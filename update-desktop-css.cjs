const fs = require('fs');
let c = fs.readFileSync('src/pages/PublicMenu.css', 'utf8');

c = c.replace(/\/\* Desktop layout constraints \*\/[\s\S]*$/, `/* Desktop & Tablet Layout */
@media (min-width: 768px) {
  .public-top-bar, .public-hero-header, .public-recommended-card, 
  .public-categories-scroll, .public-list-header, .public-product-list {
    max-width: 860px;
    margin-left: auto; margin-right: auto;
  }
  .public-product-list {
    display: grid;
    grid-template-columns: 1fr 1fr;
  }
  .public-cart-bar {
    max-width: 820px;
    margin-left: auto; margin-right: auto;
    left: 0; right: 0;
  }
  .public-categories-scroll::-webkit-scrollbar {
    display: block;
    height: 6px;
  }
  .public-categories-scroll::-webkit-scrollbar-thumb {
    background: rgba(255,255,255,0.2);
    border-radius: 4px;
  }
}`);

fs.writeFileSync('src/pages/PublicMenu.css', c);
console.log('Desktop layout CSS updated');
