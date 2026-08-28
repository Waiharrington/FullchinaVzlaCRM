const fs = require('fs');
let content = fs.readFileSync('index.html', 'utf8');

const oldRegex = /@media \(max-height: 500px\) and \(orientation: landscape\) \{[\s\S]*?\}[\s\S]*?<\/style>/;
const replacement = `@media (max-height: 500px) and (orientation: landscape) {
    .fc-loading { padding-top: 0; justify-content: center; }
    .fc-loading-logo { width: 140px; }
    .fc-sticks { transform: scale(0.7); margin-top: 0; }
    .fc-plate { transform: scale(0.7); margin-top: -25px; }
    .fc-loading-text { margin-top: 15px; font-size: 15px; }
  }
</style>`;

content = content.replace(oldRegex, replacement);

fs.writeFileSync('index.html', content);
console.log('Fixed splash screen vertical alignment');
