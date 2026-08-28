const fs = require('fs');
const file = 'src/pages/PublicOnboarding.tsx';
let content = fs.readFileSync(file, 'utf8');

const newAdjustments = `const [adjustments, setAdjustments] = useState([
    { x: 50, y: 88, scale: 1.00 },
    { x: 50, y: 82, scale: 1.00 },
    { x: 50, y: 85, scale: 1.00 },
    { x: 50, y: 45, scale: 1.45 },
    { x: 50, y: 66, scale: 1.05 },
    { x: 50, y: 77, scale: 1.00 }
  ])`;

content = content.replace(/const \[adjustments, setAdjustments\] = useState\(\[\s*\{\s*x:\s*50,\s*y:\s*100,\s*scale:\s*1\s*\},\s*\{\s*x:\s*50,\s*y:\s*100,\s*scale:\s*1\s*\},\s*\{\s*x:\s*50,\s*y:\s*83,\s*scale:\s*1\s*\},\s*\{\s*x:\s*50,\s*y:\s*41,\s*scale:\s*1\.2\s*\},\s*\{\s*x:\s*50,\s*y:\s*74,\s*scale:\s*1\.05\s*\},\s*\{\s*x:\s*50,\s*y:\s*63,\s*scale:\s*1\s*\}\s*\]\)/, newAdjustments);

fs.writeFileSync(file, content);
console.log('Done updating state');
