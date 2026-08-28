const fs = require('fs');
const file = 'src/pages/PublicOnboarding.css';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/  \.onb-content\s*\{\s*display:\s*flex\s*!important;\s*flex-direction:\s*column\s*!important;\s*padding:\s*0\s*!important;\s*margin:\s*0\s*!important;\s*\}/, '  .onb-content {\n    display: flex !important;\n    flex-direction: column !important;\n    padding: 0 !important;\n    margin: 0 !important;\n    flex: none !important;\n    justify-content: flex-start !important;\n  }');

fs.writeFileSync(file, content);
console.log('Fixed onb-content flex');
