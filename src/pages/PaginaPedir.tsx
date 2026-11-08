import { useCallback, useEffect, useMemo, useState } from 'react'
import { Eye, EyeOff, Flame, Search, ShoppingBag, Sparkles, ArrowUp, ArrowDown, ExternalLink, Check } from 'lucide-react'
import { getAllSellableProducts, updateProduct, type SellableProduct } from '../lib/dataService'
import { formatUsd } from '../lib/money'
import { categoryLabel } from '../lib/menuCategories'
import { useLiveDataRefresh } from '../lib/liveDataRefresh'
import { DEFAULT_PUBLIC_ORDER_PAGE_SETTINGS, getPublicOrderPageSettings, PUBLIC_ORDER_BANNER_OPTIONS, updatePublicOrderCarouselSelection, updatePublicOrderPageSettings, type PublicOrderPageSettings } from '../lib/publicOrderPageSettings'
import { getAutomaticPublicCarouselProductIds } from '../lib/publicOrderCarousel'
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
  const [pageSettings, setPageSettings] = useState<PublicOrderPageSettings>(DEFAULT_PUBLIC_ORDER_PAGE_SETTINGS)
  const [settingsSaving, setSettingsSaving] = useState(false)
  const [settingsLoading, setSettingsLoading] = useState(true)
  const [settingsError, setSettingsError] = useState('')

  const loadPageSettings = useCallback(async () => {
    try { setPageSettings(await getPublicOrderPageSettings()); setSettingsError('') }
    catch (cause) { setSettingsError(cause instanceof Error ? cause.message : 'No se pudo cargar la portada') }
    finally { setSettingsLoading(false) }
  }, [])

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
  useEffect(() => { void loadPageSettings() }, [loadPageSettings])
  useLiveDataRefresh('pagina-pedir', () => { void load(true); void loadPageSettings() })

  const carouselProductIds = useMemo(() => {
    const hasSavedProducts = products.some(product => product.publicCarousel && product.isActive && product.publicVisible !== false && !product.isDelivery && product.salePrice >= 0.5)
    if (pageSettings.carouselSelectionConfigured || hasSavedProducts) {
      return products.filter(product => product.publicCarousel && product.isActive && product.publicVisible !== false && !product.isDelivery && product.salePrice >= 0.5).sort((a, b) => (a.publicCarouselOrder ?? 0) - (b.publicCarouselOrder ?? 0)).map(product => product.id)
    }
    return getAutomaticPublicCarouselProductIds(products)
  }, [products, pageSettings.carouselSelectionConfigured])
  const carouselProductSet = useMemo(() => new Set(carouselProductIds), [carouselProductIds])
  const carouselProducts = useMemo(() => carouselProductIds.flatMap(id => {
    const product = products.find(row => row.id === id)
    return product ? [product] : []
  }), [products, carouselProductIds])

  const categories = useMemo(() => ['Todas', ...Array.from(new Set(products.flatMap(product => product.categories))).sort((a, b) => categoryLabel(a).localeCompare(categoryLabel(b)))], [products])
  const filtered = useMemo(() => products.filter(product => {
    const matchesSearch = `${product.name} ${product.description ?? ''}`.toLocaleLowerCase('es').includes(search.toLocaleLowerCase('es'))
    const matchesCategory = category === 'Todas' || product.categories.includes(category)
    const matchesFilter = filter === 'all' || (filter === 'visible' ? product.publicVisible !== false : carouselProductSet.has(product.id))
    return matchesSearch && matchesCategory && matchesFilter
  }), [products, search, category, filter, carouselProductSet])
  const visibleCount = products.filter(product => product.isActive && product.publicVisible !== false).length
  const carouselCount = carouselProductIds.length

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

  const saveCarouselSelection = async (product: SellableProduct, nextIds: string[]) => {
    setSavingId(product.id)
    setError('')
    try {
      await updatePublicOrderCarouselSelection(nextIds)
      setProducts(current => current.map(row => {
        const order = nextIds.indexOf(row.id)
        return { ...row, publicCarousel: order >= 0, publicCarouselOrder: order >= 0 ? order + 1 : 0 }
      }))
      setPageSettings(current => ({ ...current, carouselSelectionConfigured: true }))
      setNotice('Carrusel actualizado')
      window.setTimeout(() => setNotice(''), 2400)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo guardar el carrusel') }
    finally { setSavingId('') }
  }

  const toggleCarouselProduct = (product: SellableProduct) => {
    const nextIds = carouselProductSet.has(product.id)
      ? carouselProductIds.filter(id => id !== product.id)
      : [...carouselProductIds, product.id]
    void saveCarouselSelection(product, nextIds)
  }

  const moveCarousel = (product: SellableProduct, direction: -1 | 1) => {
    const index = carouselProductIds.indexOf(product.id)
    const nextIndex = index + direction
    if (index < 0 || nextIndex < 0 || nextIndex >= carouselProductIds.length) return
    const nextIds = [...carouselProductIds]
    ;[nextIds[index], nextIds[nextIndex]] = [nextIds[nextIndex], nextIds[index]]
    void saveCarouselSelection(product, nextIds)
  }

  const savePageSettings = async () => {
    setSettingsSaving(true)
    setSettingsError('')
    try {
      await updatePublicOrderPageSettings(pageSettings)
      setNotice('Portada guardada. Los cambios ya están disponibles en la página pública.')
      window.setTimeout(() => setNotice(''), 3000)
    } catch (cause) {
      setSettingsError(cause instanceof Error ? cause.message : 'No se pudo guardar la portada')
    } finally { setSettingsSaving(false) }
  }

  const updateSetting = <K extends keyof PublicOrderPageSettings>(key: K, value: PublicOrderPageSettings[K]) => {
    setPageSettings(current => ({ ...current, [key]: value }))
  }

  if (loading) return <PageSkeleton cards={4} rows={7} hasTable={false} />
  return <main className="pedir-admin page animate-fade-in">
    <header className="pedir-admin-head">
      <div><span className="pedir-admin-kicker">TIENDA PARA CLIENTES</span><h1 className="page-title"><ShoppingBag size={22} /> Página de pedir</h1><p className="page-subtitle">Controla qué productos aparecen, sus etiquetas y lo que se recomienda al entrar.</p></div>
      <a className="pedir-preview-link" href="/pedir" target="_blank" rel="noreferrer"><ExternalLink size={16} /> Ver página pública</a>
    </header>
    <div className="pedir-summary">
      <article><Eye size={19} /><span>Productos visibles<strong>{visibleCount}</strong></span></article>
      <article><Flame size={19} /><span>En el carrusel ahora<strong>{carouselCount} / 8</strong></span></article>
      <article><Sparkles size={19} /><span>Con etiqueta<strong>{products.filter(product => product.menuLabel).length}</strong></span></article>
    </div>
    <p className="pedir-carousel-note">
      {pageSettings.carouselSelectionConfigured
        ? 'Estos son los productos que aparecen ahora. Puedes quitarlos, añadir otros y cambiar el orden.'
        : 'Estos son los productos que aparecen actualmente por recomendación automática. Al guardar un cambio, la selección quedará fija.'}
    </p>
    <section className="pedir-controls">
      <label className="pedir-search"><Search size={17} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar un producto" /></label>
      <select aria-label="Filtrar por categoría" value={category} onChange={event => setCategory(event.target.value)}>{categories.map(item => <option value={item} key={item}>{item === 'Todas' ? item : categoryLabel(item)}</option>)}</select>
      <div className="pedir-filter-tabs">{([['all', 'Todos'], ['visible', 'En la página'], ['carousel', 'Elegidos para carrusel']] as const).map(([value, label]) => <button key={value} type="button" className={filter === value ? 'active' : ''} onClick={() => setFilter(value)}>{label}</button>)}</div>
    </section>
    <section className="pedir-cover-settings" aria-labelledby="pedir-cover-title">
      <div className="pedir-cover-heading"><div><span className="pedir-admin-kicker">PORTADA DE LA TIENDA</span><h2 id="pedir-cover-title">Encabezado y banner</h2><p>Personaliza los textos y la imagen que reciben a tus clientes. El estado del local y el carrusel de platos se mantienen automáticos.</p></div><button type="button" className="pedir-save-button" onClick={() => void savePageSettings()} disabled={settingsSaving || settingsLoading}>{settingsSaving ? 'Guardando…' : 'Guardar portada'}</button></div>
      <div className="pedir-cover-layout">
        <div className="pedir-cover-fields">
          <label><span>Título para teléfono</span><input maxLength={70} value={pageSettings.mobileHeading} onChange={event => updateSetting('mobileHeading', event.target.value)} placeholder="¿Qué provoca hoy?" /></label>
          <label><span>Texto de búsqueda</span><input maxLength={90} value={pageSettings.searchPlaceholder} onChange={event => updateSetting('searchPlaceholder', event.target.value)} placeholder="Busca Arroz, combos, pollo..." /></label>
          <label><span>Frase pequeña en computadora</span><input maxLength={70} value={pageSettings.desktopEyebrow} onChange={event => updateSetting('desktopEyebrow', event.target.value)} /></label>
          <div className="pedir-cover-title-fields"><label><span>Título · primera línea</span><input maxLength={50} value={pageSettings.desktopTitlePrefix} onChange={event => updateSetting('desktopTitlePrefix', event.target.value)} /></label><label><span>Título · resaltado</span><input maxLength={50} value={pageSettings.desktopTitleAccent} onChange={event => updateSetting('desktopTitleAccent', event.target.value)} /></label></div>
          <label><span>Descripción en computadora</span><textarea maxLength={240} rows={3} value={pageSettings.desktopDescription} onChange={event => updateSetting('desktopDescription', event.target.value)} /></label>
          <label><span>Imagen de portada en computadora</span><select value={pageSettings.desktopBannerImage} onChange={event => updateSetting('desktopBannerImage', event.target.value)}>{PUBLIC_ORDER_BANNER_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select><small>Usamos imágenes que ya están dentro de Full China.</small></label>
        </div>
        <div className="pedir-cover-preview-stack">
          <div className="pedir-cover-preview" style={{ backgroundImage: `linear-gradient(90deg, rgba(8, 6, 8, .92), rgba(8, 6, 8, .28)), url("${pageSettings.desktopBannerImage}")` }}>
            <span>{pageSettings.desktopEyebrow || 'Tu frase pequeña'}</span><strong>{pageSettings.desktopTitlePrefix || 'Primera línea'}<em>{pageSettings.desktopTitleAccent || 'Texto resaltado'}</em></strong><p>{pageSettings.desktopDescription || 'La descripción se verá aquí.'}</p><small>Vista previa de la portada en computadora</small>
          </div>
          <div className="pedir-cover-mobile-preview">
            <span>VISTA PREVIA DE TELÉFONO</span><strong>{pageSettings.mobileHeading || 'Tu título'} <Flame size={15} /></strong><small><i /> Abierto · hasta las 10:00 p. m.</small><div><Search size={14} />{pageSettings.searchPlaceholder || 'Texto de búsqueda'}</div>
          </div>
        </div>
      </div>
      {settingsError && <div className="pedir-error pedir-cover-error" role="alert">{settingsError}<button type="button" onClick={() => void loadPageSettings()}>Reintentar</button></div>}
    </section>
    {error && <div className="pedir-error" role="alert">{error}<button type="button" onClick={() => void load()}>Reintentar</button></div>}
    <section className="pedir-product-list" aria-label="Productos de la página pública">
      {filtered.map(product => {
        const visible = product.publicVisible !== false
        const inCarousel = carouselProductSet.has(product.id)
        const carouselIndex = carouselProductIds.indexOf(product.id)
        const busy = savingId === product.id
        return <article className={`pedir-product-row${!product.isActive ? ' is-inactive' : ''}`} key={product.id}>
          <div className="pedir-product-image">{product.imageUrl ? <img src={product.imageUrl} alt="" loading="lazy" /> : <span>{product.emoji || '🥡'}</span>}</div>
          <div className="pedir-product-main"><strong>{product.name}</strong><small>{product.categories.map(item => categoryLabel(item)).join(' · ')} · {formatUsd(product.salePrice)}</small>
            <div className="pedir-product-label"><label htmlFor={`label-${product.id}`}>Etiqueta</label><select id={`label-${product.id}`} value={product.menuLabel ?? ''} disabled={busy || !product.isActive || !visible} onChange={event => { const value = event.target.value as Label | ''; void save(product, { menuLabel: value || null }, 'Etiqueta guardada') }}>{labels.map(item => <option key={item.name} value={item.value ?? ''}>{item.name}</option>)}</select></div>
          </div>
          <div className="pedir-product-actions">
            <button type="button" className={`pedir-toggle${visible ? ' selected' : ''}`} disabled={busy || !product.isActive} onClick={() => void save(product, { publicVisible: !visible, ...(visible ? { publicCarousel: false } : {}) }, visible ? 'Producto oculto de la página' : 'Producto visible en la página')}><span>{visible ? <Eye size={16} /> : <EyeOff size={16} />}{visible ? 'Visible' : 'Oculto'}</span><i /></button>
            <button type="button" className={`pedir-toggle${inCarousel ? ' selected' : ''}`} disabled={busy || settingsLoading || !product.isActive || !visible || (!inCarousel && carouselCount >= 8)} onClick={() => toggleCarouselProduct(product)}><span><Flame size={16} />{inCarousel ? `Carrusel · ${carouselIndex + 1}` : 'Añadir al carrusel'}</span><i /></button>
            {inCarousel && <div className="pedir-order"><button type="button" aria-label={`Subir ${product.name}`} disabled={busy || carouselIndex <= 0} onClick={() => moveCarousel(product,-1)}><ArrowUp size={15}/></button><button type="button" aria-label={`Bajar ${product.name}`} disabled={busy || carouselIndex < 0 || carouselIndex >= carouselProducts.length-1} onClick={() => moveCarousel(product,1)}><ArrowDown size={15}/></button></div>}
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
