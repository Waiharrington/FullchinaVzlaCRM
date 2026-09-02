import fs from 'fs';

let tsx = fs.readFileSync('src/pages/Caja.tsx', 'utf8');

tsx = tsx.replace(/<Minus size=\{13\} \/>/g, '<Minus size={18} />');
tsx = tsx.replace(/<Plus size=\{13\} \/>/g, '<Plus size={18} />');
tsx = tsx.replace(/<Trash2 size=\{14\} \/>/g, '<Trash2 size={18} />');
// The customer add btn Plus
tsx = tsx.replace(/<Plus size=\{15\} \/>/g, '<Plus size={18} />');

fs.writeFileSync('src/pages/Caja.tsx', tsx);
