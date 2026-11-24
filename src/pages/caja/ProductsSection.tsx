import { MoneyWithBcv } from '../../components/MoneyWithBcv'
import { StyledSelect } from '../../components/StyledSelect'
import { type MenuProductGroup } from '../../lib/menuGrouping'
import { categoryLabel } from '../../lib/menuCategories'
import { type Product } from '../../lib/dataService'
import { X, ShoppingCart, Search } from 'lucide-react'
import { formatProductTitle } from '../../lib/textFormat'
import { getProductImage } from '../caja/model'
import type { Dispatch, SetStateAction } from 'react'

export interface ProductsSectionProps {
  activeCategory: string
  setActiveCategory: Dispatch<SetStateAction<string>>
  categories: string[]
  searchTerm: string
  setSearchTerm: Dispatch<SetStateAction<string>>
  sortBy: "popular" | "price" | "name"
  setSortBy: Dispatch<SetStateAction<"popular" | "price" | "name">>
  salesRank: Map<string, number>
  loading: boolean
  products: Product[]
  productsError: string
  filteredProductGroups: MenuProductGroup[]
  topProductRanks: Map<string, number>
  selectMenuGroup: (group: MenuProductGroup) => void
}

export function ProductsSection({ activeCategory, setActiveCategory, categories, searchTerm, setSearchTerm, sortBy, setSortBy, salesRank, loading, products, productsError, filteredProductGroups, topProductRanks, selectMenuGroup }: ProductsSectionProps) {
  return (
    <div className="products-section">
          {/* Hero Wok Flame Banner */}
          <div className="caja-hero-banner">
            <div className="hero-banner-left">
              <div>
                <h1 className="page-title"><ShoppingCart size={22} className="page-title-icon" /> Nueva venta</h1>
                <p className="hero-subtitle">Crea pedidos, cobra y envía a cocina.</p>
              </div>
            </div>
          </div>

          {/* Category Tabs */}
          <div className="category-tabs">
            <button
              className={`category-tab ${activeCategory === 'all' ? 'active' : ''}`}
              onClick={() => setActiveCategory('all')}
            >
              Todos
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                className={`category-tab ${activeCategory === cat ? 'active' : ''}`}
                onClick={() => setActiveCategory(cat)}
              >
                {categoryLabel(cat)}
              </button>
            ))}
          </div>

          {/* Toolbar */}
          <div className="products-toolbar">
            <div className="search-box">
              <span className="search-icon"><Search size={16} /></span>
              <input
                type="text"
                placeholder="Buscar en el menú..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input-caja"
              />
              {searchTerm && (
                <button type="button" className="search-clear-btn" onClick={() => setSearchTerm('')} aria-label="Borrar búsqueda">
                  <X size={13} />
                </button>
              )}
            </div>
            <StyledSelect
              className="sort-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            >
              {salesRank.size > 0 && <option value="popular">Más vendidos</option>}
              <option value="price">Precio</option>
              <option value="name">Nombre</option>
            </StyledSelect>
          </div>

          {/* Products Grid */}
          <div className="products-container grid">
            {loading && products.length === 0 ? (
              Array.from({ length: 8 }, (_, index) => <div className="product-card product-card-skeleton" key={`product-skeleton-${index}`} aria-hidden><div className="product-skeleton-image" /><div className="product-skeleton-line wide" /><div className="product-skeleton-line" /></div>)
            ) : productsError && products.length === 0 ? (
              <div className="empty-message products-load-error"><strong>{productsError}</strong><button type="button" onClick={() => window.location.reload()}>Reintentar</button></div>
            ) : filteredProductGroups.length === 0 ? (
              <p className="empty-message">No hay productos en esta categoría</p>
            ) : (
              filteredProductGroups.map((group, index) => {
                const product = group.variants[0].product
                const imgUrl = getProductImage(product)
                const rank = topProductRanks.get(group.key)
                return (
                  <div key={group.key} className={`product-card ${group.isGrouped ? 'product-family-card' : ''}`} onClick={() => selectMenuGroup(group)}>
                    <div className="product-image-area">
                      <img
                        className="product-card-image"
                        src={imgUrl}
                        alt=""
                        loading={index < 4 ? 'eager' : 'lazy'}
                        fetchPriority={index < 4 ? 'high' : 'auto'}
                        decoding="async"
                      />
                      {rank && sortBy === 'popular' && <span className="product-badge badge-popular"><strong>#{rank}</strong> Más vendido</span>}
                      {group.isGrouped && <span className="product-badge badge-variants">{group.variants.length} opciones</span>}
                      <button
                        className="product-quick-add-btn"
                        onClick={(e) => { e.stopPropagation(); selectMenuGroup(group) }}
                        title={group.isGrouped ? 'Elegir presentación' : 'Agregar al pedido'}
                      >
                        {group.isGrouped ? '›' : '+'}
                      </button>
                    </div>
                    <div className="product-card-body">
                      <h3 className="product-card-title">{formatProductTitle(group.name)}</h3>
                      {group.isGrouped && (
                        <span className="product-variant-preview">
                          {group.variants.map(variant => variant.label).join(' · ')}
                        </span>
                      )}
                      <div className="product-card-meta">
                        <div className="product-family-price">
                          {group.isGrouped && group.minPrice !== group.maxPrice && <small>Desde</small>}
                          <MoneyWithBcv usd={group.minPrice} className="product-card-price" align="start" compact />
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
  )
}
