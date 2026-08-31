import { useState, useEffect } from 'react';

const LOADING_PHRASES = [
  "Cocinando tu experiencia...",
  "El secreto está en el wok a 300°C...",
  "Preparando ingredientes frescos...",
  "¡El mejor sabor asiático está en camino!",
  "Salteando tu pedido a fuego alto...",
  "Armando tu combinación ideal..."
];

export function PublicMenuSkeleton() {
  const [phraseIndex, setPhraseIndex] = useState(() => Math.floor(Math.random() * LOADING_PHRASES.length));
  const [fadeState, setFadeState] = useState('fade-in');
  const isDesktop = typeof window !== 'undefined' && window.matchMedia('(min-width: 1280px) and (pointer: fine)').matches;
  const backgroundAsset = isDesktop
    ? '/fondos/fondo_pagina_carga_compu.png'
    : '/fondos/fondo_pagina_carga_phone.png';

  useEffect(() => {
    const interval = setInterval(() => {
      // Start fade out
      setFadeState('fade-out');
      
      setTimeout(() => {
        setPhraseIndex((prevIndex) => (prevIndex + 1) % LOADING_PHRASES.length);
        setFadeState('fade-in');
      }, 200); // duration of fade-out
    }, 1200);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="onb-loader-screen" aria-label="Cargando menú">
      <style>{`
        .onb-loader-screen {
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100dvh;
          background-image: url('${backgroundAsset}');
          background-size: cover;
          background-position: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          z-index: 99999;
          overflow: hidden;
          opacity: 0;
          animation: onb-fade-in 0.8s ease-out forwards;
        }

        @keyframes onb-fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .onb-loader-scrim {
          position: absolute;
          inset: 0;
          background: radial-gradient(circle at center, rgba(12, 13, 16, 0.05) 0%, rgba(12, 13, 16, 0.45) 100%);
          z-index: 2;
        }

        /* --- Cinematic Floating Embers --- */
        .embers-container {
          position: absolute;
          inset: 0;
          overflow: hidden;
          pointer-events: none;
          z-index: 3;
        }

        .ember {
          position: absolute;
          bottom: -15px;
          border-radius: 50%;
          background: #ff6a00;
          filter: blur(0.5px);
          box-shadow: 0 0 6px #e31b2b, 0 0 12px #ff9e1b;
          animation: ember-float-up 5s infinite linear;
          opacity: 0;
        }

        .ember:nth-child(1) { left: 12%; animation-duration: 4.8s; animation-delay: 0.3s; width: 4px; height: 4px; }
        .ember:nth-child(2) { left: 28%; animation-duration: 6.2s; animation-delay: 1.5s; width: 6px; height: 6px; }
        .ember:nth-child(3) { left: 45%; animation-duration: 5.1s; animation-delay: 0s; width: 3px; height: 3px; }
        .ember:nth-child(4) { left: 62%; animation-duration: 6.8s; animation-delay: 2.2s; width: 5px; height: 5px; }
        .ember:nth-child(5) { left: 78%; animation-duration: 4.5s; animation-delay: 1.1s; width: 4px; height: 4px; }
        .ember:nth-child(6) { left: 92%; animation-duration: 5.5s; animation-delay: 2.7s; width: 3px; height: 3px; }
        .ember:nth-child(7) { left: 20%; animation-duration: 5.9s; animation-delay: 0.8s; width: 5px; height: 5px; }
        .ember:nth-child(8) { left: 55%; animation-duration: 6.5s; animation-delay: 1.9s; width: 4px; height: 4px; }
        .ember:nth-child(9) { left: 70%; animation-duration: 5.2s; animation-delay: 3.1s; width: 3px; height: 3px; }
        .ember:nth-child(10) { left: 85%; animation-duration: 6.0s; animation-delay: 0.5s; width: 5px; height: 5px; }

        @keyframes ember-float-up {
          0% {
            transform: translateY(0) translateX(0) scale(1);
            opacity: 0;
          }
          15% {
            opacity: 0.8;
          }
          80% {
            opacity: 0.5;
          }
          100% {
            transform: translateY(-110vh) translateX(35px) scale(0.4);
            opacity: 0;
          }
        }

        .loader-content {
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          z-index: 4;
          width: 100%;
          max-width: 320px;
          gap: 24px;
        }

        /* --- Logo Container --- */
        .wok-logo-container {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 160px;
          height: 160px;
        }

        /* Logo rocks and periodically sweeps with neon drop shadow */
        .cooking-logo {
          width: 150px;
          height: 150px;
          object-fit: contain;
          transform-origin: 50% 80%;
          animation: 
            logo-subtle-rock 1.8s ease-in-out infinite,
            logo-neon-sweep-glow 3.6s ease-in-out infinite alternate;
        }

        /* --- Swirling Fire Tail SVG Spinner --- */
        .loading-spinner-svg {
          width: 44px;
          height: 44px;
          overflow: visible;
          animation: spin-anim 0.9s cubic-bezier(0.4, 0.1, 0.3, 0.95) infinite;
        }

        .spinner-track {
          stroke: rgba(227, 27, 43, 0.12);
        }

        .spinner-tail {
          stroke-dasharray: 85;
          stroke-dashoffset: 15;
          filter: drop-shadow(0 0 5px rgba(227, 27, 43, 0.8)) drop-shadow(0 0 10px rgba(255, 158, 27, 0.5));
        }

        /* --- Loading Typography --- */
        .loader-text-group {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          min-height: 50px;
        }

        .loader-title {
          font-family: var(--font-sans, system-ui, -apple-system, sans-serif);
          font-size: 14px;
          font-weight: 800;
          letter-spacing: 0.2em;
          color: #FFFFFF;
          text-align: center;
          text-transform: uppercase;
          text-shadow: 0 2px 5px rgba(0, 0, 0, 0.5);
        }

        .loader-subtitle {
          font-family: system-ui, -apple-system, sans-serif;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.08em;
          color: #888d9b;
          text-transform: uppercase;
          text-align: center;
          transition: opacity 0.2s ease-in-out, transform 0.2s ease-in-out;
        }

        .loader-subtitle.fade-in {
          opacity: 0.85;
          transform: translateY(0);
        }

        .loader-subtitle.fade-out {
          opacity: 0;
          transform: translateY(3px);
        }

        /* --- Animation Keyframes --- */
        
        /* Subtle rocking motion */
        @keyframes logo-subtle-rock {
          0%, 100% {
            transform: translateY(0) rotate(0deg);
          }
          33% {
            transform: translateY(-4px) rotate(-3deg);
          }
          66% {
            transform: translateY(1px) rotate(4deg);
          }
        }

        /* Neon drop shadow sweep (represents fire heat flares) */
        @keyframes logo-neon-sweep-glow {
          0%, 75% {
            filter: drop-shadow(0 4px 15px rgba(227, 27, 43, 0.45));
          }
          90% {
            filter: drop-shadow(0 0 22px rgba(227, 27, 43, 0.95)) drop-shadow(0 0 35px rgba(255, 158, 27, 0.65));
          }
        }

        @keyframes spin-anim {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>

      {/* Floating Cinematic Embers in background */}
      <div className="embers-container">
        <span className="ember" />
        <span className="ember" />
        <span className="ember" />
        <span className="ember" />
        <span className="ember" />
        <span className="ember" />
        <span className="ember" />
        <span className="ember" />
        <span className="ember" />
        <span className="ember" />
      </div>

      <div className="onb-loader-scrim" />

      <div className="loader-content">
        <div className="wok-logo-container">
          <img 
            className="cooking-logo" 
            src="/optimized/root/logo.webp" 
            alt="Full China" 
          />
        </div>

        {/* Swirling Fire Tail Spinner */}
        <svg className="loading-spinner-svg" viewBox="0 0 50 50">
          <defs>
            <linearGradient id="fire-trail-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#E31B2B" />
              <stop offset="60%" stopColor="#FF9E1B" />
              <stop offset="100%" stopColor="transparent" />
            </linearGradient>
          </defs>
          <circle className="spinner-track" cx="25" cy="25" r="20" fill="none" strokeWidth="4" />
          <circle className="spinner-tail" cx="25" cy="25" r="20" fill="none" stroke="url(#fire-trail-gradient)" strokeWidth="4" strokeLinecap="round" />
        </svg>

        <div className="loader-text-group">
          <div className="loader-title">Preparando Wok</div>
          <div className={`loader-subtitle ${fadeState}`}>
            {LOADING_PHRASES[phraseIndex]}
          </div>
        </div>
      </div>
    </div>
  );
}
