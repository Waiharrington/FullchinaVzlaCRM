const fs = require('fs');
let content = fs.readFileSync('index.html', 'utf8');

// 1. Replace the fc-loading CSS block and the old media query
// First, find the start and end of the old CSS
const oldCssRegex = /\.fc-loading\s*\{[\s\S]*?padding-top:\s*25vh;\s*font-family:\s*'Outfit',\s*sans-serif;\s*\}/;
let newCss = `.fc-loading {
          position: fixed; inset: 0; z-index: 99999;
          background: #0A0B0E;
          display: flex; flex-direction: column; align-items: center; justify-content: flex-start;
          padding-top: 25vh; font-family: 'Outfit', sans-serif;
          overflow: hidden;
        }
        .fc-loading-bg {
          position: absolute; inset: -10%; z-index: 0;
          background: url('/fondos/fondo-pagina-carga.png') center/cover no-repeat;
          animation: fcKenBurns 20s ease-out forwards, fcFocus 2.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          will-change: transform, filter;
        }
        .fc-loading-vignette {
          position: absolute; inset: 0; z-index: 1;
          background: radial-gradient(circle at center, transparent 20%, rgba(10,11,14,0.95) 100%);
          animation: fcVignetteBreathe 6s ease-in-out infinite alternate;
          pointer-events: none;
        }
        .fc-loading-logo, .fc-sticks, .fc-plate, .fc-loading-text {
          z-index: 2; position: relative;
        }
        @keyframes fcKenBurns {
          0% { transform: scale(1); }
          100% { transform: scale(1.15) translate(-1%, -1%); }
        }
        @keyframes fcFocus {
          0% { filter: blur(15px) brightness(0.2); }
          100% { filter: blur(0px) brightness(1); }
        }
        @keyframes fcVignetteBreathe {
          0% { opacity: 0.6; }
          100% { opacity: 1; }
        }`;
content = content.replace(oldCssRegex, newCss);

// Remove the old media query at the bottom of the style tag
content = content.replace(/@media\s*\(min-width: 1025px\),\s*\(orientation: landscape\)\s*\{[\s\S]*?\}\n/, '');

// Re-add the updated media query right before </style>
content = content.replace('</style>', '  @media (min-width: 1025px), (orientation: landscape) {\n    .fc-loading-bg { background: url(\'/fondos/compu-onboarding-fondo.png\') left center/cover no-repeat; }\n  }\n</style>');

// 2. Replace the DOM
const oldDomRegex = /<div id="fc-splash" class="fc-loading">[\s\S]*?<img src="\/splash-logo\.png"/;
const newDom = `<div id="fc-splash" class="fc-loading">
        <div class="fc-loading-bg"></div>
        <div class="fc-loading-vignette"></div>
        <img src="/splash-logo.png"`;
content = content.replace(oldDomRegex, newDom);

fs.writeFileSync('index.html', content);
console.log('Fixed splash screen cinematic effects');
