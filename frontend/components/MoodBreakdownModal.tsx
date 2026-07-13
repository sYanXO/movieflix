'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MoodProfile, MoodBreakdownResponse, getMoodBreakdown } from '@/lib/api';

interface MoodBreakdownModalProps {
  isOpen: boolean;
  moodProfile: MoodProfile | null;
  onClose: () => void;
}

export default function MoodBreakdownModal({ isOpen, moodProfile, onClose }: MoodBreakdownModalProps) {
  const [breakdown, setBreakdown] = useState<MoodBreakdownResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(false);
  const fetchedRef = useRef(false);

  const fetchBreakdown = useCallback(async () => {
    if (!moodProfile) return;
    setIsLoading(true);
    setError(false);
    fetchedRef.current = true;
    try {
      const data = await getMoodBreakdown(moodProfile);
      setBreakdown(data);
    } catch {
      setError(true);
    } finally {
      setIsLoading(false);
    }
  }, [moodProfile]);

  useEffect(() => {
    if (isOpen && !fetchedRef.current) {
      fetchBreakdown();
    }
  }, [isOpen, fetchBreakdown]);

  // Reset when closed
  useEffect(() => {
    if (!isOpen) {
      fetchedRef.current = false;
      setBreakdown(null);
      setError(false);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-background/80 backdrop-blur-md"
            onClick={onClose}
          />

          {/* Modal */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 pointer-events-none">
            <motion.div
              id="breakdown-modal"
              initial={{ opacity: 0, y: 40, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              transition={{ type: 'spring', bounce: 0, duration: 0.4 }}
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={0.8}
              onDragEnd={(e, info) => {
                if (info.velocity.y > 500 || info.offset.y > 100) onClose();
              }}
              className="pointer-events-auto w-full max-w-lg rounded-2xl bg-surface border border-border/60 shadow-2xl overflow-hidden relative"
              style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.6)' }}
            >
              {/* Top border glow */}
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-primary/60 to-transparent" />

              {/* Header */}
              <div className="flex items-start justify-between p-6 pb-4 border-b border-border/40">
                <div>
                  <p className="text-primary text-[10px] font-bold uppercase tracking-[0.2em] mb-1.5">
                    Your taste profile
                  </p>
                  {breakdown?.persona ? (
                    <motion.h3
                      initial={{ opacity: 0, transform: "translateY(6px)" }}
                      animate={{ opacity: 1, transform: "translateY(0px)" }}
                      className="text-foreground text-2xl font-display font-black leading-tight tracking-tight"
                    >
                      {breakdown.persona}
                    </motion.h3>
                  ) : (
                    <h3 className="text-foreground text-2xl font-display font-black leading-tight tracking-tight">
                      Analyzing your vibe...
                    </h3>
                  )}
                </div>
                <button
                  onClick={onClose}
                  id="breakdown-modal-close"
                  className="ml-4 text-foreground/40 hover:text-foreground transition-colors text-3xl leading-none font-light"
                >
                  ×
                </button>
              </div>

              {/* Body */}
              <div className="p-6 md:p-8 min-h-[220px]">
                {isLoading ? (
                  <div className="flex flex-col items-center justify-center gap-6 py-10">
                    <div className="relative w-12 h-12 flex items-center justify-center">
                      <div className="absolute inset-0 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
                      <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                    </div>
                    <p className="text-foreground/50 text-sm font-semibold tracking-wide uppercase">
                      Building your profile...
                    </p>
                  </div>
                ) : error ? (
                  <div className="text-center py-8 flex flex-col items-center gap-4">
                    <p className="text-foreground/40 text-sm">Could not load taste profile right now.</p>
                    <button
                      onClick={() => { fetchedRef.current = false; fetchBreakdown(); }}
                      className="px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-wider bg-surface border border-border hover:bg-border/50 text-foreground transition-colors"
                    >
                      Retry
                    </button>
                  </div>
                ) : breakdown ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex flex-col gap-4"
                  >
                    {breakdown.attributes.map((attr, i) => (
                      <div key={attr.label} className="flex items-center gap-4">
                        {/* Label */}
                        <span className="w-32 shrink-0 text-sm font-semibold text-foreground/70 text-right">
                          {attr.label}
                        </span>

                        {/* Bar track */}
                        <div className="flex-1 h-2.5 bg-white/5 rounded-full overflow-hidden">
                          <motion.div
                            className="h-full rounded-full"
                            style={{
                              background: `linear-gradient(90deg, var(--color-primary), var(--color-primary-hover))`,
                              boxShadow: attr.score > 70 ? '0 0 8px var(--color-primary-glow)' : 'none',
                            }}
                            initial={{ width: 0 }}
                            animate={{ width: `${attr.score}%` }}
                            transition={{ type: 'spring', bounce: 0, duration: 0.6, delay: i * 0.08 }}
                          />
                        </div>

                        {/* Score */}
                        <span className="w-10 shrink-0 text-xs font-bold tabular-nums text-foreground/40">
                          {attr.score}%
                        </span>
                      </div>
                    ))}
                  </motion.div>
                ) : null}
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
