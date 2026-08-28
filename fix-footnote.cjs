const fs = require('fs');
const file = 'src/pages/PublicOnboarding.css';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  '  .onb-footnote {\n    text-align: left !important;\n    font-size: 14px !important;\n    margin-top: 16px !important;\n    color: #6B6E76 !important;\n    margin-left: 4px !important;\n  }',
  '  .onb-footnote {\n    text-align: center !important;\n    font-size: 16px !important;\n    margin-top: 16px !important;\n    color: #9DA0A6 !important;\n    margin-left: 0 !important;\n  }'
);

fs.writeFileSync(file, content);
console.log('Fixed footnote');
