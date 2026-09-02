import fs from 'fs';

let css = fs.readFileSync('src/pages/Caja.css', 'utf8');

// 1. Agrandar qty-btn-sm
css = css.replace(/\.qty-btn-sm \{\s*background: transparent;\s*border: none;\s*color: #aeaeb2;\s*width: 22px;\s*height: 22px;/, 
'.qty-btn-sm { background: transparent; border: none; color: #aeaeb2; width: 38px; height: 38px;');

css = css.replace(/\.qty-btn-sm \{ width: 24px; height: 24px; border-radius: 6px; display: grid; place-items: center; \}/g,
'.qty-btn-sm { width: 38px; height: 38px; border-radius: 8px; display: grid; place-items: center; }');

// 2. Agrandar cart-item-remove
css = css.replace(/\.cart-item-remove \{\s*background: transparent;\s*border: none;\s*color: #6b7280;\s*font-size: 14px;/,
'.cart-item-remove { background: transparent; border: none; color: #6b7280; font-size: 18px;');

css = css.replace(/\.cart-item-remove \{ width: 28px; height: 28px; border-radius: 7px; display: grid; place-items: center; \}/g,
'.cart-item-remove { width: 40px; height: 40px; border-radius: 8px; display: grid; place-items: center; }');

// 3. Agrandar customer-add-btn
css = css.replace(/\.customer-add-btn \{\s*background: #E31B2B;\s*color: #fff;\s*border: none;\s*width: 24px;\s*height: 24px;/,
'.customer-add-btn { background: #E31B2B; color: #fff; border: none; width: 36px; height: 36px;');

css = css.replace(/\.customer-add-btn \{ width: 28px; height: 28px; border-radius: 8px; display: grid; place-items: center;/g,
'.customer-add-btn { width: 38px; height: 38px; border-radius: 8px; display: grid; place-items: center;');

// Make the qty display larger as well to match
css = css.replace(/\.qty-display \{\s*font-size: 12px;\s*font-weight: 700;\s*min-width: 14px;/,
'.qty-display { font-size: 14px; font-weight: 700; min-width: 20px;');

fs.writeFileSync('src/pages/Caja.css', css);
