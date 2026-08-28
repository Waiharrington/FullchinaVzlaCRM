const fs = require('fs');
const file = 'src/pages/PublicOnboarding.css';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  /\.onb-hero \{ width: 100%; aspect-ratio: 2\.5 \/ 1; height: auto; border-radius: 0;/g,
  '.onb-hero { width: 92%; max-width: none; aspect-ratio: 2.2 / 1; height: auto; border-radius: 24px;'
);

content = content.replace(
  /\.onb-hero \{ width: 100%; aspect-ratio: 2\.8 \/ 1; height: auto; border-radius: 0;/g,
  '.onb-hero { width: 90%; max-width: none; aspect-ratio: 2.4 / 1; height: auto; border-radius: 28px;'
);

fs.writeFileSync(file, content);
console.log('Done fixes');
