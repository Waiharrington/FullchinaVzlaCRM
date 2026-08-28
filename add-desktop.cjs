const fs = require('fs');

const cssFile = 'src/pages/PublicOnboarding.css';
let cssContent = fs.readFileSync(cssFile, 'utf8');

const desktopCSS = `
/* --- Desktop (>= 1025px) -------------------------------------------- */

@media (min-width: 1025px) {
  .onb-bg-img {
    background-image: url('/fondos/compu-onboarding-fondo.png');
    background-position: center;
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
    grid-template-columns: 42% 53%;
    grid-template-rows: auto auto auto 1fr;
    grid-template-areas:
      "logo hero"
      "copy hero"
      "features hero"
      "bottom hero";
    gap: 0 5%;
    align-content: center;
    align-items: start;
    width: 100vw;
    max-width: 1200px;
    height: 100dvh;
    margin: 0 auto;
    padding: 0 40px;
    overflow: visible;
  }

  .onb-top, .onb-content {
    display: contents;
  }

  /* Left Side: Logo, Copy, Features, Bottom */
  .onb-logo {
    grid-area: logo;
    width: 180px;
    margin: 0 0 40px 0;
    align-self: end;
  }

  .onb-copy {
    grid-area: copy;
    margin-top: 0;
    text-align: left;
  }
  .onb-title {
    font-size: clamp(36px, 4vw, 56px);
    justify-content: flex-start;
  }
  .onb-subtitle {
    text-align: left;
    font-size: clamp(18px, 2vw, 22px);
    margin-top: 10px;
  }

  .onb-features {
    grid-area: features;
    margin-top: 40px;
    gap: 16px;
    width: 100%;
  }
  .onb-feature-card {
    height: 90px;
    border-radius: 20px;
    background: rgba(0,0,0,0.4);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 85, 35, 0.2);
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
    padding-top: 30px;
    width: 100%;
  }
  .onb-cta {
    height: 72px;
    font-size: 24px;
    border-radius: 18px;
    background: linear-gradient(90deg, #e91616 0%, #ff3828 100%);
    box-shadow: 0 0 20px rgba(227, 27, 43, 0.3);
  }
  .onb-cta::after { display: none; }
  .onb-footnote {
    text-align: left;
    font-size: 15px;
    margin-top: 20px;
  }

  /* Right Side: Hero */
  .onb-hero {
    grid-area: hero;
    width: 100%;
    max-width: none;
    aspect-ratio: 1.3 / 1;
    height: auto;
    border-radius: 24px;
    box-shadow: 0 0 40px rgba(255, 85, 35, 0.15), 0 10px 50px rgba(0,0,0,0.8);
    border: 1px solid rgba(255, 85, 35, 0.7);
    margin: 0;
    align-self: center;
  }
  .onb-hero::before { display: none !important; }
  .onb-hero::after { display: none !important; }
  .onb-hero-img {
    mask-image: none !important;
    -webkit-mask-image: none !important;
  }
}

/* Make sure the tablet editor doesn't show on desktop */
@media (min-width: 1025px) {
  .tablet-image-editor { display: none !important; }
}
`;

fs.writeFileSync(cssFile, cssContent + desktopCSS);
console.log('Done adding desktop css');
