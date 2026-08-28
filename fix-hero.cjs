const fs = require('fs');
const file = 'src/pages/PublicOnboarding.css';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/.onb-hero\s*\{\s*position:\s*absolute\s*!important;/g, '.onb-hero {\n    position: fixed !important;');

fs.writeFileSync(file, content);
console.log('Fixed hero position');
