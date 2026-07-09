'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Movie, MoodProfile } from '@/lib/api';

interface MovieCardProps {
  movie: Movie;
  index: number;
  onWhyThis: (movie: Movie) => void;
  moodProfile: MoodProfile | null;
}

const getPosterUrl = (movie: Movie) => {
  const url = movie.poster_url;
  if (!url) return null;
  
  const titleParam = encodeURIComponent(movie.title);
  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080';
  
  const match = url.match(/\/t\/p\/w500(\/.*)$/);
  if (match && match[1]) {
    return `${apiBase}/api/proxy-image?path=${match[1]}&title=${titleParam}&year=${movie.year}&db_id=${movie.id}`;
  }
  
  if (url.startsWith('http')) {
    return `${apiBase}/api/proxy-image?url=${encodeURIComponent(url)}&title=${titleParam}&year=${movie.year}&db_id=${movie.id}`;
  }
  
  return url;
};

export default function MovieCard({ movie, index, onWhyThis }: MovieCardProps) {
  const [imageError, setImageError] = useState(false);
  const posterSrc = getPosterUrl(movie);
  const genres = movie.genres?.slice(0, 2) ?? [];

  const hasPoster = posterSrc && !imageError;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: Math.min(index * 0.05, 0.4) }}
      whileHover={{ y: -6 }}
      className="group relative rounded-2xl overflow-hidden bg-surface border border-border/50 shadow-xl flex flex-col cursor-pointer transition-all duration-300 hover:shadow-primary/10 hover:shadow-2xl hover:border-primary/30"
    >
      {/* Poster area */}
      <div className="relative w-full aspect-[2/3] overflow-hidden flex-shrink-0 bg-background/50">
        {hasPoster ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={posterSrc}
            alt={movie.title}
            width={300}
            height={450}
            loading="lazy"
            onError={() => setImageError(true)}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-surface to-background flex flex-col justify-center items-center p-5 text-center border-b border-border/50">
            <span className="text-foreground/10 text-4xl mb-4">🎬</span>
            <h4 className="font-display text-foreground/80 text-xl font-bold leading-snug line-clamp-3 text-balance">
              {movie.title}
            </h4>
            {movie.year > 0 && <p className="text-foreground/40 text-xs mt-2 font-medium tabular-nums">{movie.year}</p>}
          </div>
        )}

        {/* Overlay gradient for poster */}
        {hasPoster && (
          <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/20 to-transparent opacity-90" />
        )}

        {/* Rating pill - top right */}
        <div className="absolute top-3 right-3 flex items-center gap-1 bg-black/60 backdrop-blur-md rounded-full px-2.5 py-1 text-[11px] font-bold text-amber-400 border border-white/10 tabular-nums">
          ★ {movie.rating.toFixed(1)}
        </div>

        {/* Year pill - top left */}
        {movie.year > 0 && (
          <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-md rounded-full px-2.5 py-1 text-[11px] font-bold text-white/80 border border-white/10 tabular-nums">
            {movie.year}
          </div>
        )}
      </div>

      {/* Card body */}
      <div className="flex flex-col flex-1 p-5 gap-3 -mt-6 relative z-10">
        {/* Title */}
        <h3 className="font-display font-bold text-foreground text-lg leading-tight line-clamp-2">
          {movie.title}
        </h3>

        {/* Genre chips */}
        {genres.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-1">
            {genres.map(g => (
              <span key={g} className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded border border-border bg-background text-foreground/60 font-semibold">
                {g}
              </span>
            ))}
          </div>
        )}

        {/* Overview */}
        <p className="text-foreground/50 text-xs leading-relaxed line-clamp-3 flex-1 mt-1">
          {movie.overview}
        </p>

        {/* Why this button */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={(e) => { e.stopPropagation(); onWhyThis(movie); }}
          className="mt-2 w-full py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider text-primary border border-primary/20 bg-primary/5 hover:bg-primary hover:text-white transition-all duration-300"
        >
          Why this?
        </motion.button>
      </div>
    </motion.div>
  );
}
