const fs = require('fs')

let content = fs.readFileSync('src/pages/PublicMenu.tsx', 'utf-8')

// 1. Add <> and move </main>
content = content.replace('return (', 'return (\n    <>')
content = content.replace('</main>\n  )\n}', '    </main>\n  )\n}')

// 2. Replace the old modal with the new one OUTSIDE of main
const oldModalStr = `{selectedGroup && <div className="public-modal-backdrop" onClick={() => setSelectedGroup(null)}><section className="public-variant-modal" onClick={event => event.stopPropagation()}><button className="public-close" onClick={() => setSelectedGroup(null)}><X /></button><small>ELIGE TU PRESENTACI"N</small><h2>{selectedGroup.name}</h2>{selectedGroup.variants.map(({ product, label }) => <button className="public-variant" key={product.id} onClick={() => addProduct(product)}><span>{product.emoji}<span><strong>{label}</strong><small>{product.description}</small></span></span><b>{money(product.price)} <Plus size={18} /></b></button>)}</section></div>}`

// Wait, the emoji encoding might not match perfectly if it's utf-8. I'll use regex.
content = content.replace(/\{selectedGroup && <div className="public-modal-backdrop".+?<\/section><\/div>\}/, '')

// Insert new modal and close the fragment at the very end of the return statement
content = content.replace('</main>\n  )\n}', `</main>

      {selectedGroup && <ProductDetailModal 
        group={selectedGroup} 
        onClose={() => setSelectedGroup(null)} 
        onAdd={(product, qty) => {
          setCart(current => {
            const existing = current.find(item => item.productId === product.id)
            return existing
              ? current.map(item => item.productId === product.id ? { ...item, quantity: item.quantity + qty } : item)
              : [...current, { productId: product.id, productName: product.name, price: product.price, quantity: qty }]
          })
          setSelectedGroup(null)
          setCartOpen(true)
        }} 
      />}
    </>
  )
}

function ProductDetailModal({ group, onClose, onAdd }: { group: MenuProductGroup, onClose: () => void, onAdd: (product: Product, quantity: number, instructions: string) => void }) {
  const [selectedProduct, setSelectedProduct] = React.useState<Product>(group.variants[0].product);
  const [quantity, setQuantity] = React.useState(1);
  const [instructions, setInstructions] = React.useState('');

  const handleAdd = () => {
    onAdd(selectedProduct, quantity, instructions);
  };

  return (
    <>
      <div className="public-modal-backdrop" onClick={onClose} style={{ zIndex: 999 }} />
      <div className="public-product-detail-modal" onClick={e => e.stopPropagation()} style={{ zIndex: 1000 }}>
        <div className="ppdm-image">
          <img src={selectedProduct.imageUrl || '/default-food.png'} alt={group.name} />
          <button className="ppdm-close" onClick={onClose}><X size={20} /></button>
          <div className="ppdm-image-gradient"></div>
        </div>
        <div className="ppdm-content">
          <h1>{group.name}</h1>
          <div className="ppdm-badge"><Star size={14} fill="#FFD666" color="#FFD666" /> Mǭs pedido</div>
          <p className="ppdm-desc">{selectedProduct.description || 'Arroz salteado con pollo, camarn, jamn, vegetales frescos y huevo.'}</p>
          <div className="ppdm-price">\${selectedProduct.price.toFixed(2)}</div>

          {group.isGrouped && (
            <div className="ppdm-section">
              <div className="ppdm-section-header">
                <h3>Elige tu opcin</h3>
                <span>Obligatorio</span>
              </div>
              <div className="ppdm-options">
                {group.variants.map(({ product, label }) => (
                  <label key={product.id} className="ppdm-option">
                    <div className="ppdm-radio">
                      <div className={\`ppdm-radio-inner \${selectedProduct.id === product.id ? 'active' : ''}\`}></div>
                    </div>
                    <span className="ppdm-option-name">{label}</span>
                    <span className="ppdm-option-price">\${product.price.toFixed(2)}</span>
                    <input 
                      type="radio" 
                      checked={selectedProduct.id === product.id}
                      onChange={() => setSelectedProduct(product)}
                      style={{ display: 'none' }}
                    />
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="ppdm-section">
            <div className="ppdm-section-header">
              <h3>Extras <small>(opcionales)</small></h3>
            </div>
            <div className="ppdm-options">
              <label className="ppdm-option">
                <input type="checkbox" className="ppdm-checkbox" />
                <span className="ppdm-option-name">Lumpia</span>
                <span className="ppdm-option-price">+$1.50</span>
              </label>
              <label className="ppdm-option">
                <input type="checkbox" className="ppdm-checkbox" defaultChecked />
                <span className="ppdm-option-name">Extra camarn</span>
                <span className="ppdm-option-price">+$2.00</span>
              </label>
            </div>
          </div>

          <div className="ppdm-section">
            <div className="ppdm-section-header">
              <h3>Indicaciones <small>(opcional)</small></h3>
            </div>
            <div className="ppdm-instructions">
              <input 
                type="text" 
                placeholder="Ej: Sin cebolln, por favor..." 
                value={instructions}
                onChange={e => setInstructions(e.target.value)}
                maxLength={60}
              />
              <small>{instructions.length}/60</small>
            </div>
          </div>
        </div>

        <div className="ppdm-footer">
          <div className="ppdm-qty">
            <button onClick={() => setQuantity(Math.max(1, quantity - 1))}><Minus size={18} /></button>
            <span>{quantity}</span>
            <button onClick={() => setQuantity(quantity + 1)}><Plus size={18} /></button>
          </div>
          <button className="ppdm-add-btn" onClick={handleAdd}>
            Agregar al carrito ? \${(selectedProduct.price * quantity).toFixed(2)}
          </button>
        </div>
      </div>
    </>
  )
}
`)

fs.writeFileSync('src/pages/PublicMenu.tsx', content)
