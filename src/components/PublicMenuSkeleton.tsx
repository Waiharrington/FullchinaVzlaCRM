import './PublicMenuSkeleton.css';
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

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
    ? '/optimized/fondos/fondo-compu.webp'
    : '/optimized/fondos/fondo-pagina-carga.webp';

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

  return createPortal((
    <div className="onb-loader-screen" aria-label="Cargando menú" style={{ backgroundImage: `url("${backgroundAsset}")` }}>

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
  ), document.body);
}
