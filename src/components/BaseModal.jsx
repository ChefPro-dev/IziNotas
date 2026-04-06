import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';

const overlayVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.2 } },
  exit: { opacity: 0, transition: { duration: 0.2 } },
};

const modalVariants = {
  hidden: { opacity: 0, y: 30, scale: 0.95 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.25, ease: 'easeOut' } },
  exit: { opacity: 0, y: 20, scale: 0.95, transition: { duration: 0.2, ease: 'easeIn' } },
};

function BaseModal({ isOpen, onClose, children, maxWidth = 'max-w-lg', title, centeredTitle = false, hideClose = false }) {
  const content = (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="overlay"
          variants={overlayVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4"
        >
          <motion.div
            key="modal"
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className={`relative w-full ${maxWidth} bg-white dark:bg-gray-800 rounded-2xl shadow-2xl flex flex-col border border-gray-100 dark:border-gray-700 max-h-[90dvh]`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            {!hideClose && (
              <button
                onClick={onClose}
                className="absolute top-4 right-4 text-gray-400 hover:text-red-500 dark:hover:text-red-400 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-full p-1.5 transition-colors z-10"
                aria-label="Fechar"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}

            {title && (
              <div className={`px-6 pt-5 pb-4 border-b border-gray-100 dark:border-gray-700 shrink-0 ${centeredTitle ? 'text-center' : ''}`}>
                <h2 className={`text-lg font-bold text-gray-900 dark:text-cyan-400 ${!centeredTitle && !hideClose ? 'pr-8' : ''}`}>{title}</h2>
              </div>
            )}

            <div className={`${title ? 'px-6 pb-6 pt-4' : 'p-6'} overflow-y-auto custom-scrollbar`}>
              {children}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return typeof document !== 'undefined' ? createPortal(content, document.body) : null;
}

export default BaseModal;
