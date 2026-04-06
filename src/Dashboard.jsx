import { useState, useEffect } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';
import {
  isDriveConnected, updateOrg,
  getOrgMembers,
  registerTelegramGroup, deleteTelegramGroup,
} from './services/firestore';
import { prepararGoogleDrive, buscarClientes, criarCliente, editarCliente, deletarCliente, renomearPastasCliente, getAccessToken, buscarProcessamentosHoje, buscarProcessamentosRange, editarProcessamento, deletarProcessamento } from './services/google';
import ReactDatePicker, { registerLocale } from 'react-datepicker';
import { ptBR } from 'date-fns/locale/pt-BR';
import 'react-datepicker/dist/react-datepicker.css';
import './datepicker-dark.css';
registerLocale('pt-BR', ptBR);
import { importarClientes, processarArquivos } from './services/n8n';
import BaseModal from './components/BaseModal';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import {
  FolderSync, RefreshCw, Plus, Users,
  Loader, ExternalLink,
  HardDriveUpload, FileSpreadsheet, Wifi, WifiOff, Pencil, Trash2, Settings, Search, AlertTriangle, FolderOpen,
  TrendingUp, AlertCircle, DollarSign,
} from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from 'recharts';

// ─── Skeletons ────────────────────────────────────────────────────────────────
function SkeletonStatCard() {
  return (
    <div className="relative overflow-hidden bg-gray-200 dark:bg-gray-700/50 rounded-xl lg:rounded-2xl shadow-lg h-32 lg:h-36 animate-pulse" />
  );
}

function SkeletonChartBox() {
  return (
    <div className="bg-gray-200 dark:bg-gray-800 rounded-xl md:rounded-2xl border border-orange-400 dark:border-gray-700 p-4 md:p-5 animate-pulse">
      <div className="h-5 bg-gray-300 dark:bg-gray-700 rounded w-1/3 mb-4" />
      <div className="h-[260px] md:h-[300px] flex items-center justify-center">
        <div className="w-40 h-40 rounded-full bg-gray-300 dark:bg-gray-700" />
      </div>
    </div>
  );
}

function SkeletonTableRow({ cols = 6 }) {
  const widths = ['w-12', 'w-32', 'w-20', 'w-16', 'w-24', 'w-16'];
  return (
    <tr className="border-b border-orange-300 dark:border-gray-700/50">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="py-3.5 px-4">
          <div className={`h-3.5 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mx-auto ${widths[i % widths.length]}`} />
        </td>
      ))}
    </tr>
  );
}

function SkeletonMemberRow() {
  return (
    <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-900/30 rounded-xl animate-pulse">
      <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 shrink-0" />
      <div className="flex-1 h-3.5 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
      <div className="h-5 w-14 bg-gray-200 dark:bg-gray-700 rounded-full" />
    </div>
  );
}

// ─── Animation variants ───────────────────────────────────────────────────────
const gridVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { when: 'beforeChildren', staggerChildren: 0.08, delayChildren: 0.05 } },
};
const cardVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.98 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.4, ease: 'easeOut' } },
};

// ─── Stat Card — IziCheck style ───────────────────────────────────────────────
function StatCard({ iconPath, iconFill, label, value, sub, gradient, index }) {
  return (
    <motion.div
      variants={cardVariants}
      whileHover={{ scale: 1.03 }}
      className={`relative overflow-hidden ${gradient} rounded-xl lg:rounded-2xl shadow-lg p-4 lg:p-5 text-white h-32 lg:h-36`}
    >
      {/* Large background icon */}
      <svg
        className="absolute -right-3 -bottom-3 w-20 h-20 lg:-right-4 lg:-bottom-4 lg:w-28 lg:h-28 text-white opacity-20 group-hover:scale-110 transition-transform duration-500"
        fill={iconFill ? 'currentColor' : 'none'}
        viewBox="0 0 24 24"
        strokeWidth={iconFill ? undefined : 1.5}
        stroke={iconFill ? undefined : 'currentColor'}
      >
        <path strokeLinecap={iconFill ? undefined : 'round'} strokeLinejoin={iconFill ? undefined : 'round'} d={iconPath} />
      </svg>
      <div className="relative z-10 flex flex-col h-full justify-between">
        <h2 className="text-sm lg:text-base font-medium opacity-90 leading-tight">{label}</h2>
        <div>
          <p className="text-3xl lg:text-4xl font-black tracking-tighter leading-none mb-0.5">{value}</p>
          {sub && <p className="text-[11px] lg:text-xs opacity-80">{sub}</p>}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Custom Pie Tooltip ───────────────────────────────────────────────────────
const CustomPieTooltip = ({ active, payload, valuePrefix = '' }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-gray-200 dark:bg-gray-800 p-2.5 rounded-xl shadow-xl border border-orange-400 dark:border-gray-700">
        <div className="flex items-center gap-2 text-sm">
          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: payload[0].payload.fill || payload[0].fill }} />
          <span className="text-gray-600 dark:text-gray-300">{payload[0].name}</span>
          <span className="font-bold text-gray-900 dark:text-white">{valuePrefix}{payload[0].value}</span>
        </div>
      </div>
    );
  }
  return null;
};

// ─── Field ────────────────────────────────────────────────────────────────────
function Field({ label, name, value, onChange, placeholder, required, type = 'text' }) {
  return (
    <div>
      <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">{label}</label>
      <input
        type={type} name={name} value={value} onChange={onChange}
        placeholder={placeholder} required={required}
        className="input-style"
      />
    </div>
  );
}

// ─── Status Pill (Ativo / Inativo) ────────────────────────────────────────────
function StatusPill({ ativo }) {
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full border ${
      ativo
        ? 'bg-green-500/20 text-green-700 border-green-400 dark:bg-green-500/10 dark:text-green-400 dark:border-green-500/20'
        : 'bg-gray-200 text-gray-500 border-gray-300 dark:bg-gray-700/50 dark:text-gray-400 dark:border-gray-600/30'
    }`}>
      <span className={`w-1.5 h-1.5 rounded-full ${ativo ? 'bg-green-500' : 'bg-gray-400'}`} />
      {ativo ? 'Ativo' : 'Inativo'}
    </span>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
export default function Dashboard({ authUser, userData, orgData, refreshOrgData, activeSection, setActiveSection, connectGoogle }) {
  const isAdmin = userData?.role === 'admin';
  const driveOk = isDriveConnected(orgData);
  const driveConfigurado = orgData?.drive_configured;

  const [clientes, setClientes] = useState([]);
  const [loadingClientes, setLoadingClientes] = useState(false);

  const [modal, setModal] = useState(null); // 'novo_cliente' | 'importar' | 'editar' | 'deletar'
  const [processando, setProcessando] = useState('');

  const [formCliente, setFormCliente] = useState({
    cliente_id: '', nome: '', telegram_group_id: '',
    omie_key: '', omie_secret: '', omie_categoria: '',
    omie_conta_corrente: '', omie_fornecedor_generico: '',
  });

  const [clienteEditando, setClienteEditando] = useState(null);
  const [clienteDeletando, setClienteDeletando] = useState(null);
  const [filtroClientes, setFiltroClientes] = useState('');
  const [clientePastas, setClientePastas] = useState(null);

  const [processamentosHoje, setProcessamentosHoje] = useState(null);
  const [loadingProcessamentos, setLoadingProcessamentos] = useState(false);

  const [filtroPeriodoProc, setFiltroPeriodoProc] = useState('7dias');
  const [dateRangeProc, setDateRangeProc] = useState([null, null]);
  const [filtroCliente, setFiltroCliente] = useState('Todos');
  const [listaProcessamentos, setListaProcessamentos] = useState([]);
  const [loadingLista, setLoadingLista] = useState(false);

  const [paginaClientes, setPaginaClientes] = useState(1);
  const [paginaProc, setPaginaProc] = useState(1);

  const [procEditando, setProcEditando] = useState(null);
  const [procDeletando, setProcDeletando] = useState(null);
  const [formProcEdit, setFormProcEdit] = useState({ fornecedor: '', valor_total: '', status: 'processada', descricao_erro: '' });

  const [membros, setMembros] = useState([]);
  const [loadingEquipe, setLoadingEquipe] = useState(false);
  const [membroEditando, setMembroEditando] = useState(null);
  const [membroDeletando, setMembroDeletando] = useState(null);
  const [formEquipe, setFormEquipe] = useState({ nome: '', email: '', password: '', confirmPassword: '' });
  const [formEditar, setFormEditar] = useState({ nome: '', email: '', password: '', confirmPassword: '' });

  const carregarClientes = async () => {
    if (!driveOk || !orgData?.spreadsheet_id) return;
    setLoadingClientes(true);
    try {
      const accessToken = await getAccessToken(orgData.id);
      const dados = await buscarClientes(accessToken, orgData.spreadsheet_id);
      setClientes(dados);
    } catch (err) {
      toast.error('Erro ao carregar clientes: ' + err.message);
    }
    setLoadingClientes(false);
  };

  useEffect(() => {
    if (driveOk && driveConfigurado) carregarClientes();
  }, [orgData?.drive_connected, orgData?.spreadsheet_id]);

  const carregarProcessamentos = async () => {
    if (!driveOk || !orgData?.spreadsheet_id) return;
    setLoadingProcessamentos(true);
    try {
      const accessToken = await getAccessToken(orgData.id);
      const dados = await buscarProcessamentosHoje(accessToken, orgData.spreadsheet_id);
      setProcessamentosHoje(dados);
    } catch (err) {
      // silently fail — dashboard still works without processamentos
      setProcessamentosHoje({ processadas: 0, erros: 0, valorTotal: 0, categorias: {} });
    }
    setLoadingProcessamentos(false);
  };

  useEffect(() => {
    if (driveOk && driveConfigurado) carregarProcessamentos();
  }, [orgData?.spreadsheet_id, driveOk, driveConfigurado]);

  const getDateRangeProc = () => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const end = new Date(); end.setHours(23, 59, 59, 999);
    if (filtroPeriodoProc === 'hoje') return { start: hoje, end };
    if (filtroPeriodoProc === '7dias') { const s = new Date(hoje); s.setDate(s.getDate() - 6); return { start: s, end }; }
    if (filtroPeriodoProc === '15dias') { const s = new Date(hoje); s.setDate(s.getDate() - 14); return { start: s, end }; }
    if (filtroPeriodoProc === '30dias') { const s = new Date(hoje); s.setDate(s.getDate() - 29); return { start: s, end }; }
    if (filtroPeriodoProc === 'periodo' && dateRangeProc[0] && dateRangeProc[1]) {
      const s = new Date(dateRangeProc[0]); s.setHours(0, 0, 0, 0);
      const e = new Date(dateRangeProc[1]); e.setHours(23, 59, 59, 999);
      return { start: s, end: e };
    }
    return null;
  };

  const carregarLista = async () => {
    if (!driveOk || !orgData?.spreadsheet_id) return;
    const range = getDateRangeProc();
    if (!range) return;
    setLoadingLista(true);
    try {
      const accessToken = await getAccessToken(orgData.id);
      const rows = await buscarProcessamentosRange(accessToken, orgData.spreadsheet_id, range.start, range.end);
      setListaProcessamentos(rows);
    } catch (err) {
      toast.error('Erro ao carregar processamentos: ' + err.message);
    }
    setLoadingLista(false);
  };

  useEffect(() => {
    if (activeSection !== 'processamentos') return;
    if (filtroPeriodoProc === 'periodo' && (!dateRangeProc[0] || !dateRangeProc[1])) return;
    setPaginaProc(1);
    carregarLista();
  }, [activeSection, filtroPeriodoProc, dateRangeProc]);

  useEffect(() => { setPaginaProc(1); }, [filtroCliente]);
  useEffect(() => { setPaginaClientes(1); }, [filtroClientes]);

  // Switch to Clientes section when drive is configured
  useEffect(() => {
    if (driveConfigurado && activeSection === 'dashboard') {
      // stay on dashboard — clientes tab will show the table
    }
  }, [driveConfigurado]);

  const abrirEquipe = async () => {
    setLoadingEquipe(true);
    try {
      const m = await getOrgMembers(orgData.id);
      setMembros(m);
    } catch (err) {
      toast.error(err.message);
    }
    setLoadingEquipe(false);
  };

  useEffect(() => {
    if (activeSection === 'equipe' && isAdmin) abrirEquipe();
  }, [activeSection]);

  // ─── Actions ─────────────────────────────────────────────────────────────────
  const handlePrepararDrive = async () => {
    if (!driveOk) { toast.error('Conecte o Google Drive primeiro.'); return; }
    setProcessando('preparar');
    try {
      const accessToken = await getAccessToken(orgData.id);
      const { spreadsheet_id, folder_clientes_id } = await prepararGoogleDrive(accessToken);
      await updateOrg(orgData.id, { spreadsheet_id, folder_clientes_id, drive_configured: true });
      await refreshOrgData();
      toast.success('Google Drive preparado com sucesso!');
    } catch (err) {
      toast.error('Erro ao preparar Drive: ' + err.message);
    }
    setProcessando('');
  };

  const handleNovoCliente = async (e) => {
    e.preventDefault();
    setProcessando('novo_cliente');
    try {
      const accessToken = await getAccessToken(orgData.id);
      const folders = await criarCliente(accessToken, orgData.spreadsheet_id, orgData.folder_clientes_id, formCliente);

      if (formCliente.telegram_group_id?.trim()) {
        await registerTelegramGroup(formCliente.telegram_group_id.trim(), orgData.id, {
          ...formCliente,
          folder_em_processamento: folders.folder_em_processamento,
          folder_processadas: folders.folder_processadas,
          folder_erro: folders.folder_erro,
        }, orgData.spreadsheet_id || '');
      }

      toast.success(`Cliente "${formCliente.nome}" criado com sucesso!`);
      setModal(null);
      setFormCliente({ cliente_id: '', nome: '', telegram_group_id: '', omie_key: '', omie_secret: '', omie_categoria: '', omie_conta_corrente: '', omie_fornecedor_generico: '' });
      await carregarClientes();
    } catch (err) {
      toast.error('Erro ao criar cliente: ' + err.message);
    }
    setProcessando('');
  };

  const handleImportar = async () => {
    setProcessando('importar');
    try {
      await importarClientes(orgData);
      toast.success('Importação iniciada! Processando notas em segundo plano.');
    } catch (err) {
      toast.error('Erro ao importar: ' + err.message);
    }
    setProcessando('');
  };

  const handleProcessar = async () => {
    setProcessando('processar');
    try {
      await processarArquivos(orgData);
      toast.success('Processamento iniciado! Buscando arquivos nas pastas dos clientes.');
    } catch (err) {
      toast.error('Erro ao processar: ' + err.message);
    }
    setProcessando('');
  };

  const handleDeletarCliente = async () => {
    if (!clienteDeletando) return;
    setProcessando('deletar');
    try {
      const accessToken = await getAccessToken(orgData.id);
      await deletarCliente(accessToken, orgData.spreadsheet_id, clienteDeletando._rowIndex, clienteDeletando);
      if (clienteDeletando.telegram_group_id?.trim()) {
        await deleteTelegramGroup(clienteDeletando.telegram_group_id.trim());
      }
      toast.success(`Cliente "${clienteDeletando.nome}" excluído.`);
      setModal(null);
      setClienteDeletando(null);
      await carregarClientes();
    } catch (err) {
      toast.error('Erro ao excluir cliente: ' + err.message);
    }
    setProcessando('');
  };

  const handleSalvarEdicao = async (e) => {
    e.preventDefault();
    setProcessando('editar');
    try {
      const accessToken = await getAccessToken(orgData.id);
      const { _rowIndex, _originalTelegramId, _originalNome, ...dados } = clienteEditando;
      await editarCliente(accessToken, orgData.spreadsheet_id, _rowIndex, dados);

      // Renomear pastas no Drive se o nome mudou
      if (_originalNome && dados.nome !== _originalNome) {
        await renomearPastasCliente(accessToken, _originalNome, dados.nome, dados);
      }

      const novoId = dados.telegram_group_id?.trim() || '';
      const antigoId = _originalTelegramId?.trim() || '';

      if (antigoId && antigoId !== novoId) await deleteTelegramGroup(antigoId);
      if (novoId) await registerTelegramGroup(novoId, orgData.id, dados, orgData.spreadsheet_id || '');

      toast.success(`Cliente "${dados.nome}" atualizado!`);
      setModal(null);
      setClienteEditando(null);
      await carregarClientes();
    } catch (err) {
      toast.error('Erro ao salvar: ' + err.message);
    }
    setProcessando('');
  };

  const handleEditarProcessamento = async (e) => {
    e.preventDefault();
    if (!procEditando) return;
    setProcessando('editar_proc');
    try {
      const accessToken = await getAccessToken(orgData.id);
      await editarProcessamento(accessToken, orgData.spreadsheet_id, procEditando, formProcEdit);
      toast.success('Processamento atualizado!');
      setModal(null);
      setProcEditando(null);
      await carregarLista();
    } catch (err) {
      toast.error('Erro ao editar processamento: ' + err.message);
    }
    setProcessando('');
  };

  const handleDeletarProcessamento = async () => {
    if (!procDeletando) return;
    setProcessando('deletar_proc');
    try {
      const accessToken = await getAccessToken(orgData.id);
      await deletarProcessamento(accessToken, orgData.spreadsheet_id, procDeletando);
      toast.success('Processamento excluído.');
      setModal(null);
      setProcDeletando(null);
      await carregarLista();
    } catch (err) {
      toast.error('Erro ao excluir processamento: ' + err.message);
    }
    setProcessando('');
  };

  const handleCriarUsuario = async (e) => {
    e.preventDefault();
    if (!formEquipe.email.trim() || !formEquipe.password.trim()) return;
    if (formEquipe.password !== formEquipe.confirmPassword) {
      toast.error('As senhas não coincidem.');
      return;
    }
    if (formEquipe.password.length < 6) {
      toast.error('A senha deve ter pelo menos 6 caracteres.');
      return;
    }
    setProcessando('criar_usuario');
    try {
      const criarUsuario = httpsCallable(functions, 'criarUsuario');
      await criarUsuario({ email: formEquipe.email.trim(), password: formEquipe.password, org_id: orgData.id, nome: formEquipe.nome.trim() });
      toast.success(`Usuário ${formEquipe.nome.trim() || formEquipe.email} criado com sucesso!`);
      setModal(null);
      setFormEquipe({ nome: '', email: '', password: '', confirmPassword: '' });
      const m = await getOrgMembers(orgData.id);
      setMembros(m);
    } catch (err) {
      toast.error('Erro ao criar usuário: ' + err.message);
    }
    setProcessando('');
  };

  const handleEditarMembro = async (e) => {
    e.preventDefault();
    if (!membroEditando) return;
    if (!formEditar.nome.trim() && !formEditar.email.trim() && !formEditar.password.trim()) return;
    if (formEditar.password.trim() && formEditar.password !== formEditar.confirmPassword) {
      toast.error('As senhas não coincidem.');
      return;
    }
    if (formEditar.password.trim() && formEditar.password.length < 6) {
      toast.error('A senha deve ter pelo menos 6 caracteres.');
      return;
    }
    setProcessando('editar_membro');
    try {
      const editarUsuario = httpsCallable(functions, 'editarUsuario');
      await editarUsuario({
        uid: membroEditando.id,
        org_id: orgData.id,
        ...(formEditar.nome.trim() ? { nome: formEditar.nome.trim() } : {}),
        ...(formEditar.email.trim() ? { email: formEditar.email.trim() } : {}),
        ...(formEditar.password.trim() ? { password: formEditar.password } : {}),
      });
      toast.success('Usuário atualizado com sucesso!');
      setModal(null);
      setMembroEditando(null);
      const m = await getOrgMembers(orgData.id);
      setMembros(m);
    } catch (err) {
      toast.error('Erro ao editar usuário: ' + err.message);
    }
    setProcessando('');
  };

  const handleExcluirMembro = async () => {
    if (!membroDeletando) return;
    setProcessando('excluir_membro');
    try {
      const excluirUsuario = httpsCallable(functions, 'excluirUsuario');
      await excluirUsuario({ uid: membroDeletando.id, org_id: orgData.id });
      toast.success(`Usuário "${membroDeletando.email}" excluído.`);
      setModal(null);
      setMembroDeletando(null);
      const m = await getOrgMembers(orgData.id);
      setMembros(m);
    } catch (err) {
      toast.error('Erro ao excluir usuário: ' + err.message);
    }
    setProcessando('');
  };

  // ─── Section: Dashboard ───────────────────────────────────────────────────────
  const renderDashboard = () => (
    <div className="flex flex-col gap-6">
      {/* Page title */}
      <div>
        <h1 className="text-2xl font-black text-gray-900 dark:text-white">Dashboard</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{orgData?.nome}</p>
      </div>

      {/* Drive status banner (admin only) */}
      {isAdmin && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className={`rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center gap-4 border ${driveOk ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800/30' : 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800/30'}`}
        >
          <div className="flex items-center gap-3 flex-1">
            {driveOk
              ? <Wifi className="text-green-500 shrink-0" size={22} />
              : <WifiOff className="text-amber-500 shrink-0" size={22} />
            }
            <div>
              <p className={`font-bold text-sm ${driveOk ? 'text-green-700 dark:text-green-400' : 'text-amber-700 dark:text-amber-400'}`}>
                {driveOk ? 'Google Drive conectado' : 'Google Drive não conectado'}
              </p>
              <p className={`text-xs ${driveOk ? 'text-green-600 dark:text-green-500' : 'text-amber-600 dark:text-amber-500'}`}>
                {driveOk ? '' : 'Conecte para habilitar todas as funcionalidades'}
              </p>
            </div>
          </div>
          <button
            onClick={connectGoogle}
            className={`text-sm font-bold px-4 py-2 rounded-xl cursor-pointer transition-all ${driveOk ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50' : 'bg-amber-500 dark:bg-amber-600 text-white hover:bg-amber-600 dark:hover:bg-amber-700'}`}
          >
            {driveOk ? 'Reconectar' : 'Conectar Google Drive'}
          </button>
        </motion.div>
      )}

      {!isAdmin && !driveOk && (
        <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30 rounded-2xl p-4 flex items-center gap-3">
          <WifiOff className="text-amber-500 shrink-0" size={22} />
          <p className="text-amber-700 dark:text-amber-400 text-sm">Aguardando o admin conectar o Google Drive da organização.</p>
        </div>
      )}

      {/* Setup: Preparar Drive */}
      {isAdmin && driveOk && !driveConfigurado && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-gray-800/60 border-2 border-dashed border-orange-300 dark:border-cyan-700/50 rounded-2xl p-8 text-center"
        >
          <div className="w-16 h-16 bg-gradient-to-br from-orange-400 to-orange-600 dark:from-cyan-600 dark:to-cyan-800 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <HardDriveUpload className="text-white" size={28} />
          </div>
          <h2 className="font-black text-gray-900 dark:text-white text-lg mb-2">Configure seu Google Drive</h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm mb-6 max-w-sm mx-auto">
            Isso vai criar a planilha de clientes e a pasta de arquivos no seu Drive.
          </p>
          <button
            onClick={handlePrepararDrive}
            disabled={processando === 'preparar'}
            className="bg-orange-500 hover:bg-orange-600 dark:bg-cyan-600 dark:hover:bg-cyan-500 text-white font-bold px-8 py-3 rounded-xl shadow-lg shadow-orange-500/30 dark:shadow-cyan-600/20 transition-all hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:transform-none cursor-pointer flex items-center gap-2 mx-auto"
          >
            {processando === 'preparar'
              ? <><Loader size={18} className="animate-spin" /> Preparando...</>
              : <><Settings size={18} /> Preparar Google Drive</>
            }
          </button>
        </motion.div>
      )}

      {/* Stats cards */}
      {driveConfigurado && (
        <>
          {loadingProcessamentos ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
              <SkeletonStatCard /><SkeletonStatCard /><SkeletonStatCard /><SkeletonStatCard />
            </div>
          ) : (
          <motion.div
            className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4"
            variants={gridVariants}
            initial="hidden"
            animate="visible"
          >
            <StatCard
              label="Processadas Hoje"
              value={loadingProcessamentos ? '...' : (processamentosHoje?.processadas ?? '—')}
              sub="cupons/notas processadas"
              gradient="bg-gradient-to-br from-emerald-400 to-green-600"
              iconPath="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
            />
            <StatCard
              label="Erros Hoje"
              value={loadingProcessamentos ? '...' : (processamentosHoje?.erros ?? '—')}
              sub="cupons/notas com erro"
              gradient="bg-gradient-to-br from-orange-500 to-red-600"
              iconPath="M12 9v2.25m0 2.625h.008v.008H12v-.008ZM21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
            />
            <StatCard
              label="Valor Hoje"
              value={loadingProcessamentos ? '...' : processamentosHoje ? `R$ ${processamentosHoje.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
              sub="total processado"
              gradient="bg-gradient-to-br from-indigo-500 to-purple-600"
              iconPath="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
            />
            <StatCard
              label="Clientes"
              value={clientes.length}
              sub="cadastrados"
              gradient="bg-gradient-to-br from-blue-600 to-cyan-500"
              iconFill
              iconPath="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z"
            />
          </motion.div>
          )}

          {/* Charts */}
          {loadingProcessamentos ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              <SkeletonChartBox /><SkeletonChartBox />
            </div>
          ) : processamentosHoje && (() => {
            const temCats = Object.keys(processamentosHoje.categorias).length > 0;
            const total = (processamentosHoje.processadas ?? 0) + (processamentosHoje.erros ?? 0);
            const PIE_COLORS = ['#f97316','#06b6d4','#8b5cf6','#10b981','#f43f5e','#eab308','#3b82f6','#ec4899'];

            const dadosCats = Object.entries(processamentosHoje.categorias)
              .sort(([, a], [, b]) => b - a)
              .map(([name, value], i) => ({ name, value: parseFloat(value.toFixed(2)), fill: PIE_COLORS[i % PIE_COLORS.length] }));

            const dadosStatus = [
              { name: 'Processadas', value: processamentosHoje.processadas ?? 0, fill: '#10b981' },
              { name: 'Erros',       value: processamentosHoje.erros ?? 0,       fill: '#ef4444' },
            ].filter(d => d.value > 0);

            if (total === 0) return (
              <div className="bg-white dark:bg-gray-800/60 rounded-2xl border border-gray-200 dark:border-gray-700/50 p-8 text-center">
                <TrendingUp className="mx-auto text-gray-300 dark:text-gray-600 mb-3" size={36} />
                <p className="text-gray-500 dark:text-gray-400 text-sm">Nenhuma nota processada hoje ainda.</p>
              </div>
            );

            const pctProcessadas = total > 0 ? Math.round(((processamentosHoje.processadas ?? 0) / total) * 100) : 0;

            return (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                {/* Pie — Categorias */}
                <div className="bg-gray-200 dark:bg-gray-800 p-4 md:p-5 rounded-xl md:rounded-2xl shadow-sm border border-orange-400 dark:border-gray-700">
                  <h2 className="text-base md:text-lg font-bold text-gray-800 dark:text-gray-100 mb-2">Categorias — Hoje</h2>
                  {temCats ? (
                    <div className="h-[260px] md:h-[300px] w-full">
                      <ResponsiveContainer width="99%" height="100%" minWidth={0}>
                        <PieChart>
                          <Pie data={dadosCats} dataKey="value" nameKey="name" outerRadius={90} paddingAngle={3} stroke="none">
                            {dadosCats.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                          </Pie>
                          <RechartsTooltip content={<CustomPieTooltip valuePrefix="R$ " />} />
                          <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="h-[260px] flex items-center justify-center text-gray-400 dark:text-gray-500 text-sm">
                      Sem categorias registradas hoje.
                    </div>
                  )}
                </div>

                {/* Donut — Processadas × Erros */}
                <div className="bg-gray-200 dark:bg-gray-800 p-4 md:p-5 rounded-xl md:rounded-2xl shadow-sm border border-orange-400 dark:border-gray-700">
                  <h2 className="text-base md:text-lg font-bold text-gray-800 dark:text-gray-100 mb-2">Taxa de Sucesso — Hoje</h2>
                  <div className="h-[260px] md:h-[300px] w-full flex justify-center items-center relative">
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pb-8 z-0">
                      <span className="text-3xl font-black text-gray-800 dark:text-gray-100">{pctProcessadas}%</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">sucesso</span>
                    </div>
                    <div className="w-full h-full z-10">
                      <ResponsiveContainer width="99%" height="100%" minWidth={0}>
                        <PieChart>
                          <Pie data={dadosStatus} innerRadius={65} outerRadius={90} paddingAngle={5} dataKey="value" stroke="none">
                            {dadosStatus.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                          </Pie>
                          <RechartsTooltip content={<CustomPieTooltip />} />
                          <Legend verticalAlign="bottom" height={30} iconType="circle" wrapperStyle={{ fontSize: '13px' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
        </>
      )}

      {/* Action buttons */}
      {driveConfigurado && driveOk && (
        <div>
          <h2 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Ações rápidas</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <ActionCard
              icon={Plus}
              label="Novo Cliente"
              description="Cadastrar e criar pastas"
              color="orange"
              onClick={() => setModal('novo_cliente')}
            />
            <ActionCard
              icon={FileSpreadsheet}
              label="Importar em Massa"
              description="Via planilha Google Sheets"
              color="purple"
              onClick={() => setModal('importar')}
            />
            <ActionCard
              icon={processando === 'processar' ? Loader : RefreshCw}
              label="Processar Arquivos"
              description="Processar cupons/notas dos clientes"
              color="green"
              onClick={handleProcessar}
              disabled={processando === 'processar'}
              loading={processando === 'processar'}
            />
          </div>
        </div>
      )}
    </div>
  );

  // ─── Section: Clientes ────────────────────────────────────────────────────────
  const clientesFiltrados = clientes.filter(c =>
    c.nome?.toLowerCase().includes(filtroClientes.toLowerCase()) ||
    c.cliente_id?.toLowerCase().includes(filtroClientes.toLowerCase())
  );

  const renderClientes = () => (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100">Clientes</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{clientes.length} cadastrados</p>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          {orgData?.spreadsheet_id && (
            <a
              href={`https://docs.google.com/spreadsheets/d/${orgData.spreadsheet_id}/edit`}
              target="_blank" rel="noreferrer"
              className="flex items-center gap-2 bg-purple-500 hover:bg-purple-600 text-white text-sm font-bold px-4 py-2 rounded-xl transition-all shadow-lg shadow-purple-500/20 hover:-translate-y-0.5 active:translate-y-0"
            >
              <ExternalLink size={15} /> Ver Planilha
            </a>
          )}
          <button
            onClick={carregarClientes}
            disabled={loadingClientes}
            className="flex items-center gap-2 bg-gray-500 hover:bg-gray-600 dark:bg-gray-600 dark:hover:bg-gray-500 text-white text-sm font-bold px-4 py-2 rounded-xl transition-all shadow-lg shadow-gray-500/20 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-60 disabled:transform-none cursor-pointer"
          >
            <RefreshCw size={15} className={loadingClientes ? 'animate-spin' : ''} /> Atualizar
          </button>
          {driveOk && (
            <button
              onClick={() => setModal('novo_cliente')}
              className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 dark:bg-cyan-600 dark:hover:bg-cyan-500 text-white text-sm font-bold px-4 py-2 rounded-xl transition-all shadow-lg shadow-orange-500/20 dark:shadow-cyan-600/20 hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
            >
              <Plus size={15} /> Novo Cliente
            </button>
          )}
        </div>
      </div>

      {/* Search filter */}
      {clientes.length > 0 && (
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={filtroClientes}
            onChange={e => setFiltroClientes(e.target.value)}
            placeholder="Pesquisar cliente por nome ou ID..."
            className="input-style"
            style={{ paddingLeft: '2.5rem' }}
          />
        </div>
      )}

      {!driveConfigurado ? (
        <div className="bg-white dark:bg-gray-800/60 rounded-2xl border border-gray-200 dark:border-gray-700/50 p-12 text-center">
          <HardDriveUpload className="mx-auto text-gray-300 dark:text-gray-600 mb-3" size={40} />
          <p className="text-gray-500 dark:text-gray-400 text-sm">Configure o Google Drive no Dashboard primeiro.</p>
        </div>
      ) : loadingClientes ? (
        <div className="bg-gray-100 dark:bg-gray-800/50 border border-orange-400 dark:border-gray-700/50 rounded-lg shadow-xl overflow-hidden">
          <table className="w-full min-w-[820px] text-sm">
            <tbody>
              <SkeletonTableRow cols={6} />
              <SkeletonTableRow cols={6} />
              <SkeletonTableRow cols={6} />
              <SkeletonTableRow cols={6} />
              <SkeletonTableRow cols={6} />
            </tbody>
          </table>
        </div>
      ) : clientes.length === 0 ? (
        <div className="bg-white dark:bg-gray-800/60 rounded-2xl border border-gray-200 dark:border-gray-700/50 p-12 text-center">
          <FolderSync className="mx-auto text-gray-300 dark:text-gray-600 mb-3" size={40} />
          <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">Nenhum cliente cadastrado ainda.</p>
          {driveOk && (
            <button
              onClick={() => setModal('novo_cliente')}
              className="bg-orange-500 hover:bg-orange-600 dark:bg-cyan-600 dark:hover:bg-cyan-500 text-white text-sm font-bold px-5 py-2.5 rounded-xl transition-all cursor-pointer"
            >
              Cadastrar primeiro cliente
            </button>
          )}
        </div>
      ) : clientesFiltrados.length === 0 ? (
        <div className="bg-white dark:bg-gray-800/60 rounded-2xl border border-gray-200 dark:border-gray-700/50 p-10 text-center">
          <Search className="mx-auto text-gray-300 dark:text-gray-600 mb-3" size={36} />
          <p className="text-gray-500 dark:text-gray-400 text-sm">Nenhum cliente encontrado para "<strong>{filtroClientes}</strong>".</p>
        </div>
      ) : (
        <div className="bg-gray-100 dark:bg-gray-800/50 backdrop-blur-md border border-orange-400 dark:border-gray-700/50 rounded-lg shadow-xl w-full">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full min-w-[820px] text-center text-sm text-gray-700 dark:text-gray-300">
              <thead className="bg-gray-200 dark:bg-gray-900/50 text-xs text-orange-500 border-b border-orange-400 dark:border-gray-800 dark:text-cyan-300 uppercase tracking-wider">
                <tr>
                  <th scope="col" className="py-3 px-4 text-center">ID</th>
                  <th scope="col" className="py-3 px-6 text-left">Nome</th>
                  <th scope="col" className="py-3 px-4 text-center">Telegram</th>
                  <th scope="col" className="py-3 px-4 text-center">Integração Omie</th>
                  <th scope="col" className="py-3 px-4 text-center">Google Drive</th>
                  <th scope="col" className="py-3 px-4 text-center">Ações</th>
                </tr>
              </thead>
              <tbody>
                {clientesFiltrados.slice(0, paginaClientes * 30).map((c, i) => {
                  const realIndex = clientes.indexOf(c);
                  const telegramAtivo = !!c.telegram_group_id?.trim();
                  const omieAtivo = !!(c.omie_key?.trim() && c.omie_secret?.trim() && c.omie_conta_corrente?.trim() && c.omie_fornecedor_generico?.trim());
                  const temPastas = !!(c.folder_para_processar || c.folder_em_processamento || c.folder_processadas || c.folder_erro);
                  const folders = [
                    { label: 'Para Processar', id: c.folder_para_processar },
                    { label: 'Em Processamento', id: c.folder_em_processamento },
                    { label: 'Processadas', id: c.folder_processadas },
                    { label: 'Erros', id: c.folder_erro },
                  ].filter(f => f.id);
                  return (
                    <tr key={i} className="border-b border-orange-300 dark:border-gray-700/50 transition-colors duration-150 hover:bg-orange-100 dark:hover:bg-gray-800/60">
                      {/* ID */}
                      <td className="py-3 px-4 text-center">
                        <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">{c.cliente_id}</span>
                      </td>

                      {/* Nome */}
                      <td className="py-3 px-6 text-left">
                        <span className="font-semibold text-black dark:text-white">{c.nome}</span>
                      </td>

                      {/* Telegram */}
                      <td className="py-3 px-4 text-center">
                        <StatusPill ativo={telegramAtivo} />
                      </td>

                      {/* Integração Omie */}
                      <td className="py-3 px-4 text-center">
                        <StatusPill ativo={omieAtivo} />
                      </td>

                      {/* Google Drive — Ver Pastas */}
                      <td className="py-3 px-4 text-center">
                        {temPastas ? (
                          <button
                            onClick={() => setClientePastas({ nome: c.nome, folders })}
                            className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-blue-500/15 text-blue-600 hover:bg-blue-600 hover:text-white border border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20 dark:hover:bg-blue-500 dark:hover:text-white transition-all duration-200 shadow-sm mx-auto"
                          >
                            <FolderOpen size={13} /> Ver Pastas
                          </button>
                        ) : (
                          <span className="text-gray-400 dark:text-gray-600 text-xs">—</span>
                        )}
                      </td>

                      {/* Ações */}
                      <td className="py-3 px-4 text-center">
                        <div className="flex justify-center items-center gap-2">
                          <button
                            onClick={() => { setClienteEditando({ ...c, _rowIndex: realIndex, _originalTelegramId: c.telegram_group_id || '', _originalNome: c.nome }); setModal('editar'); }}
                            className="p-2 rounded-lg bg-cyan-500/15 text-cyan-600 hover:bg-cyan-600 hover:text-white transition-all duration-200 shadow-sm border border-cyan-200 dark:bg-cyan-500/10 dark:text-cyan-600 dark:hover:bg-cyan-300 dark:border-cyan-500/20"
                            title="Editar cliente"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                              <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                            </svg>
                          </button>
                          <button
                            onClick={() => { setClienteDeletando({ ...c, _rowIndex: realIndex }); setModal('deletar'); }}
                            className="p-2 rounded-lg bg-red-500/15 text-red-600 hover:bg-red-600 hover:text-white transition-all duration-200 shadow-sm border border-red-200 dark:bg-red-500/10 dark:text-red-600 dark:hover:bg-red-500 dark:border-red-500/20"
                            title="Excluir cliente"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                              <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {clientesFiltrados.length > paginaClientes * 30 && (
            <div className="flex justify-center py-4 border-t border-orange-300 dark:border-gray-700/50">
              <button
                onClick={() => setPaginaClientes(p => p + 1)}
                className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 dark:bg-cyan-600 dark:hover:bg-cyan-500 text-white text-sm font-bold px-6 py-2.5 rounded-xl transition-all cursor-pointer"
              >
                Carregar Mais ({clientesFiltrados.length - paginaClientes * 30} restantes)
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );

  // ─── Section: Equipe ──────────────────────────────────────────────────────────
  const renderEquipe = () => (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100">Equipe</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{membros.length} membro{membros.length !== 1 ? 's' : ''} na organização</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => { setFormEquipe({ nome: '', email: '', password: '', confirmPassword: '' }); setModal('novo_membro'); }}
            className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 dark:bg-cyan-600 dark:hover:bg-cyan-500 text-white text-sm font-bold px-4 py-2 rounded-xl transition-all shadow-lg shadow-orange-500/20 dark:shadow-cyan-600/20 hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
          >
            <Plus size={15} /> Novo Membro
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-gray-100 dark:bg-gray-800/50 border border-orange-400 dark:border-gray-700/50 rounded-lg shadow-xl overflow-hidden">
        {loadingEquipe ? (
          <div className="flex flex-col gap-2 p-4">
            <SkeletonMemberRow /><SkeletonMemberRow /><SkeletonMemberRow />
          </div>
        ) : membros.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="mx-auto text-gray-300 dark:text-gray-600 mb-3" size={40} />
            <p className="text-gray-500 dark:text-gray-400 text-sm">Nenhum membro encontrado.</p>
          </div>
        ) : (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full min-w-[560px] text-sm text-gray-700 dark:text-gray-300">
              <thead className="bg-gray-200 dark:bg-gray-900/50 text-xs text-orange-500 dark:text-cyan-300 uppercase tracking-wider border-b border-orange-400 dark:border-gray-800">
                <tr>
                  <th className="py-3 px-5 text-left">Membro</th>
                  <th className="py-3 px-5 text-center">Função</th>
                  {isAdmin && <th className="py-3 px-5 text-center">Ações</th>}
                </tr>
              </thead>
              <tbody>
                {membros.map(m => {
                  const isSelf = m.id === authUser?.uid;
                  return (
                    <tr key={m.id} className="border-b border-orange-300 dark:border-gray-700/50 hover:bg-orange-100 dark:hover:bg-gray-800/60 transition-colors">
                      <td className="py-3.5 px-5">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 dark:from-cyan-600 dark:to-cyan-800 flex items-center justify-center shrink-0 shadow-md">
                            <span className="text-white text-sm font-bold">{(m.nome || m.email)?.[0]?.toUpperCase()}</span>
                          </div>
                          <div>
                            {m.nome && <p className="font-semibold text-gray-900 dark:text-white text-sm">{m.nome}</p>}
                            <p className={`text-gray-500 dark:text-gray-400 ${m.nome ? 'text-xs' : 'font-semibold text-gray-900 dark:text-white text-sm'}`}>{m.email}</p>
                            {isSelf && <p className="text-[11px] text-gray-400 dark:text-gray-500">Você</p>}
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-5 text-center">
                        <span className={`inline-block text-xs font-bold px-3 py-1 rounded-full border ${
                          m.role === 'admin'
                            ? 'bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-500/10 dark:text-orange-400 dark:border-orange-500/20'
                            : 'bg-gray-200 text-gray-600 border-gray-300 dark:bg-gray-700/50 dark:text-gray-400 dark:border-gray-600/30'
                        }`}>
                          {m.role === 'admin' ? 'Admin' : 'Operador'}
                        </span>
                      </td>
                      {isAdmin && (
                        <td className="py-3.5 px-5 text-center">
                          <div className="flex justify-center items-center gap-2">
                            <button
                              onClick={() => { setMembroEditando(m); setFormEditar({ nome: m.nome || '', email: m.email, password: '', confirmPassword: '' }); setModal('editar_membro'); }}
                              className="p-2 rounded-lg bg-cyan-500/15 text-cyan-600 hover:bg-cyan-600 hover:text-white transition-all duration-200 shadow-sm border border-cyan-200 dark:bg-cyan-500/10 dark:text-cyan-600 dark:hover:bg-cyan-300 dark:border-cyan-500/20"
                              title="Editar email / senha"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              onClick={() => { setMembroDeletando(m); setModal('excluir_membro'); }}
                              disabled={isSelf}
                              className="p-2 rounded-lg bg-red-500/15 text-red-600 hover:bg-red-600 hover:text-white transition-all duration-200 shadow-sm border border-red-200 dark:bg-red-500/10 dark:text-red-600 dark:hover:bg-red-500 dark:border-red-500/20 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-red-500/15 disabled:hover:text-red-600"
                              title={isSelf ? 'Não pode excluir a si mesmo' : 'Excluir membro'}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );

  // ─── Section: Processamentos ──────────────────────────────────────────────────
  // Usa lista de clientes já carregada para o dropdown (não depende do período)
  const clientesUnicos = clientes.length > 0
    ? clientes.map(c => c.nome).filter(Boolean).sort()
    : [...new Set(listaProcessamentos.map(r => r[3]).filter(Boolean))].sort();
  const listaFiltrada = filtroCliente === 'Todos'
    ? listaProcessamentos
    : listaProcessamentos.filter(r => r[3] === filtroCliente);

  const statsProc = listaFiltrada.reduce((acc, row) => {
    if (row[6] === 'processada') { acc.processadas++; acc.valor += parseFloat(row[5]) || 0; }
    else if (row[6] === 'erro') acc.erros++;
    return acc;
  }, { processadas: 0, erros: 0, valor: 0 });

  const renderProcessamentos = () => (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100">Processamentos</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{listaFiltrada.length} registros encontrados</p>
        </div>
        {driveOk && (
          <button
            onClick={handleProcessar}
            disabled={processando === 'processar'}
            className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 dark:bg-cyan-600 dark:hover:bg-cyan-500 text-white text-sm font-bold px-4 py-2 rounded-xl transition-all shadow-lg shadow-orange-500/20 dark:shadow-cyan-600/20 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-60 disabled:transform-none cursor-pointer"
          >
            {processando === 'processar'
              ? <><Loader size={15} className="animate-spin" /> Processando...</>
              : <><RefreshCw size={15} /> Processar Notas</>
            }
          </button>
        )}
      </div>

      {/* Barra de filtros — igual IziCheck Desempenho */}
      <div className="p-4 bg-gray-200 dark:bg-gray-800/40 rounded-xl border border-orange-400 dark:border-gray-700/50 shadow">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
          {/* Período */}
          <div className="w-full">
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Período</label>
            {filtroPeriodoProc !== 'periodo' ? (
              <select
                value={filtroPeriodoProc}
                onChange={e => setFiltroPeriodoProc(e.target.value)}
                className="input-style border border-orange-400 dark:border-gray-600 font-bold w-full h-[42px]"
              >
                <option value="hoje">Hoje</option>
                <option value="7dias">Últimos 7 Dias</option>
                <option value="15dias">Últimos 15 Dias</option>
                <option value="30dias">Últimos 30 Dias</option>
                <option value="periodo">Personalizado...</option>
              </select>
            ) : (
              <div className="relative w-full h-[42px]">
                <ReactDatePicker
                  selectsRange
                  startDate={dateRangeProc[0]}
                  endDate={dateRangeProc[1]}
                  onChange={update => setDateRangeProc(update)}
                  className="input-style border border-orange-400 dark:border-gray-600 font-bold text-center pr-8 w-full h-full"
                  wrapperClassName="w-full block"
                  locale="pt-BR"
                  dateFormat="dd/MM/yyyy"
                  maxDate={new Date()}
                  autoFocus
                />
                <button
                  onClick={() => { setFiltroPeriodoProc('7dias'); setDateRangeProc([null, null]); }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500 transition-colors p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 z-10"
                  title="Limpar"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            )}
          </div>

          {/* Cliente */}
          <div className="w-full">
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Cliente</label>
            <select
              value={filtroCliente}
              onChange={e => setFiltroCliente(e.target.value)}
              className="input-style border border-orange-400 dark:border-gray-600 font-bold w-full h-[42px]"
            >
              <option value="Todos">Todos os Clientes</option>
              {clientesUnicos.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Stat cards */}
      {loadingLista ? (
        <div className="grid grid-cols-3 gap-3 lg:gap-4">
          <SkeletonStatCard /><SkeletonStatCard /><SkeletonStatCard />
        </div>
      ) : listaFiltrada.length > 0 && (
        <motion.div className="grid grid-cols-3 gap-3 lg:gap-4" variants={gridVariants} initial="hidden" animate="visible">
          <StatCard label="Processadas" value={statsProc.processadas} sub="notas/cupons" gradient="bg-gradient-to-br from-emerald-400 to-green-600" iconPath="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          <StatCard label="Erros" value={statsProc.erros} sub="falhas" gradient="bg-gradient-to-br from-orange-500 to-red-600" iconPath="M12 9v2.25m0 2.625h.008v.008H12v-.008ZM21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          <StatCard label="Valor Total" value={`R$ ${statsProc.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} sub="processado" gradient="bg-gradient-to-br from-indigo-500 to-purple-600" iconPath="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        </motion.div>
      )}

      {/* Table */}
      {!driveConfigurado ? (
        <div className="bg-white dark:bg-gray-800/60 rounded-2xl border border-gray-200 dark:border-gray-700/50 p-12 text-center">
          <p className="text-gray-500 dark:text-gray-400 text-sm">Configure o Google Drive no Dashboard primeiro.</p>
        </div>
      ) : loadingLista ? (
        <div className="bg-gray-100 dark:bg-gray-800/50 border border-orange-400 dark:border-gray-700/50 rounded-lg shadow-xl overflow-hidden">
          <table className="w-full min-w-[820px] text-sm">
            <tbody>
              <SkeletonTableRow cols={8} />
              <SkeletonTableRow cols={8} />
              <SkeletonTableRow cols={8} />
              <SkeletonTableRow cols={8} />
              <SkeletonTableRow cols={8} />
              <SkeletonTableRow cols={8} />
            </tbody>
          </table>
        </div>
      ) : listaFiltrada.length === 0 ? (
        <div className="bg-white dark:bg-gray-800/60 rounded-2xl border border-gray-200 dark:border-gray-700/50 p-12 text-center">
          <FileSpreadsheet className="mx-auto text-gray-300 dark:text-gray-600 mb-3" size={40} />
          <p className="text-gray-500 dark:text-gray-400 text-sm">Nenhum processamento encontrado no período.</p>
        </div>
      ) : (
        <div className="bg-gray-100 dark:bg-gray-800/50 border border-orange-400 dark:border-gray-700/50 rounded-lg shadow-xl w-full">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full min-w-[820px] text-sm text-gray-700 dark:text-gray-300">
              <thead className="bg-gray-200 dark:bg-gray-900/50 text-xs text-orange-500 dark:text-cyan-300 uppercase tracking-wider border-b border-orange-400 dark:border-gray-800">
                <tr>
                  <th className="py-3 px-4 text-center">Data</th>
                  <th className="py-3 px-4 text-center">Hora</th>
                  <th className="py-3 px-4 text-left">Cliente</th>
                  <th className="py-3 px-4 text-left">Fornecedor</th>
                  <th className="py-3 px-4 text-right">Valor (R$)</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-left">Observação</th>
                  <th className="py-3 px-4 text-center">Ações</th>
                </tr>
              </thead>
              <tbody>
                {listaFiltrada.slice(0, paginaProc * 30).map((row, i) => {
                  const [data, hora, clienteId, nomeCliente, fornecedor, valorStr, status, descErro, catsJson] = row;
                  const clienteDoRow = clientes.find(c => c.cliente_id === clienteId);
                  const valor = parseFloat(valorStr) || 0;
                  const ok = status === 'processada';
                  let catsResumo = '—';
                  try {
                    const cats = JSON.parse(catsJson || '{}');
                    const entradas = Object.entries(cats);
                    if (entradas.length > 0) catsResumo = entradas.map(([c, v]) => `${c}: R$${parseFloat(v).toFixed(2)}`).join(' · ');
                  } catch (_) {}
                  const dataFormatada = data ? data.split('-').reverse().join('/') : '—';
                  return (
                    <tr key={i} className="border-b border-orange-300 dark:border-gray-700/50 hover:bg-orange-100 dark:hover:bg-gray-800/60 transition-colors">
                      <td className="py-3 px-4 text-center font-mono text-xs">{dataFormatada}</td>
                      <td className="py-3 px-4 text-center font-mono text-xs">{hora || '—'}</td>
                      <td className="py-3 px-4 text-left font-semibold text-black dark:text-white">{nomeCliente || '—'}</td>
                      <td className="py-3 px-4 text-left text-gray-600 dark:text-gray-400">{fornecedor || '—'}</td>
                      <td className="py-3 px-4 text-right font-bold">{valor > 0 ? valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '—'}</td>
                      <td className="py-3 px-4 text-center">
                        {ok ? (
                          <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full border bg-green-500/20 text-green-700 border-green-400 dark:bg-green-500/10 dark:text-green-400 dark:border-green-500/20">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                            Processada
                          </span>
                        ) : clienteDoRow?.folder_erro ? (
                          <a
                            href={`https://drive.google.com/drive/folders/${clienteDoRow.folder_erro}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full border bg-red-500/20 text-red-700 border-red-400 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20 hover:bg-red-500 hover:text-white dark:hover:bg-red-500 dark:hover:text-white hover:border-red-500 transition-all duration-200"
                            title="Abrir pasta de Erros no Drive"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                            Erro
                            <ExternalLink size={10} className="opacity-70" />
                          </a>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full border bg-red-500/20 text-red-700 border-red-400 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                            Erro
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-left text-xs text-gray-500 dark:text-gray-400 max-w-[280px] truncate" title={ok ? catsResumo : descErro}>
                        {ok ? catsResumo : (descErro || '—')}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex justify-center items-center gap-2">
                          <button
                            onClick={() => {
                              setProcEditando(row);
                              setFormProcEdit({ fornecedor: fornecedor || '', valor_total: valorStr || '', status: status || 'processada', descricao_erro: descErro || '' });
                              setModal('editar_proc');
                            }}
                            className="p-2 rounded-lg bg-cyan-500/15 text-cyan-600 hover:bg-cyan-600 hover:text-white transition-all duration-200 shadow-sm border border-cyan-200 dark:bg-cyan-500/10 dark:text-cyan-600 dark:hover:bg-cyan-300 dark:border-cyan-500/20"
                            title="Editar processamento"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => { setProcDeletando(row); setModal('deletar_proc'); }}
                            className="p-2 rounded-lg bg-red-500/15 text-red-600 hover:bg-red-600 hover:text-white transition-all duration-200 shadow-sm border border-red-200 dark:bg-red-500/10 dark:text-red-600 dark:hover:bg-red-500 dark:border-red-500/20"
                            title="Excluir processamento"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {listaFiltrada.length > paginaProc * 30 && (
            <div className="flex justify-center py-4 border-t border-orange-300 dark:border-gray-700/50">
              <button
                onClick={() => setPaginaProc(p => p + 1)}
                className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 dark:bg-cyan-600 dark:hover:bg-cyan-500 text-white text-sm font-bold px-6 py-2.5 rounded-xl transition-all cursor-pointer"
              >
                Carregar Mais ({listaFiltrada.length - paginaProc * 30} restantes)
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Section content */}
      {activeSection === 'dashboard' && renderDashboard()}
      {activeSection === 'clientes' && renderClientes()}
      {activeSection === 'processamentos' && renderProcessamentos()}
      {activeSection === 'equipe' && isAdmin && renderEquipe()}

      {/* ── Modal: Novo Cliente ────────────────────────────────────────────────── */}
      <BaseModal isOpen={modal === 'novo_cliente'} onClose={() => setModal(null)} title="Cadastrar Novo Cliente">
        <form onSubmit={handleNovoCliente} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="ID do Cliente *" name="cliente_id" value={formCliente.cliente_id}
              onChange={e => setFormCliente({ ...formCliente, cliente_id: e.target.value })}
              placeholder="Ex: 001" required />
            <Field label="Nome *" name="nome" value={formCliente.nome}
              onChange={e => setFormCliente({ ...formCliente, nome: e.target.value })}
              placeholder="Ex: Mercado Silva" required />
          </div>
          <Field label="Telegram Group ID" name="telegram_group_id" value={formCliente.telegram_group_id}
            onChange={e => setFormCliente({ ...formCliente, telegram_group_id: e.target.value })}
            placeholder="Ex: -100123456789" />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Omie Key" name="omie_key" value={formCliente.omie_key}
              onChange={e => setFormCliente({ ...formCliente, omie_key: e.target.value })} />
            <Field label="Omie Secret" name="omie_secret" type="password" value={formCliente.omie_secret}
              onChange={e => setFormCliente({ ...formCliente, omie_secret: e.target.value })} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Categoria" name="omie_categoria" value={formCliente.omie_categoria}
              onChange={e => setFormCliente({ ...formCliente, omie_categoria: e.target.value })} />
            <Field label="Conta Corrente" name="omie_conta_corrente" value={formCliente.omie_conta_corrente}
              onChange={e => setFormCliente({ ...formCliente, omie_conta_corrente: e.target.value })} />
            <Field label="Fornecedor" name="omie_fornecedor_generico" value={formCliente.omie_fornecedor_generico}
              onChange={e => setFormCliente({ ...formCliente, omie_fornecedor_generico: e.target.value })} />
          </div>
          <button type="submit" disabled={processando === 'novo_cliente'}
            className="mt-1 w-full bg-orange-500 hover:bg-orange-600 dark:bg-cyan-600 dark:hover:bg-cyan-500 text-white font-bold py-3 rounded-xl transition-all shadow-lg disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2">
            {processando === 'novo_cliente'
              ? <><Loader size={18} className="animate-spin" /> Criando pastas no Drive...</>
              : 'Salvar e Criar Pastas'
            }
          </button>
        </form>
      </BaseModal>

      {/* ── Modal: Importar em Massa ───────────────────────────────────────────── */}
      <BaseModal isOpen={modal === 'importar'} onClose={() => setModal(null)} title="Importar Clientes em Massa">
        <div className="flex flex-col gap-4">
          <div className="bg-gray-50 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700/50 rounded-xl p-4 text-sm text-gray-600 dark:text-gray-400">
            <p className="font-bold text-gray-700 dark:text-gray-300 mb-2">Como funciona:</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>Abra a planilha no link abaixo</li>
              <li>Preencha a aba <strong>importacoes</strong> com os dados dos clientes</li>
              <li>Volte aqui e clique em <strong>Importar Clientes</strong></li>
            </ol>
          </div>
          {orgData?.spreadsheet_id && (
            <a
              href={`https://docs.google.com/spreadsheets/d/${orgData.spreadsheet_id}/edit#gid=1`}
              target="_blank" rel="noreferrer"
              className="flex items-center justify-center gap-2 border border-orange-300 dark:border-cyan-700/50 text-orange-600 dark:text-cyan-400 font-medium py-2.5 rounded-xl hover:bg-orange-50 dark:hover:bg-cyan-900/20 transition-all"
            >
              <ExternalLink size={16} /> Abrir Planilha de Importação
            </a>
          )}
          <button
            onClick={handleImportar}
            disabled={processando === 'importar'}
            className="w-full bg-orange-500 hover:bg-orange-600 dark:bg-cyan-600 dark:hover:bg-cyan-500 text-white font-bold py-3 rounded-xl transition-all shadow-lg disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
          >
            {processando === 'importar'
              ? <><Loader size={18} className="animate-spin" /> Importando...</>
              : <><FileSpreadsheet size={18} /> Importar Clientes</>
            }
          </button>
        </div>
      </BaseModal>

      {/* ── Modal: Editar Cliente ──────────────────────────────────────────────── */}
      <BaseModal isOpen={modal === 'editar'} onClose={() => { setModal(null); setClienteEditando(null); }} title={clienteEditando ? `Editar — ${clienteEditando.nome}` : 'Editar Cliente'}>
        {clienteEditando && (
          <form onSubmit={handleSalvarEdicao} className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="ID do Cliente" name="cliente_id" value={clienteEditando.cliente_id}
                onChange={e => setClienteEditando({ ...clienteEditando, cliente_id: e.target.value })} />
              <Field label="Nome" name="nome" value={clienteEditando.nome}
                onChange={e => setClienteEditando({ ...clienteEditando, nome: e.target.value })} />
            </div>
            <Field label="Telegram Group ID" name="telegram_group_id" value={clienteEditando.telegram_group_id || ''}
              onChange={e => setClienteEditando({ ...clienteEditando, telegram_group_id: e.target.value })}
              placeholder="Ex: -100123456789" />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Omie Key" name="omie_key" value={clienteEditando.omie_key || ''}
                onChange={e => setClienteEditando({ ...clienteEditando, omie_key: e.target.value })} />
              <Field label="Omie Secret" name="omie_secret" type="password" value={clienteEditando.omie_secret || ''}
                onChange={e => setClienteEditando({ ...clienteEditando, omie_secret: e.target.value })} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Categoria" name="omie_categoria" value={clienteEditando.omie_categoria || ''}
                onChange={e => setClienteEditando({ ...clienteEditando, omie_categoria: e.target.value })} />
              <Field label="Conta Corrente" name="omie_conta_corrente" value={clienteEditando.omie_conta_corrente || ''}
                onChange={e => setClienteEditando({ ...clienteEditando, omie_conta_corrente: e.target.value })} />
              <Field label="Fornecedor" name="omie_fornecedor_generico" value={clienteEditando.omie_fornecedor_generico || ''}
                onChange={e => setClienteEditando({ ...clienteEditando, omie_fornecedor_generico: e.target.value })} />
            </div>
            <button type="submit" disabled={processando === 'editar'}
              className="mt-1 w-full bg-orange-500 hover:bg-orange-600 dark:bg-cyan-600 dark:hover:bg-cyan-500 text-white font-bold py-3 rounded-xl transition-all shadow-lg disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2">
              {processando === 'editar'
                ? <><Loader size={18} className="animate-spin" /> Salvando...</>
                : 'Salvar alterações'
              }
            </button>
          </form>
        )}
      </BaseModal>

      {/* ── Modal: Ver Pastas no Drive ────────────────────────────────────────── */}
      <BaseModal
        isOpen={!!clientePastas}
        onClose={() => setClientePastas(null)}
        title={clientePastas ? `Pastas — ${clientePastas.nome}` : 'Pastas'}
        maxWidth="max-w-sm"
      >
        {clientePastas && (
          <div className="flex flex-col gap-2">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Selecione a pasta para abrir no Google Drive:</p>
            {clientePastas.folders.map(folder => (
              <a
                key={folder.label}
                href={`https://drive.google.com/drive/folders/${folder.id}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-orange-400 dark:hover:border-cyan-600 hover:bg-orange-50 dark:hover:bg-cyan-900/20 transition-all group"
                onClick={() => setClientePastas(null)}
              >
                <FolderOpen size={18} className="text-gray-400 group-hover:text-orange-500 dark:group-hover:text-cyan-400 shrink-0 transition-colors" />
                <span className="flex-1 text-sm font-medium text-gray-700 dark:text-gray-300 group-hover:text-orange-600 dark:group-hover:text-cyan-400 transition-colors">{folder.label}</span>
                <ExternalLink size={13} className="text-gray-300 dark:text-gray-600 group-hover:text-orange-400 dark:group-hover:text-cyan-500 shrink-0 transition-colors" />
              </a>
            ))}
          </div>
        )}
      </BaseModal>

      {/* ── Modal: Novo Membro ────────────────────────────────────────────────── */}
      <BaseModal isOpen={modal === 'novo_membro'} onClose={() => setModal(null)} title="Adicionar Membro">
        <form onSubmit={handleCriarUsuario} className="flex flex-col gap-4">
          <Field label="Nome *" name="nome" value={formEquipe.nome}
            onChange={e => setFormEquipe({ ...formEquipe, nome: e.target.value })}
            placeholder="Ex: João Silva" required />
          <Field label="E-mail *" name="email" type="email" value={formEquipe.email}
            onChange={e => setFormEquipe({ ...formEquipe, email: e.target.value })}
            placeholder="email@empresa.com" required />
          <Field label="Senha *" name="password" type="password" value={formEquipe.password}
            onChange={e => setFormEquipe({ ...formEquipe, password: e.target.value })}
            placeholder="Mínimo 6 caracteres" required />
          <Field label="Confirmar Senha *" name="confirmPassword" type="password" value={formEquipe.confirmPassword}
            onChange={e => setFormEquipe({ ...formEquipe, confirmPassword: e.target.value })}
            placeholder="Digite a senha novamente" required />
          {formEquipe.password && formEquipe.confirmPassword && formEquipe.password !== formEquipe.confirmPassword && (
            <p className="text-xs text-red-500 dark:text-red-400 -mt-2">As senhas não coincidem.</p>
          )}
          <p className="text-xs text-gray-400 dark:text-gray-500 -mt-1">O membro será criado com a função <strong>Operador</strong>.</p>
          <button type="submit" disabled={processando === 'criar_usuario'}
            className="mt-1 w-full bg-orange-500 hover:bg-orange-600 dark:bg-cyan-600 dark:hover:bg-cyan-500 text-white font-bold py-3 rounded-xl transition-all shadow-lg disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2">
            {processando === 'criar_usuario'
              ? <><Loader size={18} className="animate-spin" /> Criando...</>
              : <><Plus size={18} /> Criar Membro</>
            }
          </button>
        </form>
      </BaseModal>

      {/* ── Modal: Editar Membro ───────────────────────────────────────────────── */}
      <BaseModal
        isOpen={modal === 'editar_membro'}
        onClose={() => { setModal(null); setMembroEditando(null); }}
        title={membroEditando ? `Editar — ${membroEditando.nome || membroEditando.email}` : 'Editar Membro'}
      >
        {membroEditando && (
          <form onSubmit={handleEditarMembro} className="flex flex-col gap-4">
            <p className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700/50 rounded-xl px-4 py-3">
              Deixe em branco os campos que não deseja alterar.
            </p>
            <Field label="Nome" name="nome" value={formEditar.nome}
              onChange={e => setFormEditar({ ...formEditar, nome: e.target.value })}
              placeholder={membroEditando.nome || 'Nome do operador'} />
            <Field label="E-mail" name="email" type="email" value={formEditar.email}
              onChange={e => setFormEditar({ ...formEditar, email: e.target.value })}
              placeholder={membroEditando.email} />
            <Field label="Nova Senha" name="password" type="password" value={formEditar.password}
              onChange={e => setFormEditar({ ...formEditar, password: e.target.value })}
              placeholder="Deixe em branco para não alterar" />
            <Field label="Confirmar Nova Senha" name="confirmPassword" type="password" value={formEditar.confirmPassword}
              onChange={e => setFormEditar({ ...formEditar, confirmPassword: e.target.value })}
              placeholder="Repita a nova senha" />
            {formEditar.password && formEditar.confirmPassword && formEditar.password !== formEditar.confirmPassword && (
              <p className="text-xs text-red-500 dark:text-red-400 -mt-2">As senhas não coincidem.</p>
            )}
            <button type="submit" disabled={processando === 'editar_membro'}
              className="mt-1 w-full bg-orange-500 hover:bg-orange-600 dark:bg-cyan-600 dark:hover:bg-cyan-500 text-white font-bold py-3 rounded-xl transition-all shadow-lg disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2">
              {processando === 'editar_membro'
                ? <><Loader size={18} className="animate-spin" /> Salvando...</>
                : 'Salvar alterações'
              }
            </button>
          </form>
        )}
      </BaseModal>

      {/* ── Modal: Excluir Membro ──────────────────────────────────────────────── */}
      <BaseModal
        isOpen={modal === 'excluir_membro'}
        onClose={() => { if (processando !== 'excluir_membro') { setModal(null); setMembroDeletando(null); } }}
        title="Excluir Membro"
        centeredTitle
        hideClose
      >
        {membroDeletando && (
          <div className="flex flex-col gap-4">
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 rounded-xl p-4 flex gap-3">
              <AlertTriangle className="text-red-500 shrink-0 mt-0.5" size={20} />
              <div className="text-sm">
                <p className="font-bold text-red-700 dark:text-red-400 mb-1">Esta ação não pode ser desfeita!</p>
                <p className="text-red-600 dark:text-red-500">
                  O usuário <strong>"{membroDeletando.email}"</strong> perderá acesso imediatamente e será removido da organização.
                </p>
              </div>
            </div>
            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={() => { setModal(null); setMembroDeletando(null); }}
                disabled={processando === 'excluir_membro'}
                className="flex-1 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-bold py-3 rounded-xl transition-all disabled:opacity-50 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleExcluirMembro}
                disabled={processando === 'excluir_membro'}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-red-500/20 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
              >
                {processando === 'excluir_membro'
                  ? <><Loader size={16} className="animate-spin" /> Excluindo...</>
                  : <><Trash2 size={16} /> Excluir Membro</>
                }
              </button>
            </div>
          </div>
        )}
      </BaseModal>

      {/* ── Modal: Editar Processamento ───────────────────────────────────────── */}
      <BaseModal
        isOpen={modal === 'editar_proc'}
        onClose={() => { setModal(null); setProcEditando(null); }}
        title="Editar Processamento"
      >
        {procEditando && (
          <form onSubmit={handleEditarProcessamento} className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Fornecedor</label>
                <input
                  type="text"
                  value={formProcEdit.fornecedor}
                  onChange={e => setFormProcEdit({ ...formProcEdit, fornecedor: e.target.value })}
                  placeholder="Nome do fornecedor"
                  className="input-style"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Valor Total (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formProcEdit.valor_total}
                  onChange={e => setFormProcEdit({ ...formProcEdit, valor_total: e.target.value })}
                  placeholder="0.00"
                  className="input-style"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Status</label>
                <select
                  value={formProcEdit.status}
                  onChange={e => setFormProcEdit({ ...formProcEdit, status: e.target.value })}
                  className="input-style"
                >
                  <option value="processada">Processada</option>
                  <option value="erro">Erro</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Descrição do Erro</label>
                <input
                  type="text"
                  value={formProcEdit.descricao_erro}
                  onChange={e => setFormProcEdit({ ...formProcEdit, descricao_erro: e.target.value })}
                  placeholder="Deixe em branco se não houver erro"
                  className="input-style"
                />
              </div>
            </div>
            <button type="submit" disabled={processando === 'editar_proc'}
              className="mt-1 w-full bg-orange-500 hover:bg-orange-600 dark:bg-cyan-600 dark:hover:bg-cyan-500 text-white font-bold py-3 rounded-xl transition-all shadow-lg disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2">
              {processando === 'editar_proc'
                ? <><Loader size={18} className="animate-spin" /> Salvando...</>
                : 'Salvar alterações'
              }
            </button>
          </form>
        )}
      </BaseModal>

      {/* ── Modal: Excluir Processamento ──────────────────────────────────────── */}
      <BaseModal
        isOpen={modal === 'deletar_proc'}
        onClose={() => { if (processando !== 'deletar_proc') { setModal(null); setProcDeletando(null); } }}
        title="Excluir Processamento"
        centeredTitle
        hideClose
      >
        {procDeletando && (
          <div className="flex flex-col gap-4">
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 rounded-xl p-4 flex gap-3">
              <AlertTriangle className="text-red-500 shrink-0 mt-0.5" size={20} />
              <div className="text-sm">
                <p className="font-bold text-red-700 dark:text-red-400 mb-1">Esta ação não pode ser desfeita!</p>
                <p className="text-red-600 dark:text-red-500">
                  O registro de <strong>{procDeletando[3] || 'cliente'}</strong> — <strong>{procDeletando[4] || 'sem fornecedor'}</strong> ({procDeletando[0]}) será removido da planilha.
                </p>
              </div>
            </div>
            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={() => { setModal(null); setProcDeletando(null); }}
                disabled={processando === 'deletar_proc'}
                className="flex-1 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-bold py-3 rounded-xl transition-all disabled:opacity-50 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeletarProcessamento}
                disabled={processando === 'deletar_proc'}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-red-500/20 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
              >
                {processando === 'deletar_proc'
                  ? <><Loader size={16} className="animate-spin" /> Excluindo...</>
                  : <><Trash2 size={16} /> Excluir</>
                }
              </button>
            </div>
          </div>
        )}
      </BaseModal>

      {/* ── Modal: Confirmar Exclusão ──────────────────────────────────────────── */}
      <BaseModal
        isOpen={modal === 'deletar'}
        onClose={() => { if (processando !== 'deletar') { setModal(null); setClienteDeletando(null); } }}
        title="Excluir Cliente"
        centeredTitle
        hideClose
      >
        {clienteDeletando && (
          <div className="flex flex-col gap-4">
            {/* Warning box */}
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 rounded-xl p-4 flex gap-3">
              <AlertTriangle className="text-red-500 shrink-0 mt-0.5" size={20} />
              <div className="text-sm">
                <p className="font-bold text-red-700 dark:text-red-400 mb-1">Atenção — esta ação não pode ser desfeita!</p>
                <p className="text-red-600 dark:text-red-500">
                  Você está prestes a excluir permanentemente o cliente <strong>"{clienteDeletando.nome}"</strong> e todas as suas pastas no Google Drive.
                </p>
              </div>
            </div>

            {/* What will be deleted */}
            <div className="bg-gray-50 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700/50 rounded-xl p-4 text-sm">
              <p className="font-bold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1.5">
                <Trash2 size={14} className="text-gray-400" /> O que será excluído:
              </p>
              <ul className="space-y-1 text-gray-500 dark:text-gray-400 text-xs">
                <li>• Pasta <span className="font-mono text-gray-600 dark:text-gray-300">{clienteDeletando.nome} - Para Processar</span> e todo o seu conteúdo</li>
                <li>• Pasta <span className="font-mono text-gray-600 dark:text-gray-300">{clienteDeletando.nome} - Em Processamento</span> e todo o seu conteúdo</li>
                <li>• Pasta <span className="font-mono text-gray-600 dark:text-gray-300">{clienteDeletando.nome} - Processadas</span> e todo o seu conteúdo</li>
                <li>• Pasta <span className="font-mono text-gray-600 dark:text-gray-300">{clienteDeletando.nome} - Erros</span> e todo o seu conteúdo</li>
                <li>• Registro do cliente na planilha</li>
              </ul>
            </div>

            {/* Advice */}
            <p className="text-xs text-gray-500 dark:text-gray-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 rounded-xl px-4 py-3">
              💡 <strong>Antes de continuar:</strong> acesse o Google Drive e salve os arquivos importantes das pastas deste cliente.
            </p>

            {/* Actions */}
            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={() => { setModal(null); setClienteDeletando(null); }}
                disabled={processando === 'deletar'}
                className="flex-1 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-bold py-3 rounded-xl transition-all disabled:opacity-50 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeletarCliente}
                disabled={processando === 'deletar'}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-red-500/20 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
              >
                {processando === 'deletar'
                  ? <><Loader size={16} className="animate-spin" /> Excluindo...</>
                  : <><Trash2 size={16} /> Excluir Definitivamente</>
                }
              </button>
            </div>
          </div>
        )}
      </BaseModal>
    </>
  );
}

// ─── Action Card ──────────────────────────────────────────────────────────────
function ActionCard({ icon: Icon, label, description, color, onClick, disabled, loading }) {
  const colors = {
    orange: 'hover:border-orange-400 dark:hover:border-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/10 group-hover:from-orange-400 group-hover:to-orange-600',
    purple: 'hover:border-purple-400 dark:hover:border-purple-700 hover:bg-purple-50 dark:hover:bg-purple-900/10 group-hover:from-purple-400 group-hover:to-purple-600',
    green: 'hover:border-green-400 dark:hover:border-green-700 hover:bg-green-50 dark:hover:bg-green-900/10 group-hover:from-green-400 group-hover:to-green-600',
  };
  const iconColors = {
    orange: 'from-orange-400 to-orange-600',
    purple: 'from-purple-400 to-purple-600',
    green: 'from-green-400 to-green-600',
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`group flex items-center gap-4 bg-white dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700/50 rounded-2xl p-4 text-left transition-all hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:transform-none cursor-pointer ${colors[color]}`}
    >
      <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${iconColors[color]} flex items-center justify-center shrink-0 shadow-md`}>
        <Icon size={20} className={`text-white ${loading ? 'animate-spin' : ''}`} />
      </div>
      <div>
        <p className="font-bold text-gray-800 dark:text-gray-200 text-sm">{label}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400">{description}</p>
      </div>
    </button>
  );
}
