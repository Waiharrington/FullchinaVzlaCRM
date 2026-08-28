const fs = require('fs');
const file = 'src/pages/PublicOnboarding.css';
let content = fs.readFileSync(file, 'utf8');

const startStr = '/* --- Tablets portrait (600-900px, portrait) ---------------------- */';
const endStr = '/* --- Tall phones (>800px, iPhone Pro Max etc) -------------------- */';

const startIndex = content.indexOf(startStr);
const endIndex = content.indexOf(endStr);

if (startIndex === -1 || endIndex === -1) {
  console.log('Markers not found');
  process.exit(1);
}

const newTabletCSS = `/* --- Tablets portrait (600-900px, portrait) ---------------------- */

@media (min-width: 600px) and (max-width: 900px) and (orientation: portrait) {
  .onb-bg-img {
    background-image: url('/fondos/tablet-onboarding-fondo.png');
    background-position: center;
    background-size: cover;
  }
  .onb-bg-img::after { display: none !important; }
  .onb-bg-atmosphere { display: none !important; }
  .onb-embers { display: none !important; }
  .onb-waves { display: none !important; }

  .onb-page { overflow: hidden; }
  .onb-scroll { width: 100vw; max-width: 100vw; height: 100dvh; overflow: hidden; }

  .onb-top {
    padding-top: 6vh;
    padding-left: 0;
    padding-right: 0;
  }
  .onb-logo {
    width: clamp(140px, 20vw, 180px);
    margin-bottom: 2vh;
  }

  .onb-hero {
    width: 85%;
    height: clamp(220px, 30vh, 300px);
    border-radius: 24px;
    margin-top: 0;
    box-shadow: 0 0 30px rgba(255, 85, 35, 0.15), 0 10px 40px rgba(0,0,0,0.8);
    border: 1px solid rgba(255, 85, 35, 0.7);
  }
  .onb-hero::before { display: none !important; }
  .onb-hero::after { display: none !important; }

  .onb-content {
    padding: 0 7.5%;
    padding-bottom: 4vh;
    justify-content: flex-start;
  }

  .onb-copy {
    margin-top: 4vh;
    text-align: center;
  }
  .onb-title {
    font-size: clamp(32px, 5vw, 42px);
    font-weight: 800;
    justify-content: center;
    gap: 8px;
  }
  .onb-flame {
    width: clamp(28px, 4vw, 36px);
    height: clamp(28px, 4vw, 36px);
  }
  .onb-subtitle {
    font-size: clamp(16px, 2.5vw, 20px);
    text-align: center;
    color: #9da0a6;
    margin-top: 8px;
  }

  .onb-features {
    margin-top: 4vh;
    gap: 16px;
    width: 90%;
    margin-left: auto;
    margin-right: auto;
  }
  .onb-feature-card {
    padding: 16px 22px;
    height: 80px;
    border-radius: 16px;
    background: rgba(0,0,0,0.4);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 85, 35, 0.2);
    box-shadow: 0 4px 15px rgba(0,0,0,0.5);
  }
  .onb-feature-icon {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background: transparent;
    border: 1px solid rgba(227, 27, 43, 0.4);
    color: #E31B2B;
    box-shadow: none;
  }
  .onb-feature-title { font-size: 17px; font-weight: 700; color: #fff; }
  .onb-feature-desc { font-size: 14px; color: #7D8089; }
  .onb-feature-arrow { color: #FFC83D; font-size: 24px; }

  .onb-bottom {
    margin-top: auto;
    padding-top: 20px;
    width: 90%;
    margin-left: auto;
    margin-right: auto;
  }
  .onb-cta {
    padding: 20px;
    height: 64px;
    font-size: 20px;
    font-weight: 700;
    border-radius: 16px;
    background: linear-gradient(90deg, #e91616 0%, #ff3828 100%);
    box-shadow: 0 0 20px rgba(227, 27, 43, 0.3);
  }
  .onb-cta::after { display: none; }
  .onb-footnote { font-size: 14px; color: #5a5a5a; margin-top: 14px; }
}

/* --- Large tablets portrait (>=900px) ---------------------------- */

@media (min-width: 900px) and (orientation: portrait) {
  .onb-bg-img { background-image: url('/fondos/tablet-onboarding-fondo.png'); background-position: center; background-size: cover; }
  .onb-bg-img::after { display: none !important; }
  .onb-bg-atmosphere { display: none !important; }
  .onb-embers { display: none !important; }
  .onb-waves { display: none !important; }

  .onb-page { overflow: hidden; }
  .onb-scroll { width: 100vw; max-width: 100vw; height: 100dvh; overflow: hidden; }

  .onb-top { padding-top: 6vh; }
  .onb-logo { width: 220px; margin-bottom: 2vh; }

  .onb-hero {
    width: 80%;
    height: 380px;
    border-radius: 28px;
    box-shadow: 0 0 40px rgba(255, 85, 35, 0.15), 0 10px 50px rgba(0,0,0,0.8);
    border: 1px solid rgba(255, 85, 35, 0.7);
  }
  .onb-hero::before { display: none !important; }
  .onb-hero::after { display: none !important; }

  .onb-content { padding: 0 10%; padding-bottom: 5vh; }
  .onb-copy { margin-top: 5vh; text-align: center; }
  .onb-title { font-size: 48px; gap: 10px; justify-content: center; }
  .onb-flame { width: 40px; height: 40px; }
  .onb-subtitle { font-size: 22px; margin-top: 10px; text-align: center; color: #9da0a6; }

  .onb-features { margin-top: 5vh; gap: 20px; width: 85%; margin-left: auto; margin-right: auto; }
  .onb-feature-card { height: 90px; border-radius: 20px; background: rgba(0,0,0,0.4); backdrop-filter: blur(10px); border: 1px solid rgba(255, 85, 35, 0.2); }
  .onb-feature-icon { width: 50px; height: 50px; background: transparent; border: 1px solid rgba(227, 27, 43, 0.4); box-shadow: none; }
  .onb-feature-title { font-size: 20px; }
  .onb-feature-desc { font-size: 16px; color: #7D8089; }

  .onb-bottom { padding-top: 30px; width: 85%; margin-left: auto; margin-right: auto; }
  .onb-cta { height: 72px; font-size: 24px; border-radius: 18px; }
  .onb-cta::after { display: none; }
  .onb-footnote { font-size: 16px; margin-top: 20px; color: #5a5a5a; }
}

`;

content = content.substring(0, startIndex) + newTabletCSS + content.substring(endIndex);
fs.writeFileSync(file, content);
console.log('Done');
