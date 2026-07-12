'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import MovieCard from '@/components/MovieCard';
import ExplainModal from '@/components/ExplainModal';
import MoodBreakdownModal from '@/components/MoodBreakdownModal';
import FeedbackWidget from '@/components/FeedbackWidget';
import { Movie, MoodProfile, RecommendResponse, FriendRecommendResponse, getExplanation, SessionRepository } from '@/lib/api';

// Build a readable sentence from the mood profile
function buildVibeSentence(profile: MoodProfile): string {
  const parts: string[] = [];
  if (profile.mood) parts.push(profile.mood.charAt(0).toUpperCase() + profile.mood.slice(1));
  if (profile.pace && profile.pace !== 'any') parts.push(`${profile.pace}-paced`);
  if (profile.tone && profile.tone !== 'any') parts.push(profile.tone);
  if (profile.ending && profile.ending !== 'any') parts.push(`${profile.ending} ending`);
  return parts.join(' · ');
}

export default function ResultsPage() {
  const router = useRouter();
  const [movies, setMovies] = useState<Movie[]>([]);
  const [moodProfile, setMoodProfile] = useState<MoodProfile | null>(null);
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({});
  const [isFriendMode, setIsFriendMode] = useState(false);
  const [mergedMood, setMergedMood] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [explainLoading, setExplainLoading] = useState(false);

  // Breakdown modal
  const [breakdownOpen, setBreakdownOpen] = useState(false);

  // Share state
  const [shareState, setShareState] = useState<'idle' | 'copied'>('idle');

  useEffect(() => {
    const data = SessionRepository.getResults();
    if (!data) { router.replace('/'); return; }
    try {
      setMovies(data.recommendations ?? []);
      setMoodProfile(data.mood_profile ?? null);
      if (data.session_id) setSessionId(data.session_id);
      
      const answers = SessionRepository.getAnswers();
      if (answers) setUserAnswers(answers);
      
      // Friend mode
      const friendMode = SessionRepository.isFriendMode();
      if (friendMode) {
        setIsFriendMode(true);
        const mm = SessionRepository.getMergedMood();
        if (mm) setMergedMood(mm);
      }
    } catch { router.replace('/'); }
  }, [router]);

  const fetchExplanation = useCallback(async (movie: Movie) => {
    setExplainLoading(true);
    setExplanation(null);
    try {
      const res = await getExplanation(movie.id, moodProfile!, userAnswers);
      setExplanation(res.explanation);
    } catch { setExplanation(null); }
    finally { setExplainLoading(false); }
  }, [moodProfile, userAnswers]);

  const handleWhyThis = useCallback(async (movie: Movie) => {
    setSelectedMovie(movie);
    setModalOpen(true);
    fetchExplanation(movie);
  }, [fetchExplanation]);

  const handleRetryExplain = useCallback(() => {
    if (selectedMovie) fetchExplanation(selectedMovie);
  }, [selectedMovie, fetchExplanation]);

  const handleClose = useCallback(() => {
    setModalOpen(false);
    setSelectedMovie(null);
    setExplanation(null);
  }, []);

  const handleShare = useCallback(async () => {
    const titles = movies.map(m => m.title).join(', ');
    const vibe = moodProfile ? buildVibeSentence(moodProfile) : 'my mood';
    const prefix = isFriendMode ? 'MoodFlix picked these for us' : 'MoodFlix picked these for me';
    const text = `${prefix}: ${titles}\n\nVibe: ${vibe}\n\nFind your perfect film → ${window.location.origin}`;
    if (navigator.share) {
      try { await navigator.share({ title: 'My MoodFlix picks', text }); return; } catch { /* cancelled */ }
    }
    try {
      await navigator.clipboard.writeText(text);
      setShareState('copied');
      setTimeout(() => setShareState('idle'), 2500);
    } catch { /* denied */ }
  }, [movies, moodProfile, isFriendMode]);

  const vibeSentence = moodProfile ? buildVibeSentence(moodProfile) : null;
  const genreTags = moodProfile?.genres?.slice(0, 3) ?? [];
  const dealbreakers = moodProfile?.dealbreakers?.filter(d => d && d.toLowerCase() !== 'nope' && d.toLowerCase() !== 'anything') ?? [];

  return (
    <main className="min-h-screen bg-background relative overflow-hidden">
      {/* Ambient top glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[300px] pointer-events-none"
        style={{ background: 'radial-gradient(ellipse, rgba(202,138,4,0.1) 0%, transparent 70%)' }} />
      <div className="absolute inset-0 opacity-[0.015] pointer-events-none mix-blend-overlay"
        style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E\")" }} />

      {/* Sticky top bar */}
      <div className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="max-w-[1400px] mx-auto px-6 py-4 flex items-center justify-between">
          <button onClick={() => router.push('/')}
            className="font-display font-black text-xl tracking-tight text-foreground">
            Mood<span className="text-primary">Flix</span>
          </button>
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Taste Profile button */}
            <motion.button
              id="taste-profile-btn"
              onClick={() => setBreakdownOpen(true)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest px-3 py-1.5 rounded-lg border border-primary/30 bg-primary/5 text-primary hover:bg-primary/10 transition-all duration-200"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <span className="hidden sm:inline">Taste Profile</span>
              <span className="sm:hidden">Profile</span>
            </motion.button>

            {/* Share button */}
            <motion.button
              id="share-btn"
              onClick={handleShare}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest px-3 py-1.5 rounded-lg border border-border/60 text-foreground/60 hover:text-foreground hover:border-primary/40 hover:bg-primary/5 transition-all duration-200"
            >
              <AnimatePresence mode="wait">
                {shareState === 'copied' ? (
                  <motion.span key="copied" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} className="flex items-center gap-1.5 text-primary">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                    Copied!
                  </motion.span>
                ) : (
                  <motion.span key="share" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} className="flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                    Share
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>

            <button
              id="start-over-btn"
              onClick={() => { SessionRepository.clearSession(); router.push('/quiz'); }}
              className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-foreground/80 hover:text-foreground transition-colors px-3 py-1.5"
            >
              <span>↺</span> <span className="hidden sm:inline">Start Over</span>
            </button>
          </div>
        </div>
      </div>

      <div className="relative z-10 max-w-[1400px] mx-auto px-6 py-12">
        {/* Header section */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
          <div className="flex items-center gap-3 mb-3">
            <p className="text-primary text-xs font-bold uppercase tracking-widest">
              {isFriendMode ? '🎬 Picked for both of you' : 'Curated for you'}
            </p>
            {isFriendMode && (
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-primary">
                Friend Mode
              </span>
            )}
          </div>

          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-6">
            <h1 className="text-5xl sm:text-6xl font-display font-black text-foreground leading-[1.1] tracking-tight text-balance">
              {isFriendMode && mergedMood
                ? mergedMood
                : moodProfile?.mood
                  ? <>{moodProfile.mood.charAt(0).toUpperCase() + moodProfile.mood.slice(1)}</>
                  : 'Your Perfect Picks'}
            </h1>

            {/* Genre chips */}
            {genreTags.length > 0 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="flex flex-wrap gap-2 md:justify-end">
                {genreTags.map(tag => (
                  <span key={tag} className="text-[11px] uppercase tracking-wider px-3 py-1.5 rounded-full bg-surface border border-border font-bold text-foreground/70">
                    {tag}
                  </span>
                ))}
              </motion.div>
            )}
          </div>

          {/* Vibe sentence */}
          {vibeSentence && (
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <span className="text-foreground/35 text-sm font-medium uppercase tracking-widest">Your vibe</span>
              <span className="text-foreground/70 text-sm font-semibold">{vibeSentence}</span>
              {dealbreakers.length > 0 && (
                <>
                  <span className="text-foreground/20">·</span>
                  <span className="text-foreground/35 text-sm font-medium">Avoiding</span>
                  <span className="text-foreground/60 text-sm font-semibold">{dealbreakers.join(', ')}</span>
                </>
              )}
            </motion.div>
          )}
        </motion.div>

        {/* Divider */}
        <div className="w-full h-px bg-gradient-to-r from-border via-border/20 to-transparent mb-12" />

        {/* Movie grid */}
        {movies.length === 0 ? (
          <div className="text-center py-32 flex flex-col items-center">
            <p className="text-foreground/40 text-xl font-medium mb-6">No movies found. Let&apos;s try different moods!</p>
            <button onClick={() => router.push('/quiz')} className="cinematic-btn px-8 py-4 rounded-xl">Try again</button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-6">
            {movies.map((movie, i) => (
              <MovieCard key={movie.id} movie={movie} index={i} onWhyThis={handleWhyThis} moodProfile={moodProfile} />
            ))}
          </div>
        )}

        {/* Bottom CTA */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }} className="text-center mt-20 flex flex-col items-center gap-4">
          <p className="text-foreground/40 text-sm font-medium">Not quite what you were looking for?</p>
          <button
            onClick={() => { SessionRepository.clearSession(); router.push('/quiz'); }}
            className="px-8 py-4 rounded-xl border border-border text-foreground/60 hover:text-foreground hover:border-border hover:bg-surface transition-all duration-300 font-bold uppercase tracking-widest text-xs"
          >
            Redo the Quiz
          </button>
        </motion.div>

        {/* Feedback Widget */}
        {sessionId && movies.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.0 }} className="mt-16">
            <FeedbackWidget sessionId={sessionId} />
          </motion.div>
        )}
      </div>

      <ExplainModal
        isOpen={modalOpen}
        movieTitle={selectedMovie?.title ?? ''}
        explanation={explanation}
        isLoading={explainLoading}
        onClose={handleClose}
        onRetry={handleRetryExplain}
      />

      <MoodBreakdownModal
        isOpen={breakdownOpen}
        moodProfile={moodProfile}
        onClose={() => setBreakdownOpen(false)}
      />
    </main>
  );
}
