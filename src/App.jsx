import { useState, useEffect } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { useGoogleLogin } from '@react-oauth/google';
import { Toaster } from 'react-hot-toast';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { auth, functions } from './firebase';
import { getUser, getOrg, isDriveConnected } from './services/firestore';
import LoginScreen from './screens/LoginScreen';
import Dashboard from './Dashboard';
import Sidebar from './components/Sidebar';
import { FolderSync } from 'lucide-react';

const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/spreadsheets',
].join(' ');

// Apply saved theme on startup before React renders
const savedTheme = localStorage.getItem('theme') || 'dark';
document.documentElement.classList.remove('light', 'dark');
document.documentElement.classList.add(savedTheme);

export default function App() {
  // 'loading' | 'auth' | 'ready'
  const [appState, setAppState] = useState('loading');
  const [authUser, setAuthUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [orgData, setOrgData] = useState(null);

  const [isDark, setIsDark] = useState(savedTheme === 'dark');

  const toggleTheme = () => {
    setIsDark(prev => {
      const next = !prev;
      const root = document.documentElement;
      root.classList.remove('light', 'dark');
      root.classList.add(next ? 'dark' : 'light');
      localStorage.setItem('theme', next ? 'dark' : 'light');
      return next;
    });
  };

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('dashboard');

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setAuthUser(null);
        setUserData(null);
        setOrgData(null);
        setAppState('auth');
        return;
      }

      setAuthUser(user);
      setActiveSection('dashboard');

      try {
        // Retry até 5x com 1s de intervalo — evita race condition durante cadastro
        // onde onAuthStateChanged dispara antes do createUser terminar de escrever
        let uData = null;
        for (let i = 0; i < 5; i++) {
          uData = await getUser(user.uid);
          if (uData) break;
          await new Promise(r => setTimeout(r, 1000));
        }

        if (!uData || !uData.org_id) {
          // Após 5 tentativas ainda sem doc — conta incompleta, faz logout
          await signOut(auth);
          return;
        }

        setUserData(uData);
        const oData = await getOrg(uData.org_id);
        setOrgData(oData);
        setAppState('ready');
      } catch (err) {
        console.error('Erro ao carregar dados do usuário:', err);
        setAppState('auth');
      }
    });

    return unsub;
  }, []);

  const refreshOrgData = async () => {
    if (userData?.org_id) {
      const oData = await getOrg(userData.org_id);
      setOrgData(oData);
    }
  };

  // Google Drive connect (lifted up so sidebar can trigger it)
  const connectGoogle = useGoogleLogin({
    onSuccess: async ({ code }) => {
      try {
        const exchange = httpsCallable(functions, 'exchangeGoogleCode');
        await exchange({ code, org_id: orgData?.id });
        toast.success('Google Drive conectado com sucesso!');
        await refreshOrgData();
      } catch (err) {
        toast.error('Erro ao conectar Drive: ' + err.message);
      }
    },
    onError: () => toast.error('Erro ao conectar com o Google.'),
    scope: GOOGLE_SCOPES,
    flow: 'auth-code',
  });

  if (appState === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <div className="text-center">
          <FolderSync className="mx-auto text-orange-500 dark:text-cyan-400 animate-pulse mb-3" size={48} />
          <p className="text-gray-400 text-sm">Carregando...</p>
        </div>
      </div>
    );
  }

  if (appState === 'auth') {
    return (
      <>
        <Toaster position="top-right" />
        <LoginScreen />
      </>
    );
  }

  const isAdmin = userData?.role === 'admin';
  const driveOk = isDriveConnected(orgData);

  return (
    <div className="fixed inset-0 flex bg-gray-100 dark:bg-gray-900">
      <Toaster position="top-right" />

      <Sidebar
        isCollapsed={isSidebarCollapsed}
        toggleSidebar={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        isMobileOpen={isMobileNavOpen}
        setIsMobileOpen={setIsMobileNavOpen}
        activeSection={activeSection}
        setActiveSection={setActiveSection}
        userData={userData}
        isAdmin={isAdmin}
        orgData={orgData}
        onConnectDrive={() => connectGoogle()}
        driveOk={driveOk}
        isDark={isDark}
        toggleTheme={toggleTheme}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile top bar */}
        <div className="xl:hidden flex items-center justify-between px-4 py-3 border-b border-orange-300 dark:border-gray-700/50 bg-white/80 dark:bg-gray-800/30 backdrop-blur-lg shrink-0">
          <div className="font-black text-xl text-gray-900 dark:text-white">
            Izi<span className="text-orange-500 dark:text-cyan-400">Notas</span>
          </div>
          <button
            onClick={() => setIsMobileNavOpen(true)}
            className="text-gray-500 hover:text-orange-600 dark:hover:text-cyan-400 p-2 rounded-lg"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>
        </div>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto custom-scrollbar p-4 xl:p-8 bg-gray-100 dark:bg-gray-900">
          <motion.div
            key={activeSection}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            <Dashboard
              authUser={authUser}
              userData={userData}
              orgData={orgData}
              refreshOrgData={refreshOrgData}
              activeSection={activeSection}
              setActiveSection={setActiveSection}
              connectGoogle={connectGoogle}
            />
          </motion.div>
        </main>
      </div>
    </div>
  );
}
