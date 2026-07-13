'use client';

import { useEffect, Suspense, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { generateAdaptiveQuiz, getRecommendations, getFriendRecommendations, createSession, getSession, submitSession, QuestionResponse, SessionRepository } from '@/lib/api';
import { useQuizEngine } from './useQuizEngine';

const MAX_QUESTIONS = 5;



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

// ─── Local Handoff Screen (Pass the Phone) ───────────────────────
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

// ─── Handoff Choice Screen (Same vs Different Device) ────────────
function HandoffChoiceScreen({
  onLocal,
  onRemote,
  isLoading,
}: {
  onLocal: () => void;
  onRemote: () => void;
  isLoading: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97 }}
      className="flex flex-col items-center text-center gap-8"
    >
      <div className="text-7xl">🎬</div>
      <div className="flex flex-col gap-3">
        <h2 className="font-display text-3xl font-black text-white">
          Person A is done!
        </h2>
        <p className="text-white/50 text-base max-w-sm leading-relaxed">
          How would you like your friend (Person B) to take the quiz and merge your vibes?
        </p>
      </div>

      <div className="flex flex-col gap-4 w-full">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onLocal}
          className="w-full text-left px-6 py-5 rounded-2xl border bg-surface border-border/50 text-foreground/80 hover:bg-surface-hover hover:border-border hover:text-foreground transition-all duration-300 flex items-center gap-4 font-semibold text-lg"
        >
          <span className="text-2xl">📱</span>
          <div className="flex flex-col text-left">
            <span>Pass the phone</span>
            <span className="text-xs text-white/40 font-normal">Answer sequentially on this same device</span>
          </div>
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onRemote}
          disabled={isLoading}
          className="w-full text-left px-6 py-5 rounded-2xl border bg-surface border-border/50 text-foreground/80 hover:bg-surface-hover hover:border-border hover:text-foreground transition-all duration-300 flex items-center gap-4 font-semibold text-lg disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span className="text-2xl">🔗</span>
          <div className="flex flex-col text-left">
            <span>Share a session link</span>
            <span className="text-xs text-white/40 font-normal">
              {isLoading ? 'Creating session...' : 'Send a link to your friend to play on their device'}
            </span>
          </div>
        </motion.button>
      </div>
    </motion.div>
  );
}

// ─── Remote Share Screen (Waiting Screen) ───────────────────────
function RemoteShareScreen({
  sessionId,
  onCopy,
  copied,
}: {
  sessionId: string;
  onCopy: () => void;
  copied: boolean;
}) {
  const shareUrl = `${window.location.origin}/quiz?session_id=${sessionId}&mode=friend&person=B`;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97 }}
      className="flex flex-col items-center text-center gap-8"
    >
      <div className="text-7xl">💬</div>
      <div className="flex flex-col gap-3">
        <h2 className="font-display text-3xl font-black text-white">
          Send link to friend
        </h2>
        <p className="text-white/50 text-base max-w-sm leading-relaxed">
          Copy and share this link. Once they complete the quiz, this page will automatically redirect to your merged results!
        </p>
      </div>

      <div className="w-full flex flex-col gap-3">
        <div className="relative flex items-center bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-sm text-white/60 font-mono select-all overflow-x-auto whitespace-nowrap hide-scrollbar">
          {shareUrl}
        </div>
        
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onCopy}
          className="cinematic-btn w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2"
        >
          {copied ? (
            <>
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Link Copied!
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
              </svg>
              Copy Session Link
            </>
          )}
        </motion.button>
      </div>

      <div className="flex items-center gap-3 py-4">
        <div className="relative w-5 h-5 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
        </div>
        <span className="text-xs font-semibold text-foreground/50 tracking-wider uppercase">
          Live Status: Waiting for Friend...
        </span>
      </div>
    </motion.div>
  );
}

// ─── Quiz Inner (uses search params) ─────────────────────────────
function QuizInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Friend mode state
  const sessionIdParam = searchParams.get('session_id');
  const isFriendMode = searchParams.get('mode') === 'friend' || !!sessionIdParam;
  
  const [state, dispatch] = useQuizEngine();
  const {
    status, friendPerson, answersA, sessionId, copied,
    answers, currentQ, upcomingQuestions, questionNum,
    error, selectedOption, multiSelected, history
  } = state;

  const showHandoff = status === 'HANDOFF_LOCAL';
  const showHandoffChoice = status === 'HANDOFF_CHOICE';
  const isFriendWaiting = status === 'WAITING_FOR_FRIEND';
  const isLoading = status === 'INITIALIZING' || status === 'LOADING_NEXT_QUESTION';
  const isSubmitting = status === 'SUBMITTING_FINAL' || status === 'CREATING_SESSION';

  const isAnswerLocked = useRef(false);
  useEffect(() => {
    isAnswerLocked.current = false;
  }, [questionNum, friendPerson, status]);

  useEffect(() => {
    const loadQuiz = async () => {
      const sessionParam = searchParams.get('session_id');
      const personParam = searchParams.get('person') as 'A' | 'B';
      
      let initialAnswersA: Record<string, string> | undefined = undefined;

      if (sessionParam) {
        dispatch({ type: 'INIT_START', payload: { friendPerson: 'B', sessionId: sessionParam } });
        try {
          const session = await getSession(sessionParam);
          initialAnswersA = session.answers_a ?? {};
          dispatch({ type: 'INIT_START', payload: { friendPerson: 'B', sessionId: sessionParam, answersA: initialAnswersA } });
        } catch {
          dispatch({ type: 'SET_ERROR', payload: 'Invalid or expired remote sharing session link. Please start a new session.' });
          return;
        }
      } else {
        const fp = personParam ?? (isFriendMode ? 'A' : 'A');
        dispatch({ type: 'INIT_START', payload: { friendPerson: fp, sessionId: null } });
        if (isFriendMode && fp === 'B') {
          const stored = SessionRepository.getAnswersA();
          if (stored) {
             initialAnswersA = stored;
             dispatch({ type: 'INIT_START', payload: { friendPerson: fp, sessionId: null, answersA: initialAnswersA } });
          }
        }
      }
      
      try {
        const starter: QuestionResponse = {
          question: "How would you describe your week so far?",
          options: ["Exhausting", "Rollercoaster", "Chill", "Productive", "Surprise me"],
          is_final: false
        };
        dispatch({ type: 'INIT_SUCCESS', payload: { currentQ: starter } });
      } catch (e) {
        dispatch({ type: 'SET_ERROR', payload: (e as Error).message });
      }
    };
    
    loadQuiz();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Polling logic for Person A waiting screen
  useEffect(() => {
    if (status !== 'WAITING_FOR_FRIEND' || !sessionId) return;
    
    const cancelPoll = SessionRepository.pollRemoteSession(sessionId, () => {
      router.push('/results');
    });

    return () => cancelPoll();
  }, [status, sessionId, router]);

  const fetchNextQuestion = async (currentAnswers: Record<string, string>) => {
    dispatch({ type: 'NEXT_QUESTION_START', payload: { newAnswers: currentAnswers } });
    
    try {
      if (questionNum === 1) {
        // Single LLM call to generate the rest of the custom quiz
        const res = await generateAdaptiveQuiz(currentAnswers["q1"]);
        if (res.questions.length > 0) {
          dispatch({ type: 'NEXT_QUESTION_SUCCESS', payload: { currentQ: res.questions[0], upcomingQuestions: res.questions } });
        } else {
          await handleFinal(currentAnswers);
        }
      } else {
        // Pop the next generated question from local state
        const nextIndex = questionNum - 1;
        if (nextIndex < upcomingQuestions.length) {
          dispatch({ type: 'NEXT_QUESTION_SUCCESS', payload: { currentQ: upcomingQuestions[nextIndex] } });
        } else {
          await handleFinal(currentAnswers);
        }
      }
    } catch (e) {
      dispatch({ type: 'SET_ERROR', payload: (e as Error).message });
    }
  };

  const handleFinal = async (finalAnswers: Record<string, string>) => {
    if (isFriendMode && friendPerson === 'A') {
      SessionRepository.setAnswersA(finalAnswers);
      dispatch({ type: 'HANDOFF_CHOICE', payload: { finalAnswers } });
      return;
    }

    dispatch({ type: 'SUBMIT_START' });
    try {
      await SessionRepository.finalizeQuiz(finalAnswers, isFriendMode, friendPerson, sessionId);
      router.push('/results');
    } catch (e) {
      dispatch({ type: 'SET_ERROR', payload: (e as Error).message });
    }
  };

  const handleSelectLocal = () => {
    dispatch({ type: 'HANDOFF_LOCAL' });
  };

  const handleSelectRemote = async () => {
    dispatch({ type: 'HANDOFF_REMOTE_START' });
    try {
      const res = await createSession(answersA);
      dispatch({ type: 'HANDOFF_REMOTE_SUCCESS', payload: { sessionId: res.session_id } });
    } catch (e) {
      dispatch({ type: 'SET_ERROR', payload: 'Failed to create remote sharing session. Please try again.' });
    }
  };

  const handleCopyLink = () => {
    if (!sessionId) return;
    const shareUrl = `${window.location.origin}/quiz?session_id=${sessionId}&mode=friend&person=B`;
    navigator.clipboard.writeText(shareUrl).then(() => {
      dispatch({ type: 'COPY_LINK_SUCCESS' });
      setTimeout(() => dispatch({ type: 'RESET_COPY_LINK' }), 2500);
    });
  };

  const startPersonB = () => {
    const starter: QuestionResponse = {
      question: "How would you describe your week so far?",
      options: ["Exhausting", "Rollercoaster", "Chill", "Productive", "Surprise me"],
      is_final: false
    };
    dispatch({ type: 'START_PERSON_B', payload: { currentQ: starter } });
  };

  const handleAnswer = async (option: string) => {
    if (!currentQ || status !== 'TAKING_QUIZ' || isAnswerLocked.current) return;
    isAnswerLocked.current = true;
    dispatch({ type: 'ANSWER_SELECT', payload: { option, currentQ } });
    await new Promise(r => setTimeout(r, 200));
    const qKey = `q${questionNum}`;
    const newAnswers = { ...answers, [qKey]: option };
    await fetchNextQuestion(newAnswers);
  };

  const toggleMulti = (option: string) => {
    const noneOption = currentQ?.options.find(o => o.toLowerCase().includes('nope') || o.toLowerCase().includes('anything goes'));
    dispatch({ type: 'MULTI_TOGGLE', payload: { option, noneOption } });
  };

  const submitMultiSelect = async () => {
    if (!currentQ || status !== 'TAKING_QUIZ' || isAnswerLocked.current) return;
    isAnswerLocked.current = true;
    dispatch({ type: 'SUBMIT_MULTI_SELECT', payload: { currentQ } });
    const value = multiSelected.size === 0 ? 'Nope, anything goes' : Array.from(multiSelected).join(', ');
    const qKey = `q${questionNum}`;
    const newAnswers = { ...answers, [qKey]: value };
    await fetchNextQuestion(newAnswers);
  };

  const handleBack = () => {
    if (history.length === 0) { router.push('/'); return; }
    dispatch({ type: 'BACK' });
  };

  const isMulti = currentQ ? (currentQ.is_multi_select ?? false) : false;

  useEffect(() => {
    if (!currentQ || status !== 'TAKING_QUIZ' || error) return;
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
  }, [currentQ, status, error, isMulti, multiSelected]);

  const maxTotalQuestions = Math.max(MAX_QUESTIONS, upcomingQuestions.length + 1);
  const progressPercent = Math.min(((questionNum - 1) / maxTotalQuestions) * 100, 100);
  
  const loadingText = isSubmitting
    ? 'Finding your films...'
    : questionNum === 1 ? 'Reading your vibe...' : 'One moment...';

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

          {!showHandoff && !showHandoffChoice && !isFriendWaiting && (
            <div className="w-full h-1 bg-surface rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-primary"
                initial={{ width: 0 }}
                animate={{ width: `${progressPercent}%` }}
                transition={{ type: 'spring', bounce: 0, duration: 0.5 }}
              />
            </div>
          )}
        </div>

        <AnimatePresence mode="wait">
          {showHandoffChoice && (
            <HandoffChoiceScreen
              key="handoff-choice"
              onLocal={handleSelectLocal}
              onRemote={handleSelectRemote}
              isLoading={isSubmitting}
            />
          )}

          {isFriendWaiting && sessionId && (
            <RemoteShareScreen
              key="remote-share"
              sessionId={sessionId}
              onCopy={handleCopyLink}
              copied={copied}
            />
          )}

          {showHandoff && (
            <HandoffScreen key="handoff" onContinue={startPersonB} />
          )}

          {!showHandoff && !showHandoffChoice && !isFriendWaiting && (isLoading || isSubmitting) && !error && (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center gap-6 py-32">
              <div className="relative w-12 h-12 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
                <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
              </div>
              <p className="text-foreground/50 text-sm font-semibold tracking-wide uppercase">{loadingText}</p>
            </motion.div>
          )}

          {!showHandoff && !showHandoffChoice && !isFriendWaiting && error && (
            <motion.div key="error" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="cinematic-glass rounded-2xl p-8 text-center border-red-500/20">
              <div className="text-4xl mb-4">⚠️</div>
              <h3 className="font-display font-bold text-xl mb-3 text-foreground">Something went wrong</h3>
              <p className="text-foreground/60 text-sm leading-relaxed mb-8">{cleanErrorMessage(error)}</p>
              <button onClick={() => { 
                dispatch({ type: 'CLEAR_ERROR' }); 
                if (status === 'INITIALIZING') {
                  window.location.reload();
                } else if (status === 'SUBMITTING_FINAL') {
                  handleFinal(answers);
                } else if (status === 'CREATING_SESSION') {
                  handleSelectRemote();
                } else {
                  fetchNextQuestion(answers); 
                }
              }} className="cinematic-btn w-full py-4 rounded-xl">Try again</button>
            </motion.div>
          )}

          {!showHandoff && !showHandoffChoice && !isFriendWaiting && !isLoading && !isSubmitting && !error && currentQ && (
            <motion.div
              key={questionNum}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ type: 'spring', bounce: 0, duration: 0.4 }}
              className="flex flex-col gap-8"
            >
              <div className="flex flex-col gap-3">
                <span className="text-primary/80 text-xs font-bold uppercase tracking-widest">
                  Question {questionNum} of {maxTotalQuestions}
                  {personLabel && <span className="ml-2 text-primary/50">· {personLabel}</span>}
                </span>
                <h2 className="font-display text-3xl sm:text-4xl font-black leading-tight text-balance text-foreground">
                  {currentQ.question}
                </h2>
                {isMulti && (
                  <p className="text-foreground/40 text-sm font-medium">Pick all that apply — or skip if nothing bothers you.</p>
                )}
              </div>

              <div className="flex flex-col gap-3">
                {currentQ.options.map((option, i) => {
                  const isSelected = isMulti ? multiSelected.has(option) : selectedOption === option;
                  return (
                    <motion.button
                      key={option}
                      id={`option-${i}`}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ type: 'spring', bounce: 0, duration: 0.4, delay: i * 0.05 }}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => isMulti ? toggleMulti(option) : handleAnswer(option)}
                      className={`w-full text-left px-4 py-4 sm:px-6 sm:py-5 rounded-2xl border transition-colors transition-shadow duration-300 flex items-center gap-3 sm:gap-4 font-semibold text-base sm:text-lg ${
                        isSelected
                           ? 'bg-primary border-primary text-white shadow-[0_0_20px_rgba(202,138,4,0.3)]'
                           : 'bg-surface border-border/50 text-foreground/80 hover:bg-surface-hover hover:border-border hover:text-foreground'
                      }`}
                    >
                      <span className="text-[10px] font-bold w-5 text-center flex-shrink-0 opacity-30 font-mono">{i + 1}</span>
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

              {isMulti && (
                <motion.button
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: 'spring', bounce: 0, duration: 0.4, delay: 0.3 }}
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

export default function QuizPage() {
  return (
    <Suspense>
      <QuizInner />
    </Suspense>
  );
}
