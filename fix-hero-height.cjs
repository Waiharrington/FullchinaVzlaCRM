const fs = require('fs');
const file = 'src/pages/PublicOnboarding.css';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/height: clamp\(220px, 30vh, 300px\);/g, 'aspect-ratio: 2.35 / 1; height: auto;');
content = content.replace(/height: 380px;/g, 'aspect-ratio: 2.35 / 1; height: auto;');

fs.writeFileSync(file, content);
console.log('Done');
