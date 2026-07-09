'use client';

import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface ExplainModalProps {
  isOpen: boolean;
  movieTitle: string;
  explanation: string | null;
  isLoading: boolean;
  onClose: () => void;
  onRetry?: () => void;
}

export default function ExplainModal({
  isOpen,
  movieTitle,
  explanation,
  isLoading,
  onClose,
  onRetry,
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
            className="fixed inset-0 z-50 bg-background/80 backdrop-blur-md"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 pointer-events-none"
          >
            <div
              id="explain-modal"
              className="pointer-events-auto w-full max-w-lg rounded-2xl bg-surface border border-border/60 shadow-2xl overflow-hidden relative"
              style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}
            >
              {/* Subtle top border glow */}
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-primary/50 to-transparent" />

              {/* Header */}
              <div className="flex items-start justify-between p-6 pb-4 border-b border-border/40">
                <div>
                  <p className="text-primary text-[10px] font-bold uppercase tracking-[0.2em] mb-1.5">
                    Why we picked this
                  </p>
                  <h3 className="text-foreground text-2xl font-display font-black leading-tight tracking-tight">
                    {movieTitle}
                  </h3>
                </div>
                <button
                  onClick={onClose}
                  id="explain-modal-close"
                  className="ml-4 text-foreground/40 hover:text-foreground transition-colors text-3xl leading-none font-light"
                >
                  ×
                </button>
              </div>

              {/* Body */}
              <div className="p-6 md:p-8">
                {isLoading ? (
                  <div className="flex flex-col items-center justify-center gap-6 py-8">
                    <div className="relative w-12 h-12 flex items-center justify-center">
                      <div className="absolute inset-0 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
                      <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                    </div>
                    <p className="text-foreground/50 text-sm font-semibold tracking-wide uppercase">
                      Analyzing cinematic fit...
                    </p>
                  </div>
                ) : explanation ? (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="prose prose-invert prose-p:text-foreground/80 prose-p:leading-relaxed prose-p:text-[15px]"
                  >
                    <p>{explanation}</p>
                  </motion.div>
                ) : (
                  <div className="text-center py-6 flex flex-col items-center gap-4">
                    <p className="text-foreground/40 text-sm">
                      Could not generate an explanation right now.
                    </p>
                    {onRetry && (
                      <button
                        onClick={onRetry}
                        className="px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-wider bg-surface border border-border hover:bg-border/50 text-foreground transition-colors"
                      >
                        Retry Explanation
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
