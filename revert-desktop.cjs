const fs = require('fs');
const file = 'src/pages/PublicOnboarding.css';
let content = fs.readFileSync(file, 'utf8');

const oldDesktopStart = '/* --- Desktop (>= 1025px)';
const startIndex = content.indexOf(oldDesktopStart);
if (startIndex !== -1) {
  content = content.substring(0, startIndex);
}

const newDesktopCSS = \/* --- Desktop (>= 1025px) Split Screen -------------------------------------------- */

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
    grid-template-columns: 45vw 55vw; /* Slightly wider left column to fit the text */
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
    object-position: center !important;
  }

  /* Left Side: Reverted to what user liked */
  .onb-logo {
    grid-area: logo;
    width: 200px !important;
    margin: 0 0 30px 6vw !important;
    align-self: end;
  }

  .onb-copy {
    grid-area: copy;
    margin-top: 0 !important;
    text-align: left !important;
    padding-left: 6vw;
    padding-right: 2vw;
    position: relative;
    z-index: 10; /* Keep text above the photo if it overlaps */
  }
  .onb-title {
    font-size: clamp(40px, 4.5vw, 64px) !important;
    justify-content: flex-start !important;
    white-space: normal !important; /* Allow wrapping so it doesn't get cut off */
    flex-wrap: wrap;
    line-height: 1.1;
  }
  .onb-subtitle {
    text-align: left !important;
    font-size: clamp(20px, 2vw, 24px) !important;
    margin-top: 12px !important;
  }

  .onb-features {
    grid-area: features;
    margin-top: 40px !important;
    gap: 16px;
    width: 100% !important;
    padding-left: 6vw;
    padding-right: 4vw;
  }
  .onb-feature-card {
    height: 90px !important;
    border-radius: 20px !important;
    background: rgba(10,11,14,0.6) !important;
    backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 85, 35, 0.15) !important;
  }
  .onb-feature-icon {
    width: 50px !important;
    height: 50px !important;
    background: transparent !important;
    border: 1px solid rgba(227, 27, 43, 0.4) !important;
    box-shadow: none !important;
  }
  .onb-feature-title { font-size: 18px !important; }
  .onb-feature-desc { font-size: 15px !important; color: #7D8089 !important; }

  .onb-bottom {
    grid-area: bottom;
    padding-top: 40px !important;
    width: 100% !important;
    padding-left: 6vw;
    padding-right: 4vw;
  }
  .onb-cta {
    height: 72px !important;
    font-size: 22px !important;
    border-radius: 18px !important;
    background: linear-gradient(90deg, #e91616 0%, #ff3828 100%) !important;
    box-shadow: 0 0 20px rgba(227, 27, 43, 0.3) !important;
  }
  .onb-cta::after { display: none !important; }
  .onb-footnote {
    text-align: left !important;
    font-size: 15px !important;
    margin-top: 20px !important;
    color: #6B6E76 !important;
  }
}

@media (min-width: 1025px) {
  .tablet-image-editor { display: none !important; }
}
\;

fs.writeFileSync(file, content + newDesktopCSS);
console.log('Reverted to requested desktop css');
