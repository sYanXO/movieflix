'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { getNextQuestion, getRecommendations, QuestionResponse } from '@/lib/api';

const MAX_QUESTIONS = 5;

const OPTION_ICONS: Record<string, string> = {
  'Turn my brain off': '🛋️',
  'Something intense': '⚡',
  'Make me think': '🧠',
  'Scare me': '👻',
  'Surprise me': '🎲',
  'Fast paced': '🚀',
  'Slow burn': '🕯️',
  'Full focus': '🎯',
  'Half-watching on my phone': '📱',
  'Happy': '☀️',
  'Sad / dark': '🌧️',
  "Doesn't matter": '🎭',
  'Gore': '🩸',
  'Romance': '💘',
  'Subtitles': '🌐',
  'Nope, anything goes': '🤙',
};

const cleanErrorMessage = (err: string) => {
  const msg = err.toLowerCase();
  if (msg.includes('quota') || msg.includes('resource_exhausted') || msg.includes('429')) {
    return 'The AI is catching its breath (rate limit). Please wait a moment and try again.';
  }
  if (msg.includes('demand') || msg.includes('unavailable') || msg.includes('503')) {
    return 'High demand on the AI right now. Give it a second!';
  }
  if (msg.includes('not found') || msg.includes('404') || msg.includes('available')) {
    return "We're updating the AI backend. Try clicking again in a few seconds.";
  }
  return err;
};

export default function QuizPage() {
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [currentQ, setCurrentQ] = useState<QuestionResponse | null>(null);
  const [questionNum, setQuestionNum] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);

  useEffect(() => {
    fetchNextQuestion({});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchNextQuestion = async (currentAnswers: Record<string, string>) => {
    setIsLoading(true);
    setError(null);
    setSelectedOption(null);
    try {
      const q = await getNextQuestion(currentAnswers);
      if (q.is_final) {
        await fetchRecommendations(currentAnswers);
        return;
      }
      setCurrentQ(q);
      setQuestionNum(prev => prev + 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchRecommendations = async (finalAnswers: Record<string, string>) => {
    setIsSubmitting(true);
    try {
      const data = await getRecommendations(finalAnswers);
      sessionStorage.setItem('moodflix_results', JSON.stringify(data));
      sessionStorage.setItem('moodflix_answers', JSON.stringify(finalAnswers));
      router.push('/results');
    } catch (e) {
      setError((e as Error).message);
      setIsSubmitting(false);
    }
  };

  const handleAnswer = async (option: string) => {
    setSelectedOption(option);
    await new Promise(r => setTimeout(r, 200)); // brief visual feedback delay
    const qKey = `q${questionNum}`;
    const newAnswers = { ...answers, [qKey]: option };
    setAnswers(newAnswers);
    await fetchNextQuestion(newAnswers);
  };

  const progressPercent = Math.min(((questionNum - 1) / MAX_QUESTIONS) * 100, 100);

  return (
    <main className="min-h-screen bg-background flex flex-col items-center justify-center px-6 py-12 relative overflow-hidden">
      {/* Subtle background glow */}
      <div 
        className="absolute top-1/2 left-1/2 w-[120%] h-[120%] -translate-x-1/2 -translate-y-1/2 pointer-events-none rounded-full blur-[150px] opacity-[0.03]"
        style={{ background: 'var(--color-primary)' }} 
      />

      <div className="relative z-10 w-full max-w-lg flex flex-col gap-10">
        {/* Top Navigation & Progress */}
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <button onClick={() => router.push('/')}
              className="text-foreground/40 hover:text-foreground transition-colors text-sm font-semibold flex items-center gap-1.5">
              <span>←</span> Back
            </button>
            <span className="font-display font-black text-xl tracking-tight text-foreground">
              Mood<span className="text-primary">Flix</span>
            </span>
          </div>
          
          {/* Progress Bar */}
          <div className="w-full h-1 bg-surface rounded-full overflow-hidden">
            <motion.div 
              className="h-full bg-primary"
              initial={{ width: 0 }}
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            />
          </div>
        </div>

        {/* Loading / Submitting */}
        {(isLoading || isSubmitting) && (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center gap-6 py-32"
          >
            <div className="relative w-12 h-12 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
              <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
            </div>
            <p className="text-foreground/50 text-sm font-semibold tracking-wide uppercase">
              {isSubmitting ? 'Curating your films...' : 'Analyzing mood...'}
            </p>
          </motion.div>
        )}

        {/* Error state */}
        {error && !isLoading && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="cinematic-glass rounded-2xl p-8 text-center border-red-500/20"
          >
            <div className="text-4xl mb-4">⚠️</div>
            <h3 className="font-display font-bold text-xl mb-3 text-foreground">
              AI is catching its breath
            </h3>
            <p className="text-foreground/60 text-sm leading-relaxed mb-8">{cleanErrorMessage(error)}</p>
            <button
              onClick={() => { setError(null); fetchNextQuestion(answers); }}
              className="cinematic-btn w-full py-4 rounded-xl"
            >
              Try again
            </button>
          </motion.div>
        )}

        {/* Question card */}
        {!isLoading && !isSubmitting && !error && currentQ && (
          <AnimatePresence mode="wait">
            <motion.div
              key={questionNum}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="flex flex-col gap-8"
            >
              <div className="flex flex-col gap-3">
                <span className="text-primary/80 text-xs font-bold uppercase tracking-widest">
                  Question {questionNum} of {MAX_QUESTIONS}
                </span>
                <h2 className="font-display text-3xl sm:text-4xl font-black leading-tight text-balance text-foreground">
                  {currentQ.question}
                </h2>
              </div>

              {/* Options */}
              <div className="flex flex-col gap-3">
                {currentQ.options.map((option, i) => {
                  const icon = OPTION_ICONS[option] ?? '•';
                  const isSelected = selectedOption === option;
                  return (
                    <motion.button
                      key={option}
                      id={`option-${i}`}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05, duration: 0.3 }}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleAnswer(option)}
                      className={`w-full text-left px-6 py-5 rounded-2xl border transition-all duration-300 flex items-center gap-4 font-semibold text-lg ${
                        isSelected
                          ? 'bg-primary border-primary text-white shadow-[0_0_20px_rgba(225,29,72,0.3)]'
                          : 'bg-surface border-border/50 text-foreground/80 hover:bg-surface-hover hover:border-border hover:text-foreground'
                      }`}
                    >
                      <span className="text-2xl w-8 text-center flex-shrink-0 opacity-80">{icon}</span>
                      <span className="flex-1">{option}</span>
                      {isSelected && (
                        <motion.span
                          initial={{ opacity: 0, scale: 0.5 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="text-white text-lg font-bold"
                        >
                          ✓
                        </motion.span>
                      )}
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </main>
  );
}
