const { onCall, onRequest, HttpsError } = require('firebase-functions/v2/https');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');
const axios = require('axios');

initializeApp();
const db = getFirestore();

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const N8N_URL_IMPORTAR    = 'https://izinotas.app.n8n.cloud/webhook/importar-clientes';
const N8N_URL_SINCRONIZAR = 'https://izinotas.app.n8n.cloud/webhook/sincronizar-notas';

// ─── exchangeGoogleCode ───────────────────────────────────────────────────────
// Chamada pelo app após o usuário autorizar o Google.
// Recebe o authorization code e troca por refresh_token (persistente).

exports.exchangeGoogleCode = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Usuário não autenticado.');
  }

  const { code, org_id } = request.data;
  if (!code || !org_id) throw new HttpsError('invalid-argument', 'Parâmetros ausentes: code, org_id.');

  try {
    const params = new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: 'postmessage',
      grant_type: 'authorization_code',
    });

    const response = await axios.post(TOKEN_URL, params.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    const { refresh_token } = response.data;

    if (!refresh_token) {
      throw new Error(
        'Google não retornou refresh_token. Revogue o acesso em myaccount.google.com/permissions e tente novamente.'
      );
    }

    await db.collection('organizations').doc(org_id).update({
      drive_refresh_token: refresh_token,
      drive_connected: true,
      drive_connected_at: db.constructor.FieldValue?.serverTimestamp?.() ?? null,
    });

    return { success: true };
  } catch (err) {
    const msg = err.response?.data?.error_description || err.message;
    throw new Error('Erro ao trocar código: ' + msg);
  }
});

// ─── getAccessToken ───────────────────────────────────────────────────────────
// Chamado pelo app E pelo N8N para obter um access_token sempre fresco.
// GET https://REGION-PROJECT.cloudfunctions.net/getAccessToken?orgId=xxx

exports.getAccessToken = onRequest({ cors: true }, async (req, res) => {
  const orgId = req.query.orgId;
  if (!orgId) {
    res.status(400).json({ error: 'Parâmetro orgId é obrigatório.' });
    return;
  }

  try {
    const orgDoc = await db.collection('organizations').doc(orgId).get();
    if (!orgDoc.exists) {
      res.status(404).json({ error: 'Organização não encontrada.' });
      return;
    }

    const { drive_refresh_token } = orgDoc.data();
    if (!drive_refresh_token) {
      res.status(401).json({
        error: 'Drive não conectado. Admin deve conectar o Google Drive no app.',
      });
      return;
    }

    const params = new URLSearchParams({
      refresh_token: drive_refresh_token,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      grant_type: 'refresh_token',
    });

    const response = await axios.post(TOKEN_URL, params.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    res.json({ access_token: response.data.access_token });
  } catch (err) {
    const msg = err.response?.data?.error_description || err.message;
    res.status(500).json({ error: 'Erro ao renovar token: ' + msg });
  }
});

// ─── importarClientes (proxy N8N) ─────────────────────────────────────────────

exports.importarClientes = onRequest({ cors: true }, async (req, res) => {
  const { org_id } = req.body;
  if (!org_id) { res.status(400).json({ error: 'org_id obrigatório.' }); return; }

  try {
    const orgDoc = await db.collection('organizations').doc(org_id).get();
    if (!orgDoc.exists) { res.status(404).json({ error: 'Organização não encontrada.' }); return; }

    const org = orgDoc.data();
    const access_token = await getFreshToken(org);

    const response = await axios.post(N8N_URL_IMPORTAR, {
      access_token,
      spreadsheet_id: org.spreadsheet_id,
      folder_clientes_id: org.folder_clientes_id,
    });
    res.json(response.data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── processarArquivos (proxy N8N) ────────────────────────────────────────────

exports.processarArquivos = onRequest({ cors: true }, async (req, res) => {
  const { org_id } = req.body;
  if (!org_id) { res.status(400).json({ error: 'org_id obrigatório.' }); return; }

  try {
    const orgDoc = await db.collection('organizations').doc(org_id).get();
    if (!orgDoc.exists) { res.status(404).json({ error: 'Organização não encontrada.' }); return; }

    const org = orgDoc.data();
    const access_token = await getFreshToken(org);

    const response = await axios.post(N8N_URL_SINCRONIZAR, {
      access_token,
      spreadsheet_id: org.spreadsheet_id,
    });
    res.json(response.data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── criarUsuario (onCall) ────────────────────────────────────────────────────
// Admin cria um funcionário diretamente — sem convite por email.

exports.criarUsuario = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Não autenticado.');
  }

  const { email, password, org_id, nome } = request.data;
  if (!email || !password || !org_id) {
    throw new HttpsError('invalid-argument', 'email, password e org_id são obrigatórios.');
  }

  // Verifica se o chamador é admin da org
  const callerDoc = await db.collection('users').doc(request.auth.uid).get();
  const caller = callerDoc.data();
  if (!callerDoc.exists || caller.role !== 'admin' || caller.org_id !== org_id) {
    throw new HttpsError('permission-denied', 'Apenas admins podem criar usuários.');
  }

  try {
    // Cria o usuário no Firebase Auth
    const authPayload = { email, password };
    if (nome?.trim()) authPayload.displayName = nome.trim();
    const userRecord = await getAuth().createUser(authPayload);

    // Cria o documento no Firestore
    await db.collection('users').doc(userRecord.uid).set({
      email,
      nome: nome?.trim() || '',
      org_id,
      role: 'operador',
      created_at: FieldValue.serverTimestamp(),
    });

    return { uid: userRecord.uid };
  } catch (err) {
    if (err.code === 'auth/email-already-exists') {
      throw new HttpsError('already-exists', 'Este e-mail já está em uso.');
    }
    throw new HttpsError('internal', err.message);
  }
});

// ─── editarUsuario (onCall) ───────────────────────────────────────────────────
// Admin altera email e/ou senha de um operador da mesma org.

exports.editarUsuario = onCall({ cors: true }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Não autenticado.');

  const { uid, email, password, org_id, nome } = request.data;
  if (!uid || !org_id) throw new HttpsError('invalid-argument', 'uid e org_id são obrigatórios.');
  if (!email && !password && nome === undefined) throw new HttpsError('invalid-argument', 'Informe ao menos um campo para atualizar.');

  const callerDoc = await db.collection('users').doc(request.auth.uid).get();
  const caller = callerDoc.data();
  if (!callerDoc.exists || caller.role !== 'admin' || caller.org_id !== org_id) {
    throw new HttpsError('permission-denied', 'Apenas admins podem editar usuários.');
  }

  const targetDoc = await db.collection('users').doc(uid).get();
  if (!targetDoc.exists || targetDoc.data().org_id !== org_id) {
    throw new HttpsError('not-found', 'Usuário não encontrado nesta organização.');
  }

  const authUpdates = {};
  if (email) authUpdates.email = email;
  if (password) authUpdates.password = password;
  if (nome?.trim()) authUpdates.displayName = nome.trim();

  await getAuth().updateUser(uid, authUpdates);

  const firestoreUpdates = {};
  if (email) firestoreUpdates.email = email;
  if (nome !== undefined) firestoreUpdates.nome = nome.trim();
  if (Object.keys(firestoreUpdates).length > 0) {
    await db.collection('users').doc(uid).update(firestoreUpdates);
  }

  return { success: true };
});

// ─── excluirUsuario (onCall) ──────────────────────────────────────────────────
// Admin remove um operador da org (Auth + Firestore).

exports.excluirUsuario = onCall({ cors: true }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Não autenticado.');

  const { uid, org_id } = request.data;
  if (!uid || !org_id) throw new HttpsError('invalid-argument', 'uid e org_id são obrigatórios.');

  if (uid === request.auth.uid) {
    throw new HttpsError('invalid-argument', 'Você não pode excluir sua própria conta.');
  }

  const callerDoc = await db.collection('users').doc(request.auth.uid).get();
  const caller = callerDoc.data();
  if (!callerDoc.exists || caller.role !== 'admin' || caller.org_id !== org_id) {
    throw new HttpsError('permission-denied', 'Apenas admins podem excluir usuários.');
  }

  const targetDoc = await db.collection('users').doc(uid).get();
  if (!targetDoc.exists || targetDoc.data().org_id !== org_id) {
    throw new HttpsError('not-found', 'Usuário não encontrado nesta organização.');
  }

  await getAuth().deleteUser(uid);
  await db.collection('users').doc(uid).delete();

  return { success: true };
});

// ─── helper interno ───────────────────────────────────────────────────────────

async function getFreshToken(org) {
  const params = new URLSearchParams({
    refresh_token: org.drive_refresh_token,
    client_id: process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    grant_type: 'refresh_token',
  });
  const r = await axios.post(TOKEN_URL, params.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
  return r.data.access_token;
}
