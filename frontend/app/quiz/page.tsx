'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { getNextQuestion, getRecommendations, getFriendRecommendations, QuestionResponse } from '@/lib/api';

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

const MULTI_SELECT_KEYWORDS = ['dealbreaker', 'avoid', 'not okay', 'nope'];
const isMultiSelectQuestion = (q: QuestionResponse) =>
  MULTI_SELECT_KEYWORDS.some(kw => q.question.toLowerCase().includes(kw)) ||
  q.options.some(o => o.toLowerCase().includes('gore') || o.toLowerCase().includes('romance') || o.toLowerCase().includes('subtitle'));

const cleanErrorMessage = (err: string) => {
  const msg = err.toLowerCase();
  if (msg.includes('quota') || msg.includes('resource_exhausted') || msg.includes('429'))
    return 'Rate limit hit — please wait a moment and try again.';
  if (msg.includes('demand') || msg.includes('unavailable') || msg.includes('503'))
    return 'High demand right now. Give it a second and try again!';
  if (msg.includes('not found') || msg.includes('404') || msg.includes('available'))
    return 'Backend is warming up. Try clicking again in a few seconds.';
  return err;
};

interface HistoryEntry {
  question: QuestionResponse;
  questionNum: number;
  answers: Record<string, string>;
}

// ─── Handoff Screen ───────────────────────────────────────────────
function HandoffScreen({ onContinue }: { onContinue: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97 }}
      className="flex flex-col items-center text-center gap-8"
    >
      <div className="text-7xl">👋</div>
      <div className="flex flex-col gap-3">
        <h2 className="font-display text-3xl font-black text-white">
          Your turn, friend!
        </h2>
        <p className="text-white/50 text-base max-w-sm leading-relaxed">
          Person A is done. Now answer the same questions — your picks will be merged to find films you&apos;ll both love.
        </p>
      </div>
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={onContinue}
        className="cinematic-btn px-10 py-4 rounded-xl text-lg group"
      >
        <span className="flex items-center gap-2">
          Start my quiz
          <svg className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
        </span>
      </motion.button>
    </motion.div>
  );
}

// ─── Quiz Inner (uses search params) ─────────────────────────────
function QuizInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Friend mode state
  const isFriendMode = searchParams.get('mode') === 'friend';
  const [friendPerson, setFriendPerson] = useState<'A' | 'B'>(
    (searchParams.get('person') as 'A' | 'B') ?? (isFriendMode ? 'A' : 'A')
  );
  const [answersA, setAnswersA] = useState<Record<string, string>>({});
  const [showHandoff, setShowHandoff] = useState(false);

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [currentQ, setCurrentQ] = useState<QuestionResponse | null>(null);
  const [questionNum, setQuestionNum] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [multiSelected, setMultiSelected] = useState<Set<string>>(new Set());
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    // If arriving via friend link (person=B already set), load answersA from sessionStorage
    if (isFriendMode && friendPerson === 'B') {
      const stored = sessionStorage.getItem('moodflix_answers_a');
      if (stored) setAnswersA(JSON.parse(stored));
    }
    fetchNextQuestion({});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchNextQuestion = async (currentAnswers: Record<string, string>) => {
    setIsLoading(true);
    setError(null);
    setSelectedOption(null);
    setMultiSelected(new Set());
    try {
      const q = await getNextQuestion(currentAnswers);
      if (q.is_final) {
        await handleFinal(currentAnswers);
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

  const handleFinal = async (finalAnswers: Record<string, string>) => {
    if (isFriendMode && friendPerson === 'A') {
      // Person A done — save answers, show handoff
      sessionStorage.setItem('moodflix_answers_a', JSON.stringify(finalAnswers));
      setAnswersA(finalAnswers);
      setShowHandoff(true);
      setIsLoading(false);
      setIsSubmitting(false);
      return;
    }

    // Solo or Person B → fetch recommendations
    setIsSubmitting(true);
    try {
      if (isFriendMode && friendPerson === 'B') {
        const storedA = sessionStorage.getItem('moodflix_answers_a');
        const aAnswers = storedA ? JSON.parse(storedA) : answersA;
        const data = await getFriendRecommendations(aAnswers, finalAnswers);
        sessionStorage.setItem('moodflix_results', JSON.stringify(data));
        sessionStorage.setItem('moodflix_answers', JSON.stringify(finalAnswers));
        sessionStorage.setItem('moodflix_friend_mode', 'true');
        sessionStorage.setItem('moodflix_merged_mood', data.merged_mood ?? '');
      } else {
        const data = await getRecommendations(finalAnswers);
        sessionStorage.setItem('moodflix_results', JSON.stringify(data));
        sessionStorage.setItem('moodflix_answers', JSON.stringify(finalAnswers));
        sessionStorage.removeItem('moodflix_friend_mode');
      }
      router.push('/results');
    } catch (e) {
      setError((e as Error).message);
      setIsSubmitting(false);
    }
  };

  const startPersonB = () => {
    setShowHandoff(false);
    setFriendPerson('B');
    setAnswers({});
    setHistory([]);
    setQuestionNum(0);
    setCurrentQ(null);
    fetchNextQuestion({});
  };

  const handleAnswer = async (option: string) => {
    if (!currentQ) return;
    setHistory(prev => [...prev, { question: currentQ, questionNum, answers }]);
    setSelectedOption(option);
    await new Promise(r => setTimeout(r, 200));
    const qKey = `q${questionNum}`;
    const newAnswers = { ...answers, [qKey]: option };
    setAnswers(newAnswers);
    await fetchNextQuestion(newAnswers);
  };

  const toggleMulti = (option: string) => {
    const noneOption = currentQ?.options.find(o => o.toLowerCase().includes('nope') || o.toLowerCase().includes('anything goes'));
    setMultiSelected(prev => {
      const next = new Set(prev);
      if (option === noneOption) return next.has(option) ? new Set() : new Set([option]);
      if (next.has(option)) { next.delete(option); }
      else { if (noneOption) next.delete(noneOption); next.add(option); }
      return next;
    });
  };

  const submitMultiSelect = async () => {
    if (!currentQ) return;
    setHistory(prev => [...prev, { question: currentQ, questionNum, answers }]);
    const value = multiSelected.size === 0 ? 'Nope, anything goes' : Array.from(multiSelected).join(', ');
    const qKey = `q${questionNum}`;
    const newAnswers = { ...answers, [qKey]: value };
    setAnswers(newAnswers);
    await fetchNextQuestion(newAnswers);
  };

  const handleBack = () => {
    if (history.length === 0) { router.push('/'); return; }
    const prev = history[history.length - 1];
    setHistory(h => h.slice(0, -1));
    setCurrentQ(prev.question);
    setQuestionNum(prev.questionNum);
    setAnswers(prev.answers);
    setSelectedOption(null);
    setMultiSelected(new Set());
    setError(null);
  };

  const isMulti = currentQ ? isMultiSelectQuestion(currentQ) : false;

  useEffect(() => {
    if (!currentQ || isLoading || isSubmitting || error || showHandoff) return;
    const handleKey = (e: KeyboardEvent) => {
      const num = parseInt(e.key);
      if (!isNaN(num) && num >= 1 && num <= currentQ.options.length) {
        const option = currentQ.options[num - 1];
        if (isMulti) toggleMulti(option);
        else handleAnswer(option);
      }
      if (e.key === 'Enter' && isMulti) submitMultiSelect();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentQ, isLoading, isSubmitting, error, isMulti, multiSelected, showHandoff]);

  const progressPercent = Math.min(((questionNum - 1) / MAX_QUESTIONS) * 100, 100);
  const loadingText = isSubmitting
    ? 'Finding your films...'
    : questionNum === 0 ? 'Getting started...' : 'One moment...';

  // Friend mode label
  const personLabel = isFriendMode
    ? (friendPerson === 'A' ? 'Person A' : 'Person B')
    : null;

  return (
    <main className="min-h-screen bg-background flex flex-col items-center justify-center px-6 py-12 relative overflow-hidden">
      <div
        className="absolute top-1/2 left-1/2 w-[120%] h-[120%] -translate-x-1/2 -translate-y-1/2 pointer-events-none rounded-full blur-[150px] opacity-[0.04]"
        style={{ background: 'var(--color-primary)' }}
      />

      <div className="relative z-10 w-full max-w-lg flex flex-col gap-10">
        {/* Top Nav */}
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <button
              onClick={handleBack}
              className="text-foreground/40 hover:text-foreground transition-colors text-sm font-semibold flex items-center gap-1.5"
            >
              <span>←</span> {history.length > 0 ? 'Back' : 'Home'}
            </button>
            <div className="flex items-center gap-2">
              {personLabel && (
                <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-primary">
                  {personLabel}
                </span>
              )}
              <span className="font-display font-black text-xl tracking-tight text-foreground">
                Mood<span className="text-primary">Flix</span>
              </span>
            </div>
          </div>

          {!showHandoff && (
            <div className="w-full h-1 bg-surface rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-primary"
                initial={{ width: 0 }}
                animate={{ width: `${progressPercent}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
              />
            </div>
          )}
        </div>

        <AnimatePresence mode="wait">
          {/* Handoff screen */}
          {showHandoff && (
            <HandoffScreen key="handoff" onContinue={startPersonB} />
          )}

          {/* Loading */}
          {!showHandoff && (isLoading || isSubmitting) && (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center gap-6 py-32">
              <div className="relative w-12 h-12 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
                <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
              </div>
              <p className="text-foreground/50 text-sm font-semibold tracking-wide uppercase">{loadingText}</p>
            </motion.div>
          )}

          {/* Error */}
          {!showHandoff && error && !isLoading && (
            <motion.div key="error" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="cinematic-glass rounded-2xl p-8 text-center border-red-500/20">
              <div className="text-4xl mb-4">⚠️</div>
              <h3 className="font-display font-bold text-xl mb-3 text-foreground">Something went wrong</h3>
              <p className="text-foreground/60 text-sm leading-relaxed mb-8">{cleanErrorMessage(error)}</p>
              <button onClick={() => { setError(null); fetchNextQuestion(answers); }} className="cinematic-btn w-full py-4 rounded-xl">Try again</button>
            </motion.div>
          )}

          {/* Question card */}
          {!showHandoff && !isLoading && !isSubmitting && !error && currentQ && (
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
                  {personLabel && <span className="ml-2 text-primary/50">· {personLabel}</span>}
                </span>
                <h2 className="font-display text-3xl sm:text-4xl font-black leading-tight text-balance text-foreground">
                  {currentQ.question}
                </h2>
                {isMulti && (
                  <p className="text-foreground/40 text-sm font-medium">Pick all that apply — or skip if nothing bothers you.</p>
                )}
              </div>

              {/* Options */}
              <div className="flex flex-col gap-3">
                {currentQ.options.map((option, i) => {
                  const icon = OPTION_ICONS[option] ?? '•';
                  const isSelected = isMulti ? multiSelected.has(option) : selectedOption === option;
                  return (
                    <motion.button
                      key={option}
                      id={`option-${i}`}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05, duration: 0.3 }}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => isMulti ? toggleMulti(option) : handleAnswer(option)}
                      className={`w-full text-left px-6 py-5 rounded-2xl border transition-all duration-300 flex items-center gap-4 font-semibold text-lg ${
                        isSelected
                          ? 'bg-primary border-primary text-white shadow-[0_0_20px_rgba(225,29,72,0.3)]'
                          : 'bg-surface border-border/50 text-foreground/80 hover:bg-surface-hover hover:border-border hover:text-foreground'
                      }`}
                    >
                      <span className="text-[10px] font-bold w-5 text-center flex-shrink-0 opacity-30 font-mono">{i + 1}</span>
                      <span className="text-2xl w-8 text-center flex-shrink-0 opacity-80">{icon}</span>
                      <span className="flex-1">{option}</span>
                      {isMulti ? (
                        <span className={`w-5 h-5 rounded flex-shrink-0 border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-white border-white' : 'border-white/20'}`}>
                          {isSelected && (
                            <motion.svg initial={{ scale: 0 }} animate={{ scale: 1 }} className="w-3 h-3 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </motion.svg>
                          )}
                        </span>
                      ) : (
                        isSelected && (
                          <motion.span initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} className="text-white text-lg font-bold">✓</motion.span>
                        )
                      )}
                    </motion.button>
                  );
                })}
              </div>

              {/* Multi-select confirm */}
              {isMulti && (
                <motion.button
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={submitMultiSelect}
                  className="cinematic-btn w-full py-4 rounded-xl text-base group"
                >
                  {multiSelected.size === 0 ? 'Nothing bothers me →' : `Confirm ${multiSelected.size} dealbreaker${multiSelected.size > 1 ? 's' : ''} →`}
                </motion.button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}

// Wrap in Suspense for useSearchParams
export default function QuizPage() {
  return (
    <Suspense>
      <QuizInner />
    </Suspense>
  );
}
