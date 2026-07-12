'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getClassifyQuery } from '@/lib/api';

import { MovieNode, ClusterInfo, MOVIES_DATA, CLUSTERS, SAMPLE_QUERIES, KEYWORD_MAPS } from './data';
import { computeFallbackCoordinates } from './fallbackEngine';

export default function VectorSpaceVisualizer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Interaction settings states
  const [showGrid, setShowGrid] = useState(true);
  const [showVectors, setShowVectors] = useState(true);
  const [showClusters, setShowClusters] = useState(true);

  // Mouse hover state
  const [hoveredMovie, setHoveredMovie] = useState<MovieNode | null>(null);

  // Zoom & Pan states (in canvas space)
  const [zoom, setZoom] = useState(1.1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });

  // Query simulator states
  const [queryText, setQueryText] = useState('');
  const [projectedQuery, setProjectedQuery] = useState<{ x: number; y: number; text: string } | null>(null);
  const [isProjecting, setIsProjecting] = useState(false);
  const queryRippleRef = useRef(0); // For ripple ring animation
  const projectionProgressRef = useRef(0); // 0→1 progressive line draw
  const [nearestMatches, setNearestMatches] = useState<{ movie: MovieNode; score: number }[]>([]);

  // Camera intro animation control
  const [introFinished, setIntroFinished] = useState(false);
  const introProgress = useRef(0); // 0 to 1

  // Hovered node screen position (for anchored tooltip)
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);

  // Color mappings for movie nodes
  const getMovieColor = (movie: MovieNode) => {
    if (movie.genres.includes('Sci-Fi')) return '#a855f7'; // Purple
    if (movie.genres.includes('Romance')) return '#ec4899'; // Pink
    if (movie.genres.includes('Action')) return '#f59e0b'; // Amber
    if (movie.genres.includes('Comedy')) return '#10b981'; // Emerald
    if (movie.genres.includes('Horror')) return '#ef4444'; // Red
    return '#3b82f6'; // Blue
  };

  // Resets zoom and pan to defaults
  const handleResetView = () => {
    setZoom(1.1);
    setPan({ x: 0, y: 0 });
  };

  // SIMULATED VECTOR EMBEDDING CALCULATION
  const projectQueryVector = async (text: string) => {
    if (!text.trim()) return;
    setIsProjecting(true);
    setNearestMatches([]);

    let targetX = 0;
    let targetY = 0;

    try {
      // 1. Call Gemini LLM backend for exact projection
      const apiResult = await getClassifyQuery(text);
      targetX = apiResult.x;
      targetY = apiResult.y;
    } catch (err) {
      console.warn("API classification failed, falling back to local model...", err);
      const fallback = await computeFallbackCoordinates(text);
      targetX = fallback.x;
      targetY = fallback.y;
    }

    // Keep coordinates within [-0.95, 0.95] boundary
    targetX = Math.max(-0.95, Math.min(0.95, targetX));
    targetY = Math.max(-0.95, Math.min(0.95, targetY));

    // Set the final destination immediately so canvas can draw progressively
    setProjectedQuery({ x: targetX, y: targetY, text });
    projectionProgressRef.current = 0; // reset line draw progress

    // Animate the line draw progress from 0 → 1 (pure ref, no state update)
    let frame = 0;
    const duration = 60; // 60 frames (~1s) — smooth 3B1B feel

    const animateProject = () => {
      frame++;
      const t = Math.min(frame / duration, 1);
      // easeOutQuart: fast start, slow settle — exactly like 3B1B arrow paint
      projectionProgressRef.current = 1 - Math.pow(1 - t, 4);

      if (frame < duration) {
        requestAnimationFrame(animateProject);
      } else {
        projectionProgressRef.current = 1;
        // Projection finished! Compute similarity ranks
        setIsProjecting(false);
        queryRippleRef.current = 0.01; // trigger ripple wave

        // Calculate cosine similarities
        const scores = MOVIES_DATA.map((movie) => {
          const dotProduct = targetX * movie.x + targetY * movie.y;
          const magQ = Math.sqrt(targetX * targetX + targetY * targetY);
          const magM = Math.sqrt(movie.x * movie.x + movie.y * movie.y);

          // Avoid division by zero
          let similarity = 0;
          if (magQ > 0 && magM > 0) {
            similarity = dotProduct / (magQ * magM);
          }

          // Convert similarity from [-1, 1] to a percentage [0, 100]
          const matchPercent = Math.max(0, Math.floor(similarity * 100));

          return {
            movie,
            score: matchPercent
          };
        });

        // Sort descending and take top 5
        scores.sort((a, b) => b.score - a.score);
        setNearestMatches(scores.slice(0, 5));
      }
    };

    animateProject();
  };

  // Triggered on form submit
  const handleQuerySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    projectQueryVector(queryText);
  };

  // Triggered on sample query click
  const handleSampleClick = (text: string) => {
    setQueryText(text);
    projectQueryVector(text);
  };

  // Clear query
  const handleClearQuery = () => {
    setQueryText('');
    setProjectedQuery(null);
    setNearestMatches([]);
    queryRippleRef.current = 0;
    projectionProgressRef.current = 0;
    setTooltipPos(null);
  };

  // CANVAS DRAWING AND UPDATE LOOP
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;

    // Handle screen pixel ratio resizing
    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height = rect.height * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };
    resizeCanvas();

    window.addEventListener('resize', resizeCanvas);

    // Main Draw Function
    const draw = () => {
      const width = canvas.width / window.devicePixelRatio;
      const height = canvas.height / window.devicePixelRatio;

      // 1. Progress camera intro animation — slow cinematic drift
      if (!introFinished) {
        introProgress.current += 0.004; // ~250 frames ≈ 4 seconds
        if (introProgress.current >= 1) {
          introProgress.current = 1;
          setIntroFinished(true);
        }
      }

      // Calculate camera coordinates with easeInOutCubic for graceful settle
      let drawZoom = zoom;
      let drawPan = pan;
      if (!introFinished) {
        const t = introProgress.current;
        // easeInOutCubic: starts slow, accelerates, decelerates into final position
        const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        drawZoom = 2.5 - 1.4 * ease; // 2.5 → 1.1
        drawPan = {
          x: 120 * (1 - ease),  // pan from off-center left
          y: -80 * (1 - ease)   // and slightly above
        };
      }

      // 2. Progress ripple wave expansion animation
      if (projectedQuery && queryRippleRef.current > 0) {
        queryRippleRef.current += 0.008;
        if (queryRippleRef.current >= 0.6) {
          queryRippleRef.current = 0; // stop ripple
        }
      }

      // Clear with dark blue-gray background matching page bg
      ctx.fillStyle = '#09090b';
      ctx.fillRect(0, 0, width, height);

      // Save canvas state for zoom & pan transformations
      ctx.save();
      const centerX = width / 2 + drawPan.x;
      const centerY = height / 2 + drawPan.y;
      // Coordinate multiplier size (in pixels for coordinates -1 to 1)
      const scaleMultiplier = Math.min(width, height) * 0.42 * drawZoom;

      // Draw Grid Backdrop
      if (showGrid) {
        // Draw coordinate grid lines
        const step = 0.25; // tick lines every 0.25 units
        ctx.lineWidth = 1;

        for (let val = -1; val <= 1; val += step) {
          // Horizontal grid line (Y values)
          const sy = centerY - val * scaleMultiplier;
          ctx.strokeStyle = val === 0 ? 'rgba(255, 255, 255, 0.15)' : 'rgba(255, 255, 255, 0.04)';
          ctx.beginPath();
          ctx.moveTo(centerX - scaleMultiplier * 1.2, sy);
          ctx.lineTo(centerX + scaleMultiplier * 1.2, sy);
          ctx.stroke();

          // Vertical grid line (X values)
          const sx = centerX + val * scaleMultiplier;
          ctx.strokeStyle = val === 0 ? 'rgba(255, 255, 255, 0.15)' : 'rgba(255, 255, 255, 0.04)';
          ctx.beginPath();
          ctx.moveTo(sx, centerY - scaleMultiplier * 1.2);
          ctx.lineTo(sx, centerY + scaleMultiplier * 1.2);
          ctx.stroke();

          // Text coordinates markings (3Blue1Brown style typewriter digits)
          if (val !== 0 && drawZoom > 0.6) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
            ctx.font = '10px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';

            // X values along Y=0 axis
            ctx.fillText(val.toFixed(2), sx, centerY + 6);

            // Y values along X=0 axis
            ctx.textAlign = 'right';
            ctx.textBaseline = 'middle';
            ctx.fillText(val.toFixed(2), centerX - 8, sy);
          }
        }

        // Draw Origin Indicator
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(centerX, centerY, 4, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Draw Shaded Cluster Regions (Glow boundaries)
      if (showClusters) {
        CLUSTERS.forEach((cluster) => {
          const cx = centerX + cluster.centerX * scaleMultiplier;
          const cy = centerY - cluster.centerY * scaleMultiplier;
          const cr = cluster.radius * scaleMultiplier;

          // Glowing contour fill
          const grad = ctx.createRadialGradient(cx, cy, cr * 0.1, cx, cy, cr);
          grad.addColorStop(0, cluster.glowColor);
          grad.addColorStop(1, 'transparent');
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(cx, cy, cr, 0, Math.PI * 2);
          ctx.fill();

          // Dotted boundary line
          ctx.strokeStyle = cluster.borderColor;
          ctx.lineWidth = 1;
          ctx.setLineDash([4, 6]);
          ctx.beginPath();
          ctx.arc(cx, cy, cr, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]); // Reset line dash

          // Cluster Name Label (drawn very faintly in background)
          ctx.fillStyle = cluster.borderColor.replace('0.35', '0.5'); // Slightly brighter text
          ctx.font = '9px monospace';
          ctx.textAlign = 'center';
          ctx.fillText(cluster.name.toUpperCase(), cx, cy - cr - 8);
        });
      }

      // Draw Query Vector Connections & ripples (if present)
      if (projectedQuery) {
        const qx = centerX + projectedQuery.x * scaleMultiplier;
        const qy = centerY - projectedQuery.y * scaleMultiplier;

        // Draw nearest neighbor similarity lines (cosine match threads)
        if (nearestMatches.length > 0) {
          nearestMatches.forEach(({ movie, score }) => {
            const mx = centerX + movie.x * scaleMultiplier;
            const my = centerY - movie.y * scaleMultiplier;

            // Fading neon green line to nearest neighbors
            ctx.strokeStyle = `rgba(16, 185, 129, ${0.1 + (score / 100) * 0.4})`;
            ctx.lineWidth = 1.5;
            ctx.setLineDash([2, 4]);
            ctx.beginPath();
            ctx.moveTo(qx, qy);
            ctx.lineTo(mx, my);
            ctx.stroke();
            ctx.setLineDash([]);
          });
        }

        // Draw Expanding Ripple Rings from query node
        if (queryRippleRef.current > 0 && queryRippleRef.current < 0.6) {
          const rRadius = queryRippleRef.current * scaleMultiplier * 1.5;
          ctx.strokeStyle = `rgba(16, 185, 129, ${0.6 * (1 - queryRippleRef.current / 0.6)})`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(qx, qy, rRadius, 0, Math.PI * 2);
          ctx.stroke();
        }

        // Draw Query Vector Line progressively (3B1B paint effect)
        const progress = projectionProgressRef.current;
        const tipX = centerX + (qx - centerX) * progress;
        const tipY = centerY + (qy - centerY) * progress;
        const angle = Math.atan2(qy - centerY, qx - centerX);

        // Glowing stroke — draw from origin to current tip
        ctx.shadowBlur = 8;
        ctx.shadowColor = '#10b981';
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(tipX, tipY);
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Arrowhead only appears when line is fully drawn
        if (progress >= 1) {
          ctx.fillStyle = '#10b981';
          ctx.shadowBlur = 6;
          ctx.shadowColor = '#10b981';
          ctx.beginPath();
          ctx.moveTo(qx, qy);
          ctx.lineTo(qx - 13 * Math.cos(angle - Math.PI / 8), qy - 13 * Math.sin(angle - Math.PI / 8));
          ctx.lineTo(qx - 13 * Math.cos(angle + Math.PI / 8), qy - 13 * Math.sin(angle + Math.PI / 8));
          ctx.closePath();
          ctx.fill();
          ctx.shadowBlur = 0;
        }

        // Glowing query dot travels with the tip during animation
        ctx.shadowBlur = progress >= 1 ? 20 : 12;
        ctx.shadowColor = '#10b981';
        ctx.fillStyle = progress >= 1 ? '#34d399' : '#6ee7b7';
        ctx.beginPath();
        ctx.arc(tipX, tipY, progress >= 1 ? 7 : 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(tipX, tipY, progress >= 1 ? 7 : 5, 0, Math.PI * 2);
        ctx.stroke();

        // Label fades in as line completes
        if (progress > 0.7) {
          ctx.globalAlpha = Math.min(1, (progress - 0.7) / 0.3);
          ctx.fillStyle = '#10b981';
          ctx.font = 'bold 11px monospace';
          ctx.textAlign = 'center';
          ctx.fillText('QUERY VECTOR', tipX, tipY - 17);
          ctx.globalAlpha = 1;
        }
      }

      // Draw Hovered Movie Projections & Vector Line
      if (hoveredMovie) {
        const mx = centerX + hoveredMovie.x * scaleMultiplier;
        const my = centerY - hoveredMovie.y * scaleMultiplier;
        const mColor = getMovieColor(hoveredMovie);

        // 1. Draw perpendicular projection guides to X and Y axes
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 4]);

        // To X axis
        ctx.beginPath();
        ctx.moveTo(mx, my);
        ctx.lineTo(mx, centerY);
        ctx.stroke();

        // To Y axis
        ctx.beginPath();
        ctx.moveTo(mx, my);
        ctx.lineTo(centerX, my);
        ctx.stroke();
        ctx.setLineDash([]); // Reset

        // Axis Component Tick Labels
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.font = '9px monospace';
        ctx.textAlign = 'center';
        // X component label on X axis
        ctx.fillText(`x=${hoveredMovie.x.toFixed(2)}`, mx, centerY - 12);
        // Y component label on Y axis
        ctx.textAlign = 'left';
        ctx.fillText(`y=${hoveredMovie.y.toFixed(2)}`, centerX + 6, my);

        // 2. Draw Vector Line from (0,0) to Movie Node
        if (showVectors) {
          ctx.strokeStyle = mColor;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(centerX, centerY);
          ctx.lineTo(mx, my);
          ctx.stroke();

          // Arrowhead
          const angle = Math.atan2(my - centerY, mx - centerX);
          ctx.fillStyle = mColor;
          ctx.beginPath();
          ctx.moveTo(mx, my);
          ctx.lineTo(mx - 10 * Math.cos(angle - Math.PI / 8), my - 10 * Math.sin(angle - Math.PI / 8));
          ctx.lineTo(mx - 10 * Math.cos(angle + Math.PI / 8), my - 10 * Math.sin(angle + Math.PI / 8));
          ctx.closePath();
          ctx.fill();

          // Angle arc at origin
          const mag = Math.sqrt(hoveredMovie.x * hoveredMovie.x + hoveredMovie.y * hoveredMovie.y);
          if (mag > 0.15) {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(centerX, centerY, 25, 0, angle, angle < 0);
            ctx.stroke();
            
            // Formula marker: theta
            ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.font = 'italic 10px Times New Roman';
            const midAngle = angle / 2;
            ctx.fillText('θ', centerX + 30 * Math.cos(midAngle), centerY + 30 * Math.sin(midAngle));
          }
        }
      }

      // Draw all Movie Nodes
      MOVIES_DATA.forEach((movie) => {
        const mx = centerX + movie.x * scaleMultiplier;
        const my = centerY - movie.y * scaleMultiplier;
        const isHovered = hoveredMovie?.id === movie.id;
        const mColor = getMovieColor(movie);

        // Check if movie is one of the matched results to highlight
        const isMatched = nearestMatches.some((match) => match.movie.id === movie.id);

        if (isMatched) {
          // Extra outer neon ring for matched movies
          ctx.strokeStyle = '#10b981';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(mx, my, isHovered ? 13 : 9, 0, Math.PI * 2);
          ctx.stroke();
        }

        // Draw glowing shadow for hovered node
        if (isHovered) {
          ctx.shadowBlur = 12;
          ctx.shadowColor = mColor;
        }

        ctx.fillStyle = mColor;
        ctx.beginPath();
        ctx.arc(mx, my, isHovered ? 6 : 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.shadowBlur = 0; // Reset

        // Node outline (gives mathematical vector point vibe)
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = isHovered ? 1.5 : 1;
        ctx.beginPath();
        ctx.arc(mx, my, isHovered ? 6 : 4, 0, Math.PI * 2);
        ctx.stroke();

        // Node Title Tag (if zoomed in enough, or if hovered)
        if (isHovered || (drawZoom > 1.4 && !isDragging)) {
          ctx.fillStyle = isHovered ? '#ffffff' : 'rgba(255, 255, 255, 0.5)';
          ctx.font = isHovered ? 'bold 11px monospace' : '9px monospace';
          ctx.textAlign = 'left';
          ctx.fillText(` ${movie.title}`, mx + 8, my + 3);
        }
      });

      // Restore canvas transform state
      ctx.restore();

      animationId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', resizeCanvas);
    };
  }, [showGrid, showVectors, showClusters, zoom, pan, hoveredMovie, projectedQuery, nearestMatches, introFinished, isDragging]);

  // PAN & ZOOM EVENT HANDLERS
  const getCanvasMousePos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return; // Only left click drags
    setIsDragging(true);
    const mPos = getCanvasMousePos(e);
    dragStart.current = { x: mPos.x - pan.x, y: mPos.y - pan.y };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const mPos = getCanvasMousePos(e);

    if (isDragging) {
      setPan({
        x: mPos.x - dragStart.current.x,
        y: mPos.y - dragStart.current.y
      });
      return;
    }

    // Hover check
    const width = canvas.width / window.devicePixelRatio;
    const height = canvas.height / window.devicePixelRatio;
    const centerX = width / 2 + pan.x;
    const centerY = height / 2 + pan.y;
    const scaleMultiplier = Math.min(width, height) * 0.42 * zoom;

    let foundMovie: MovieNode | null = null;
    let foundScreenPos: { x: number; y: number } | null = null;
    const hitRadius = 18; // larger hit area for easier hovering

    for (let i = 0; i < MOVIES_DATA.length; i++) {
      const movie = MOVIES_DATA[i];
      const mx = centerX + movie.x * scaleMultiplier;
      const my = centerY - movie.y * scaleMultiplier;

      const dist = Math.sqrt((mPos.x - mx) ** 2 + (mPos.y - my) ** 2);
      if (dist <= hitRadius) {
        foundMovie = movie;
        foundScreenPos = { x: mx, y: my };
        break;
      }
    }

    if (foundMovie !== hoveredMovie) {
      setHoveredMovie(foundMovie);
      // Store screen position for anchored tooltip
      if (foundScreenPos) {
        setTooltipPos(foundScreenPos);
      } else {
        setTooltipPos(null);
      }
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const zoomFactor = 1.15;
    let nextZoom = zoom;

    if (e.deltaY < 0) {
      // Zoom In
      nextZoom = Math.min(zoom * zoomFactor, 3.5);
    } else {
      // Zoom Out
      nextZoom = Math.max(zoom / zoomFactor, 0.4);
    }

    setZoom(nextZoom);
  };

  // TOUCH EVENTS FOR MOBILE ZOOM & PAN
  const touchStartDist = useRef<number | null>(null);
  const touchStartPan = useRef({ x: 0, y: 0 });

  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      const touch = e.touches[0];
      const canvas = canvasRef.current;
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        const tx = touch.clientX - rect.left;
        const ty = touch.clientY - rect.top;
        dragStart.current = { x: tx - pan.x, y: ty - pan.y };
      }
    } else if (e.touches.length === 2) {
      // Pinch to zoom start
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      touchStartDist.current = Math.sqrt((t1.clientX - t2.clientX) ** 2 + (t1.clientY - t2.clientY) ** 2);
      touchStartPan.current = { ...pan };
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (e.touches.length === 1 && isDragging) {
      const touch = e.touches[0];
      const rect = canvas.getBoundingClientRect();
      const tx = touch.clientX - rect.left;
      const ty = touch.clientY - rect.top;
      setPan({
        x: tx - dragStart.current.x,
        y: ty - dragStart.current.y
      });
    } else if (e.touches.length === 2 && touchStartDist.current !== null) {
      // Pinch zooming
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.sqrt((t1.clientX - t2.clientX) ** 2 + (t1.clientY - t2.clientY) ** 2);
      const ratio = dist / touchStartDist.current;
      setZoom(Math.max(0.4, Math.min(3.5, zoom * ratio)));
      touchStartDist.current = dist; // update baseline
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    touchStartDist.current = null;
  };

  return (
    <div ref={containerRef} className="w-full flex flex-col lg:flex-row rounded-3xl border border-white/5 bg-zinc-950/40 backdrop-blur-md overflow-hidden relative shadow-2xl">
      
      {/* ── CANVAS AREA (Left/Top) ────────────────────────────── */}
      <div className="flex-1 min-h-[420px] sm:min-h-[500px] lg:min-h-[600px] relative cursor-grab active:cursor-grabbing select-none overflow-hidden">
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className="w-full h-full absolute inset-0 block touch-none"
        />

        {/* Ambient Topographic Lines Grid overlay */}
        <div className="absolute inset-0 opacity-[0.02] pointer-events-none mix-blend-overlay"
          style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")` }} />

        {/* HUD Mathematical Title / Metadata overlay */}
        <div className="absolute top-6 left-6 p-4 rounded-xl border border-white/5 bg-zinc-950/80 backdrop-blur-sm pointer-events-none max-w-xs sm:max-w-sm">
          <div className="text-[10px] font-bold text-primary tracking-widest uppercase mb-1">Vector DB Projection Engine</div>
          <h4 className="font-display font-black text-white text-base leading-tight">High-Dimensional Embedding Space</h4>
          <p className="text-[10px] text-white/40 font-mono mt-1">Projection: Cosine Metric (t-SNE / PCA reduced to 2D)</p>
          
          {/* Legend */}
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-3 border-t border-white/5 pt-2 text-[9px] font-mono">
            <div className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-[#a855f7]" /> Sci-Fi</div>
            <div className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-[#ec4899]" /> Romance</div>
            <div className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-[#f59e0b]" /> Action</div>
            <div className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-[#10b981]" /> Comedy</div>
            <div className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-[#ef4444]" /> Horror</div>
            <div className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-[#3b82f6]" /> Drama</div>
          </div>
        </div>

        {/* Hover Movie Metadata Card — anchored above the node */}
        <AnimatePresence>
          {hoveredMovie && tooltipPos && (
            <motion.div
              key={hoveredMovie.id}
              initial={{ opacity: 0, y: 6, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, scale: 0.96 }}
              transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] }}
              className="absolute w-72 p-4 rounded-2xl border border-white/10 bg-zinc-950/95 backdrop-blur-md shadow-2xl z-10 pointer-events-none"
              style={{
                // Anchor to node: center horizontally, sit above the node
                left: Math.max(8, Math.min(tooltipPos.x - 144, (canvasRef.current?.getBoundingClientRect().width ?? 600) - 296)),
                top: Math.max(8, tooltipPos.y - 180),
              }}
            >
              {/* Connector line pointing down to the node */}
              <div
                className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-full w-px h-4 pointer-events-none"
                style={{ background: 'linear-gradient(to bottom, rgba(255,255,255,0.15), transparent)' }}
              />
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="min-w-0">
                  <h5 className="font-display font-bold text-base text-white leading-tight truncate">{hoveredMovie.title}</h5>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[11px] text-white/40">{hoveredMovie.year}</span>
                    <span className="w-1 h-1 rounded-full bg-white/20 shrink-0" />
                    <span className="text-[11px] text-primary font-bold">★ {hoveredMovie.rating.toFixed(1)}</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1 justify-end shrink-0">
                  {hoveredMovie.genres.slice(0, 2).map((g) => (
                    <span key={g} className="text-[9px] font-mono px-1.5 py-0.5 rounded-full bg-white/5 border border-white/10 text-white/60 uppercase">
                      {g}
                    </span>
                  ))}
                </div>
              </div>
              <p className="text-[11px] text-white/50 leading-relaxed line-clamp-2 mb-2">{hoveredMovie.description}</p>
              <div className="border-t border-white/5 pt-2 flex items-center justify-between text-[9px] font-mono text-white/25">
                <span>[{hoveredMovie.x.toFixed(3)}, {hoveredMovie.y.toFixed(3)}]</span>
                <span>‖v‖ = {Math.sqrt(hoveredMovie.x**2 + hoveredMovie.y**2).toFixed(3)}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* HUD Navigation Help Overlay */}
        <div className="absolute bottom-6 right-6 flex items-center gap-2">
          <button
            onClick={handleResetView}
            className="p-2 rounded-xl border border-white/10 bg-zinc-950/80 backdrop-blur-sm text-white/60 hover:text-white hover:bg-zinc-900 transition-all text-xs font-mono cursor-pointer"
            title="Reset viewport focus"
          >
            Reset Camera
          </button>
        </div>
      </div>

      {/* ── CONTROLS SIDEBAR (Right/Bottom) ───────────────────────── */}
      <div className="w-full lg:w-[350px] border-t lg:border-t-0 lg:border-l border-white/5 bg-zinc-950/20 p-6 sm:p-8 flex flex-col justify-between">
        <div>
          <div className="mb-6">
            <span className="text-xs font-bold text-primary uppercase tracking-widest font-mono">Live Simulation</span>
            <h3 className="font-display font-black text-white text-2xl tracking-tight leading-none mt-1">Project Vibe Vector</h3>
            <p className="text-xs text-white/40 mt-2 leading-relaxed">
              Watch cosine similarity math in action. Type a query or click a preset to project a text embedding.
            </p>
          </div>

          {/* Form input */}
          <form onSubmit={handleQuerySubmit} className="space-y-3 mb-6">
            <div className="relative">
              <input
                type="text"
                value={queryText}
                onChange={(e) => setQueryText(e.target.value)}
                placeholder="e.g. A fast pacing space puzzle"
                disabled={isProjecting}
                spellCheck="false"
                className="w-full px-4 py-3 rounded-xl border border-white/10 bg-white/[0.02] text-white placeholder-white/20 text-sm focus:outline-none focus:border-primary/50 focus:bg-white/[0.04] transition-all disabled:opacity-50 pr-8"
              />
              {queryText && (
                <button
                  type="button"
                  onClick={handleClearQuery}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white text-xs font-bold"
                >
                  ✕
                </button>
              )}
            </div>
            
            <button
              type="submit"
              disabled={isProjecting || !queryText.trim()}
              className="w-full py-3 rounded-xl bg-primary hover:bg-primary/90 disabled:bg-white/5 disabled:text-white/20 text-white font-bold text-sm transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer"
            >
              {isProjecting ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  Calculating Embedding...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Project & Search Vector
                </>
              )}
            </button>
          </form>

          {/* Preset options */}
          <div className="mb-6">
            <div className="text-[10px] font-bold text-white/30 uppercase tracking-wider mb-2 font-mono">Sample Mood Vectors</div>
            <div className="flex flex-col gap-1.5">
              {SAMPLE_QUERIES.map((q) => (
                <button
                  key={q.label}
                  type="button"
                  onClick={() => handleSampleClick(q.text)}
                  disabled={isProjecting}
                  className="w-full text-left px-3 py-2 rounded-lg border border-white/5 bg-white/[0.01] hover:bg-white/[0.04] hover:border-white/10 text-xs text-white/70 hover:text-white transition-all overflow-hidden text-ellipsis whitespace-nowrap cursor-pointer animate-duration-150"
                >
                  {q.label}
                </button>
              ))}
            </div>
          </div>

          {/* Similarity Results Panel */}
          <div className="border-t border-white/5 pt-5">
            <div className="text-[10px] font-bold text-white/30 uppercase tracking-wider mb-3 font-mono">
              {projectedQuery ? 'Cosine Nearest Neighbors (Top 5)' : 'How it calculates'}
            </div>

            <AnimatePresence mode="wait">
              {projectedQuery ? (
                <motion.div
                  key="results-list"
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  className="space-y-3.5"
                >
                  {nearestMatches.length > 0 ? (
                    nearestMatches.map(({ movie, score }, index) => {
                      const mColor = getMovieColor(movie);
                      return (
                        <div key={movie.id} className="group relative flex flex-col p-2.5 rounded-xl border border-white/5 bg-white/[0.01] hover:bg-white/[0.03] transition-all">
                          <div className="flex items-center justify-between mb-1 gap-2">
                            <span className="text-xs font-bold text-white truncate max-w-[70%]">{movie.title}</span>
                            <span className="text-[10px] font-mono font-bold" style={{ color: '#10b981' }}>
                              {score}% match
                            </span>
                          </div>
                          
                          {/* Animated similarity score bar */}
                          <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${score}%` }}
                              transition={{ duration: 0.5, delay: index * 0.08 }}
                              className="h-full rounded-full"
                              style={{ backgroundColor: '#10b981' }}
                            />
                          </div>

                          <div className="flex items-center justify-between text-[8.5px] text-white/30 mt-1 font-mono">
                            <span>Index: #{index + 1}</span>
                            <span className="uppercase" style={{ color: mColor }}>{movie.genres[0]}</span>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="flex flex-col items-center justify-center py-6 text-center text-white/30">
                      <div className="w-5 h-5 border-2 border-[#10b981] border-t-transparent rounded-full animate-spin mb-2" />
                      <span className="text-xs">Measuring cosine space...</span>
                    </div>
                  )}
                </motion.div>
              ) : (
                <motion.div
                  key="info-card"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-xs text-white/50 space-y-3 leading-relaxed"
                >
                  <p>
                    Each movie is ingested by feeding its synopsis, pacing, and keywords to an LLM, generating a high-dimensional vector representation.
                  </p>
                  <p>
                    When searching, we measure the angular distance (cosine similarity) between your query vector and all movie vectors. Points aligned closer have a higher matching score.
                  </p>
                  <div className="p-3 rounded-xl border border-white/5 bg-zinc-950/80 font-mono text-[9px] text-white/30 space-y-1">
                    <div className="text-[8.5px] font-bold text-primary mb-1">COSINE SIMILARITY METRIC</div>
                    <div>cos(θ) = (A · B) / (||A|| ||B||)</div>
                    <div>Matches ➔ θ ≈ 0 (cos θ ≈ 1.0)</div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* View Toggles HUD */}
        <div className="border-t border-white/5 pt-5 mt-6 grid grid-cols-3 gap-2">
          <button
            onClick={() => setShowGrid(!showGrid)}
            className={`py-2 px-1.5 rounded-lg border text-[9px] font-mono text-center transition-all cursor-pointer ${
              showGrid ? 'border-primary/20 bg-primary/5 text-primary' : 'border-white/5 bg-white/[0.01] text-white/40'
            }`}
          >
            Grid
          </button>
          <button
            onClick={() => setShowVectors(!showVectors)}
            className={`py-2 px-1.5 rounded-lg border text-[9px] font-mono text-center transition-all cursor-pointer ${
              showVectors ? 'border-primary/20 bg-primary/5 text-primary' : 'border-white/5 bg-white/[0.01] text-white/40'
            }`}
          >
            Vectors
          </button>
          <button
            onClick={() => setShowClusters(!showClusters)}
            className={`py-2 px-1.5 rounded-lg border text-[9px] font-mono text-center transition-all cursor-pointer ${
              showClusters ? 'border-primary/20 bg-primary/5 text-primary' : 'border-white/5 bg-white/[0.01] text-white/40'
            }`}
          >
            Clusters
          </button>
        </div>

      </div>
    </div>
  );
}
