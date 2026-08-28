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
    position: relative !important;
    display: flex;
    align-items: center;
  }

  /* Make sure these don't trap absolute positioning */
  .onb-scroll, .onb-top, .onb-content {
    position: static !important;
    transform: none !important;
  }

  /* Left Side Container (Flexbox for perfect UX hierarchy) */
  .onb-scroll {
    display: flex !important;
    flex-direction: column !important;
    justify-content: center !important;
    width: 42vw !important;
    max-width: 600px !important;
    height: 100dvh !important;
    margin: 0 !important;
    padding: 0 4vw 0 6vw !important;
    overflow: visible !important;
    z-index: 2;
  }

  .onb-top {
    display: flex !important;
    flex-direction: column !important;
    padding: 0 !important;
    margin: 0 !important;
    align-items: flex-start !important;
  }

  .onb-content {
    display: flex !important;
    flex-direction: column !important;
    padding: 0 !important;
    margin: 0 !important;
  }

  /* Typography & Hierarchy */
  .onb-logo {
    width: clamp(140px, 12vw, 180px) !important;
    margin: 0 0 40px 0 !important;
    animation: none !important;
    filter: drop-shadow(0 4px 15px rgba(227, 27, 43, 0.4)) !important;
  }

  .onb-copy {
    margin: 0 0 32px 0 !important;
    text-align: left !important;
  }
  
  .onb-title {
    font-size: clamp(38px, 4vw, 56px) !important;
    justify-content: flex-start !important;
    gap: 12px !important;
    margin: 0 0 8px 0 !important;
    line-height: 1.1 !important;
  }
  
  .onb-flame {
    width: clamp(30px, 3vw, 40px) !important;
    height: clamp(30px, 3vw, 40px) !important;
  }
  
  .onb-subtitle {
    text-align: left !important;
    font-size: clamp(18px, 1.8vw, 22px) !important;
    color: #9DA0A6 !important;
    margin: 0 !important;
  }

  /* Features */
  .onb-features {
    margin: 0 0 40px 0 !important;
    gap: 16px !important;
    width: 100% !important;
    display: flex !important;
    flex-direction: column !important;
  }
  
  .onb-feature-card {
    height: auto !important;
    padding: 18px 24px !important;
    border-radius: 16px !important;
    background: rgba(12, 14, 18, 0.7) !important;
    backdrop-filter: blur(16px) !important;
    border: 1px solid rgba(255, 255, 255, 0.05) !important;
    box-shadow: 0 8px 25px rgba(0,0,0,0.4) !important;
    margin: 0 !important;
  }
  
  .onb-feature-icon {
    width: 44px !important;
    height: 44px !important;
    background: transparent !important;
    border: 1px solid rgba(227, 27, 43, 0.4) !important;
    color: #E31B2B !important;
    box-shadow: none !important;
  }
  
  .onb-feature-title { 
    font-size: 17px !important; 
    font-weight: 700 !important; 
    color: #FFF !important; 
    margin-bottom: 2px !important;
  }
  
  .onb-feature-desc { 
    font-size: 14px !important; 
    color: #7D8089 !important; 
    line-height: 1.4 !important; 
  }

  /* CTA Area */
  .onb-bottom {
    padding: 0 !important;
    width: 100% !important;
    margin: 0 !important;
  }
  
  .onb-cta {
    width: 100% !important;
    height: 64px !important;
    font-size: 20px !important;
    font-weight: 700 !important;
    border-radius: 16px !important;
    background: linear-gradient(135deg, #CC1A1A 0%, #E62B20 45%, #FF3D2E 100%) !important;
    box-shadow: 0 8px 28px rgba(204, 26, 26, 0.35) !important;
    margin: 0 !important;
  }
  
  .onb-cta::after { display: none !important; }
  
  .onb-footnote {
    text-align: left !important;
    font-size: 14px !important;
    margin-top: 16px !important;
    color: #6B6E76 !important;
    margin-left: 4px !important;
  }

  /* Right Side: Full Bleed Hero Absolute Positioned */
  .onb-hero {
    position: absolute !important;
    right: 0 !important;
    top: 0 !important;
    width: 58vw !important;
    height: 100dvh !important;
    max-width: none !important;
    margin: 0 !important;
    padding: 0 !important;
    border-radius: 0 !important;
    box-shadow: none !important;
    border: none !important;
    z-index: 1 !important;
  }
  
  .onb-hero::before {
    content: '';
    display: block !important;
    position: absolute !important;
    inset: 0 !important;
    z-index: 3 !important;
    background: linear-gradient(to right, #0A0B0E 0%, rgba(10,11,14,0.85) 12%, transparent 35%) !important;
    pointer-events: none !important;
    mask: none !important;
    -webkit-mask: none !important;
  }
  
  .onb-hero::after { display: none !important; }
  
  .onb-hero-img {
    mask-image: none !important;
    -webkit-mask-image: none !important;
    border-radius: 0 !important;
    object-position: center !important; /* Defaulting to center for desktop full view */
  }
}
`;

fs.writeFileSync(file, content + newDesktopCSS);
console.log('Fixed hierarchy layout for desktop');
