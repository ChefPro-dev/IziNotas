import { db } from '../firebase';
import {
  doc, setDoc, getDoc, updateDoc, deleteDoc,
  collection, addDoc, query, where, getDocs,
  serverTimestamp
} from 'firebase/firestore';

// ─── Usuários ────────────────────────────────────────────────────────────────

export const createUser = async (uid, data) => {
  await setDoc(doc(db, 'users', uid), {
    ...data,
    created_at: serverTimestamp(),
  });
};

export const getUser = async (uid) => {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};

export const updateUser = async (uid, data) => {
  await updateDoc(doc(db, 'users', uid), data);
};

export const getOrgMembers = async (orgId) => {
  const q = query(collection(db, 'users'), where('org_id', '==', orgId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

// ─── Organizações ─────────────────────────────────────────────────────────────

export const createOrg = async (data) => {
  const ref = await addDoc(collection(db, 'organizations'), {
    ...data,
    drive_configured: false,
    created_at: serverTimestamp(),
  });
  return ref.id;
};

export const getOrg = async (orgId) => {
  const snap = await getDoc(doc(db, 'organizations', orgId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};

export const updateOrg = async (orgId, data) => {
  await updateDoc(doc(db, 'organizations', orgId), data);
};

// ─── Convites ─────────────────────────────────────────────────────────────────

export const createInvite = async ({ email, org_id, org_nome, invited_by_email }) => {
  const key = email.trim().toLowerCase();
  const existing = await getDoc(doc(db, 'invites', key));
  if (existing.exists() && existing.data().status === 'pending') {
    throw new Error('Já existe um convite pendente para este e-mail.');
  }
  await setDoc(doc(db, 'invites', key), {
    email: key,
    org_id,
    org_nome,
    invited_by_email,
    status: 'pending',
    created_at: serverTimestamp(),
  });
};

export const getInviteByEmail = async (email) => {
  const snap = await getDoc(doc(db, 'invites', email.trim().toLowerCase()));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};

export const acceptInvite = async (email) => {
  await updateDoc(doc(db, 'invites', email.trim().toLowerCase()), {
    status: 'accepted',
  });
};

export const deleteInvite = async (email) => {
  await deleteDoc(doc(db, 'invites', email.trim().toLowerCase()));
};

export const getOrgInvites = async (orgId) => {
  const q = query(
    collection(db, 'invites'),
    where('org_id', '==', orgId),
    where('status', '==', 'pending')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

// ─── Grupos Telegram ──────────────────────────────────────────────────────────
// Mapeia chat_id → dados do cliente (para o bot Telegram encontrar sem autenticação)

export const deleteTelegramGroup = async (chatId) => {
  await deleteDoc(doc(db, 'telegram_groups', chatId.toString()));
};

export const registerTelegramGroup = async (chatId, orgId, clienteData, spreadsheetId = '') => {
  await setDoc(doc(db, 'telegram_groups', chatId.toString()), {
    org_id: orgId,
    spreadsheet_id: spreadsheetId,
    cliente_id: clienteData.cliente_id,
    nome: clienteData.nome,
    folder_em_processamento: clienteData.folder_em_processamento,
    folder_processadas: clienteData.folder_processadas,
    folder_erro: clienteData.folder_erro,
    omie_key: clienteData.omie_key || '',
    omie_secret: clienteData.omie_secret || '',
    omie_categoria: clienteData.omie_categoria || '',
    omie_conta_corrente: clienteData.omie_conta_corrente || '',
    omie_fornecedor_generico: clienteData.omie_fornecedor_generico || '',
    updated_at: serverTimestamp(),
  });
};

// ─── Drive helpers ─────────────────────────────────────────────────────────────

export const isDriveConnected = (orgData) => orgData?.drive_connected === true;
