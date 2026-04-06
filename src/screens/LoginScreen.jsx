// src/screens/LoginScreen.jsx
import { useState } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../firebase';
import { createOrg, createUser } from '../services/firestore';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';

// --- Icons ---
const EyeOpenIcon = ({ size = 5 }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`w-${size} h-${size}`}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
  </svg>
);
const EyeClosedIcon = ({ size = 5 }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`w-${size} h-${size}`}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.243 4.243L6.228 6.228" />
  </svg>
);

// --- Formatters ---
const formatCNPJ = (value) => {
  if (!value) return '';
  value = value.replace(/\D/g, '').substring(0, 14);
  if (value.length > 12) return value.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  if (value.length > 8)  return value.replace(/^(\d{2})(\d{3})(\d{3})(\d{1,4})/, '$1.$2.$3/$4');
  if (value.length > 5)  return value.replace(/^(\d{2})(\d{3})(\d{1,3})/, '$1.$2.$3');
  if (value.length > 2)  return value.replace(/^(\d{2})(\d{1,3})/, '$1.$2');
  return value;
};

const formatTelefone = (value) => {
  if (!value) return '';
  value = value.replace(/\D/g, '').substring(0, 11);
  if (value.length > 10) return value.replace(/^(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  if (value.length > 6)  return value.replace(/^(\d{2})(\d{4,5})(\d{0,4})/, '($1) $2-$3');
  if (value.length > 2)  return value.replace(/^(\d{2})(\d{0,5})/, '($1) $2');
  return value;
};

// --- Password validation ---
const validatePassword = (pw) => {
  if (pw.length < 8) return 'A senha deve ter no mínimo 8 caracteres.';
  if (!/[A-Z]/.test(pw)) return 'A senha deve conter pelo menos 1 letra maiúscula.';
  if (!/[0-9]/.test(pw)) return 'A senha deve conter pelo menos 1 número.';
  if (!/[!@#$%^&*(),.?":{}|<>_\-+=[\]\\;'/`~]/.test(pw)) return 'A senha deve conter pelo menos 1 caractere especial (ex: !@#$).';
  return null;
};

const getPasswordStrength = (pw) => {
  if (!pw) return { score: 0, label: '', color: '' };
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[!@#$%^&*(),.?":{}|<>_\-+=[\]\\;'/`~]/.test(pw)) score++;
  if (score <= 2) return { score, label: 'Fraca', color: 'bg-red-500' };
  if (score <= 3) return { score, label: 'Média', color: 'bg-yellow-500' };
  if (score <= 4) return { score, label: 'Boa', color: 'bg-blue-500' };
  return { score, label: 'Forte', color: 'bg-green-500' };
};

// --- Animations ---
const formVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.12, delayChildren: 0.15 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: 'easeOut' } },
};
const modalVariants = {
  hidden: { opacity: 0, scale: 0.95, y: 20 },
  visible: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.2, ease: 'easeOut' } },
  exit: { opacity: 0, scale: 0.95, y: 20, transition: { duration: 0.15, ease: 'easeIn' } },
};

function FormField({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1">{label}</label>
      {children}
    </div>
  );
}

export default function LoginScreen() {
  const [isRegistering, setIsRegistering] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Login fields
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Register fields
  const [nome, setNome] = useState('');
  const [sobrenome, setSobrenome] = useState('');
  const [nomeEmpresa, setNomeEmpresa] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [telefone, setTelefone] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [showSenha, setShowSenha] = useState(false);
  const [showConfirmar, setShowConfirmar] = useState(false);

  // Reset modal
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  const passwordStrength = getPasswordStrength(senha);

  // --- Login ---
  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
    } catch (error) {
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found') {
        toast.error('Email ou senha inválidos.');
      } else {
        toast.error('Erro ao fazer login. Tente novamente.');
      }
    }
    setIsLoading(false);
  };

  // --- Register ---
  const handleRegister = async (e) => {
    e.preventDefault();
    if (!nome.trim() || !sobrenome.trim()) { toast.error('Preencha seu Nome e Sobrenome.'); return; }
    if (!nomeEmpresa.trim()) { toast.error('Preencha o Nome da Empresa.'); return; }
    if (cnpj.replace(/\D/g, '').length !== 14) { toast.error('CNPJ inválido. Deve conter 14 dígitos.'); return; }
    if (telefone.replace(/\D/g, '').length < 10) { toast.error('Telefone inválido.'); return; }
    const senhaError = validatePassword(senha);
    if (senhaError) { toast.error(senhaError, { duration: 4000 }); return; }
    if (senha !== confirmarSenha) { toast.error('As senhas não coincidem.'); return; }

    setIsLoading(true);
    try {
      // 1. Create Firebase Auth account
      const userCred = await createUserWithEmailAndPassword(auth, regEmail, senha);
      const uid = userCred.user.uid;

      // 2. Create org in Firestore
      const orgId = await createOrg({
        nome: nomeEmpresa.trim(),
        cnpj: cnpj.replace(/\D/g, ''),
        telefone: telefone.replace(/\D/g, ''),
        owner_uid: uid,
        owner_email: regEmail,
        owner_nome: `${nome.trim()} ${sobrenome.trim()}`,
      });

      // 3. Create user doc
      await createUser(uid, {
        email: regEmail,
        org_id: orgId,
        role: 'admin',
        nome: `${nome.trim()} ${sobrenome.trim()}`,
      });

      // onAuthStateChanged in App.jsx will pick up the new user + org
    } catch (error) {
      if (error.code === 'auth/email-already-in-use') {
        toast.error('Este e-mail já está cadastrado.');
      } else if (error.code === 'auth/weak-password') {
        toast.error('Senha muito fraca.');
      } else {
        toast.error('Erro ao criar conta: ' + error.message);
      }
    }
    setIsLoading(false);
  };

  // --- Password reset ---
  const handlePasswordReset = async (e) => {
    e.preventDefault();
    if (!resetEmail.trim()) { toast.error('Por favor, informe seu e-mail.'); return; }
    setIsResetting(true);
    try {
      await sendPasswordResetEmail(auth, resetEmail);
      toast.success('E-mail de recuperação enviado! Verifique sua caixa de entrada e spam.');
      setIsResetModalOpen(false);
      setResetEmail('');
    } catch (error) {
      if (error.code === 'auth/user-not-found') toast.error('Não encontramos conta associada a este e-mail.');
      else if (error.code === 'auth/invalid-email') toast.error('E-mail inválido.');
      else toast.error('Ocorreu um erro. Tente novamente mais tarde.');
    }
    setIsResetting(false);
  };

  const switchToRegister = () => { setIsRegistering(true); };
  const switchToLogin = () => { setIsRegistering(false); };

  return (
    <div className="flex min-h-screen w-full bg-gray-50 dark:bg-gray-950 font-sans selection:bg-cyan-500 selection:text-white">

      {/* LEFT — Branding (hidden on mobile and on register page) */}
      <div className={`hidden xl:flex xl:w-1/2 relative overflow-hidden flex-col justify-center items-center p-12 text-white ${isRegistering ? 'bg-gradient-to-br from-orange-400 via-amber-500 to-yellow-600 dark:from-cyan-600 dark:via-cyan-700 dark:to-blue-900' : 'bg-gradient-to-br from-orange-500 via-orange-600 to-amber-700 dark:from-cyan-600 dark:via-cyan-800 dark:to-blue-900'}`}>
        <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-orange-300 dark:bg-cyan-400 rounded-full mix-blend-overlay filter blur-[100px] opacity-50 animate-pulse"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-amber-400 dark:bg-blue-500 rounded-full mix-blend-overlay filter blur-[100px] opacity-40"></div>
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wNSkiLz48L3N2Zz4=')] [mask-image:linear-gradient(to_bottom,white,transparent)]"></div>

        <motion.div
          key={isRegistering ? 'register-brand' : 'login-brand'}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="relative z-10 max-w-xl"
        >
          {isRegistering ? (
            <>
              <h1 className="text-5xl xl:text-6xl font-black mb-6 leading-tight tracking-tight">
                Comece agora.<br />
                <span className="text-orange-200 dark:text-cyan-300">É simples.</span>
              </h1>
              <p className="text-xl text-orange-50/90 dark:text-cyan-50/90 leading-relaxed font-light mb-8">
                Cadastre-se e comece enviar cupons e notas fiscais do Telegram e Google Drive para Omie automaticamente em minutos.
              </p>
              <div className="flex flex-col gap-3 text-sm font-medium text-orange-100 dark:text-cyan-100">
                {['Processamento automático', 'Configure em minutos', 'Integração com Omie'].map(item => (
                  <div key={item} className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-orange-200 dark:text-cyan-400 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
                    {item}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              <h1 className="text-4xl xl:text-5xl font-black mb-6 leading-tight tracking-tight">
                Cupons. Notas Fiscais.<br />
                <span className="text-4xl xl:text-6xl text-orange-200 dark:text-cyan-300">Sem Complicação.</span>
              </h1>
              <p className="text-xl text-orange-50/90 dark:text-cyan-50/90 leading-relaxed font-light mb-10">
                Receba Cupons e Notas Fiscais pelo Telegram ou Google Drive, processe e envie para a Omie automaticamente em minutos.
              </p>
              <div className="flex flex-wrap items-center gap-3 text-sm font-medium text-orange-100 dark:text-cyan-100">
                {[['Processamento automático', 'M21 12a9 9 0 1 1-18 0'], ['Configure em minutos', 'M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z'], ['Integração com Omie', 'M3 13.125C3 12.504 3.504 12 4.125 12h2.25']].map(([label]) => (
                  <div key={label} className="flex items-center gap-2">
                    <svg className="w-6 h-6 text-orange-200 dark:text-cyan-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
                    {label}
                  </div>
                ))}
              </div>
            </>
          )}
        </motion.div>
      </div>

      {/* RIGHT — Form */}
      <div className={`w-full xl:w-1/2 flex items-center justify-center relative bg-gray-100 dark:bg-gray-900 ${isRegistering ? 'p-4 sm:p-6 xl:overflow-y-auto' : 'p-6 sm:p-12'}`}>
        <div className="absolute top-0 right-0 w-64 h-64 bg-orange-400/10 dark:bg-cyan-500/5 rounded-full filter blur-[80px] xl:hidden pointer-events-none"></div>

        <motion.div
          key={isRegistering ? 'register-form' : 'login-form'}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className={`w-full relative z-10 ${isRegistering ? 'max-w-2xl py-6' : 'max-w-md'}`}
        >
          {/* Header */}
          <div className="text-center mb-8">
            <h2 className="text-3xl font-black text-gray-900 dark:text-white mb-2">
              Izi<span className="text-orange-500 dark:text-cyan-400">Notas</span>
            </h2>
            <p className="text-gray-500 dark:text-gray-400 font-medium">
              {isRegistering ? 'Crie sua conta e sua organização.' : 'Bem-vindo de volta! Acesse sua conta.'}
            </p>
          </div>

          {/* ═══════════ LOGIN FORM ═══════════ */}
          {!isRegistering && (
            <motion.div variants={formVariants} initial="hidden" animate="visible">
              <motion.div
                variants={itemVariants}
                className="bg-gray-50 dark:bg-gray-800/60 backdrop-blur-xl p-8 rounded-2xl shadow-xl shadow-gray-200/50 dark:shadow-black/20 border border-gray-400 dark:border-gray-700/50"
              >
                <form onSubmit={handleLogin} className="space-y-5">
                  <div>
                    <label htmlFor="login-email" className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5 ml-1">Email</label>
                    <input
                      type="email" id="login-email"
                      value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)}
                      className="input-style w-full py-3 px-4"
                      placeholder="seu@email.com" required autoComplete="email"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-1.5 ml-1 pr-1">
                      <label htmlFor="login-password" className="block text-sm font-bold text-gray-700 dark:text-gray-300">Senha</label>
                      <button type="button"
                        onClick={() => { setResetEmail(loginEmail); setIsResetModalOpen(true); }}
                        className="text-xs font-bold text-orange-600 dark:text-cyan-400 hover:text-orange-800 dark:hover:text-cyan-300 transition-colors">
                        Esqueceu a senha?
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        type={showLoginPassword ? 'text' : 'password'} id="login-password"
                        value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)}
                        className="input-style w-full py-3 px-4 pr-12"
                        placeholder="••••••••" required autoComplete="current-password"
                      />
                      <button type="button" onClick={() => setShowLoginPassword(!showLoginPassword)}
                        className="absolute inset-y-0 right-0 flex items-center pr-4 text-gray-400 hover:text-orange-600 dark:hover:text-cyan-400 transition-colors">
                        {showLoginPassword ? <EyeClosedIcon /> : <EyeOpenIcon />}
                      </button>
                    </div>
                  </div>

                  <div className="pt-2">
                    <button type="submit" disabled={isLoading}
                      className="w-full bg-orange-500 hover:bg-orange-600 dark:bg-cyan-600 dark:hover:bg-cyan-500 text-white font-bold py-3.5 px-6 rounded-xl shadow-lg shadow-orange-500/30 dark:shadow-cyan-500/10 transition-all duration-300 transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-70 disabled:cursor-wait disabled:transform-none flex justify-center items-center">
                      {isLoading ? (
                        <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      ) : 'Entrar na Conta'}
                    </button>
                  </div>
                </form>
              </motion.div>

              <motion.div variants={itemVariants} className="text-center mt-8">
                <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">
                  Não tem conta?{' '}
                  <button onClick={switchToRegister}
                    className="font-bold text-orange-600 dark:text-cyan-400 hover:text-orange-800 dark:hover:text-cyan-300 transition-colors ml-1.5 underline decoration-2 underline-offset-4 decoration-orange-600/30 dark:decoration-cyan-400/30 hover:decoration-orange-600/100 dark:hover:decoration-cyan-400/100">
                    Criar minha conta
                  </button>
                </p>
              </motion.div>
            </motion.div>
          )}

          {/* ═══════════ REGISTER FORM ═══════════ */}
          {isRegistering && (
            <form onSubmit={handleRegister}>
              <div className="bg-gray-50 dark:bg-gray-800/60 backdrop-blur-xl rounded-2xl shadow-xl shadow-gray-200/50 dark:shadow-black/20 border border-gray-400 dark:border-gray-700/50 overflow-hidden">

                {/* Section: Personal */}
                <div className="px-6 pt-6 pb-4 border-b border-gray-200 dark:border-gray-700/50">
                  <p className="text-[10px] font-black text-orange-600 dark:text-cyan-400 uppercase tracking-widest mb-4">Dados Pessoais</p>
                  <div className="grid grid-cols-2 gap-3">
                    <FormField label="Nome *">
                      <input type="text" value={nome} onChange={e => setNome(e.target.value)}
                        placeholder="João" required className="input-style" />
                    </FormField>
                    <FormField label="Sobrenome *">
                      <input type="text" value={sobrenome} onChange={e => setSobrenome(e.target.value)}
                        placeholder="Silva" required className="input-style" />
                    </FormField>
                  </div>
                </div>

                {/* Section: Company */}
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700/50">
                  <p className="text-[10px] font-black text-orange-600 dark:text-cyan-400 uppercase tracking-widest mb-4">Dados da Empresa</p>
                  <div className="flex flex-col gap-3">
                    <FormField label="Nome da Empresa *">
                      <input type="text" value={nomeEmpresa} onChange={e => setNomeEmpresa(e.target.value)}
                        placeholder="Contabilidade Silva Ltda" required className="input-style" />
                    </FormField>
                    <div className="grid grid-cols-2 gap-3">
                      <FormField label="CNPJ *">
                        <input type="text" value={cnpj} onChange={e => setCnpj(formatCNPJ(e.target.value))}
                          placeholder="00.000.000/0000-00" required className="input-style font-mono" maxLength={18} />
                      </FormField>
                      <FormField label="Telefone *">
                        <input type="text" value={telefone} onChange={e => setTelefone(formatTelefone(e.target.value))}
                          placeholder="(11) 99999-9999" required className="input-style font-mono" maxLength={15} />
                      </FormField>
                    </div>
                  </div>
                </div>

                {/* Section: Access */}
                <div className="px-6 py-4">
                  <p className="text-[10px] font-black text-orange-600 dark:text-cyan-400 uppercase tracking-widest mb-4">Acesso</p>
                  <div className="flex flex-col gap-3">
                    <FormField label="E-mail *">
                      <input type="email" value={regEmail} onChange={e => setRegEmail(e.target.value)}
                        placeholder="seu@email.com" required className="input-style" autoComplete="email" />
                    </FormField>

                    <FormField label="Senha *">
                      <div className="relative">
                        <input type={showSenha ? 'text' : 'password'} value={senha}
                          onChange={e => setSenha(e.target.value)}
                          placeholder="Mín. 8 caracteres" required className="input-style pr-10" />
                        <button type="button" onClick={() => setShowSenha(!showSenha)}
                          className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-orange-500 dark:hover:text-cyan-400 transition-colors">
                          {showSenha ? <EyeClosedIcon size={4} /> : <EyeOpenIcon size={4} />}
                        </button>
                      </div>
                      {/* Strength bar */}
                      {senha && (
                        <div className="mt-1.5 flex items-center gap-2">
                          <div className="flex-1 h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all duration-300 ${passwordStrength.color}`}
                              style={{ width: `${(passwordStrength.score / 5) * 100}%` }} />
                          </div>
                          <span className={`text-[10px] font-bold whitespace-nowrap ${passwordStrength.score <= 2 ? 'text-red-500' : passwordStrength.score <= 3 ? 'text-yellow-500' : passwordStrength.score <= 4 ? 'text-blue-500' : 'text-green-500'}`}>
                            {passwordStrength.label}
                          </span>
                        </div>
                      )}
                      <p className="mt-1 text-[10px] text-gray-400 dark:text-gray-500">
                        Mín. 8 caracteres, 1 maiúscula, 1 número, 1 caractere especial
                      </p>
                    </FormField>

                    <FormField label="Confirmar Senha *">
                      <div className="relative">
                        <input type={showConfirmar ? 'text' : 'password'} value={confirmarSenha}
                          onChange={e => setConfirmarSenha(e.target.value)}
                          placeholder="Digite a senha novamente" required
                          className={`input-style pr-10 ${confirmarSenha && confirmarSenha !== senha ? 'border-red-400 dark:border-red-600' : confirmarSenha && confirmarSenha === senha ? 'border-green-400 dark:border-green-600' : ''}`} />
                        <button type="button" onClick={() => setShowConfirmar(!showConfirmar)}
                          className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-orange-500 dark:hover:text-cyan-400 transition-colors">
                          {showConfirmar ? <EyeClosedIcon size={4} /> : <EyeOpenIcon size={4} />}
                        </button>
                      </div>
                      {confirmarSenha && confirmarSenha !== senha && (
                        <p className="mt-1 text-[10px] text-red-500 font-medium">As senhas não coincidem.</p>
                      )}
                      {confirmarSenha && confirmarSenha === senha && (
                        <p className="mt-1 text-[10px] text-green-500 font-medium">Senhas conferem ✓</p>
                      )}
                    </FormField>
                  </div>
                </div>

                {/* Submit */}
                <div className="px-6 pb-6">
                  <button type="submit" disabled={isLoading}
                    className="w-full bg-orange-500 hover:bg-orange-600 dark:bg-cyan-600 dark:hover:bg-cyan-500 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-orange-500/30 dark:shadow-cyan-500/10 transition-all duration-300 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-70 disabled:cursor-wait disabled:transform-none flex justify-center items-center gap-2">
                    {isLoading ? (
                      <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    ) : 'Criar Conta e Organização'}
                  </button>
                </div>
              </div>

              <div className="text-center mt-6">
                <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">
                  Já tem conta?{' '}
                  <button type="button" onClick={switchToLogin}
                    className="font-bold text-orange-600 dark:text-cyan-400 hover:text-orange-800 dark:hover:text-cyan-300 transition-colors ml-1.5 underline decoration-2 underline-offset-4">
                    Entrar aqui
                  </button>
                </p>
              </div>
            </form>
          )}
        </motion.div>
      </div>

      {/* --- PASSWORD RESET MODAL --- */}
      <AnimatePresence>
        {isResetModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div variants={modalVariants} initial="hidden" animate="visible" exit="exit"
              className="bg-gray-50 dark:bg-gray-900 rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col border border-gray-400 dark:border-gray-800">
              <div className="p-6 xl:p-8">
                <div className="w-16 h-16 bg-orange-100 dark:bg-cyan-900/30 text-orange-600 dark:text-cyan-400 rounded-full flex items-center justify-center mb-5 mx-auto">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
                  </svg>
                </div>
                <h3 className="text-xl font-black text-gray-900 dark:text-white text-center mb-2">Recuperar Senha</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center mb-6">
                  Informe o e-mail cadastrado e enviaremos um link para você redefinir sua senha.
                </p>
                <form onSubmit={handlePasswordReset}>
                  <div className="mb-6">
                    <input type="email" value={resetEmail} onChange={(e) => setResetEmail(e.target.value)}
                      placeholder="seu@email.com"
                      className="input-style w-full py-3 px-4 text-center" required />
                  </div>
                  <div className="flex flex-col gap-3">
                    <button type="submit" disabled={isResetting}
                      className="w-full bg-orange-500 hover:bg-orange-600 dark:bg-cyan-600 dark:hover:bg-cyan-500 text-white font-bold py-3 rounded-xl transition-colors disabled:opacity-70 flex justify-center items-center shadow-lg">
                      {isResetting ? (
                        <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      ) : 'Enviar Link'}
                    </button>
                    <button type="button" onClick={() => setIsResetModalOpen(false)}
                      className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-gray-300 font-bold py-3 rounded-xl transition-colors">
                      Cancelar
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
