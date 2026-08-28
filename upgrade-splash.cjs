const fs = require('fs');
const file = 'index.html';
let content = fs.readFileSync(file, 'utf8');

const newStyles = `<style>
      .fc-loading {
        position: fixed; inset: 0; z-index: 99999;
        background: #0A0B0E url('/fondos/fondo-pagina-carga.png') center/cover no-repeat;
        display: flex; flex-direction: column; align-items: center; justify-content: flex-start;
        padding-top: 25vh; font-family: 'Outfit', sans-serif;
      }
      .fc-loading-logo {
        width: clamp(200px, 48vw, 320px); height: auto;
        opacity: 0; transform: scale(0.6) translateY(20px);
        animation: fcLogoIn 1s cubic-bezier(0.16, 1, 0.3, 1) 0.1s forwards, fcLogoFloat 4s ease-in-out 1.1s infinite;
        filter: drop-shadow(0 8px 40px rgba(227,27,43,0.8));
      }
      @keyframes fcLogoIn { to { opacity: 1; transform: scale(1) translateY(0); } }
      @keyframes fcLogoFloat { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
      
      .fc-sticks {
        position: relative; width: 100px; height: 120px; margin-top: 8vh;
      }
      .fc-stick {
        position: absolute; width: 6px; height: 90px; border-radius: 4px;
        top: -150px; opacity: 0; box-shadow: 2px 2px 5px rgba(0,0,0,0.5);
      }
      .fc-stick-l {
        left: 28px; background: linear-gradient(180deg, #D69762, #9E5630);
        transform: rotate(-20deg);
        animation: fcStickL 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) 0.5s forwards;
      }
      .fc-stick-r {
        right: 28px; background: linear-gradient(180deg, #D69762, #9E5630);
        transform: rotate(20deg);
        animation: fcStickR 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) 0.65s forwards;
      }
      @keyframes fcStickL { 0% { top: -150px; opacity: 0; transform: rotate(-30deg); } 100% { top: 10px; opacity: 1; transform: rotate(-12deg); } }
      @keyframes fcStickR { 0% { top: -150px; opacity: 0; transform: rotate(30deg); } 100% { top: 10px; opacity: 1; transform: rotate(12deg); } }
      
      .fc-plate {
        position: relative;
        width: 120px; height: 28px;
        border: 4px solid #FF5528; border-top: none; border-radius: 0 0 60px 60px;
        margin-top: -15px; opacity: 0;
        box-shadow: 0 10px 20px rgba(255, 85, 40, 0.5), inset 0 5px 15px rgba(255, 85, 40, 0.4);
        animation: fcPlateIn 0.6s ease 1s forwards, fcPlatePulse 2s ease-in-out 1.6s infinite;
      }
      @keyframes fcPlateIn { from { transform: scale(0.8); opacity: 0; } to { transform: scale(1); opacity: 1; } }
      @keyframes fcPlatePulse { 0%, 100% { box-shadow: 0 10px 20px rgba(255, 85, 40, 0.5), inset 0 5px 15px rgba(255, 85, 40, 0.4); border-color: #FF5528; } 50% { box-shadow: 0 10px 30px rgba(255, 85, 40, 0.8), inset 0 5px 25px rgba(255, 85, 40, 0.6); border-color: #FF7740; } }
      
      .fc-loading-text {
        margin-top: 40px; font-size: 18px; font-weight: 700; letter-spacing: 0.05em;
        opacity: 0; 
        background: linear-gradient(90deg, #FFFFFF, #FFD666, #FFFFFF);
        background-size: 200% auto;
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        animation: fcTextIn 0.5s ease 1.3s forwards, fcTextShimmer 2s linear 1.8s infinite;
      }
      @keyframes fcTextIn { from { transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      @keyframes fcTextShimmer { to { background-position: 200% center; } }
    </style>`;

content = content.replace(/<style>[\s\S]*?<\/style>/, newStyles);
fs.writeFileSync(file, content);
console.log('Done replacing index.html styles');
