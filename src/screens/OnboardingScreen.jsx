// src/screens/OnboardingScreen.jsx
// Shown only for users who have an account but no organization yet
// (edge case: account created externally, or org doc missing)
import { useState } from 'react';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';
import { createOrg, createUser, getInviteByEmail, acceptInvite, getOrg } from '../services/firestore';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { ArrowRight, Loader, LogOut } from 'lucide-react';

const itemVariants = {
  hidden: { opacity: 0, y: 15 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
};

export default function OnboardingScreen({ authUser, onComplete }) {
  const [modo, setModo] = useState(null); // null | 'criar' | 'entrar'
  const [orgNome, setOrgNome] = useState('');
  const [emailConvite, setEmailConvite] = useState(authUser.email || '');
  const [loading, setLoading] = useState(false);

  const handleCriarOrg = async (e) => {
    e.preventDefault();
    if (!orgNome.trim()) return;
    setLoading(true);
    try {
      const orgId = await createOrg({
        nome: orgNome.trim(),
        owner_uid: authUser.uid,
        owner_email: authUser.email,
      });
      const userData = { email: authUser.email, org_id: orgId, role: 'admin' };
      await createUser(authUser.uid, userData);
      const orgData = await getOrg(orgId);
      onComplete({ id: authUser.uid, ...userData }, orgData);
    } catch (err) {
      toast.error('Erro ao criar organização: ' + err.message);
    }
    setLoading(false);
  };

  const handleEntrarOrg = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const invite = await getInviteByEmail(emailConvite);
      if (!invite || invite.status !== 'pending') {
        toast.error('Nenhum convite pendente encontrado para este e-mail.');
        setLoading(false);
        return;
      }
      const userData = { email: authUser.email, org_id: invite.org_id, role: 'operador' };
      await createUser(authUser.uid, userData);
      await acceptInvite(emailConvite);
      const orgData = await getOrg(invite.org_id);
      onComplete({ id: authUser.uid, ...userData }, orgData);
    } catch (err) {
      toast.error('Erro: ' + err.message);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex flex-col justify-center items-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <h1 className="text-3xl font-black text-gray-900 dark:text-white mb-1">
            Izi<span className="text-orange-500 dark:text-cyan-400">Notas</span>
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Bem-vindo, <span className="font-semibold text-gray-700 dark:text-gray-300">{authUser.email}</span>
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800/60 rounded-2xl shadow-xl shadow-gray-200/50 dark:shadow-black/20 border border-gray-200 dark:border-gray-700/50 overflow-hidden">
          <div className="h-1.5 bg-gradient-to-r from-orange-400 to-amber-500 dark:from-cyan-500 dark:to-cyan-700" />
          <div className="p-6">
            {!modo && (
              <motion.div variants={itemVariants} initial="hidden" animate="visible">
                <p className="text-gray-500 dark:text-gray-400 text-sm text-center mb-6">Como você deseja continuar?</p>
                <div className="flex flex-col gap-3">
                  <button onClick={() => setModo('criar')}
                    className="flex items-center gap-4 p-4 border-2 border-gray-200 dark:border-gray-700 rounded-xl hover:border-orange-400 dark:hover:border-cyan-600 hover:bg-orange-50 dark:hover:bg-cyan-900/20 transition-all cursor-pointer text-left group">
                    <div className="w-11 h-11 bg-gradient-to-br from-orange-400 to-orange-600 dark:from-cyan-600 dark:to-cyan-800 rounded-xl flex items-center justify-center shadow-md shrink-0">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-white">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-gray-800 dark:text-gray-200">Criar minha organização</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Sou admin, vou configurar tudo</p>
                    </div>
                    <ArrowRight className="text-gray-300 dark:text-gray-600 group-hover:text-orange-500 dark:group-hover:text-cyan-400 transition-colors" size={18} />
                  </button>
                  <button onClick={() => setModo('entrar')}
                    className="flex items-center gap-4 p-4 border-2 border-gray-200 dark:border-gray-700 rounded-xl hover:border-green-400 dark:hover:border-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 transition-all cursor-pointer text-left group">
                    <div className="w-11 h-11 bg-gradient-to-br from-green-400 to-green-600 rounded-xl flex items-center justify-center shadow-md shrink-0">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-white">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-gray-800 dark:text-gray-200">Entrar em uma organização</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Fui convidado por um admin</p>
                    </div>
                    <ArrowRight className="text-gray-300 dark:text-gray-600 group-hover:text-green-500 transition-colors" size={18} />
                  </button>
                </div>
              </motion.div>
            )}

            {modo === 'criar' && (
              <motion.form variants={itemVariants} initial="hidden" animate="visible" onSubmit={handleCriarOrg} className="flex flex-col gap-4">
                <button type="button" onClick={() => setModo(null)} className="text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-left w-fit">← Voltar</button>
                <div>
                  <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Nome da organização</label>
                  <input type="text" required value={orgNome} onChange={(e) => setOrgNome(e.target.value)}
                    className="input-style" placeholder="Ex: Contabilidade Silva Ltda" autoFocus />
                </div>
                <button type="submit" disabled={loading}
                  className="w-full bg-orange-500 hover:bg-orange-600 dark:bg-cyan-600 dark:hover:bg-cyan-500 text-white font-bold py-3 rounded-xl transition-all shadow-lg disabled:opacity-60 cursor-pointer flex items-center justify-center gap-2">
                  {loading ? <><Loader size={18} className="animate-spin" /> Criando...</> : 'Criar Organização'}
                </button>
              </motion.form>
            )}

            {modo === 'entrar' && (
              <motion.form variants={itemVariants} initial="hidden" animate="visible" onSubmit={handleEntrarOrg} className="flex flex-col gap-4">
                <button type="button" onClick={() => setModo(null)} className="text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-left w-fit">← Voltar</button>
                <div>
                  <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Seu e-mail (mesmo do convite)</label>
                  <input type="email" required value={emailConvite} onChange={(e) => setEmailConvite(e.target.value)}
                    className="input-style" placeholder="seu@email.com" />
                </div>
                <button type="submit" disabled={loading}
                  className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3 rounded-xl transition-all shadow-lg disabled:opacity-60 cursor-pointer flex items-center justify-center gap-2">
                  {loading ? <><Loader size={18} className="animate-spin" /> Buscando convite...</> : 'Entrar na Organização'}
                </button>
              </motion.form>
            )}

            <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-700/50 text-center">
              <button onClick={() => signOut(auth)}
                className="text-xs text-gray-400 hover:text-red-500 flex items-center gap-1 mx-auto cursor-pointer transition-colors">
                <LogOut size={13} /> Sair da conta
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
