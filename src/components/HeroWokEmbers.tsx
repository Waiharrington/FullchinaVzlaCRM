import React, { useEffect, useRef } from 'react';

type EmberShape = 'shard' | 'cinder' | 'droplet' | 'dust';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
  shape: EmberShape;
  polygonRatios?: number[]; // Unique jagged vertices for cinders
  rotation: number;
  rotSpeed: number;
  depth: 'bg' | 'mid' | 'fg';
  age: number;
  maxAge: number;
  seed: number;
  freq: number;
  swayAmp: number;
  flickerSpeed: number;
  hueType: number; // 0: Gold/Orange, 1: Flame Orange, 2: Deep Crimson
}

export const HeroWokEmbers: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      return;
    }

    let animationFrameId: number;
    let isVisible = true;
    let w = 0;
    let h = 0;

    const particles: Particle[] = [];

    const getTargetCount = () => {
      const isMobile = w < 768;
      return isMobile ? 8 : 16;
    };

    const createParticle = (initialSpawn = false): Particle => {
      const isMobile = w < 768;
      const depthRoll = Math.random();
      const depth: 'bg' | 'mid' | 'fg' = depthRoll < 0.3 ? 'bg' : depthRoll < 0.72 ? 'mid' : 'fg';

      // Shape archetype distribution:
      // - 'shard': elongated burning splinter (35%)
      // - 'cinder': jagged irregular carbon flake (35%)
      // - 'droplet': tapered teardrop ember (20%)
      // - 'dust': micro background ambient spark (10%)
      const shapeRoll = Math.random();
      let shape: EmberShape = 'cinder';
      if (shapeRoll < 0.35) shape = 'shard';
      else if (shapeRoll < 0.70) shape = 'cinder';
      else if (shapeRoll < 0.88) shape = 'droplet';
      else shape = 'dust';

      let baseW = 2.5;
      let baseH = 2.5;

      if (shape === 'shard') {
        // Thin elongated fiery splinter
        baseW = 1.2 + Math.random() * 1.5;
        baseH = 4.5 + Math.random() * 5.0; // Up to 9.5px tall!
      } else if (shape === 'cinder') {
        // Jagged irregular chunk
        baseW = 2.2 + Math.random() * 2.8;
        baseH = 2.0 + Math.random() * 2.6;
      } else if (shape === 'droplet') {
        // Tapered droplet
        baseW = 2.0 + Math.random() * 2.0;
        baseH = 3.5 + Math.random() * 3.5;
      } else {
        // Micro spark
        baseW = 0.8 + Math.random() * 0.8;
        baseH = 0.8 + Math.random() * 0.8;
      }

      // Depth scaling
      if (depth === 'bg') {
        baseW *= 0.65;
        baseH *= 0.65;
      } else if (depth === 'fg') {
        baseW *= 1.25;
        baseH *= 1.25;
      }

      if (isMobile) {
        baseW *= 0.85;
        baseH *= 0.85;
      }

      // Random polygon vertices for irregular cinders
      const polygonRatios = [
        0.7 + Math.random() * 0.6,
        0.6 + Math.random() * 0.7,
        0.8 + Math.random() * 0.5,
        0.5 + Math.random() * 0.8,
        0.7 + Math.random() * 0.6,
      ];

      // Emitter origin: around the wok dish and food area
      const minX = w * 0.38;
      const maxX = w * 0.94;
      const x = minX + Math.random() * (maxX - minX);

      const y = initialSpawn 
        ? h * (0.2 + Math.random() * 0.75) 
        : h * (0.72 + Math.random() * 0.24);

      const vy = -(0.32 + Math.random() * 0.48);
      const vx = (Math.random() - 0.5) * 0.22;
      const maxAge = 220 + Math.random() * 200;

      return {
        x,
        y,
        vx,
        vy,
        width: baseW,
        height: baseH,
        shape,
        polygonRatios,
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.04,
        depth,
        age: initialSpawn ? Math.floor(Math.random() * maxAge * 0.6) : 0,
        maxAge,
        seed: Math.random() * 100,
        freq: 0.018 + Math.random() * 0.025,
        swayAmp: 0.25 + Math.random() * 0.45,
        flickerSpeed: 0.08 + Math.random() * 0.12,
        hueType: Math.floor(Math.random() * 3),
      };
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = rect.width;
      h = rect.height;

      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const target = getTargetCount();
      while (particles.length < target) {
        particles.push(createParticle(true));
      }
    };

    resize();
    window.addEventListener('resize', resize);

    const observer = new IntersectionObserver(
      (entries) => {
        isVisible = entries[0].isIntersecting;
      },
      { threshold: 0.05 }
    );
    observer.observe(canvas);

    let lastTime = performance.now();

    const render = (time: number) => {
      animationFrameId = requestAnimationFrame(render);

      if (!isVisible || document.hidden) return;

      const delta = Math.min((time - lastTime) / 16.666, 2.5);
      lastTime = time;

      ctx.clearRect(0, 0, w, h);

      const targetCount = getTargetCount();

      if (particles.length < targetCount && Math.random() < 0.045) {
        particles.push(createParticle(false));
      }

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.age += delta;

        if (p.age >= p.maxAge || p.y < -20 || p.x < -20 || p.x > w + 20) {
          particles.splice(i, 1);
          continue;
        }

        // Upward drift with heat convection sway
        p.y += p.vy * delta;
        p.x += (p.vx + Math.sin(p.age * p.freq + p.seed) * p.swayAmp) * delta;
        p.rotation += p.rotSpeed * delta;

        const progress = p.age / p.maxAge;

        // Smooth fade in & graceful burn-out fade
        let alpha = 0;
        if (progress < 0.15) {
          alpha = progress / 0.15;
        } else if (progress > 0.60) {
          alpha = Math.max(0, 1 - (progress - 0.60) / 0.40);
        } else {
          alpha = 1;
        }

        // Oxygen turbulence micro-flicker
        const flicker = 0.85 + 0.15 * Math.sin(p.age * p.flickerSpeed + p.seed);
        alpha *= flicker;

        if (p.depth === 'bg') alpha *= 0.45;
        else if (p.depth === 'mid') alpha *= 0.78;
        else alpha *= 0.98;

        if (alpha <= 0.01) continue;

        // Size slightly shrinks as carbon burns down
        const scale = 1 - progress * 0.35;
        const curW = p.width * scale;
        const curH = p.height * scale;
        if (curW <= 0.4 || curH <= 0.4) continue;

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(p.x, p.y);

        // Directional alignment: shards align with drift angle, cinders tumble
        if (p.shape === 'shard' || p.shape === 'droplet') {
          const velocityAngle = Math.atan2(p.vy, p.vx + Math.sin(p.age * p.freq + p.seed) * p.swayAmp) + Math.PI / 2;
          ctx.rotate(velocityAngle * 0.6 + p.rotation * 0.2);
        } else {
          ctx.rotate(p.rotation);
        }

        // Incandescent thermal gradient (Yellow core -> Orange body -> Crimson red rim)
        const glowRadius = Math.max(curW, curH) * 2.0;
        const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, glowRadius);

        if (p.hueType === 0) {
          // Intense Molten Orange -> Scarlet Fire Red
          grad.addColorStop(0, 'rgba(255, 145, 25, 1)');
          grad.addColorStop(0.30, 'rgba(255, 69, 0, 0.95)');
          grad.addColorStop(0.65, 'rgba(220, 20, 20, 0.75)');
          grad.addColorStop(1, 'rgba(150, 0, 0, 0)');
        } else if (p.hueType === 1) {
          // Blazing Orange -> Deep Crimson Ember
          grad.addColorStop(0, 'rgba(255, 110, 10, 1)');
          grad.addColorStop(0.30, 'rgba(240, 40, 10, 0.95)');
          grad.addColorStop(0.65, 'rgba(195, 15, 15, 0.70)');
          grad.addColorStop(1, 'rgba(120, 0, 0, 0)');
        } else {
          // Ruby Charcoal with Warm Orange Spark Core
          grad.addColorStop(0, 'rgba(255, 160, 40, 0.98)');
          grad.addColorStop(0.25, 'rgba(255, 50, 0, 0.90)');
          grad.addColorStop(0.65, 'rgba(180, 10, 10, 0.60)');
          grad.addColorStop(1, 'rgba(100, 0, 0, 0)');
        }

        ctx.fillStyle = grad;

        // Draw organic non-circular geometry
        ctx.beginPath();
        if (p.shape === 'shard') {
          // Elongated burning diamond/shard with needle tips
          ctx.moveTo(0, -curH * 0.6);
          ctx.lineTo(curW * 0.55, 0);
          ctx.lineTo(0, curH * 0.6);
          ctx.lineTo(-curW * 0.55, 0);
          ctx.closePath();
        } else if (p.shape === 'cinder' && p.polygonRatios) {
          // Irregular 5-point jagged polygon (unique per particle)
          const numPoints = 5;
          const rx = curW * 0.8;
          const ry = curH * 0.8;
          for (let pt = 0; pt < numPoints; pt++) {
            const th = (pt / numPoints) * Math.PI * 2;
            const rMod = p.polygonRatios[pt] || 1;
            const px = Math.cos(th) * rx * rMod;
            const py = Math.sin(th) * ry * rMod;
            if (pt === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.closePath();
        } else if (p.shape === 'droplet') {
          // Tapered burning teardrop
          ctx.moveTo(0, -curH * 0.55);
          ctx.quadraticCurveTo(curW * 0.6, 0, 0, curH * 0.5);
          ctx.quadraticCurveTo(-curW * 0.6, 0, 0, -curH * 0.55);
          ctx.closePath();
        } else {
          // Micro dust point
          ctx.rect(-curW * 0.5, -curH * 0.5, curW, curH);
        }

        ctx.fill();
        ctx.restore();
      }
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', resize);
      observer.disconnect();
    };
  }, []);

  return (
    <canvas 
      ref={canvasRef} 
      className="public-hero-embers-canvas" 
      aria-hidden="true" 
    />
  );
};
