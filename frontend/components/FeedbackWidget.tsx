'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { rateSession } from '@/lib/api';

export default function FeedbackWidget({ sessionId }: { sessionId: string }) {
  const [hoveredStar, setHoveredStar] = useState<number | null>(null);
  const [selectedStar, setSelectedStar] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!selectedStar) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await rateSession(sessionId, selectedStar, notes);
      setIsSubmitted(true);
    } catch (err: any) {
      setError(err.message || 'Failed to submit feedback');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <motion.div
        initial={{ opacity: 0, transform: "scale(0.95)" }}
        animate={{ opacity: 1, transform: "scale(1)" }}
        className="w-full max-w-lg mx-auto p-8 rounded-2xl bg-surface/50 border border-primary/20 flex flex-col items-center justify-center gap-4 text-center"
      >
        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-2">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="text-xl font-display font-bold text-foreground">Thanks for your feedback!</h3>
        <p className="text-foreground/60 text-sm max-w-sm">
          Your input helps us train our AI and improve future recommendations for everyone.
        </p>
      </motion.div>
    );
  }

  return (
    <div className="w-full max-w-lg mx-auto p-6 md:p-8 rounded-3xl bg-surface/30 backdrop-blur-md border border-border flex flex-col gap-6">
      <div className="text-center">
        <h3 className="text-xl font-display font-bold text-foreground mb-2">How were these recommendations?</h3>
        <p className="text-foreground/50 text-sm">Help us improve by rating your results.</p>
      </div>

      <div className="flex justify-center gap-2">
        {[1, 2, 3, 4, 5].map((star) => (
          <motion.button
            key={star}
            onHoverStart={() => setHoveredStar(star)}
            onHoverEnd={() => setHoveredStar(null)}
            onClick={() => setSelectedStar(star)}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.97 }}
            className="p-1 transition-colors"
          >
            <svg
              className={`w-8 h-8 sm:w-10 sm:h-10 transition-colors duration-200 ${(hoveredStar !== null ? star <= hoveredStar : selectedStar !== null && star <= selectedStar) ? 'text-primary drop-shadow-[0_0_8px_var(--color-primary-glow)]' : 'text-foreground/20'}`}
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
          </motion.button>
        ))}
      </div>

      <AnimatePresence>
        {selectedStar !== null && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex flex-col gap-4 overflow-hidden"
          >
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any specific thoughts? (e.g. 'Loved the pacing, but didn't want romance')"
              className="w-full h-24 p-4 rounded-xl bg-background/50 border border-border text-foreground text-sm placeholder:text-foreground/30 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 resize-none transition-all"
            />
            
            {error && <p className="text-red-500 text-xs text-center">{error}</p>}
            
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="w-full py-3 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-sm tracking-wide transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Submitting...' : 'Submit Feedback'}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
