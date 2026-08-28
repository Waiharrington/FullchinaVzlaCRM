const fs = require('fs');
const file = 'src/pages/PublicOnboarding.css';
let content = fs.readFileSync(file, 'utf8');

const oldDesktopStart = '/* --- Desktop (>= 1025px)';
const startIndex = content.indexOf(oldDesktopStart);
if (startIndex !== -1) {
  content = content.substring(0, startIndex);
}

const newDesktopCSS = `/* --- Desktop (>= 1025px) Split Screen -------------------------------------------- */

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
    display: grid;
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
    width: 100vw;
    max-width: 100vw;
    height: 100dvh;
    margin: 0;
    padding: 0;
    overflow: hidden;
  }

  .onb-top, .onb-content {
    display: contents;
  }

  /* Left Side: Logo, Copy, Features, Bottom */
  .onb-logo {
    grid-area: logo;
    width: 200px;
    margin: 0 0 40px 6vw;
    align-self: end;
  }

  .onb-copy {
    grid-area: copy;
    margin-top: 0;
    text-align: left;
    padding-left: 6vw;
    padding-right: 2vw;
  }
  .onb-title {
    font-size: clamp(40px, 4.5vw, 64px);
    justify-content: flex-start;
  }
  .onb-subtitle {
    text-align: left;
    font-size: clamp(20px, 2vw, 24px);
    margin-top: 12px;
  }

  .onb-features {
    grid-area: features;
    margin-top: 50px;
    gap: 16px;
    width: 100%;
    padding-left: 6vw;
    padding-right: 4vw;
  }
  .onb-feature-card {
    height: 90px;
    border-radius: 20px;
    background: rgba(10,11,14,0.6);
    backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 85, 35, 0.15);
  }
  .onb-feature-icon {
    width: 50px;
    height: 50px;
    background: transparent;
    border: 1px solid rgba(227, 27, 43, 0.4);
    box-shadow: none;
  }
  .onb-feature-title { font-size: 18px; }
  .onb-feature-desc { font-size: 15px; color: #7D8089; }

  .onb-bottom {
    grid-area: bottom;
    padding-top: 50px;
    width: 100%;
    padding-left: 6vw;
    padding-right: 4vw;
  }
  .onb-cta {
    height: 72px;
    font-size: 22px;
    border-radius: 18px;
    background: linear-gradient(90deg, #e91616 0%, #ff3828 100%);
    box-shadow: 0 0 20px rgba(227, 27, 43, 0.3);
  }
  .onb-cta::after { display: none; }
  .onb-footnote {
    text-align: left;
    font-size: 15px;
    margin-top: 20px;
    color: #6B6E76;
  }

  /* Right Side: Full Bleed Hero */
  .onb-hero {
    grid-area: hero;
    width: 100%;
    max-width: none;
    height: 100dvh;
    border-radius: 0;
    box-shadow: none;
    border: none;
    margin: 0;
    align-self: stretch;
    position: relative;
  }
  
  /* The blend gradient over the image */
  .onb-hero::before {
    content: '';
    display: block !important;
    position: absolute;
    inset: 0;
    z-index: 3;
    background: linear-gradient(to right, #0A0B0E 0%, rgba(10,11,14,0.85) 15%, transparent 35%);
    pointer-events: none;
    border-radius: 0;
    padding: 0;
    mask: none;
    -webkit-mask: none;
  }
  .onb-hero::after { display: none !important; }
  
  .onb-hero-img {
    mask-image: none !important;
    -webkit-mask-image: none !important;
  }
}

@media (min-width: 1025px) {
  .tablet-image-editor { display: none !important; }
}
`;

fs.writeFileSync(file, content + newDesktopCSS);
console.log('Done rewriting desktop split screen css');
