'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';

const MOOD_WORDS = [
  'Thrilling', 'Heartwarming', 'Mind-bending',
  'Hilarious', 'Spine-chilling', 'Emotional',
  'Action-packed', 'Mysterious', 'Epic',
];

const PREVIEW_MOVIES = [
  { title: 'Inception', year: 2010, genre: 'Sci-Fi' },
  { title: 'The Dark Knight', year: 2008, genre: 'Action' },
  { title: 'Parasite', year: 2019, genre: 'Thriller' },
  { title: 'Spirited Away', year: 2001, genre: 'Animation' },
  { title: 'Interstellar', year: 2014, genre: 'Sci-Fi' },
  { title: 'Pulp Fiction', year: 1994, genre: 'Crime' },
];

export default function LandingPage() {
  const router = useRouter();
  const [currentWordIndex, setCurrentWordIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setCurrentWordIndex((prev) => (prev + 1) % MOOD_WORDS.length);
    }, 2500);
    return () => clearInterval(id);
  }, []);

  return (
    <main className="relative min-h-screen flex flex-col overflow-hidden bg-background selection:bg-primary/30">
      {/* Subtle cinematic glow */}
      <div 
        className="absolute top-[-20%] left-1/2 w-[80%] max-w-4xl h-[50%] -translate-x-1/2 pointer-events-none rounded-full blur-[120px] opacity-20"
        style={{ background: 'var(--color-primary)' }} 
      />
      
      {/* Noise texture overlay for cinematic feel */}
      <div className="absolute inset-0 opacity-[0.015] pointer-events-none mix-blend-overlay"
        style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E\")" }} />

      {/* Navbar */}
      <nav className="relative z-10 flex items-center justify-between px-6 py-6 max-w-7xl mx-auto w-full">
        <motion.div 
          initial={{ opacity: 0, y: -10 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ duration: 0.5 }}
          className="flex items-center gap-2"
        >
          <span className="font-display font-black text-2xl tracking-tighter text-foreground">
            Mood<span className="text-primary">Flix</span>
          </span>
        </motion.div>
        
        <motion.div
          initial={{ opacity: 0, y: -10 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ duration: 0.5, delay: 0.1 }}
          className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full border border-border/50 bg-surface/50 backdrop-blur-sm"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          <span className="text-xs font-medium text-foreground/70 uppercase tracking-widest">Powered by AI</span>
        </motion.div>
      </nav>

      {/* Hero Content */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center text-center px-4 max-w-4xl mx-auto w-full mt-[-4vh]">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="w-full"
        >
          <h1 className="font-display text-5xl sm:text-7xl md:text-[5.5rem] font-black tracking-tight leading-[1.05] text-balance text-foreground mb-6">
            Find the perfect movie for a <br className="hidden sm:block" />
            <span className="text-primary inline-block min-w-[280px] sm:min-w-[400px] text-center mt-2">
              <motion.span
                key={currentWordIndex}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.4 }}
                className="inline-block"
              >
                {MOOD_WORDS[currentWordIndex]}
              </motion.span>
            </span>
            <br /> night.
          </h1>
        </motion.div>

        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="text-foreground/60 text-lg sm:text-xl max-w-xl leading-relaxed mb-10"
        >
          Skip the endless scrolling. Answer 5 quick questions and let our AI curate the perfect cinematic experience for your exact mood.
        </motion.p>

        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => router.push('/quiz')}
          className="cinematic-btn px-10 py-4 rounded-xl text-lg group"
        >
          <span className="flex items-center gap-2">
            Start the Quiz
            <svg className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
          </span>
        </motion.button>
      </div>

      {/* Footer / Preview Shelf - Minimalist */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, delay: 0.6 }}
        className="relative z-10 w-full border-t border-border/40 bg-surface/30 backdrop-blur-md py-6 mt-auto"
      >
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs font-bold text-foreground/40 uppercase tracking-widest">
            Curated from millions of titles
          </p>
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2">
            {PREVIEW_MOVIES.map((m, i) => (
              <span key={i} className="text-sm font-medium text-foreground/30 flex items-center gap-2">
                {m.title} <span className="text-[10px] opacity-50 px-1 border border-foreground/10 rounded">{m.year}</span>
              </span>
            ))}
          </div>
        </div>
      </motion.div>
    </main>
  );
}
