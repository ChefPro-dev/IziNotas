// URL base das Firebase Functions (atualizar após o deploy)
const FUNCTIONS_BASE = 'https://us-central1-izinotas-d5202.cloudfunctions.net';

// Busca um access_token sempre fresco via Firebase Function
export const getAccessToken = async (orgId) => {
  const res = await fetch(`${FUNCTIONS_BASE}/getAccessToken?orgId=${orgId}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Erro ao obter token do Google.');
  return data.access_token;
};

// ─── Google API helper ────────────────────────────────────────────────────────

const gFetch = async (url, options = {}, accessToken) => {
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Google API error ${res.status}`);
  }
  return res.json();
};

// ─── Preparar Google Drive ─────────────────────────────────────────────────────
// Cria planilha "IziNotas - Clientes" com abas formatadas + pasta "IziNotas - Clientes"

export const prepararGoogleDrive = async (accessToken) => {
  // 1. Criar planilha com duas abas
  const spreadsheet = await gFetch(
    'https://sheets.googleapis.com/v4/spreadsheets',
    {
      method: 'POST',
      body: JSON.stringify({
        properties: { title: 'clientes' },
        sheets: [
          { properties: { title: 'clientes', index: 0 } },
          { properties: { title: 'importacoes', index: 1 } },
        ],
      }),
    },
    accessToken
  );

  const spreadsheetId = spreadsheet.spreadsheetId;
  const sheet1Id = spreadsheet.sheets[0].properties.sheetId; // clientes
  const sheet2Id = spreadsheet.sheets[1].properties.sheetId; // importacoes

  // 2. Escrever cabeçalhos
  const clientesCols = [
    'cliente_id', 'nome', 'telegram_group_id',
    'folder_para_processar', 'folder_em_processamento',
    'folder_processadas', 'folder_erro',
    'omie_key', 'omie_secret', 'omie_categoria',
    'omie_conta_corrente', 'omie_fornecedor_generico',
  ];
  const importacoesCols = [
    'cliente_id', 'nome',
    'omie_key', 'omie_secret', 'omie_categoria',
    'omie_conta_corrente', 'omie_fornecedor_generico',
  ];

  await gFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/clientes!A1?valueInputOption=RAW`,
    { method: 'PUT', body: JSON.stringify({ values: [clientesCols] }) },
    accessToken
  );
  await gFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/importacoes!A1?valueInputOption=RAW`,
    { method: 'PUT', body: JSON.stringify({ values: [importacoesCols] }) },
    accessToken
  );

  // 3. Formatar: col A como texto, tudo centralizado, cabeçalho negrito, linha congelada
  const formatRequests = [sheet1Id, sheet2Id].flatMap((sheetId) => [
    // Coluna A como texto simples (preserva zeros à esquerda)
    {
      repeatCell: {
        range: { sheetId, startColumnIndex: 0, endColumnIndex: 1 },
        cell: { userEnteredFormat: { numberFormat: { type: 'TEXT', pattern: '' } } },
        fields: 'userEnteredFormat.numberFormat',
      },
    },
    // Todas as células centralizadas
    {
      repeatCell: {
        range: { sheetId },
        cell: { userEnteredFormat: { horizontalAlignment: 'CENTER' } },
        fields: 'userEnteredFormat.horizontalAlignment',
      },
    },
    // Cabeçalho negrito
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
        cell: { userEnteredFormat: { textFormat: { bold: true } } },
        fields: 'userEnteredFormat.textFormat.bold',
      },
    },
    // Congelar linha de cabeçalho
    {
      updateSheetProperties: {
        properties: { sheetId, gridProperties: { frozenRowCount: 1 } },
        fields: 'gridProperties.frozenRowCount',
      },
    },
  ]);

  await gFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
    { method: 'POST', body: JSON.stringify({ requests: formatRequests }) },
    accessToken
  );

  // 4. Criar aba processamentos
  const processamentosCols = [
    'data', 'hora', 'cliente_id', 'nome_cliente',
    'fornecedor', 'valor_total', 'status', 'descricao_erro', 'categorias',
  ];
  const addSheetRes = await gFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
    {
      method: 'POST',
      body: JSON.stringify({
        requests: [{ addSheet: { properties: { title: 'processamentos', index: 2 } } }],
      }),
    },
    accessToken
  );
  const sheet3Id = addSheetRes.replies[0].addSheet.properties.sheetId;

  await gFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/processamentos!A1?valueInputOption=RAW`,
    { method: 'PUT', body: JSON.stringify({ values: [processamentosCols] }) },
    accessToken
  );

  // Format processamentos header
  await gFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
    {
      method: 'POST',
      body: JSON.stringify({
        requests: [
          {
            repeatCell: {
              range: { sheetId: sheet3Id, startRowIndex: 0, endRowIndex: 1 },
              cell: { userEnteredFormat: { textFormat: { bold: true }, horizontalAlignment: 'CENTER' } },
              fields: 'userEnteredFormat.textFormat.bold,userEnteredFormat.horizontalAlignment',
            },
          },
          {
            updateSheetProperties: {
              properties: { sheetId: sheet3Id, gridProperties: { frozenRowCount: 1 } },
              fields: 'gridProperties.frozenRowCount',
            },
          },
        ],
      }),
    },
    accessToken
  );

  // 5. Criar pasta "Clientes" no Drive raiz
  const folder = await gFetch(
    'https://www.googleapis.com/drive/v3/files',
    {
      method: 'POST',
      body: JSON.stringify({
        name: 'Clientes',
        mimeType: 'application/vnd.google-apps.folder',
      }),
    },
    accessToken
  );

  return {
    spreadsheet_id: spreadsheetId,
    folder_clientes_id: folder.id,
  };
};

// ─── Nome da aba do mês atual ─────────────────────────────────────────────────

const getAbaProcessamentos = () => {
  const hoje = new Date();
  const arr = hoje.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }).split('/');
  // arr = ['DD', 'MM', 'YYYY']
  return `processamentos_${arr[2]}_${arr[1]}`;
};

// ─── Garantir aba processamentos do mês (cria se não existir) ────────────────

export const garantirAbaProcessamentos = async (accessToken, spreadsheetId) => {
  const nomeAba = getAbaProcessamentos();

  const meta = await gFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties`,
    { method: 'GET' },
    accessToken
  );
  // Deletar abas de processamentos com mais de 12 meses
  const limite = new Date();
  limite.setMonth(limite.getMonth() - 12);

  const velhas = (meta.sheets || []).filter(s => {
    const match = s.properties?.title?.match(/^processamentos_(\d{4})_(\d{2})$/);
    if (!match) return false;
    const dataAba = new Date(parseInt(match[1]), parseInt(match[2]) - 1, 1);
    return dataAba < limite;
  });

  if (velhas.length > 0) {
    await gFetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
      {
        method: 'POST',
        body: JSON.stringify({
          requests: velhas.map(s => ({ deleteSheet: { sheetId: s.properties.sheetId } })),
        }),
      },
      accessToken
    ).catch(() => {}); // silencioso se falhar
  }

  const existe = meta.sheets?.some(s => s.properties?.title === nomeAba);
  if (existe) return;

  const addRes = await gFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
    {
      method: 'POST',
      body: JSON.stringify({
        requests: [{ addSheet: { properties: { title: nomeAba } } }],
      }),
    },
    accessToken
  );
  const sheetId = addRes.replies[0].addSheet.properties.sheetId;

  const range = encodeURIComponent(`${nomeAba}!A1`);
  await gFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?valueInputOption=RAW`,
    {
      method: 'PUT',
      body: JSON.stringify({ values: [['data', 'hora', 'cliente_id', 'nome_cliente', 'fornecedor', 'valor_total', 'status', 'descricao_erro', 'categorias']] }),
    },
    accessToken
  );

  await gFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
    {
      method: 'POST',
      body: JSON.stringify({
        requests: [
          {
            repeatCell: {
              range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
              cell: { userEnteredFormat: { textFormat: { bold: true }, horizontalAlignment: 'CENTER' } },
              fields: 'userEnteredFormat.textFormat.bold,userEnteredFormat.horizontalAlignment',
            },
          },
          {
            updateSheetProperties: {
              properties: { sheetId, gridProperties: { frozenRowCount: 1 } },
              fields: 'gridProperties.frozenRowCount',
            },
          },
        ],
      }),
    },
    accessToken
  );
};

// ─── Buscar processamentos por intervalo de datas ────────────────────────────

export const buscarProcessamentosRange = async (accessToken, spreadsheetId, startDate, endDate) => {
  const toIso = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  };
  const startIso = toIso(startDate);
  const endIso = toIso(endDate);

  // Gerar lista de abas mensais no intervalo
  const meses = [];
  const cur = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  const fim = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
  while (cur <= fim) {
    const ano = cur.getFullYear();
    const mes = String(cur.getMonth() + 1).padStart(2, '0');
    meses.push(`processamentos_${ano}_${mes}`);
    cur.setMonth(cur.getMonth() + 1);
  }

  const todasLinhas = [];
  await Promise.all(meses.map(async (nomeAba) => {
    try {
      const range = encodeURIComponent(`${nomeAba}!A:I`);
      const data = await gFetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`,
        { method: 'GET' },
        accessToken
      );
      if (!data.values || data.values.length < 2) return;
      const [, ...rows] = data.values;
      rows.forEach((row, idx) => {
        const dataRow = row[0] || '';
        if (dataRow >= startIso && dataRow <= endIso) {
          // _sheetRowIndex: índice 0-based na planilha incluindo cabeçalho (idx+1)
          // usado no batchUpdate deleteDimension e no range de update
          const rowWithMeta = [...row];
          rowWithMeta._sheetName = nomeAba;
          rowWithMeta._sheetRowIndex = idx + 1;
          todasLinhas.push(rowWithMeta);
        }
      });
    } catch (_) { /* aba pode não existir */ }
  }));

  todasLinhas.sort((a, b) => `${b[0]}${b[1]}`.localeCompare(`${a[0]}${a[1]}`));
  return todasLinhas;
};

// ─── Editar linha de processamento ───────────────────────────────────────────

export const editarProcessamento = async (accessToken, spreadsheetId, row, dados) => {
  const sheetRow1Based = row._sheetRowIndex + 1; // +1 porque índice inclui header
  const range = encodeURIComponent(`${row._sheetName}!A${sheetRow1Based}:I${sheetRow1Based}`);
  const updatedRow = row.slice(0, 9).map((v, i) => v ?? '');
  if (dados.fornecedor     !== undefined) updatedRow[4] = dados.fornecedor;
  if (dados.valor_total    !== undefined) updatedRow[5] = dados.valor_total;
  if (dados.status         !== undefined) updatedRow[6] = dados.status;
  if (dados.descricao_erro !== undefined) updatedRow[7] = dados.descricao_erro;
  if (dados.categorias     !== undefined) updatedRow[8] = dados.categorias;
  await gFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?valueInputOption=RAW`,
    { method: 'PUT', body: JSON.stringify({ values: [updatedRow] }) },
    accessToken
  );
};

// ─── Deletar linha de processamento ──────────────────────────────────────────

export const deletarProcessamento = async (accessToken, spreadsheetId, row) => {
  const meta = await gFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties`,
    { method: 'GET' },
    accessToken
  );
  const sheet = meta.sheets?.find(s => s.properties?.title === row._sheetName);
  if (!sheet) throw new Error('Aba não encontrada: ' + row._sheetName);
  await gFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
    {
      method: 'POST',
      body: JSON.stringify({
        requests: [{
          deleteDimension: {
            range: {
              sheetId: sheet.properties.sheetId,
              dimension: 'ROWS',
              startIndex: row._sheetRowIndex,
              endIndex: row._sheetRowIndex + 1,
            },
          },
        }],
      }),
    },
    accessToken
  );
};

// ─── Buscar processamentos do dia ─────────────────────────────────────────────

export const buscarProcessamentosHoje = async (accessToken, spreadsheetId) => {
  await garantirAbaProcessamentos(accessToken, spreadsheetId);

  const nomeAba = getAbaProcessamentos();
  const range = encodeURIComponent(`${nomeAba}!A:I`);
  const data = await gFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`,
    { method: 'GET' },
    accessToken
  );
  if (!data.values || data.values.length < 2) {
    return { processadas: 0, erros: 0, valorTotal: 0, categorias: {} };
  }

  const hoje = new Date();
  const hojeArr = hoje.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }).split('/');
  const hojeIso = `${hojeArr[2]}-${hojeArr[1]}-${hojeArr[0]}`;

  const [, ...rows] = data.values;
  const deHoje = rows.filter(r => r[0] === hojeIso);

  let processadas = 0;
  let erros = 0;
  let valorTotal = 0;
  const categorias = {};

  for (const row of deHoje) {
    const status = row[6] || '';
    const valor = parseFloat(row[5]) || 0;

    if (status === 'processada') {
      processadas++;
      valorTotal += valor;
      try {
        const cats = JSON.parse(row[8] || '{}');
        for (const [cat, val] of Object.entries(cats)) {
          categorias[cat] = (categorias[cat] || 0) + (parseFloat(val) || 0);
        }
      } catch (_) {}
    } else if (status === 'erro') {
      erros++;
    }
  }

  return { processadas, erros, valorTotal, categorias };
};

// ─── Deletar Cliente (pastas no Drive + linha na planilha) ───────────────────

export const deletarCliente = async (accessToken, spreadsheetId, rowIndex, cliente) => {
  // 1. Excluir as pastas do Drive — ignora 404 (pasta já apagada)
  const folderIds = [
    cliente.folder_para_processar,
    cliente.folder_em_processamento,
    cliente.folder_processadas,
    cliente.folder_erro,
  ].filter(Boolean);

  await Promise.all(
    folderIds.map((folderId) =>
      fetch(`https://www.googleapis.com/drive/v3/files/${folderId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      }).then(res => {
        // 404 = pasta já não existe; qualquer outro erro lança exceção
        if (!res.ok && res.status !== 404) {
          throw new Error(`Drive error ${res.status} ao excluir pasta ${folderId}`);
        }
      })
    )
  );

  // 2. Buscar o sheetId real da aba "clientes" (evita hardcode de 0)
  const meta = await gFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties`,
    { method: 'GET' },
    accessToken
  );
  const sheetId = meta.sheets?.find(s => s.properties?.title === 'clientes')?.properties?.sheetId ?? 0;

  // 3. Remover a linha da planilha
  await gFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
    {
      method: 'POST',
      body: JSON.stringify({
        requests: [{
          deleteDimension: {
            range: {
              sheetId,
              dimension: 'ROWS',
              startIndex: rowIndex + 1,
              endIndex: rowIndex + 2,
            },
          },
        }],
      }),
    },
    accessToken
  );
};

// ─── Renomear pastas do cliente no Drive ──────────────────────────────────────

export const renomearPastasCliente = async (accessToken, nomeAntigo, nomeNovo, folders) => {
  const pastas = [
    { id: folders.folder_para_processar, sufixo: 'Para Processar' },
    { id: folders.folder_em_processamento, sufixo: 'Em Processamento' },
    { id: folders.folder_processadas, sufixo: 'Processadas' },
    { id: folders.folder_erro, sufixo: 'Erros' },
  ].filter(p => p.id);

  await Promise.all(
    pastas.map(pasta =>
      gFetch(
        `https://www.googleapis.com/drive/v3/files/${pasta.id}`,
        { method: 'PATCH', body: JSON.stringify({ name: `${nomeNovo} - ${pasta.sufixo}` }) },
        accessToken
      ).catch(() => {}) // ignora se pasta não existir
    )
  );
};

// ─── Editar Cliente (atualiza linha na planilha) ──────────────────────────────

export const editarCliente = async (accessToken, spreadsheetId, rowIndex, dados) => {
  // rowIndex é 0-based (índice no array de clientes); +2 para compensar header e base-1
  const sheetRow = rowIndex + 2;
  const row = [
    dados.cliente_id,
    dados.nome,
    dados.telegram_group_id || '',
    dados.folder_para_processar || '',
    dados.folder_em_processamento || '',
    dados.folder_processadas || '',
    dados.folder_erro || '',
    dados.omie_key || '',
    dados.omie_secret || '',
    dados.omie_categoria || '',
    dados.omie_conta_corrente || '',
    dados.omie_fornecedor_generico || '',
  ];
  const range = encodeURIComponent(`clientes!A${sheetRow}:L${sheetRow}`);
  await gFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?valueInputOption=RAW`,
    { method: 'PUT', body: JSON.stringify({ values: [row] }) },
    accessToken
  );
};

// ─── Buscar Clientes ──────────────────────────────────────────────────────────

export const buscarClientes = async (accessToken, spreadsheetId) => {
  const range = encodeURIComponent('clientes!A:L');
  const data = await gFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`,
    { method: 'GET' },
    accessToken
  );
  if (!data.values || data.values.length < 2) return [];
  const [headers, ...rows] = data.values;
  return rows.map((row) =>
    Object.fromEntries(headers.map((h, i) => [h, row[i] ?? '']))
  );
};

// ─── Criar Cliente (pastas + linha na planilha) ───────────────────────────────

const criarPasta = async (accessToken, nome, parentId) => {
  return gFetch(
    'https://www.googleapis.com/drive/v3/files',
    {
      method: 'POST',
      body: JSON.stringify({
        name: nome,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentId],
      }),
    },
    accessToken
  );
};

export const criarCliente = async (accessToken, spreadsheetId, folderClientesId, dados) => {
  const { nome } = dados;

  // Criar as 4 subpastas do cliente dentro de "IziNotas - Clientes"
  const [paraProcessar, emProcessamento, processadas, erros] = await Promise.all([
    criarPasta(accessToken, `${nome} - Para Processar`, folderClientesId),
    criarPasta(accessToken, `${nome} - Em Processamento`, folderClientesId),
    criarPasta(accessToken, `${nome} - Processadas`, folderClientesId),
    criarPasta(accessToken, `${nome} - Erros`, folderClientesId),
  ]);

  // Montar linha para a planilha
  const row = [
    dados.cliente_id,
    dados.nome,
    dados.telegram_group_id || '',
    paraProcessar.id,
    emProcessamento.id,
    processadas.id,
    erros.id,
    dados.omie_key || '',
    dados.omie_secret || '',
    dados.omie_categoria || '',
    dados.omie_conta_corrente || '',
    dados.omie_fornecedor_generico || '',
  ];

  const range = encodeURIComponent('clientes!A:L');
  await gFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    { method: 'POST', body: JSON.stringify({ values: [row] }) },
    accessToken
  );

  return {
    folder_para_processar: paraProcessar.id,
    folder_em_processamento: emProcessamento.id,
    folder_processadas: processadas.id,
    folder_erro: erros.id,
  };
};
