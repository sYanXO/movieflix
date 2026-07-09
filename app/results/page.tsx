'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import MovieCard from '@/components/MovieCard';
import ExplainModal from '@/components/ExplainModal';
import { Movie, MoodProfile, RecommendResponse, getExplanation } from '@/lib/api';

export default function ResultsPage() {
  const router = useRouter();
  const [movies, setMovies] = useState<Movie[]>([]);
  const [moodProfile, setMoodProfile] = useState<MoodProfile | null>(null);
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({});

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [explainLoading, setExplainLoading] = useState(false);

  useEffect(() => {
    const raw = sessionStorage.getItem('moodflix_results');
    if (!raw) { router.replace('/'); return; }
    try {
      const data: RecommendResponse = JSON.parse(raw);
      setMovies(data.recommendations ?? []);
      setMoodProfile(data.mood_profile ?? null);
      const answers = sessionStorage.getItem('moodflix_answers');
      if (answers) setUserAnswers(JSON.parse(answers));
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

  const moodTags = moodProfile ? [
    moodProfile.pace && `${moodProfile.pace} pace`,
    moodProfile.tone && `${moodProfile.tone}`,
    moodProfile.ending !== 'any' && moodProfile.ending && `${moodProfile.ending} ending`,
    ...(moodProfile.genres ?? []).slice(0, 2),
  ].filter(Boolean) as string[] : [];

  return (
    <main className="min-h-screen bg-background relative overflow-hidden">
      {/* Ambient top glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[300px] pointer-events-none"
        style={{ background: 'radial-gradient(ellipse, rgba(225,29,72,0.1) 0%, transparent 70%)' }} />
      <div className="absolute inset-0 opacity-[0.015] pointer-events-none mix-blend-overlay"
        style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E\")" }} />

      {/* Sticky top bar */}
      <div className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="max-w-[1400px] mx-auto px-6 py-4 flex items-center justify-between">
          <button onClick={() => router.push('/')}
            className="font-display font-black text-xl tracking-tight text-foreground">
            Mood<span className="text-primary">Flix</span>
          </button>
          <button
            id="start-over-btn"
            onClick={() => { sessionStorage.clear(); router.push('/quiz'); }}
            className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-foreground/80 hover:text-foreground transition-colors px-3 py-1.5"
          >
            <span>↺</span> Start Over
          </button>
        </div>
      </div>

      <div className="relative z-10 max-w-[1400px] mx-auto px-6 py-12">
        {/* Header section */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-12"
        >
          <p className="text-primary text-xs font-bold uppercase tracking-widest mb-3">Curated for you</p>
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <h1 className="text-5xl sm:text-6xl font-display font-black text-foreground leading-[1.1] tracking-tight text-balance">
              {moodProfile?.mood
                ? <>{moodProfile.mood.charAt(0).toUpperCase() + moodProfile.mood.slice(1)}</>
                : 'Your Perfect Picks'}
            </h1>

            {/* Mood tags */}
            {moodTags.length > 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="flex flex-wrap gap-2 md:justify-end"
              >
                {moodTags.map(tag => (
                  <span key={tag}
                    className="text-[11px] uppercase tracking-wider px-3 py-1.5 rounded-full bg-surface border border-border font-bold text-foreground/70">
                    {tag}
                  </span>
                ))}
              </motion.div>
            )}
          </div>
        </motion.div>

        {/* Divider */}
        <div className="w-full h-px bg-gradient-to-r from-border via-border/20 to-transparent mb-12" />

        {/* Movie grid */}
        {movies.length === 0 ? (
          <div className="text-center py-32 flex flex-col items-center">
            <p className="text-foreground/40 text-xl font-medium mb-6">No movies found. Let&apos;s try different moods!</p>
            <button onClick={() => router.push('/quiz')}
              className="cinematic-btn px-8 py-4 rounded-xl">
              Try again
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            {movies.map((movie, i) => (
              <MovieCard
                key={movie.id}
                movie={movie}
                index={i}
                onWhyThis={handleWhyThis}
                moodProfile={moodProfile}
              />
            ))}
          </div>
        )}

        {/* Bottom CTA row */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="text-center mt-20 flex flex-col items-center gap-4"
        >
          <p className="text-foreground/40 text-sm font-medium">Not quite what you were looking for?</p>
          <button
            onClick={() => { sessionStorage.clear(); router.push('/quiz'); }}
            className="px-8 py-4 rounded-xl border border-border text-foreground/60 hover:text-foreground hover:border-border hover:bg-surface transition-all duration-300 font-bold uppercase tracking-widest text-xs"
          >
            Redo the Quiz
          </button>
        </motion.div>
      </div>

      <ExplainModal
        isOpen={modalOpen}
        movieTitle={selectedMovie?.title ?? ''}
        explanation={explanation}
        isLoading={explainLoading}
        onClose={handleClose}
        onRetry={handleRetryExplain}
      />
    </main>
  );
}
