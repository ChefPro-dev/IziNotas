// src/components/Sidebar.jsx
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';

const sidebarVariants = {
  expanded: { width: "14rem", transition: { type: "spring", stiffness: 300, damping: 30, duration: 0.3 } },
  collapsed: { width: "5rem", transition: { type: "spring", stiffness: 300, damping: 30, duration: 0.3 } },
};
const textVariants = {
  hidden: { opacity: 0, width: 0, x: -10, transition: { duration: 0.15 } },
  visible: { opacity: 1, width: "auto", x: 0, transition: { duration: 0.2, delay: 0.1 } },
};
const logoTextVariants = {
  hidden: { opacity: 0, display: "none", transition: { duration: 0.1 } },
  visible: { opacity: 1, display: "inline", transition: { duration: 0.2, delay: 0.1 } },
};
const mobileSidebarVariants = {
  hidden: { x: "-100%", transition: { type: "spring", stiffness: 400, damping: 40, duration: 0.3 } },
  visible: { x: "0%", transition: { type: "spring", stiffness: 400, damping: 30, duration: 0.3 } },
};
const overlayVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.3 } },
  exit: { opacity: 0, transition: { duration: 0.3 } },
};

// Nav items config
const NAV_ITEMS = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 shrink-0">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z" />
      </svg>
    ),
  },
  {
    id: 'clientes',
    label: 'Clientes',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 shrink-0">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" />
      </svg>
    ),
  },
  {
    id: 'processamentos',
    label: 'Processamentos',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 shrink-0">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25ZM6.75 12h.008v.008H6.75V12Zm0 3h.008v.008H6.75V15Zm0 3h.008v.008H6.75V18Z" />
      </svg>
    ),
  },
  {
    id: 'equipe',
    label: 'Equipe',
    adminOnly: true,
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 shrink-0">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
      </svg>
    ),
  },
];

function SidebarContent({
  isCollapsed,
  onLinkClick,
  toggleSidebar,
  activeSection,
  setActiveSection,
  userData,
  isAdmin,
  orgData,
  onConnectDrive,
  driveOk,
  isDark,
  toggleTheme,
}) {
  const handleLogout = async () => {
    try {
      await signOut(auth);
      onLinkClick();
    } catch (error) {
      toast.error('Erro ao sair.');
    }
  };

  const displayName = userData?.nome || userData?.email?.split('@')[0] || '';

  const navigate = (id) => {
    setActiveSection(id);
    onLinkClick();
  };

  return (
    <>
      {/* Logo */}
      <div className={`pt-[calc(env(safe-area-inset-top)+1rem)] pb-4 font-black text-center border-b border-orange-300 dark:border-gray-700/50 overflow-hidden whitespace-nowrap ${isCollapsed ? 'text-xl' : 'text-3xl px-4'}`}>
        <span className="text-gray-900 dark:text-white">
          I
          <AnimatePresence>
            {!isCollapsed && (
              <motion.span variants={logoTextVariants} initial="hidden" animate="visible" exit="hidden">
                zi<span className="text-orange-500 dark:text-cyan-400">Notas</span>
              </motion.span>
            )}
          </AnimatePresence>
        </span>
        {isCollapsed && <span className="text-orange-500 dark:text-cyan-400">N</span>}
      </div>

      {/* Navigation */}
      <nav className="mt-4 flex-1 space-y-2 overflow-y-auto overflow-x-hidden custom-scrollbar pb-2 px-2">
        {NAV_ITEMS.filter(item => !item.adminOnly || isAdmin).map(item => {
          const isActive = activeSection === item.id;
          return (
            <button
              key={item.id}
              onClick={() => navigate(item.id)}
              title={isCollapsed ? item.label : undefined}
              className={`w-full flex items-center px-4 py-3 rounded-lg font-medium transition-colors duration-200 ${isCollapsed ? 'justify-center' : ''} ${isActive ? 'bg-orange-100 shadow-sm dark:bg-gray-700/60 text-orange-500 dark:text-cyan-300' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700/50 hover:text-orange-500 dark:hover:text-cyan-300'}`}
            >
              <span className={!isCollapsed ? 'mr-3' : ''}>{item.icon}</span>
              <AnimatePresence>
                {!isCollapsed && (
                  <motion.span variants={textVariants} initial="hidden" animate="visible" exit="hidden" className="overflow-hidden whitespace-nowrap">
                    {item.label}
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
          );
        })}
      </nav>

      {/* Bottom section */}
      <div className="mt-auto border-t border-orange-300 dark:border-gray-700/50 relative">

        {/* Drive status button — full width above user info */}
        <div className="px-3 pt-3">
          <button
            onClick={onConnectDrive}
            title={driveOk ? 'Clique para reconectar o Drive' : 'Conectar Google Drive'}
            className={`w-full flex items-center justify-center gap-2.5 px-3 py-2 rounded-lg font-medium text-xs transition-all duration-200 border
              ${driveOk
                ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800/40 text-green-700 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/30'
                : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800/40 text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/30'
              }
            `}
          >
            {/* Wifi icon: with slash when not connected */}
            {driveOk ? (
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 shrink-0">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.288 15.038a5.25 5.25 0 0 1 7.424 0M5.106 11.856c3.807-3.808 9.98-3.808 13.788 0M1.924 8.674c5.565-5.565 14.587-5.565 20.152 0M12.53 18.22l-.53.53-.53-.53a.75.75 0 0 1 1.06 0Z" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 shrink-0">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.288 15.038a5.25 5.25 0 0 1 7.424 0M5.106 11.856c3.807-3.808 9.98-3.808 13.788 0M1.924 8.674c5.565-5.565 14.587-5.565 20.152 0M12.53 18.22l-.53.53-.53-.53a.75.75 0 0 1 1.06 0Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18" />
              </svg>
            )}
            <AnimatePresence>
              {!isCollapsed && (
                <motion.span variants={textVariants} initial="hidden" animate="visible" exit="hidden" className="overflow-hidden whitespace-nowrap font-semibold">
                  {driveOk ? 'Google Drive Conectado' : 'Conectar Google Drive'}
                </motion.span>
              )}
            </AnimatePresence>
          </button>
        </div>

        {/* User info row */}
        <AnimatePresence>
          {!isCollapsed && (
            <motion.div
              variants={textVariants}
              initial="hidden"
              animate="visible"
              exit="hidden"
              className="flex justify-between items-center py-3 px-4"
              title={userData?.email}
            >
              <div className="text-left text-xs text-gray-500 dark:text-gray-400 overflow-hidden whitespace-nowrap mr-2">
                <span className="block truncate font-medium text-orange-700 dark:text-gray-300">{displayName}</span>
                <span className="font-bold text-emerald-700 dark:text-cyan-300">({isAdmin ? 'admin' : 'operador'})</span>
              </div>
              <div className="flex items-center space-x-1 shrink-0">
                {/* Logout */}
                <button
                  onClick={handleLogout}
                  title="Sair"
                  className="p-2 rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700/50 hover:text-red-500 dark:hover:text-red-400 transition-colors duration-200"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
                  </svg>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Collapsed user row */}
        {isCollapsed && (
          <div className="py-3 px-2 flex flex-col items-center space-y-2">
            <button
              onClick={handleLogout}
              title="Sair"
              className="flex items-center justify-center w-full p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700/50 hover:text-red-500 dark:hover:text-red-400 rounded-lg transition-colors duration-200"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 shrink-0">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
              </svg>
            </button>
          </div>
        )}

        {/* Utilities bar: theme + collapse */}
        <div className="border-t border-orange-300 dark:border-gray-700/50 pt-3 pb-2 px-2">
          <div className={`flex items-center ${isCollapsed ? 'flex-col space-y-2' : 'justify-between'}`}>
            <div className={`flex items-center ${isCollapsed ? 'w-full flex-col space-y-2' : 'space-x-1'}`}>
              {/* Theme toggle */}
              <button
                onClick={toggleTheme}
                className={`p-1.5 rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-700/50 hover:text-orange-500 dark:hover:text-cyan-300 transition-colors duration-200 ${isCollapsed ? 'w-full flex justify-center' : ''}`}
                title={isDark ? 'Mudar para Modo Claro' : 'Mudar para Modo Escuro'}
              >
                {isDark ? (
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-[18px] h-[18px] shrink-0">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-[18px] h-[18px] shrink-0">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z" />
                  </svg>
                )}
              </button>
            </div>

            {/* Collapse/Expand button */}
            {toggleSidebar && (
              <button
                onClick={toggleSidebar}
                className={`p-2 rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-700/50 hover:text-orange-500 dark:hover:text-cyan-300 transition-colors duration-200 ${isCollapsed ? 'w-full flex justify-center' : ''}`}
                title={isCollapsed ? 'Expandir Menu' : 'Retrair Menu'}
              >
                {isCollapsed ? (
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 9V4.5M9 9H4.5M9 9 3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5 5.25 5.25" />
                  </svg>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function Sidebar({
  isCollapsed,
  toggleSidebar,
  isMobileOpen,
  setIsMobileOpen,
  activeSection,
  setActiveSection,
  userData,
  isAdmin,
  orgData,
  onConnectDrive,
  driveOk,
  isDark,
  toggleTheme,
}) {
  return (
    <>
      {/* Desktop */}
      <motion.aside
        variants={sidebarVariants}
        initial={false}
        animate={isCollapsed ? 'collapsed' : 'expanded'}
        className="hidden xl:flex flex-col border-r border-orange-300 dark:border-gray-700/50 bg-white/80 dark:bg-gray-800/30 backdrop-blur-lg flex-shrink-0 z-50 h-full"
      >
        <SidebarContent
          isCollapsed={isCollapsed}
          onLinkClick={() => {}}
          toggleSidebar={toggleSidebar}
          activeSection={activeSection}
          setActiveSection={setActiveSection}
          userData={userData}
          isAdmin={isAdmin}
          orgData={orgData}
          onConnectDrive={onConnectDrive}
          driveOk={driveOk}
          isDark={isDark}
          toggleTheme={toggleTheme}
        />
      </motion.aside>

      {/* Mobile overlay + drawer */}
      <AnimatePresence>
        {isMobileOpen && (
          <>
            <motion.div
              key="mobile-overlay"
              variants={overlayVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="fixed inset-0 bg-gray-400 dark:bg-black bg-opacity-10 dark:bg-opacity-10 backdrop-blur-sm z-[100] xl:hidden"
              onClick={() => setIsMobileOpen(false)}
            />
            <motion.aside
              key="mobile-sidebar"
              variants={mobileSidebarVariants}
              initial="hidden"
              animate="visible"
              exit="hidden"
              className="fixed inset-y-0 left-0 w-64 bg-gray-100 dark:bg-gray-900 border-r border-orange-400 dark:border-gray-700/50 z-[110] xl:hidden flex flex-col"
            >
              <button
                onClick={() => setIsMobileOpen(false)}
                className="absolute top-3 right-3 text-gray-500 hover:text-red-500 dark:text-gray-400 dark:hover:text-red-400 transition-colors z-[100] p-2"
                aria-label="Fechar menu"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <SidebarContent
                isCollapsed={false}
                onLinkClick={() => setIsMobileOpen(false)}
                activeSection={activeSection}
                setActiveSection={setActiveSection}
                userData={userData}
                isAdmin={isAdmin}
                orgData={orgData}
                onConnectDrive={onConnectDrive}
                driveOk={driveOk}
                isDark={isDark}
                toggleTheme={toggleTheme}
              />
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

export default Sidebar;
