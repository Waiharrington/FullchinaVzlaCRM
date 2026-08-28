const fs = require('fs');
const file = 'src/pages/PublicOnboarding.css';
let content = fs.readFileSync(file, 'utf8');

// Remove the ::before gradient overlay
content = content.replace(/  \.onb-hero::before\s*\{[\s\S]*?\}\n/, '');

// Add the mask-image to .onb-hero
content = content.replace(/z-index: 1 !important;\n  \}/, 'z-index: 1 !important;\n    -webkit-mask-image: linear-gradient(to right, transparent 0%, black 25%) !important;\n    mask-image: linear-gradient(to right, transparent 0%, black 25%) !important;\n  }');

fs.writeFileSync(file, content);
console.log('Fixed blend mask');
