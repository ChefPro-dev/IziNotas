const FUNCTIONS_BASE = 'https://us-central1-izinotas-d5202.cloudfunctions.net';

export const importarClientes = async (orgData) => {
  const res = await fetch(`${FUNCTIONS_BASE}/importarClientes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ org_id: orgData.id }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Erro ao importar clientes.');
  return data;
};

export const processarArquivos = async (orgData) => {
  const res = await fetch(`${FUNCTIONS_BASE}/processarArquivos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ org_id: orgData.id }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Erro ao processar arquivos.');
  return data;
};
