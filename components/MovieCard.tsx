'use client';

import { motion } from 'framer-motion';
import { Movie, MoodProfile } from '@/lib/api';

interface MovieCardProps {
  movie: Movie;
  index: number;
  onWhyThis: (movie: Movie) => void;
  moodProfile: MoodProfile | null;
}

const starRating = (rating: number) => {
  const filled = Math.round(rating / 2);
  return Array.from({ length: 5 }, (_, i) => (
    <span key={i} className={i < filled ? 'text-amber-400' : 'text-white/20'}>
      ★
    </span>
  ));
};

export default function MovieCard({ movie, index, onWhyThis }: MovieCardProps) {
  const posterSrc = movie.poster_url || null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      whileHover={{ y: -6, scale: 1.015 }}
      className="group relative rounded-2xl overflow-hidden bg-[#13131a] border border-white/5 shadow-2xl cursor-pointer flex flex-col"
      style={{ boxShadow: '0 0 0 0 transparent' }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow =
          '0 0 30px 0 rgba(124,58,237,0.25)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow = '0 0 0 0 transparent';
      }}
    >
      {/* Poster */}
      <div className="relative w-full aspect-[2/3] bg-white/5 overflow-hidden">
        {posterSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={posterSrc}
            alt={movie.title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-violet-900/40 to-indigo-900/40">
            <span className="text-6xl opacity-30">🎬</span>
          </div>
        )}

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#13131a] via-transparent to-transparent opacity-80" />

        {/* Rating badge */}
        <div className="absolute top-3 right-3 bg-black/70 backdrop-blur-sm rounded-full px-2.5 py-1 flex items-center gap-1 text-xs font-semibold text-amber-400">
          ★ {movie.rating.toFixed(1)}
        </div>

        {/* Year badge */}
        {movie.year > 0 && (
          <div className="absolute top-3 left-3 bg-black/70 backdrop-blur-sm rounded-full px-2.5 py-1 text-xs text-white/70">
            {movie.year}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-col flex-1 p-4 gap-3">
        {/* Title */}
        <h3 className="font-bold text-white text-lg leading-tight line-clamp-2" style={{ fontFamily: "'Playfair Display', serif" }}>
          {movie.title}
        </h3>

        {/* Stars */}
        <div className="flex gap-0.5 text-sm">
          {starRating(movie.rating)}
        </div>

        {/* Genres */}
        {movie.genres && movie.genres.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {movie.genres.slice(0, 3).map((g) => (
              <span
                key={g}
                className="text-xs px-2.5 py-0.5 rounded-full bg-violet-900/40 text-violet-300 border border-violet-800/30"
              >
                {g}
              </span>
            ))}
          </div>
        )}

        {/* Overview */}
        <p className="text-white/50 text-sm leading-relaxed line-clamp-3 flex-1">
          {movie.overview}
        </p>

        {/* Why this button */}
        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => onWhyThis(movie)}
          id={`why-this-${movie.id}`}
          className="mt-auto w-full py-2.5 rounded-xl text-sm font-semibold text-violet-300 border border-violet-700/40 bg-violet-900/20 hover:bg-violet-800/30 hover:border-violet-600/60 transition-all duration-200"
        >
          ✦ Why this?
        </motion.button>
      </div>
    </motion.div>
  );
}
