const fs = require('fs');
const file = 'src/pages/PublicOnboarding.css';
let content = fs.readFileSync(file, 'utf8');

// Fix desktop title
content = content.replace(
  '  .onb-title {\n    font-size: clamp(38px, 4vw, 56px) !important;\n    justify-content: flex-start !important;\n    gap: 12px !important;\n    margin: 0 0 8px 0 !important;\n    line-height: 1.1 !important;\n  }',
  '  .onb-title {\n    font-size: clamp(24px, 3.5vw, 52px) !important;\n    white-space: nowrap !important;\n    flex-wrap: nowrap !important;\n    justify-content: flex-start !important;\n    gap: 12px !important;\n    margin: 0 0 8px 0 !important;\n    line-height: 1.1 !important;\n  }'
);

// Fix the one I accidentally broke
content = content.replace(
  '    .onb-title {\n      font-size: clamp(24px, 3.5vw, 56px) !important;\n      white-space: nowrap !important;\n      justify-content: flex-start !important;\n      gap: 12px !important;\n      margin: 0 0 8px 0 !important;\n      line-height: 1.1 !important;\n    }',
  '    .onb-title {\n      font-size: 34px;\n    }'
);

fs.writeFileSync(file, content);
console.log('Fixed title wrap strictly');
