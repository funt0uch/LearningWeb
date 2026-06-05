"use client";

import { useEffect, useRef } from "react";

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  pulse: number;
};

function createParticle(width: number, height: number): Particle {
  const speed = 0.22 + Math.random() * 0.42;
  const angle = Math.random() * Math.PI * 2;
  return {
    x: Math.random() * width,
    y: Math.random() * height,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    r: 1.15 + Math.random() * 2.1,
    pulse: Math.random() * Math.PI * 2,
  };
}

export function ParticleCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let frame = 0;
    let raf = 0;
    let particles: Particle[] = [];

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.floor(rect.width * dpr);
      canvas.height = Math.floor(rect.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.max(56, Math.min(112, Math.floor((rect.width * rect.height) / 12000)));
      particles = Array.from({ length: count }, () => createParticle(rect.width, rect.height));
    };

    const draw = () => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      frame += 0.01;
      ctx.clearRect(0, 0, width, height);

      const gradient = ctx.createLinearGradient(0, 0, width, height);
      gradient.addColorStop(0, "rgba(255,255,255,0.74)");
      gradient.addColorStop(0.45, "rgba(235,248,255,0.54)");
      gradient.addColorStop(1, "rgba(232,255,250,0.44)");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.pulse += 0.012;

        if (p.x < -20) p.x = width + 20;
        if (p.x > width + 20) p.x = -20;
        if (p.y < -20) p.y = height + 20;
        if (p.y > height + 20) p.y = -20;
      }

      for (let i = 0; i < particles.length; i += 1) {
        const a = particles[i];
        for (let j = i + 1; j < particles.length; j += 1) {
          const b = particles[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.hypot(dx, dy);
          if (dist > 142) continue;

          const alpha = (1 - dist / 142) * 0.22;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.strokeStyle = `rgba(18, 106, 175, ${alpha})`;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }

      for (const p of particles) {
        const glow = 0.48 + Math.sin(p.pulse + frame) * 0.18;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * 3.8, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(10, 173, 185, ${0.035 + glow * 0.02})`;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(12, 84, 158, ${0.58 + glow * 0.18})`;
        ctx.fill();
      }

      raf = window.requestAnimationFrame(draw);
    };

    resize();
    draw();
    window.addEventListener("resize", resize);

    return () => {
      window.removeEventListener("resize", resize);
      window.cancelAnimationFrame(raf);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-hidden="true" />;
}
