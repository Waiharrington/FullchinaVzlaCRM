const fs = require('fs');
let c = fs.readFileSync('index.html', 'utf8');

c = c.replace('</style>', '  @media (min-width: 1025px), (orientation: landscape) {\n    .fc-loading {\n      background: #0A0B0E url(\'/fondos/compu-onboarding-fondo.png\') left center/cover no-repeat;\n    }\n  }\n</style>');

fs.writeFileSync('index.html', c);
console.log('Done');
