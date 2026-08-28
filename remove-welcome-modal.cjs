const fs = require('fs');
let lines = fs.readFileSync('src/pages/PublicMenu.tsx', 'utf8').split(/\r?\n/);

lines = lines.filter(line => !line.includes('welcomeOpen'));

fs.writeFileSync('src/pages/PublicMenu.tsx', lines.join('\n'));
console.log('Filtered out welcomeOpen lines completely');
