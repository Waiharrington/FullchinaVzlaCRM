const fs = require('fs');
const file = 'src/pages/PublicOnboarding.css';
let content = fs.readFileSync(file, 'utf8');

const oldDesktopStart = '/* --- Desktop (>= 1025px)';
const startIndex = content.indexOf(oldDesktopStart);
if (startIndex !== -1) {
  content = content.substring(0, startIndex);
}

const newDesktopCSS = `/* --- Desktop (>= 1025px) -------------------------------------------- */

@media (min-width: 1025px) {
  .onb-bg-img {
    background-image: url('/fondos/compu-onboarding-fondo.png');
    background-position: left center;
    background-size: cover;
  }
  .onb-bg-img::after { display: none !important; }
  .onb-bg-atmosphere { display: none !important; }
  .onb-embers { display: none !important; }
  .onb-waves { display: none !important; }

  .onb-page {
    overflow: hidden;
  }

  .onb-scroll {
    display: grid !important;
    grid-template-columns: 42vw 58vw;
    grid-template-rows: auto auto auto 1fr;
    grid-template-areas:
      "logo hero"
      "copy hero"
      "features hero"
      "bottom hero";
    gap: 0;
    align-content: center;
    align-items: start;
    width: 100vw !important;
    max-width: 100vw !important;
    height: 100dvh;
    margin: 0 !important;
    padding: 0 !important;
    overflow: hidden;
  }

  /* Flatten the DOM tree for the grid */
  .onb-top, .onb-content {
    display: contents !important;
  }

  /* Right Side: Full Bleed Hero */
  .onb-hero {
    grid-area: hero;
    position: relative !important;
    width: 100% !important;
    max-width: none !important;
    height: 100dvh !important;
    margin: 0 !important;
    border-radius: 0 !important;
    box-shadow: none !important;
    border: none !important;
    align-self: stretch;
  }
  
  .onb-hero::before {
    content: '';
    display: block !important;
    position: absolute;
    inset: 0;
    z-index: 3;
    background: linear-gradient(to right, #0A0B0E 0%, rgba(10,11,14,0.7) 12%, transparent 30%);
    pointer-events: none;
    mask: none;
    -webkit-mask: none;
  }
  .onb-hero::after { display: none !important; }
  
  .onb-hero-img {
    mask-image: none !important;
    -webkit-mask-image: none !important;
    border-radius: 0 !important;
  }

  /* Left Side Items */
  .onb-logo {
    grid-area: logo;
    width: clamp(160px, 14vw, 220px) !important;
    margin: 0 0 24px 6vw !important;
    align-self: end;
    animation: none !important;
    transform: none !important;
    filter: drop-shadow(0 4px 20px rgba(227, 27, 43, 0.4));
  }

  .onb-copy {
    grid-area: copy;
    margin-top: 0 !important;
    text-align: left !important;
    padding-left: 6vw;
    padding-right: 2vw;
  }
  .onb-title {
    font-size: clamp(38px, 4.5vw, 60px) !important;
    justify-content: flex-start !important;
    gap: 12px;
    margin-bottom: 8px;
  }
  .onb-flame {
    width: clamp(34px, 3.5vw, 48px);
    height: clamp(34px, 3.5vw, 48px);
  }
  .onb-subtitle {
    text-align: left !important;
    font-size: clamp(18px, 2vw, 24px) !important;
    color: #9DA0A6;
  }

  .onb-features {
    grid-area: features;
    margin-top: 36px !important;
    gap: 16px;
    width: 100% !important;
    padding-left: 6vw;
    padding-right: 4vw;
  }
  .onb-feature-card {
    height: auto !important;
    padding: 16px 22px !important;
    border-radius: 16px !important;
    background: rgba(12, 14, 18, 0.7) !important;
    backdrop-filter: blur(16px);
    border: 1px solid rgba(255, 255, 255, 0.05) !important;
    box-shadow: 0 8px 30px rgba(0,0,0,0.5) !important;
  }
  .onb-feature-icon {
    width: 48px !important;
    height: 48px !important;
    background: transparent !important;
    border: 1px solid rgba(227, 27, 43, 0.4) !important;
    color: #E31B2B;
    box-shadow: none !important;
  }
  .onb-feature-title { font-size: 17px !important; font-weight: 700 !important; color: #FFF !important; }
  .onb-feature-desc { font-size: 14px !important; color: #7D8089 !important; line-height: 1.4 !important; }

  .onb-bottom {
    grid-area: bottom;
    padding-top: 36px !important;
    width: 100% !important;
    padding-left: 6vw;
    padding-right: 4vw;
  }
  .onb-cta {
    width: 100% !important;
    height: 68px !important;
    font-size: 22px !important;
    border-radius: 16px !important;
    background: linear-gradient(135deg, #CC1A1A 0%, #E62B20 45%, #FF3D2E 100%) !important;
    box-shadow: 0 8px 28px rgba(204, 26, 26, 0.35) !important;
  }
  .onb-cta::after { display: none !important; }
  .onb-footnote {
    text-align: left !important;
    font-size: 14px !important;
    margin-top: 16px !important;
    color: #6B6E76 !important;
    margin-left: 2px;
  }
}
`;

fs.writeFileSync(file, content + newDesktopCSS);
console.log('Fixed desktop grid correctly');
