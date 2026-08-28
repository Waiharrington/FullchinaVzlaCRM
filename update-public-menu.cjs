const fs = require('fs');
let c = fs.readFileSync('src/pages/PublicMenu.tsx', 'utf8');

// Update imports
c = c.replace(
  /import \{ Check, ChevronRight, MapPin, Minus, Plus, Search, Navigation, ShoppingBag, Trash2, X \} from 'lucide-react'/,
  "import { Check, ChevronRight, MapPin, Minus, Plus, Search, Navigation, ShoppingBag, Trash2, X, Menu } from 'lucide-react'"
);

// Add emoji helper
c = c.replace(
  'const CATEGORY_LABELS',
  `const CATEGORY_EMOJIS: Record<string, string> = {
  arroz: '🍚', bebida: '🥤', extra: '🍟', plato: '🍛', wok: '🥘',
  pollo_camaron: '🍤', racion: '🥡', sin_categoria: '🍱',
}
function getCategoryEmoji(category: string) {
  if (category === 'Todos') return '🔥'
  return CATEGORY_EMOJIS[category] || '🍱'
}

const CATEGORY_LABELS`
);

// Extract the original return block
const returnIndex = c.indexOf('  return (\n    <main className="public-menu-page">');
const modalIndex = c.indexOf('      {selectedGroup && <div className="public-modal-backdrop"');

if (returnIndex !== -1 && modalIndex !== -1) {
  const originalTopReturn = c.substring(returnIndex, modalIndex);
  
  const newTopReturn = `  return (
    <main className="public-menu-page">
      {/* 1. App Bar */}
      <header className="public-top-bar">
        <div className="public-top-bar-left">
          <button className="public-top-bar-menu-btn"><Menu size={24} /></button>
        </div>
        <img src="/logo.png" alt="Full China" className="public-top-bar-logo" />
        <div className="public-top-bar-actions">
          <button onClick={() => document.getElementById('menu-search')?.focus()}><Search size={24} /></button>
          <button onClick={() => { setCartOpen(true); setStep('cart') }}>
            <ShoppingBag size={24} />
            {itemCount > 0 && <span className="public-cart-badge">{itemCount}</span>}
          </button>
        </div>
      </header>

      {/* 2. Hero Status */}
      <div className="public-hero-header">
        <h1>¿Qué provoca hoy? 🔥</h1>
        <span className="public-status">
          <i /> <strong>Abierto</strong> hasta las 10:00 PM
        </span>
      </div>

      {/* 3. Recommended Card */}
      <div className="public-recommended-card">
        <div className="public-recommended-copy">
          <small>RECOMENDADO 🔥</small>
          <h2>Full Kilo</h2>
          <p>Para cuando el hambre<br/>viene seria.</p>
          <span className="public-recommended-price">$14.00</span>
          <button className="public-recommended-btn">Ver producto</button>
        </div>
        <img src="/login-carousel/slide3.png" alt="Full Kilo" className="public-recommended-img" />
        <div className="public-recommended-dots-overlay">
          <span className="active"></span><span></span><span></span>
        </div>
      </div>

      {/* 4. Category Nav */}
      <nav className="public-categories-scroll">
        <button 
           className={\`public-cat-btn \${activeCategory === 'Todos' ? 'active' : ''}\`} 
           onClick={() => setActiveCategory('Todos')}>
           <span style={{ fontSize: '24px' }}>🔥</span>
           <span>Populares</span>
        </button>
        {categories.filter(c => c !== 'Todos').map(category => (
           <button 
             key={category} 
             className={\`public-cat-btn \${activeCategory === category ? 'active' : ''}\`}
             onClick={() => setActiveCategory(category)}
           >
             <span style={{ fontSize: '24px' }}>{getCategoryEmoji(category)}</span>
             <span>{CATEGORY_LABELS[category] || category}</span>
           </button>
        ))}
      </nav>

      {/* 5. Products Section */}
      <section className="public-content">
        <div className="public-list-header">
           <h2>{activeCategory === 'Todos' ? '🔥 Populares' : \`\${getCategoryEmoji(activeCategory)} \${CATEGORY_LABELS[activeCategory] || activeCategory}\`}</h2>
           <span>Ver todos <ChevronRight size={16} /></span>
        </div>

        <input id="menu-search" style={{ opacity: 0, position: 'absolute', pointerEvents: 'none' }} value={search} onChange={e => setSearch(e.target.value)} />

        {loading ? <div className="public-state">Cargando sabores...</div> : error && products.length === 0 ? <div className="public-state error">{error}</div> : (
          <div className="public-product-list">
            {groups.map(group => (
              <article className="public-prod-card" key={group.key} onClick={() => openGroup(group)}>
                <img src={group.variants[0]?.product.imageUrl || productImage(group.category)} className="public-prod-img" alt="" />
                <div className="public-prod-info">
                  <span className="public-prod-price">{group.isGrouped && group.minPrice !== group.maxPrice ? 'Desde ' : ''}{money(group.minPrice)}</span>
                  <h3 className="public-prod-title">{group.name}</h3>
                  <div className="public-prod-badge">⭐ Más pedido</div>
                  <p className="public-prod-desc">{group.isGrouped ? group.variants.map(item => item.label).join(' • ') : group.variants[0].product.description}</p>
                  <button className="public-prod-add" aria-label={\`Agregar \${group.name}\`} onClick={(e) => { e.stopPropagation(); openGroup(group) }}>
                    <Plus size={18} />
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* 6. Floating Cart */}
      {itemCount > 0 && !cartOpen && (
        <div className="public-cart-bar" onClick={() => { setCartOpen(true); setStep('cart') }}>
          <div className="public-cart-bar-info">
            <div className="public-cart-bar-icon">
              <ShoppingBag size={24} color="#FFF" />
              <span className="public-cart-bar-badge">{itemCount}</span>
            </div>
            <div className="public-cart-bar-text">
              <h4>{itemCount} producto{itemCount !== 1 ? 's' : ''}</h4>
              <p>Ver tu pedido</p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
             <span className="public-cart-bar-total">{money(total)}</span>
             <button className="public-cart-bar-btn">
                Ver pedido <ChevronRight size={18} />
             </button>
          </div>
        </div>
      )}

`;
  
  c = c.replace(originalTopReturn, newTopReturn);
  fs.writeFileSync('src/pages/PublicMenu.tsx', c);
  console.log('Successfully rewrote PublicMenu.tsx return block');
} else {
  console.log('Could not find indices to replace');
}
