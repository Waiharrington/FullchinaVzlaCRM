const fs = require('fs');
const file = 'src/pages/PublicOnboarding.css';
let content = fs.readFileSync(file, 'utf8');

// Change left column width
content = content.replace(/width: 42vw !important;\n      max-width: 600px !important;/, 'width: 50vw !important;\n      max-width: 700px !important;');

// Change right column width and mask
content = content.replace(/width: 58vw !important;/, 'width: 50vw !important;');
content = content.replace(/-webkit-mask-image: linear-gradient\(to right, transparent 0%, black 25%\) !important;/g, '-webkit-mask-image: linear-gradient(to right, transparent 0%, black 35%) !important;');
content = content.replace(/mask-image: linear-gradient\(to right, transparent 0%, black 25%\) !important;/g, 'mask-image: linear-gradient(to right, transparent 0%, black 35%) !important;');

fs.writeFileSync(file, content);
console.log('Fixed split ratio');
