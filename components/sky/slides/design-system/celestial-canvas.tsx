'use client';

import { useEffect, useRef } from 'react';

interface Star {
  x: number;
  y: number;
  size: number;
  opacity: number;
  twinkleSpeed: number;
  twinkleOffset: number;
  layer: number;
}

interface Nebula {
  x: number;
  y: number;
  radius: number;
  color: string;
  opacity: number;
  driftSpeed: number;
  driftAngle: number;
}

interface CelestialCanvasProps {
  /** Number of stars per layer (default: 80) */
  starCount?: number;
  /** Enable parallax on mouse move (default: true) */
  parallax?: boolean;
  /** Enable nebula clouds (default: true) */
  nebula?: boolean;
  /** Show grid overlay (default: true) */
  grid?: boolean;
  /** Show horizon glow band at bottom (default: false) */
  horizonGlow?: boolean;
}

export function CelestialCanvas({
  starCount = 80,
  parallax = true,
  nebula = true,
  grid = true,
  horizonGlow = false,
}: CelestialCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const starsRef = useRef<Star[]>([]);
  const nebulasRef = useRef<Nebula[]>([]);
  const mouseRef = useRef({ x: 0, y: 0 });
  const animFrameRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let w = 0;
    let h = 0;

    function resize() {
      if (!canvas) return;
      const dpr = window.devicePixelRatio || 1;
      w = canvas.offsetWidth;
      h = canvas.offsetHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      initStars();
      if (nebula) initNebulas();
    }

    function initStars() {
      const stars: Star[] = [];
      for (let layer = 0; layer < 3; layer++) {
        const count = Math.round(starCount * (layer === 0 ? 1.5 : layer === 1 ? 1 : 0.5));
        for (let i = 0; i < count; i++) {
          stars.push({
            x: Math.random() * w,
            y: Math.random() * h,
            size: layer === 0 ? Math.random() * 0.8 + 0.2 : layer === 1 ? Math.random() * 1.2 + 0.5 : Math.random() * 1.8 + 0.8,
            opacity: Math.random() * 0.4 + 0.2,
            twinkleSpeed: Math.random() * 0.001 + 0.0003,
            twinkleOffset: Math.random() * Math.PI * 2,
            layer,
          });
        }
      }
      starsRef.current = stars;
    }

    function initNebulas() {
      const colors = ['rgba(139, 92, 246, 0.08)', 'rgba(56, 189, 248, 0.06)', 'rgba(255, 140, 105, 0.05)'];
      nebulasRef.current = colors.map((color) => ({
        x: Math.random() * w,
        y: Math.random() * h,
        radius: Math.random() * 200 + 150,
        color,
        opacity: 1,
        driftSpeed: Math.random() * 0.005 + 0.002,
        driftAngle: Math.random() * Math.PI * 2,
      }));
    }

    function drawGrid() {
      if (!grid) return;
      ctx!.strokeStyle = 'rgba(245, 230, 200, 0.015)';
      ctx!.lineWidth = 0.5;
      const spacing = 60;
      for (let x = 0; x < w; x += spacing) {
        ctx!.beginPath();
        ctx!.moveTo(x, 0);
        ctx!.lineTo(x, h);
        ctx!.stroke();
      }
      for (let y = 0; y < h; y += spacing) {
        ctx!.beginPath();
        ctx!.moveTo(0, y);
        ctx!.lineTo(w, y);
        ctx!.stroke();
      }
    }

    function drawHorizon() {
      if (!horizonGlow) return;
      const gradient = ctx!.createLinearGradient(0, h * 0.7, 0, h);
      gradient.addColorStop(0, 'rgba(255, 140, 105, 0)');
      gradient.addColorStop(0.5, 'rgba(255, 140, 105, 0.04)');
      gradient.addColorStop(1, 'rgba(255, 140, 105, 0.08)');
      ctx!.fillStyle = gradient;
      ctx!.fillRect(0, h * 0.7, w, h * 0.3);
    }

    function drawNebulas(time: number) {
      if (!nebula) return;
      for (const n of nebulasRef.current) {
        const dx = Math.cos(n.driftAngle + time * n.driftSpeed) * 30;
        const dy = Math.sin(n.driftAngle + time * n.driftSpeed * 0.7) * 20;
        const gradient = ctx!.createRadialGradient(n.x + dx, n.y + dy, 0, n.x + dx, n.y + dy, n.radius);
        gradient.addColorStop(0, n.color);
        gradient.addColorStop(1, 'transparent');
        ctx!.fillStyle = gradient;
        ctx!.fillRect(n.x + dx - n.radius, n.y + dy - n.radius, n.radius * 2, n.radius * 2);
      }
    }

    function drawStars(time: number) {
      const mx = parallax ? mouseRef.current.x : 0;
      const my = parallax ? mouseRef.current.y : 0;

      for (const star of starsRef.current) {
        const parallaxFactor = (star.layer + 1) * 0.015;
        const px = star.x - mx * parallaxFactor;
        const py = star.y - my * parallaxFactor;

        const twinkle = Math.sin(time * star.twinkleSpeed + star.twinkleOffset) * 0.15 + 0.85;
        const alpha = star.opacity * twinkle;

        ctx!.beginPath();
        ctx!.arc(px, py, star.size, 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(245, 230, 200, ${alpha})`;
        ctx!.fill();

        // Cross flare for bright near stars
        if (star.layer === 2 && alpha > 0.5) {
          ctx!.strokeStyle = `rgba(245, 230, 200, ${alpha * 0.3})`;
          ctx!.lineWidth = 0.5;
          const flareLen = star.size * 4;
          ctx!.beginPath();
          ctx!.moveTo(px - flareLen, py);
          ctx!.lineTo(px + flareLen, py);
          ctx!.moveTo(px, py - flareLen);
          ctx!.lineTo(px, py + flareLen);
          ctx!.stroke();
        }
      }
    }

    function animate(time: number) {
      if (!ctx) return;
      ctx.clearRect(0, 0, w, h);
      drawNebulas(time);
      drawGrid();
      drawHorizon();
      drawStars(time);
      animFrameRef.current = requestAnimationFrame(animate);
    }

    function onMouseMove(e: MouseEvent) {
      if (!parallax || !canvas) return;
      const rect = canvas.getBoundingClientRect();
      mouseRef.current.x = e.clientX - rect.left - w / 2;
      mouseRef.current.y = e.clientY - rect.top - h / 2;
    }

    resize();
    animFrameRef.current = requestAnimationFrame(animate);

    window.addEventListener('resize', resize);
    if (parallax) window.addEventListener('mousemove', onMouseMove);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener('resize', resize);
      if (parallax) window.removeEventListener('mousemove', onMouseMove);
    };
  }, [starCount, parallax, nebula, grid, horizonGlow]);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 w-full h-full"
      style={{ zIndex: 0 }}
      aria-hidden="true"
    />
  );
}
