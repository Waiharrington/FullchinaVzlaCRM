const fs = require('fs');
const file = 'src/pages/PublicOnboarding.css';
let content = fs.readFileSync(file, 'utf8');

// For 600-900px
content = content.replace(
  /\.onb-hero \{\s*width: 85%;\s*aspect-ratio: 2\.5 \/ 1;\s*height: auto;\s*border-radius: 24px;/g,
  '.onb-hero { width: 100%; aspect-ratio: 2.5 / 1; height: auto; border-radius: 0;'
);

// For >= 900px
content = content.replace(
  /\.onb-hero \{\s*width: 80%;\s*aspect-ratio: 2\.5 \/ 1;\s*height: auto;\s*border-radius: 28px;/g,
  '.onb-hero { width: 100%; aspect-ratio: 2.8 / 1; height: auto; border-radius: 0;'
);

fs.writeFileSync(file, content);
console.log('Done full width');
