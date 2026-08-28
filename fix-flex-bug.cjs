const fs = require('fs');
const file = 'src/pages/PublicOnboarding.css';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/display:\s*flex;\s*align-items:\s*center;\s*\/\*\s*Make sure these don't trap/g, '/* Make sure these don\\'t trap');
content = content.replace(/\.onb-page\s*\{\s*overflow:\s*hidden;\s*position:\s*relative\s*!important;\s*display:\s*flex;\s*align-items:\s*center;\s*\}/, '.onb-page {\n    overflow: hidden;\n    position: relative !important;\n  }');

fs.writeFileSync(file, content);
console.log('Fixed onb-page flex bug');
