'use client';

import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface ExplainModalProps {
  isOpen: boolean;
  movieTitle: string;
  explanation: string | null;
  isLoading: boolean;
  onClose: () => void;
}

export default function ExplainModal({
  isOpen,
  movieTitle,
  explanation,
  isLoading,
  onClose,
}: ExplainModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            ref={overlayRef}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, y: 60, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 280, damping: 28 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 pointer-events-none"
          >
            <div
              id="explain-modal"
              className="pointer-events-auto w-full max-w-lg rounded-2xl bg-[#16161f] border border-white/10 shadow-2xl overflow-hidden"
              style={{ boxShadow: '0 0 60px rgba(124,58,237,0.2)' }}
            >
              {/* Header */}
              <div className="flex items-start justify-between p-6 pb-4 border-b border-white/5">
                <div>
                  <p className="text-violet-400 text-xs font-semibold uppercase tracking-widest mb-1">
                    Why we picked this
                  </p>
                  <h3
                    className="text-white text-xl font-bold leading-tight"
                    style={{ fontFamily: "'Playfair Display', serif" }}
                  >
                    {movieTitle}
                  </h3>
                </div>
                <button
                  onClick={onClose}
                  id="explain-modal-close"
                  className="ml-4 mt-0.5 text-white/40 hover:text-white/80 transition-colors text-2xl leading-none"
                >
                  ×
                </button>
              </div>

              {/* Body */}
              <div className="p-6">
                {isLoading ? (
                  <div className="flex flex-col items-center gap-4 py-6">
                    {/* Clapperboard spinner */}
                    <div className="relative w-12 h-12">
                      <div className="absolute inset-0 rounded-full border-2 border-violet-500/30 border-t-violet-500 animate-spin" />
                      <div className="absolute inset-3 rounded-full border-2 border-violet-400/20 border-t-violet-400 animate-spin animation-delay-150" />
                    </div>
                    <p className="text-white/40 text-sm animate-pulse">
                      Thinking about why this is perfect for you...
                    </p>
                  </div>
                ) : explanation ? (
                  <motion.p
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-white/80 text-base leading-relaxed"
                  >
                    {explanation}
                  </motion.p>
                ) : (
                  <p className="text-white/40 text-sm text-center py-4">
                    Could not generate an explanation. Try again!
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
