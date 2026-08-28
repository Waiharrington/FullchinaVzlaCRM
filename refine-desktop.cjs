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
    position: relative;
  }

  /* Right Side: Absolute Full Bleed Hero */
  .onb-hero {
    position: absolute !important;
    right: 0;
    top: 0;
    width: 58vw;
    height: 100dvh;
    max-width: none !important;
    margin: 0 !important;
    border-radius: 0 !important;
    box-shadow: none !important;
    border: none !important;
    z-index: 1;
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

  /* Left Side Container */
  .onb-scroll {
    position: relative;
    z-index: 2;
    display: flex;
    flex-direction: column;
    justify-content: center;
    width: 42vw;
    max-width: none;
    height: 100dvh;
    padding: 0 4vw 0 6vw;
    margin: 0;
    overflow: hidden;
  }

  .onb-top {
    padding: 0;
    align-items: flex-start;
  }

  .onb-logo {
    width: clamp(160px, 14vw, 220px);
    margin-bottom: 40px;
    animation: none;
    transform: none;
    filter: drop-shadow(0 4px 20px rgba(227, 27, 43, 0.4));
  }

  .onb-content {
    padding: 0;
    justify-content: flex-start;
    flex: none;
  }

  .onb-copy {
    margin-top: 0;
    text-align: left;
    width: 100%;
  }
  .onb-title {
    font-size: clamp(38px, 4.5vw, 60px);
    justify-content: flex-start;
    gap: 12px;
    margin-bottom: 12px;
  }
  .onb-flame {
    width: clamp(34px, 3.5vw, 48px);
    height: clamp(34px, 3.5vw, 48px);
  }
  .onb-subtitle {
    text-align: left;
    font-size: clamp(18px, 2vw, 24px);
    color: #9DA0A6;
  }

  .onb-features {
    margin-top: 36px;
    gap: 16px;
    width: 100%;
  }
  .onb-feature-card {
    height: auto;
    padding: 16px 22px;
    border-radius: 16px;
    background: rgba(12, 14, 18, 0.7);
    backdrop-filter: blur(16px);
    border: 1px solid rgba(255, 255, 255, 0.05);
    box-shadow: 0 8px 30px rgba(0,0,0,0.5);
  }
  .onb-feature-icon {
    width: 48px;
    height: 48px;
    background: transparent;
    border: 1px solid rgba(227, 27, 43, 0.4);
    color: #E31B2B;
    box-shadow: none;
  }
  .onb-feature-text {
    gap: 4px;
  }
  .onb-feature-title { font-size: 17px; font-weight: 700; color: #FFF; }
  .onb-feature-desc { font-size: 14px; color: #7D8089; line-height: 1.4; }
  .onb-feature-arrow { color: #FFC83D; font-size: 24px; opacity: 0.8; }

  .onb-bottom {
    padding-top: 36px;
    width: 100%;
  }
  .onb-cta-wrap {
    width: 100%;
  }
  .onb-cta {
    width: 100%;
    height: 68px;
    padding: 0 24px;
    font-size: 22px;
    border-radius: 16px;
    background: linear-gradient(135deg, #CC1A1A 0%, #E62B20 45%, #FF3D2E 100%);
    box-shadow: 0 8px 28px rgba(204, 26, 26, 0.35);
  }
  .onb-cta::after { display: none; }
  .onb-footnote {
    text-align: left;
    font-size: 14px;
    margin-top: 16px;
    color: #6B6E76;
    margin-left: 2px;
  }
}
`;

fs.writeFileSync(file, content + newDesktopCSS);
console.log('Done rewriting desktop layout properly');
