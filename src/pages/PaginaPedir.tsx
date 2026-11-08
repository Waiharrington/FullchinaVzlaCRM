import { useCallback, useEffect, useMemo, useState } from 'react'
import { Eye, EyeOff, Flame, Search, ShoppingBag, Sparkles, ArrowUp, ArrowDown, ExternalLink, Check } from 'lucide-react'
import { getAllSellableProducts, updateProduct, type SellableProduct } from '../lib/dataService'
import { formatUsd } from '../lib/money'
import { categoryLabel } from '../lib/menuCategories'
import { useLiveDataRefresh } from '../lib/liveDataRefresh'
import { PageSkeleton } from '../components/PageSkeleton'
import Toast from '../components/Toast'
import './PaginaPedir.css'

type Label = NonNullable<SellableProduct['menuLabel']>
const labels: Array<{ value: Label | null; name: string }> = [
  { value: null, name: 'Sin etiqueta' },
  { value: 'top_sales', name: 'Más vendido' },
  { value: 'new', name: 'Nuevo' },
  { value: 'recommended', name: 'Recomendado' },
  { value: 'free_drink', name: 'Refresco gratis' },
]

export function PaginaPedir() {
  const [products, setProducts] = useState<SellableProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState('')
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('Todas')
  const [filter, setFilter] = useState<'all' | 'visible' | 'carousel'>('all')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const load = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true)
      const all = await getAllSellableProducts()
      setProducts(all.filter(product => !product.isDelivery))
      setError('')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo cargar el catálogo')
    } finally { setLoading(false) }
  }, [])
  useEffect(() => { void load() }, [load])
  useLiveDataRefresh('pagina-pedir', () => { void load(true) })

  const categories = useMemo(() => ['Todas', ...Array.from(new Set(products.flatMap(product => product.categories))).sort((a, b) => categoryLabel(a).localeCompare(categoryLabel(b)))], [products])
  const filtered = useMemo(() => products.filter(product => {
    const matchesSearch = `${product.name} ${product.description ?? ''}`.toLocaleLowerCase('es').includes(search.toLocaleLowerCase('es'))
    const matchesCategory = category === 'Todas' || product.categories.includes(category)
    const matchesFilter = filter === 'all' || (filter === 'visible' ? product.publicVisible !== false : product.publicCarousel)
    return matchesSearch && matchesCategory && matchesFilter
  }), [products, search, category, filter])
  const visibleCount = products.filter(product => product.isActive && product.publicVisible !== false).length
  const carouselCount = products.filter(product => product.isActive && product.publicVisible !== false && product.publicCarousel).length

  const save = async (product: SellableProduct, changes: Partial<SellableProduct>, message: string) => {
    setSavingId(product.id)
    setError('')
    try {
      await updateProduct(product.id, changes)
      setProducts(current => current.map(row => row.id === product.id ? { ...row, ...changes } : row))
      setNotice(message)
      window.setTimeout(() => setNotice(''), 2400)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo guardar el cambio')
    } finally { setSavingId('') }
  }

  const moveCarousel = async (product: SellableProduct, direction: -1 | 1) => {
    const ordered = products.filter(item => item.isActive && item.publicVisible !== false && item.publicCarousel)
      .sort((a, b) => (a.publicCarouselOrder ?? 0) - (b.publicCarouselOrder ?? 0))
    const index = ordered.findIndex(item => item.id === product.id)
    const next = ordered[index + direction]
    if (!next) return
    setSavingId(product.id)
    setError('')
    try {
      await Promise.all([
        updateProduct(product.id, { publicCarouselOrder: next.publicCarouselOrder ?? index + direction }),
        updateProduct(next.id, { publicCarouselOrder: product.publicCarouselOrder ?? index }),
      ])
      await load(true)
      setNotice('Orden del carrusel actualizado')
      window.setTimeout(() => setNotice(''), 2400)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo cambiar el orden') }
    finally { setSavingId('') }
  }

  if (loading) return <PageSkeleton cards={4} rows={7} hasTable={false} />
  return <main className="pedir-admin page animate-fade-in">
    <header className="pedir-admin-head">
      <div><span className="pedir-admin-kicker">TIENDA PARA CLIENTES</span><h1 className="page-title"><ShoppingBag size={22} /> Página de pedir</h1><p className="page-subtitle">Controla qué productos aparecen, sus etiquetas y lo que se recomienda al entrar.</p></div>
      <a className="pedir-preview-link" href="/pedir" target="_blank" rel="noreferrer"><ExternalLink size={16} /> Ver página pública</a>
    </header>
    <div className="pedir-summary">
      <article><Eye size={19} /><span>Productos visibles<strong>{visibleCount}</strong></span></article>
      <article><Flame size={19} /><span>En el carrusel<strong>{carouselCount} / 8</strong></span></article>
      <article><Sparkles size={19} /><span>Con etiqueta<strong>{products.filter(product => product.menuLabel).length}</strong></span></article>
    </div>
    <section className="pedir-controls">
      <label className="pedir-search"><Search size={17} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar un producto" /></label>
      <select aria-label="Filtrar por categoría" value={category} onChange={event => setCategory(event.target.value)}>{categories.map(item => <option value={item} key={item}>{item === 'Todas' ? item : categoryLabel(item)}</option>)}</select>
      <div className="pedir-filter-tabs">{([['all', 'Todos'], ['visible', 'En la página'], ['carousel', 'En el carrusel']] as const).map(([value, label]) => <button key={value} type="button" className={filter === value ? 'active' : ''} onClick={() => setFilter(value)}>{label}</button>)}</div>
    </section>
    {error && <div className="pedir-error" role="alert">{error}<button type="button" onClick={() => void load()}>Reintentar</button></div>}
    <section className="pedir-product-list" aria-label="Productos de la página pública">
      {filtered.map(product => {
        const visible = product.publicVisible !== false
        const inCarousel = Boolean(product.publicCarousel)
        const carouselRows = products.filter(item => item.isActive && item.publicVisible !== false && item.publicCarousel).sort((a,b)=>(a.publicCarouselOrder??0)-(b.publicCarouselOrder??0))
        const carouselIndex = carouselRows.findIndex(item => item.id === product.id)
        const busy = savingId === product.id
        return <article className={`pedir-product-row${!product.isActive ? ' is-inactive' : ''}`} key={product.id}>
          <div className="pedir-product-image">{product.imageUrl ? <img src={product.imageUrl} alt="" loading="lazy" /> : <span>{product.emoji || '🥡'}</span>}</div>
          <div className="pedir-product-main"><strong>{product.name}</strong><small>{product.categories.map(item => categoryLabel(item)).join(' · ')} · {formatUsd(product.salePrice)}</small>
            <div className="pedir-product-label"><label htmlFor={`label-${product.id}`}>Etiqueta</label><select id={`label-${product.id}`} value={product.menuLabel ?? ''} disabled={busy || !product.isActive || !visible} onChange={event => { const value = event.target.value as Label | ''; void save(product, { menuLabel: value || null }, 'Etiqueta guardada') }}>{labels.map(item => <option key={item.name} value={item.value ?? ''}>{item.name}</option>)}</select></div>
          </div>
          <div className="pedir-product-actions">
            <button type="button" className={`pedir-toggle${visible ? ' selected' : ''}`} disabled={busy || !product.isActive} onClick={() => void save(product, { publicVisible: !visible, ...(visible ? { publicCarousel: false } : {}) }, visible ? 'Producto oculto de la página' : 'Producto visible en la página')}><span>{visible ? <Eye size={16} /> : <EyeOff size={16} />}{visible ? 'Visible' : 'Oculto'}</span><i /></button>
            <button type="button" className={`pedir-toggle${inCarousel ? ' selected' : ''}`} disabled={busy || !product.isActive || !visible || (!inCarousel && carouselCount >= 8)} onClick={() => void save(product, { publicCarousel: !inCarousel, publicCarouselOrder: inCarousel ? product.publicCarouselOrder : Math.max(0, ...products.map(item => item.publicCarouselOrder ?? 0)) + 1 }, inCarousel ? 'Quitado del carrusel' : 'Añadido al carrusel')}><span><Flame size={16} />{inCarousel ? `Carrusel · ${carouselIndex + 1}` : 'Añadir al carrusel'}</span><i /></button>
            {inCarousel && <div className="pedir-order"><button type="button" aria-label={`Subir ${product.name}`} disabled={busy || carouselIndex <= 0} onClick={() => void moveCarousel(product,-1)}><ArrowUp size={15}/></button><button type="button" aria-label={`Bajar ${product.name}`} disabled={busy || carouselIndex < 0 || carouselIndex >= carouselRows.length-1} onClick={() => void moveCarousel(product,1)}><ArrowDown size={15}/></button></div>}
            {!product.isActive && <small className="pedir-inactive">Inactivo en Menú</small>}
          </div>
          {busy && <span className="pedir-saving"><Check size={15} /> Guardando…</span>}
        </article>
      })}
      {filtered.length === 0 && <div className="pedir-empty">No hay productos que coincidan con estos filtros.</div>}
    </section>
    {notice && <Toast type="success" message={notice} onClose={() => setNotice('')} />}
  </main>
}
