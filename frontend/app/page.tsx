'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, useInView } from 'framer-motion';
import VectorSpaceVisualizer from '@/components/vector-visualizer';

const MOOD_WORDS = [
  'Thrilling', 'Heartwarming', 'Mind-bending',
  'Hilarious', 'Spine-chilling', 'Emotional',
  'Action-packed', 'Mysterious', 'Epic',
];

const HOW_IT_WORKS_STEPS = [
  {
    number: '01',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-8 h-8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
      </svg>
    ),
    title: 'Tell us your vibe',
    desc: 'Start with one simple question about your current mood — no account, no signup, just honest vibes.',
  },
  {
    number: '02',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-8 h-8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 9.75a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375m-13.5 3.01c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 01.778-.332 48.294 48.294 0 005.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
      </svg>
    ),
    title: 'Answer a few questions',
    desc: 'Up to 5 smart, adaptive questions. It stops as soon as it has enough to nail your perfect pick.',
  },
  {
    number: '03',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-8 h-8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
      </svg>
    ),
    title: 'Builds your mood profile',
    desc: 'Your answers are synthesized into a detailed cinematic mood profile — pace, tone, ending preferences and more.',
  },
  {
    number: '04',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-8 h-8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
      </svg>
    ),
    title: 'Vector search across thousands',
    desc: 'Your profile is matched against embeddings of thousands of films using cosine similarity — surfacing hidden gems, not just box office hits.',
  },
  {
    number: '05',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-8 h-8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0112 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0c0 .621.504 1.125 1.125 1.125h15a1.125 1.125 0 001.125-1.125m-17.25 0v10.5" />
      </svg>
    ),
    title: 'Get your perfect 5',
    desc: 'Receive 5 handpicked recommendations with explanations. Click "Why this?" on any film to understand the reasoning behind each pick.',
  },
];

const FEATURES = [
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
      </svg>
    ),
    title: 'Mood-first, not genre-first',
    desc: 'Stop hunting through genre tabs. Describe how you feel and we handle the rest — because "action" means nothing when you\'re emotionally exhausted.',
    accent: '#CA8A04',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
      </svg>
    ),
    title: 'Adaptive questions',
    desc: 'No rigid 20-question forms. The system adapts in real-time, stopping as soon as it\'s confident — usually in 2–3 questions.',
    accent: '#EAB308',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
      </svg>
    ),
    title: 'Beyond the algorithm bubble',
    desc: 'Vector similarity search across thousands of films surfaces hidden gems you\'d never find on Netflix or Prime. Obscure classics welcome.',
    accent: '#FDE047',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 01.778-.332 48.294 48.294 0 005.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
      </svg>
    ),
    title: 'Transparent reasoning',
    desc: 'Every recommendation comes with a "Why this?" button. You\'ll see exactly why that film was picked for your specific mood — no black boxes.',
    accent: '#CA8A04',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0112 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0c0 .621.504 1.125 1.125 1.125h15a1.125 1.125 0 001.125-1.125m-17.25 0v10.5" />
      </svg>
    ),
    title: 'Zero friction, zero account',
    desc: 'No sign-up, no subscription, no ads. Open the page, answer questions, get your movie. That\'s it.',
    accent: '#EAB308',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
      </svg>
    ),
    title: 'Built for real movie nights',
    desc: 'Designed around how humans actually decide — feeling, energy level, how much attention you have — not abstract genre taxonomies.',
    accent: '#FDE047',
  },
];

function SectionWrapper({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-80px' });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, transform: "translateY(40px)" }}
      animate={isInView ? { opacity: 1, transform: "translateY(0px)" } : { opacity: 0, transform: "translateY(40px)" }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function FeatureCard({ feature, index }: { feature: typeof FEATURES[0]; index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-40px' });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, transform: "translateY(30px)" }}
      animate={isInView ? { opacity: 1, transform: "translateY(0px)" } : { opacity: 0, transform: "translateY(30px)" }}
      transition={{ duration: 0.6, delay: index * 0.08, ease: [0.22, 1, 0.36, 1] }}
      className="group relative p-6 rounded-2xl border border-white/5 bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/10 transition-colors duration-200"
      style={{ '--card-accent': feature.accent } as React.CSSProperties}
    >
      <div
        className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
        style={{ background: `radial-gradient(ellipse at top left, ${feature.accent}18 0%, transparent 60%)` }}
      />
      <div
        className="inline-flex p-2.5 rounded-xl mb-4 text-white/80 group-hover:text-white transition-colors"
        style={{ background: `${feature.accent}22`, color: feature.accent }}
      >
        {feature.icon}
      </div>
      <h3 className="font-display font-bold text-lg text-white mb-2 leading-tight">{feature.title}</h3>
      <p className="text-sm text-white/50 leading-relaxed group-hover:text-white/60 transition-colors">{feature.desc}</p>
    </motion.div>
  );
}

export default function LandingPage() {
  const router = useRouter();
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = setInterval(() => {
      setCurrentWordIndex((prev) => (prev + 1) % MOOD_WORDS.length);
    }, 2500);
    return () => clearInterval(id);
  }, []);

  const scrollSteps = (dir: 'left' | 'right') => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollBy({ left: dir === 'right' ? 340 : -340, behavior: 'smooth' });
  };

  return (
    <main className="relative flex flex-col overflow-hidden bg-background selection:bg-primary/30">

      {/* ── HERO SECTION ─────────────────────────────────────────── */}
      <section className="relative min-h-screen flex flex-col overflow-hidden">
        {/* Vibrant glow — more saturated */}
        <div
          className="absolute top-[-15%] left-1/2 w-[90%] max-w-5xl h-[60%] -translate-x-1/2 pointer-events-none rounded-full blur-[140px] opacity-30"
          style={{ background: 'radial-gradient(ellipse, #CA8A04 0%, #A16207 60%, transparent 100%)' }}
        />
        <div
          className="absolute bottom-0 right-[-10%] w-[50%] h-[40%] pointer-events-none rounded-full blur-[100px] opacity-10"
          style={{ background: '#EAB308' }}
        />

        {/* Noise overlay */}
        <div className="absolute inset-0 opacity-[0.02] pointer-events-none mix-blend-overlay"
          style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E\")" }} />

        {/* Navbar */}
        <nav className="relative z-10 flex items-center justify-between px-6 py-6 max-w-7xl mx-auto w-full">
          <motion.div
            initial={{ opacity: 0, transform: "translateY(-10px)" }}
            animate={{ opacity: 1, transform: "translateY(0px)" }}
            transition={{ duration: 0.5 }}
            className="flex items-center gap-2"
          >
            <span className="font-display font-black text-2xl tracking-tighter text-foreground">
              Mood<span className="text-primary">Flix</span>
            </span>
          </motion.div>

          <motion.a
            href="https://github.com/sYanXO/movieflix"
            target="_blank"
            rel="noopener noreferrer"
            initial={{ opacity: 0, transform: "translateY(-10px)" }}
            animate={{ opacity: 1, transform: "translateY(0px)" }}
            transition={{ duration: 0.5, delay: 0.1 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="group hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full border border-border/50 bg-surface/50 backdrop-blur-sm hover:border-primary/50 transition-colors duration-200 relative cursor-pointer"
          >
            <svg className="w-4 h-4 text-foreground/70 group-hover:text-primary transition-colors duration-200" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
            </svg>
            <span className="text-xs font-medium text-foreground/70 uppercase tracking-widest group-hover:text-primary transition-colors duration-200">GitHub</span>
            
            {/* Floating Message Tooltip */}
            <div className="absolute top-full mt-3 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none whitespace-nowrap bg-surface border border-primary/30 px-3 py-1.5 rounded-lg shadow-xl shadow-primary/10">
              <span className="text-[10px] font-bold text-primary tracking-widest uppercase">Star the repo if you enjoyed it! ⭐</span>
              {/* Tooltip Arrow */}
              <div className="absolute -top-[5px] left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-surface border-t border-l border-primary/30 rotate-45" />
            </div>
          </motion.a>
        </nav>

        {/* Hero Content */}
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center text-center px-4 max-w-4xl mx-auto w-full mt-[-6vh]">
          <motion.div
            initial={{ opacity: 0, transform: "scale(0.95)" }}
            animate={{ opacity: 1, transform: "scale(1)" }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="w-full"
          >
            <h1 className="font-display text-5xl sm:text-7xl md:text-[5.5rem] font-black tracking-tight leading-[1.05] text-balance text-foreground mb-6">
              Find the perfect movie for a <br className="hidden sm:block" />
              <span className="text-primary inline-grid items-center justify-items-center mt-2 mx-2">
                {MOOD_WORDS.map((word, i) => (
                  <motion.span
                    key={word}
                    initial={{ opacity: i === 0 ? 1 : 0, transform: `translateY(${i === 0 ? 0 : 15}px)` }}
                    animate={{ opacity: i === currentWordIndex ? 1 : 0, transform: `translateY(${i === currentWordIndex ? 0 : (i < currentWordIndex ? -15 : 15)}px)` }}
                    transition={{ duration: 0.4 }}
                    className="col-start-1 row-start-1"
                    aria-hidden={i !== currentWordIndex}
                    style={{ pointerEvents: i === currentWordIndex ? 'auto' : 'none' }}
                  >
                    {word}
                  </motion.span>
                ))}
              </span>
              <br /> night.
            </h1>
          </motion.div>

          <motion.p
            initial={{ opacity: 0, transform: "translateY(10px)" }}
            animate={{ opacity: 1, transform: "translateY(0px)" }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-foreground/60 text-lg sm:text-xl max-w-xl leading-relaxed mb-10"
          >
            Skip the endless scrolling. Answer 5 quick questions and get the perfect cinematic experience curated for your exact mood.
          </motion.p>

          <div className="flex flex-col sm:flex-row items-center gap-4">
            <motion.button
              initial={{ opacity: 0, transform: "translateY(10px)" }}
              animate={{ opacity: 1, transform: "translateY(0px)" }}
              transition={{ duration: 0.5, delay: 0.3 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => router.push('/quiz')}
              className="cinematic-btn px-10 py-4 rounded-xl text-lg group w-full sm:w-auto"
            >
              <span className="flex items-center gap-2">
                Start the Quiz
                <svg className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </span>
            </motion.button>

            <motion.button
              initial={{ opacity: 0, transform: "translateY(10px)" }}
              animate={{ opacity: 1, transform: "translateY(0px)" }}
              transition={{ duration: 0.5, delay: 0.4 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => router.push('/quiz?mode=friend')}
              className="w-full sm:w-auto flex items-center justify-center gap-2.5 px-8 py-4 rounded-xl text-base font-bold border border-white/10 bg-white/[0.04] text-white/70 hover:text-white hover:border-white/20 hover:bg-white/[0.08] transition-colors duration-200"
            >
              <svg className="w-5 h-5 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Friend Mode
              <span className="text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded bg-primary/20 text-primary border border-primary/20">New</span>
            </motion.button>
          </div>


          {/* Scroll hint */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 1.2 }}
            className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-white/30"
          >
            <span className="text-xs font-medium uppercase tracking-widest">Scroll to learn more</span>
            <motion.div
              animate={{ transform: ["translateY(0px)", "translateY(6px)", "translateY(0px)"] }}
              transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ── HOW IT WORKS ─────────────────────────────────────────── */}
      <section className="relative py-28 overflow-hidden">
        {/* Animated gradient background */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse 80% 60% at 50% 50%, rgba(202,138,4,0.07) 0%, transparent 70%)',
          }}
        />
        <div
          className="absolute top-0 left-0 right-0 h-px pointer-events-none"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(202,138,4,0.3), transparent)' }}
        />

        <div className="relative z-10 max-w-7xl mx-auto px-6">
          <SectionWrapper>
            <div className="text-center mb-16">
              <span className="inline-block text-xs font-bold text-primary uppercase tracking-[0.2em] mb-4 px-3 py-1 rounded-full border border-primary/20 bg-primary/5">
                How it works
              </span>
              <h2 className="font-display text-4xl sm:text-5xl font-black tracking-tight text-white mb-4">
                From mood to movie in{' '}
                <span className="gradient-text-primary">under 2 minutes</span>
              </h2>
              <p className="text-white/50 text-lg max-w-xl mx-auto">
                No account needed. No genre hunting. Just honest questions and precision matching.
              </p>
            </div>
          </SectionWrapper>

          {/* Horizontal scroll container */}
          <div className="relative">
            {/* Scroll nav buttons */}
            <button
              onClick={() => scrollSteps('left')}
              className="absolute left-0 top-1/2 -translate-y-1/2 z-20 -translate-x-4 hidden md:flex items-center justify-center w-10 h-10 rounded-full border border-white/10 bg-surface/80 backdrop-blur-sm text-white/60 hover:text-white hover:border-white/20 transition-all"
              aria-label="Scroll left"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <button
              onClick={() => scrollSteps('right')}
              className="absolute right-0 top-1/2 -translate-y-1/2 z-20 translate-x-4 hidden md:flex items-center justify-center w-10 h-10 rounded-full border border-white/10 bg-surface/80 backdrop-blur-sm text-white/60 hover:text-white hover:border-white/20 transition-all"
              aria-label="Scroll right"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </button>

            {/* Fade edges */}
            <div className="absolute left-0 top-0 bottom-0 w-16 z-10 pointer-events-none" style={{ background: 'linear-gradient(90deg, var(--color-background), transparent)' }} />
            <div className="absolute right-0 top-0 bottom-0 w-16 z-10 pointer-events-none" style={{ background: 'linear-gradient(-90deg, var(--color-background), transparent)' }} />

            <div
              ref={scrollRef}
              className="flex gap-5 overflow-x-auto pb-4 scroll-smooth snap-x snap-mandatory hide-scrollbar"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              {HOW_IT_WORKS_STEPS.map((step, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, transform: "translateX(30px)" }}
                  whileInView={{ opacity: 1, transform: "translateX(0px)" }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: i * 0.1 }}
                  className="flex-shrink-0 snap-center w-[300px] sm:w-[320px] p-7 rounded-2xl border border-white/5 bg-white/[0.03] relative group hover:border-primary/20 hover:bg-white/[0.05] transition-all duration-300"
                >
                  {/* Step number watermark */}
                  <div className="absolute top-4 right-5 font-display font-black text-6xl text-white/[0.04] select-none pointer-events-none">
                    {step.number}
                  </div>

                  {/* Hover glow */}
                  <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                    style={{ background: 'radial-gradient(ellipse at top left, rgba(202,138,4,0.1) 0%, transparent 60%)' }} />

                  <div className="inline-flex p-3 rounded-xl mb-5 text-primary bg-primary/10 group-hover:bg-primary/15 transition-colors">
                    {step.icon}
                  </div>

                  {/* Connector line (except last) */}
                  {i < HOW_IT_WORKS_STEPS.length - 1 && (
                    <div className="absolute top-[60px] right-[-20px] w-5 h-px z-10 hidden xl:block"
                      style={{ background: 'linear-gradient(90deg, rgba(202,138,4,0.4), transparent)' }} />
                  )}

                  <div className="text-xs font-bold text-primary/60 uppercase tracking-widest mb-2">Step {step.number}</div>
                  <h3 className="font-display font-bold text-xl text-white mb-3 leading-snug">{step.title}</h3>
                  <p className="text-sm text-white/50 leading-relaxed group-hover:text-white/60 transition-colors">{step.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── INTERACTIVE VECTOR PLAYGROUND ──────────────────────── */}
      <section className="relative py-28 overflow-hidden hidden lg:block">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse 80% 60% at 50% 50%, rgba(168,85,247,0.05) 0%, transparent 70%)',
          }}
        />
        <div
          className="absolute top-0 left-0 right-0 h-px pointer-events-none"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(168,85,247,0.25), transparent)' }}
        />
        
        <div className="relative z-10 max-w-7xl mx-auto px-6">
          <SectionWrapper>
            <div className="text-center mb-16">
              <span className="inline-block text-xs font-bold text-primary uppercase tracking-[0.2em] mb-4 px-3 py-1 rounded-full border border-primary/20 bg-primary/5">
                The Science
              </span>
              <h2 className="font-display text-4xl sm:text-5xl font-black tracking-tight text-white mb-4">
                Explore the Movie{' '}
                <span className="gradient-text-primary">Vector Space</span>
              </h2>
              <p className="text-white/50 text-lg max-w-xl mx-auto">
                Drag to explore coordinates, hover to inspect films, and project vibes to calculate cosine similarities in real-time.
              </p>
            </div>
          </SectionWrapper>

          <SectionWrapper>
            <div className="w-full">
              <VectorSpaceVisualizer />
            </div>
          </SectionWrapper>
        </div>
      </section>

      {/* ── FEATURES / WHY MOODFLIX ──────────────────────────────── */}
      <section className="relative py-28 overflow-hidden">
        {/* Animated gradient — shifted hue for visual contrast */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse 70% 80% at 80% 50%, rgba(234,179,8,0.06) 0%, transparent 70%), radial-gradient(ellipse 60% 60% at 20% 80%, rgba(202,138,4,0.05) 0%, transparent 70%)',
          }}
        />
        <div
          className="absolute top-0 left-0 right-0 h-px pointer-events-none"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(234,179,8,0.25), transparent)' }}
        />

        <div className="relative z-10 max-w-7xl mx-auto px-6">
          <SectionWrapper>
            <div className="text-center mb-16">
              <span className="inline-block text-xs font-bold text-primary uppercase tracking-[0.2em] mb-4 px-3 py-1 rounded-full border border-primary/20 bg-primary/5">
                Why MoodFlix
              </span>
              <h2 className="font-display text-4xl sm:text-5xl font-black tracking-tight text-white mb-4">
                Recommendations that{' '}
                <span className="gradient-text-primary">actually fit</span>
              </h2>
              <p className="text-white/50 text-lg max-w-xl mx-auto">
                Because &quot;what&apos;s popular on Netflix&quot; has never once matched how you feel at 10pm on a Tuesday.
              </p>
            </div>
          </SectionWrapper>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((feature, i) => (
              <FeatureCard key={i} feature={feature} index={i} />
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ────────────────────────────────────────────── */}
      <section className="relative py-32 overflow-hidden">
        {/* Bold animated gradient for CTA */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse 100% 120% at 50% 50%, rgba(202,138,4,0.15) 0%, rgba(161,98,7,0.08) 40%, transparent 75%)',
          }}
        />
        <div
          className="absolute top-0 left-0 right-0 h-px pointer-events-none"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(202,138,4,0.4), transparent)' }}
        />
        <div
          className="absolute bottom-0 left-0 right-0 h-px pointer-events-none"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(202,138,4,0.15), transparent)' }}
        />

        {/* Decorative orbs */}
        <div className="absolute top-1/4 left-[10%] w-64 h-64 rounded-full blur-[80px] pointer-events-none opacity-20"
          style={{ background: '#CA8A04' }} />
        <div className="absolute bottom-1/4 right-[10%] w-48 h-48 rounded-full blur-[60px] pointer-events-none opacity-15"
          style={{ background: '#EAB308' }} />

        <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
          <SectionWrapper>
            <span className="inline-block text-xs font-bold text-primary uppercase tracking-[0.2em] mb-6 px-3 py-1 rounded-full border border-primary/20 bg-primary/5">
              Ready?
            </span>
            <h2 className="font-display text-5xl sm:text-6xl md:text-7xl font-black tracking-tight text-white mb-6 leading-[1.02]">
              Your next favorite film{' '}
              <br className="hidden sm:block" />
              is{' '}
              <span className="gradient-text-primary">3 questions away.</span>
            </h2>
            <p className="text-white/50 text-xl max-w-lg mx-auto mb-12 leading-relaxed">
              No account. No waiting. Just the movie you actually want to watch tonight.
            </p>

            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => router.push('/quiz')}
              className="cinematic-btn px-14 py-5 rounded-2xl text-xl font-bold group shadow-2xl"
              style={{ boxShadow: '0 0 60px rgba(202,138,4,0.35)' }}
            >
              <span className="flex items-center gap-3">
                Find My Movie
                <svg className="w-6 h-6 transition-transform duration-300 group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </span>
            </motion.button>

            <p className="mt-6 text-white/25 text-sm">Free forever · No sign-up · Takes 60 seconds</p>
          </SectionWrapper>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────────── */}
      <footer className="relative z-10 border-t border-white/5 py-8">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <span className="font-display font-black text-lg tracking-tighter text-white/40">
            Mood<span className="text-primary/60">Flix</span>
          </span>
          <p className="text-white/25 text-xs">
            Smart cinema recommendations — built for real movie nights.
          </p>
        </div>
      </footer>

    </main>
  );
}
