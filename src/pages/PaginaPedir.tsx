import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Eye, EyeOff, Flame, Search, ShoppingBag, Tag, ExternalLink, Check, ChevronLeft, ChevronRight, Image, ImagePlus, PackageSearch, SlidersHorizontal, ArrowLeft, ArrowLeftRight, CirclePlus, CircleMinus, X, MapPin, Clock, MessageSquareText, Star, Zap, CupSoda, Navigation, Wallet } from 'lucide-react'
import { Link } from 'react-router-dom'
import { StyledSelect } from '../components/StyledSelect'
import { TimeSelect } from '../components/TimeSelect'
import { getAllSellableProducts, updateProduct, type SellableProduct } from '../lib/dataService'
import { formatUsd } from '../lib/money'
import { categoryLabel } from '../lib/menuCategories'
import { useLiveDataRefresh } from '../lib/liveDataRefresh'
import { DEFAULT_PUBLIC_ORDER_PAGE_SETTINGS, getPublicOrderMapEmbedUrl, getPublicOrderPageSettings, PUBLIC_ORDER_BANNER_OPTIONS, updatePublicOrderCarouselSelection, updatePublicOrderPageSettings, updatePublicOrderContactSettings, type PublicOrderPageSettings } from '../lib/publicOrderPageSettings'
import { getAutomaticPublicCarouselProductIds } from '../lib/publicOrderCarousel'
import { PageSkeleton } from '../components/PageSkeleton'
import Toast from '../components/Toast'
import './PaginaPedir.css'

type Label = NonNullable<SellableProduct['menuLabel']>
const PRODUCTS_PER_PAGE = 12
const PAGE_MEMORY_STORAGE_KEY = 'fullchina:pagina-pedir:session:v1'
type AdminSection = 'home' | 'cover' | 'contact' | 'products'
type PageMemory = {
  section: AdminSection
  search: string
  category: string
  filter: 'all' | 'labeled' | 'carousel'
  productPage: number
  scrollTop: number
}
const labels: Array<{ value: Label | null; name: string }> = [
  { value: null, name: 'Sin etiqueta' },
  { value: 'top_sales', name: 'Más vendido' },
  { value: 'new', name: 'Nuevo' },
  { value: 'recommended', name: 'Recomendado' },
  { value: 'free_drink', name: 'Refresco gratis' },
]
const labelPreviewMeta = {
  top_sales: { name: 'Más vendido', Icon: Flame, className: 'top-sales' },
  new: { name: 'Nuevo', Icon: Zap, className: 'new' },
  recommended: { name: 'Recomendado', Icon: Star, className: 'recommended' },
  free_drink: { name: 'Refresco gratis', Icon: CupSoda, className: 'free-drink' },
} as const

function readPageMemory(): PageMemory {
  const fallback: PageMemory = { section: 'home', search: '', category: 'Todas', filter: 'all', productPage: 1, scrollTop: 0 }
  if (typeof window === 'undefined') return fallback
  try {
    const saved: unknown = JSON.parse(window.sessionStorage.getItem(PAGE_MEMORY_STORAGE_KEY) || 'null')
    if (!saved || typeof saved !== 'object') return fallback
    const value = saved as Partial<PageMemory>
    return {
      section: ['home', 'cover', 'contact', 'products'].includes(String(value.section)) ? value.section as AdminSection : fallback.section,
      search: typeof value.search === 'string' ? value.search.slice(0, 160) : fallback.search,
      category: typeof value.category === 'string' ? value.category.slice(0, 100) : fallback.category,
      filter: value.filter === 'labeled' || value.filter === 'carousel' ? value.filter : 'all',
      productPage: Number.isInteger(value.productPage) && Number(value.productPage) > 0 ? Number(value.productPage) : fallback.productPage,
      scrollTop: typeof value.scrollTop === 'number' && Number.isFinite(value.scrollTop) && value.scrollTop > 0 ? value.scrollTop : fallback.scrollTop,
    }
  } catch { return fallback }
}

function formatContactTime(value: string) {
  const [hourValue, minute = '00'] = value.split(':')
  const hour24 = Number(hourValue)
  if (!Number.isFinite(hour24)) return value
  return `${hour24 % 12 || 12}:${minute} ${hour24 >= 12 ? 'p. m.' : 'a. m.'}`
}

function getMobilePaginationItems(currentPage: number, pageCount: number): Array<number | 'ellipsis-start' | 'ellipsis-end'> {
  if (pageCount <= 5) return Array.from({ length: pageCount }, (_, index) => index + 1)
  if (currentPage <= 3) return [1, 2, 3, 4, 'ellipsis-end', pageCount]
  if (currentPage >= pageCount - 2) return [1, 'ellipsis-start', pageCount - 3, pageCount - 2, pageCount - 1, pageCount]
  return [1, 'ellipsis-start', currentPage - 1, currentPage, currentPage + 1, 'ellipsis-end', pageCount]
}

function scaleBannerImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('No se pudo leer la imagen'))
    reader.onload = () => {
      const image = new window.Image()
      image.onerror = () => reject(new Error('El archivo no parece ser una imagen válida'))
      image.onload = () => {
        const scale = Math.min(1, 1800 / Math.max(image.width, image.height))
        const canvas = document.createElement('canvas')
        canvas.width = Math.max(1, Math.round(image.width * scale))
        canvas.height = Math.max(1, Math.round(image.height * scale))
        const context = canvas.getContext('2d')
        if (!context) return reject(new Error('No se pudo procesar la imagen'))
        context.drawImage(image, 0, 0, canvas.width, canvas.height)
        const dataUrl = canvas.toDataURL('image/jpeg', 0.78)
        if (dataUrl.length > 1_500_000) return reject(new Error('La imagen sigue siendo demasiado pesada. Prueba con otra más ligera.'))
        resolve(dataUrl)
      }
      image.src = String(reader.result)
    }
    reader.readAsDataURL(file)
  })
}

export function PaginaPedir() {
  const [pageMemory] = useState(readPageMemory)
  const [section, setSection] = useState<AdminSection>(pageMemory.section)
  const [products, setProducts] = useState<SellableProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState('')
  const [search, setSearch] = useState(pageMemory.search)
  const [category, setCategory] = useState(pageMemory.category)
  const [filter, setFilter] = useState<'all' | 'labeled' | 'carousel'>(pageMemory.filter)
  const [productPage, setProductPage] = useState(pageMemory.productPage)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [pageSettings, setPageSettings] = useState<PublicOrderPageSettings>(DEFAULT_PUBLIC_ORDER_PAGE_SETTINGS)
  const [settingsSaving, setSettingsSaving] = useState(false)
  const [contactSaving, setContactSaving] = useState(false)
  const [settingsLoading, setSettingsLoading] = useState(true)
  const [settingsError, setSettingsError] = useState('')
  const [replacementProduct, setReplacementProduct] = useState<SellableProduct | null>(null)
  const [replacementFeaturedId, setReplacementFeaturedId] = useState('')
  const [replacementDialogOpen, setReplacementDialogOpen] = useState(false)
  const [replacementSearch, setReplacementSearch] = useState('')
  const bannerInputRef = useRef<HTMLInputElement>(null)
  const [bannerProcessing, setBannerProcessing] = useState(false)
  const scrollRestored = useRef(false)
  const previousInnerView = useRef({ section, category, filter })

  const savePageMemory = useCallback((scrollTop?: number) => {
    try {
      const main = document.querySelector<HTMLElement>('.app-main')
      window.sessionStorage.setItem(PAGE_MEMORY_STORAGE_KEY, JSON.stringify({
        section, search, category, filter, productPage,
        scrollTop: scrollTop ?? main?.scrollTop ?? 0,
      } satisfies PageMemory))
    } catch { /* La página sigue funcionando aunque el navegador bloquee sessionStorage. */ }
  }, [section, search, category, filter, productPage])

  useEffect(() => { savePageMemory(scrollRestored.current ? undefined : pageMemory.scrollTop) }, [savePageMemory, pageMemory.scrollTop])

  useEffect(() => {
    const main = document.querySelector<HTMLElement>('.app-main')
    if (!main) return
    let timer = 0
    const rememberScroll = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => savePageMemory(main.scrollTop), 120)
    }
    main.addEventListener('scroll', rememberScroll, { passive: true })
    return () => {
      window.clearTimeout(timer)
      main.removeEventListener('scroll', rememberScroll)
    }
  }, [savePageMemory])

  useEffect(() => {
    if (loading || settingsLoading || scrollRestored.current) return
    const main = document.querySelector<HTMLElement>('.app-main')
    if (!main) return
    scrollRestored.current = true
    const frame = window.requestAnimationFrame(() => {
      main.scrollTop = pageMemory.scrollTop
      savePageMemory(main.scrollTop)
    })
    return () => window.cancelAnimationFrame(frame)
  }, [loading, settingsLoading, pageMemory.scrollTop, savePageMemory])

  useLayoutEffect(() => {
    const previous = previousInnerView.current
    const viewChanged = previous.section !== section || previous.category !== category || previous.filter !== filter
    previousInnerView.current = { section, category, filter }
    if (!viewChanged) return

    scrollRestored.current = true
    const main = document.querySelector<HTMLElement>('.app-main')
    if (main) {
      main.scrollTop = 0
      main.scrollLeft = 0
    }
    document.documentElement.scrollTop = 0
    document.body.scrollTop = 0
    window.scrollTo(0, 0)
    savePageMemory(0)
  }, [section, category, filter, savePageMemory])

  useEffect(() => {
    if (!replacementDialogOpen) return
    const main = document.querySelector<HTMLElement>('.app-main')
    const previous = {
      html: document.documentElement.style.overflow,
      body: document.body.style.overflow,
      main: main?.style.overflow ?? '',
    }
    document.documentElement.style.overflow = 'hidden'
    document.body.style.overflow = 'hidden'
    if (main) main.style.overflow = 'hidden'
    return () => {
      document.documentElement.style.overflow = previous.html
      document.body.style.overflow = previous.body
      if (main) main.style.overflow = previous.main
    }
  }, [replacementDialogOpen])

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
    const matchesFilter = filter === 'all' || (filter === 'labeled' ? Boolean(product.menuLabel) : carouselProductSet.has(product.id))
    return matchesSearch && matchesCategory && matchesFilter
  }), [products, search, category, filter, carouselProductSet])
  const pageCount = Math.max(1, Math.ceil(filtered.length / PRODUCTS_PER_PAGE))
  const currentProductPage = Math.min(productPage, pageCount)
  const paginatedProducts = filtered.slice((currentProductPage - 1) * PRODUCTS_PER_PAGE, currentProductPage * PRODUCTS_PER_PAGE)
  const previewProduct = filtered.find(product => product.isActive && product.publicVisible !== false) ?? filtered[0]
  const previewProductLabel = previewProduct?.menuLabel ? labelPreviewMeta[previewProduct.menuLabel] : null
  const PreviewLabelIcon = previewProductLabel?.Icon
  const recommendedPreviewProduct = carouselProducts.find(product => product.isActive && product.publicVisible !== false)
  const visibleCount = products.filter(product => product.isActive && product.publicVisible !== false).length
  const carouselCount = carouselProductIds.length
  const featuredToReplace = products.find(product => product.id === replacementFeaturedId) ?? null
  const featuredToReplaceIndex = carouselProductIds.indexOf(replacementFeaturedId)
  const replacementCandidates = products.filter(product => product.isActive && product.publicVisible !== false && product.salePrice >= 0.5 && !carouselProductSet.has(product.id) && `${product.name} ${product.description ?? ''}`.toLocaleLowerCase('es').includes(replacementSearch.toLocaleLowerCase('es')))

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

  const saveCarouselSelection = async (product: SellableProduct, nextIds: string[], message = 'Productos destacados actualizados') => {
    setSavingId(product.id)
    setError('')
    try {
      await updatePublicOrderCarouselSelection(nextIds)
      setProducts(current => current.map(row => {
        const order = nextIds.indexOf(row.id)
        return { ...row, publicCarousel: order >= 0, publicCarouselOrder: order >= 0 ? order + 1 : 0 }
      }))
      setPageSettings(current => ({ ...current, carouselSelectionConfigured: true }))
      setNotice(message)
      window.setTimeout(() => setNotice(''), 2400)
      return true
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo actualizar la selección de destacados'); return false }
    finally { setSavingId('') }
  }

  const toggleCarouselProduct = (product: SellableProduct) => {
    const nextIds = carouselProductSet.has(product.id)
      ? carouselProductIds.filter(id => id !== product.id)
      : [...carouselProductIds, product.id]
    void saveCarouselSelection(product, nextIds)
  }

  const openFeaturedReplacement = (product: SellableProduct) => {
    setReplacementProduct(product)
    setReplacementFeaturedId(carouselProductIds[0] ?? '')
    setReplacementSearch('')
    setReplacementDialogOpen(true)
    setError('')
  }

  const openReplacementFromFeaturedFilter = () => {
    setReplacementProduct(null)
    setReplacementFeaturedId(carouselProductIds[0] ?? '')
    setReplacementSearch('')
    setReplacementDialogOpen(true)
    setError('')
  }

  const confirmFeaturedReplacement = async () => {
    if (!replacementProduct || !replacementFeaturedId) return
    const nextIds = carouselProductIds.map(id => id === replacementFeaturedId ? replacementProduct.id : id)
    if (!nextIds.includes(replacementProduct.id)) return
    if (await saveCarouselSelection(replacementProduct, nextIds)) {
      setReplacementProduct(null)
      setReplacementFeaturedId('')
      setReplacementDialogOpen(false)
    }
  }

  const setCarouselPosition = (product: SellableProduct, position: number) => {
    const index = carouselProductIds.indexOf(product.id)
    if (index < 0 || position < 0 || position >= carouselProductIds.length || position === index) return
    const nextIds = [...carouselProductIds]
    const [movingId] = nextIds.splice(index, 1)
    nextIds.splice(position, 0, movingId)
    void saveCarouselSelection(product, nextIds, 'Lugar actualizado en recomendados')
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

  const saveContactSettings = async () => {
    setContactSaving(true)
    setSettingsError('')
    try {
      await updatePublicOrderContactSettings(pageSettings)
      setNotice('Información del local guardada y actualizada en la página pública.')
      window.setTimeout(() => setNotice(''), 3000)
    } catch (cause) {
      setSettingsError(cause instanceof Error ? cause.message : 'No se pudo guardar la información del local')
    } finally { setContactSaving(false) }
  }

  const updateSetting = <K extends keyof PublicOrderPageSettings>(key: K, value: PublicOrderPageSettings[K]) => {
    setPageSettings(current => ({ ...current, [key]: value }))
  }

  const pickBannerImage = async (file?: File) => {
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setSettingsError('Usa una imagen JPG, PNG o WebP.')
      return
    }
    if (file.size > 12 * 1024 * 1024) {
      setSettingsError('La imagen original debe pesar menos de 12 MB.')
      return
    }
    setBannerProcessing(true)
    setSettingsError('')
    try { updateSetting('desktopBannerImage', await scaleBannerImage(file)) }
    catch (cause) { setSettingsError(cause instanceof Error ? cause.message : 'No se pudo procesar la imagen') }
    finally { setBannerProcessing(false); if (bannerInputRef.current) bannerInputRef.current.value = '' }
  }

  if (loading) return <PageSkeleton cards={4} rows={7} hasTable={false} />
  return <main className="pedir-admin page animate-fade-in">
    <header className="pedir-admin-head">
      <div className="pedir-heading-copy">{section !== 'home' && <button type="button" className="pedir-back-button" onClick={() => setSection('home')}><ArrowLeft size={16} /> Volver a opciones</button>}<span className="pedir-admin-kicker">TIENDA PARA CLIENTES</span><h1 className="page-title"><ShoppingBag size={22} /> {section === 'cover' ? 'Portada de la tienda' : section === 'contact' ? 'Información del local' : section === 'products' ? 'Productos de la tienda' : 'Página de pedir'}</h1><p className="page-subtitle">{section === 'cover' ? 'Cambia la imagen y los textos que reciben a tus clientes.' : section === 'contact' ? 'Actualiza cómo te encuentran y cuándo pueden visitarte.' : section === 'products' ? 'Elige qué productos mostrar y destacar.' : '¿Qué quieres cambiar hoy?'}</p></div>
      <a className="pedir-preview-link" href="/pedir" target="_blank" rel="noreferrer"><ExternalLink size={16} /> Ver página pública</a>
    </header>
    {section === 'home' && <section className="pedir-welcome" aria-labelledby="pedir-welcome-title"><div className="pedir-welcome-intro"><span className="pedir-admin-kicker">ASISTENTE DE TIENDA</span><h2 id="pedir-welcome-title">Hola, ¿qué quieres actualizar hoy?</h2><p>Escoge una opción. Te mostraremos solo lo que necesitas para hacer ese cambio.</p></div><div className="pedir-task-grid"><button type="button" className="pedir-task-card" onClick={() => setSection('cover')}><span className="pedir-task-icon"><Image size={20} /></span><strong>La portada</strong><small>Cambiar el banner, la foto o los textos de bienvenida.</small><span className="pedir-task-action">Editar portada <ChevronRight size={15} /></span></button><button type="button" className="pedir-task-card" onClick={() => setSection('contact')}><span className="pedir-task-icon"><MapPin size={20} /></span><strong>Información del local</strong><small>Teléfono, WhatsApp, dirección, horario y redes sociales.</small><span className="pedir-task-action">Editar contacto <ChevronRight size={15} /></span></button><button type="button" className="pedir-task-card" onClick={() => setSection('products')}><span className="pedir-task-icon"><ShoppingBag size={20} /></span><strong>Los productos que se muestran</strong><small>Buscar por categoría, ocultar productos, poner etiquetas o elegir destacados.</small><span className="pedir-task-action">Organizar productos <ChevronRight size={15} /></span></button><Link className="pedir-task-card" to="/menu"><span className="pedir-task-icon"><SlidersHorizontal size={20} /></span><strong>El nombre, la foto o los extras de un producto</strong><small>Abre Menú para editar los datos del producto y las opciones que puede agregar el cliente.</small><span className="pedir-task-action">Ir a Menú <ChevronRight size={15} /></span></Link></div><p className="pedir-welcome-footnote"><PackageSearch size={15} /> Los cambios de la portada, contacto y visibilidad se reflejan en la página pública al guardarlos.</p></section>}
    {section === 'cover' && <section className="pedir-cover-section">
    <section className="pedir-cover-settings" aria-labelledby="pedir-cover-title">
      <div className="pedir-cover-heading"><div><span className="pedir-admin-kicker">PORTADA DE LA TIENDA</span><h2 id="pedir-cover-title">Encabezado y banner</h2><p>Personaliza los textos y la imagen que reciben a tus clientes. Los productos destacados se configuran en su propia sección.</p></div><button type="button" className="pedir-save-button" onClick={() => void savePageSettings()} disabled={settingsSaving || settingsLoading || bannerProcessing}>{settingsSaving ? 'Guardando…' : 'Guardar portada'}</button></div>
      <div className="pedir-cover-layout">
        <div className="pedir-cover-fields">
          <label><span>Título para teléfono</span><input maxLength={70} value={pageSettings.mobileHeading} onChange={event => updateSetting('mobileHeading', event.target.value)} placeholder="¿Qué provoca hoy?" /></label>
          <label><span>Texto de búsqueda</span><input maxLength={90} value={pageSettings.searchPlaceholder} onChange={event => updateSetting('searchPlaceholder', event.target.value)} placeholder="Busca Arroz, combos, pollo..." /></label>
          <label><span>Frase pequeña en computadora</span><input maxLength={70} value={pageSettings.desktopEyebrow} onChange={event => updateSetting('desktopEyebrow', event.target.value)} /></label>
          <div className="pedir-cover-title-fields"><label><span>Título · primera línea</span><input maxLength={50} value={pageSettings.desktopTitlePrefix} onChange={event => updateSetting('desktopTitlePrefix', event.target.value)} /></label><label><span>Título · resaltado</span><input maxLength={50} value={pageSettings.desktopTitleAccent} onChange={event => updateSetting('desktopTitleAccent', event.target.value)} /></label></div>
          <label><span>Descripción en computadora</span><textarea maxLength={240} rows={3} value={pageSettings.desktopDescription} onChange={event => updateSetting('desktopDescription', event.target.value)} /></label>
          <div className="pedir-banner-upload"><span className="pedir-banner-upload-label">Imagen de portada en computadora</span><div className="pedir-banner-upload-control"><img src={pageSettings.desktopBannerImage} alt="Imagen de portada actual" /><div><strong>{pageSettings.desktopBannerImage.startsWith('data:image/') ? 'Imagen personalizada' : PUBLIC_ORDER_BANNER_OPTIONS.find(option => option.value === pageSettings.desktopBannerImage)?.label ?? 'Imagen de portada actual'}</strong><small>JPG, PNG o WebP · hasta 12 MB</small></div><input ref={bannerInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={event => void pickBannerImage(event.target.files?.[0])} /><button type="button" onClick={() => bannerInputRef.current?.click()} disabled={bannerProcessing || settingsSaving}>{bannerProcessing ? 'Procesando…' : <><ImagePlus size={16} /> Subir foto</>}</button></div><small>La imagen se ajusta para la portada y se guarda al pulsar “Guardar portada”.</small></div>
        </div>
        <div className="pedir-cover-preview-stack">
          <div className="pedir-preview-label">VISTA PREVIA · ASÍ LA VE EL CLIENTE</div>
          <div className="pedir-cover-preview">
            <div className="pedir-preview-hero-copy"><span className="pedir-preview-eyebrow"><Flame size={13} />{pageSettings.desktopEyebrow || 'Tu frase pequeña'}</span><strong>{pageSettings.desktopTitlePrefix || 'Primera línea'}<em>{pageSettings.desktopTitleAccent || 'Texto resaltado'}</em></strong><p>{pageSettings.desktopDescription || 'La descripción se verá aquí.'}</p><div className="pedir-preview-actions"><span>⌕&nbsp; {pageSettings.searchPlaceholder || 'Texto de búsqueda'}</span><b>Ver menú completo&nbsp; ›</b></div></div>
            <div className="pedir-preview-hero-image"><img src={pageSettings.desktopBannerImage} alt="Vista previa de la imagen de portada" /></div>
          </div>
          <div className="pedir-cover-mobile-preview">
            <span>VISTA PREVIA DE TELÉFONO</span><strong>{pageSettings.mobileHeading || 'Tu título'} <Flame size={15} /></strong><small><i /> Abierto · hasta las 10:00 p. m.</small><div><Search size={14} />{pageSettings.searchPlaceholder || 'Texto de búsqueda'}</div>
          </div>
        </div>
      </div>
      {settingsError && <div className="pedir-error pedir-cover-error" role="alert">{settingsError}<button type="button" onClick={() => void loadPageSettings()}>Reintentar</button></div>}
    </section></section>}
    {section === 'contact' && <section className="pedir-contact-section">
      <section className="pedir-contact-settings" aria-labelledby="pedir-contact-title">
        <div className="pedir-contact-heading"><div><span className="pedir-admin-kicker">DATOS PARA TUS CLIENTES</span><h2 id="pedir-contact-title">Información del local</h2><p>Estos datos aparecen en Contacto dentro de la página de pedir. La vista previa se actualiza mientras editas.</p></div><button type="button" className="pedir-save-button" onClick={() => void saveContactSettings()} disabled={contactSaving || settingsLoading}>{contactSaving ? 'Guardando…' : 'Guardar información'}</button></div>
        <div className="pedir-contact-layout">
          <div className="pedir-contact-fields">
            <label><span><MessageSquareText size={14} /> Número de WhatsApp</span><input type="tel" maxLength={30} value={pageSettings.contactWhatsapp} onChange={event => updateSetting('contactWhatsapp', event.target.value)} placeholder="Agrega un número de WhatsApp" /><small>Este número actualiza el destino de “Escríbenos ahora” y de los enlaces de WhatsApp para pedidos.</small></label>
            <label><span><MapPin size={14} /> Dirección o zona</span><input maxLength={180} value={pageSettings.contactAddress} onChange={event => updateSetting('contactAddress', event.target.value)} placeholder="Ciudad · Estado" /></label>
            <label><span><ExternalLink size={14} /> Enlace para llegar</span><input type="url" maxLength={400} value={pageSettings.contactDirectionsUrl} onChange={event => updateSetting('contactDirectionsUrl', event.target.value)} placeholder="https://maps.app.goo.gl/..." /></label>
            <label><span>Instagram</span><input type="url" maxLength={400} value={pageSettings.contactInstagramUrl} onChange={event => updateSetting('contactInstagramUrl', event.target.value)} placeholder="https://www.instagram.com/..." /></label>
            <div className="pedir-contact-hours"><label><span><Clock size={14} /> Días de atención</span><StyledSelect className="pedir-contact-days-select" value={pageSettings.contactDays} onChange={event => updateSetting('contactDays', event.target.value)}><option>Martes a Domingo</option><option>Lunes a Domingo</option><option>Lunes a Sábado</option><option>Lunes a Viernes</option></StyledSelect></label><label><span>Abre</span><TimeSelect label="Hora de apertura" value={pageSettings.contactOpenTime} onChange={value => updateSetting('contactOpenTime', value)} /></label><label><span>Cierra</span><TimeSelect label="Hora de cierre" value={pageSettings.contactCloseTime} onChange={value => updateSetting('contactCloseTime', value)} /></label></div>
          </div>
          <div className="pedir-contact-preview-wrap">
            <div className="pedir-preview-label">VISTA PREVIA · ASÍ SE VE CONTACTO EN LA TIENDA</div>
            <div className="pedir-contact-preview-page">
              <article className="pedir-contact-public-card pedir-contact-public-direct">
                <header><span><Flame size={14} /> Pedido directo</span><h3>Pide sin complicarte</h3></header>
                <div className="pedir-contact-public-hours"><span><Clock size={14} /> Horario de atención</span><strong>{pageSettings.contactDays || 'Días de atención'}</strong><small>{formatContactTime(pageSettings.contactOpenTime)} – {formatContactTime(pageSettings.contactCloseTime)}</small>
                </div>
                <div className="pedir-contact-public-payments"><Wallet size={15} /><span>Métodos de pago</span><small>Efectivo USD · Bs. · Pago móvil · Punto de venta</small></div>
              </article>
              <article className="pedir-contact-public-card pedir-contact-public-location">
                <div className="pedir-contact-public-map">
                  <iframe title="Vista previa de la ubicación en Google Maps" src={getPublicOrderMapEmbedUrl(pageSettings.contactDirectionsUrl, pageSettings.contactAddress)} loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
                  <div><span><MapPin size={13} /> Punto Full China</span><strong>{pageSettings.contactAddress || 'Dirección del local'}</strong><p>Ven, come y disfruta.</p>{(pageSettings.contactDirectionsUrl || DEFAULT_PUBLIC_ORDER_PAGE_SETTINGS.contactDirectionsUrl) && <a href={pageSettings.contactDirectionsUrl || DEFAULT_PUBLIC_ORDER_PAGE_SETTINGS.contactDirectionsUrl} target="_blank" rel="noreferrer"><Navigation size={15} /> Cómo llegar <ChevronRight size={16} /></a>}</div>
                </div>
              </article>
            </div>
            <small className="pedir-contact-preview-foot">El WhatsApp se configura aquí y se abre desde “Escríbenos ahora”. La dirección y el horario se actualizan mientras editas.</small>
          </div>
        </div>
        {settingsError && <div className="pedir-error pedir-cover-error" role="alert">{settingsError}<button type="button" onClick={() => void loadPageSettings()}>Reintentar</button></div>}
      </section>
    </section>}
    {section === 'products' && <section className="pedir-products-section">
    <div className="pedir-summary">
      <article><Eye size={19} /><span>Productos visibles<strong>{visibleCount}</strong></span></article>
      <article><Flame size={19} /><span>Destacados al inicio<strong>{carouselCount} / 8</strong></span></article>
      <article><Tag size={19} /><span>Con etiqueta<strong>{products.filter(product => product.menuLabel).length}</strong></span></article>
    </div>
    <p className="pedir-carousel-note">{pageSettings.carouselSelectionConfigured ? 'Estos productos aparecen en Recomendados al inicio. En cada uno, elige “Lugar en recomendados” para decidir cuál se muestra primero.' : 'Full China elige automáticamente qué productos recomienda al inicio. Al añadir, quitar o cambiar un destacado, también podrás elegir su lugar.'}</p>
    <section className="pedir-controls">
      <label className="pedir-search"><Search size={17} /><input value={search} onChange={event => { setSearch(event.target.value); setProductPage(1) }} placeholder="Buscar un producto" />{search && <button type="button" className="pedir-search-clear" aria-label="Borrar búsqueda" title="Borrar búsqueda" onClick={event => { setSearch(''); setProductPage(1); event.currentTarget.parentElement?.querySelector('input')?.focus() }}><X size={16} /></button>}</label>
      <div className="pedir-filter-tabs">{([['all', 'Todos los productos'], ['labeled', 'Con etiqueta'], ['carousel', 'Destacados al inicio']] as const).map(([value, label]) => <button key={value} type="button" className={filter === value ? 'active' : ''} onClick={() => { setFilter(value); setProductPage(1) }}>{label}</button>)}</div>
    </section>
    <nav className="pedir-category-tabs" aria-label="Filtrar productos por categoría">
      {categories.map(item => <button key={item} type="button" className={category === item ? 'active' : ''} aria-pressed={category === item} onClick={() => { setCategory(item); setProductPage(1) }}>{item === 'Todas' ? 'Todas las categorías' : categoryLabel(item)}</button>)}
    </nav>
    <div className="pedir-catalog-meta"><span>{filtered.length} producto{filtered.length === 1 ? '' : 's'}{category !== 'Todas' ? ` en ${categoryLabel(category)}` : ''}</span><span>Página {currentProductPage} de {pageCount}</span></div>
    {filter === 'carousel' && <div className="pedir-featured-tools"><div><strong>¿Quieres cambiar uno?</strong><span>Escoge el destacado que sale y el producto que ocupará su lugar.</span></div><button type="button" onClick={openReplacementFromFeaturedFilter} disabled={settingsLoading || carouselCount === 0}><ArrowLeftRight size={16} /> Cambiar un destacado</button></div>}
    {error && <div className="pedir-error" role="alert">{error}<button type="button" onClick={() => void load()}>Reintentar</button></div>}
    {filter === 'carousel' && recommendedPreviewProduct && <section className="pedir-live-preview" aria-label="Vista previa de los productos recomendados al inicio"><div className="pedir-live-preview-heading"><div><span className="pedir-admin-kicker">VISTA PREVIA · RECOMENDADOS AL INICIO</span><h3>Así se verá el destacado</h3></div><span>Ejemplo · {recommendedPreviewProduct.name}</span></div><article className="pedir-recommended-preview"><div className="pedir-recommended-preview-copy"><small>RECOMENDADO <Flame size={11} /></small><strong>{recommendedPreviewProduct.name}</strong><p>{recommendedPreviewProduct.description || 'Elige tu favorito y arma tu pedido.'}</p><b>{formatUsd(recommendedPreviewProduct.salePrice)}</b><button type="button" tabIndex={-1}>Ver producto <ChevronRight size={13} /></button></div>{recommendedPreviewProduct.imageUrl ? <img className="pedir-recommended-preview-image" src={recommendedPreviewProduct.imageUrl} alt="" /> : <div className="pedir-recommended-preview-image pedir-recommended-preview-emoji">{recommendedPreviewProduct.emoji || '🥡'}</div>}<div className="pedir-recommended-preview-dots" aria-hidden="true">{carouselProducts.slice(0, 8).map((product, index) => <i key={product.id} className={index === 0 ? 'active' : ''} />)}</div></article></section>}
    {filter !== 'carousel' && previewProduct && <section className="pedir-live-preview" aria-label={filter === 'labeled' ? 'Vista previa de un producto con etiqueta' : 'Vista de producto en la página pública'}><div className="pedir-live-preview-heading"><div><span className="pedir-admin-kicker">{filter === 'labeled' ? 'VISTA PREVIA · PRODUCTO CON ETIQUETA' : 'VISTA DE PRODUCTO'}</span><h3>{filter === 'labeled' ? 'Así verá el cliente esta etiqueta' : 'Así aparecerá en la tienda'}</h3></div><span>Ejemplo · {previewProduct.name}</span></div><article className="pedir-public-product-card"><div className="pedir-public-product-image">{previewProduct.imageUrl ? <img src={previewProduct.imageUrl} alt="" /> : <span>{previewProduct.emoji || '🥡'}</span>}{previewProduct.menuLabel === 'free_drink' ? <img className="pedir-free-drink-badge" src="/icons/free-drink-badge.png" alt="Refresco gratis" /> : PreviewLabelIcon && previewProductLabel && <span className={`pedir-preview-label-pill ${previewProductLabel.className}`}><PreviewLabelIcon size={12} strokeWidth={2.5} aria-hidden="true" />{previewProductLabel.name}</span>}</div><div className="pedir-public-product-copy"><small>{previewProduct.categories.map(item => categoryLabel(item)).join(' · ')}</small><strong>{previewProduct.name}</strong><p>{previewProduct.description || 'Preparado al momento con el auténtico sabor Full China.'}</p><div><b>{formatUsd(previewProduct.salePrice)}</b><span>＋</span></div></div></article></section>}
    <section className="pedir-product-list" aria-label="Productos de la página pública">
      {paginatedProducts.map(product => {
        const visible = product.publicVisible !== false
        const appearsInStore = product.isActive && visible
        const inCarousel = carouselProductSet.has(product.id)
        const carouselIndex = carouselProductIds.indexOf(product.id)
        const busy = savingId === product.id
        return <article className={`pedir-product-row${!product.isActive ? ' is-inactive' : ''}${filter === 'carousel' ? ' is-carousel-filter' : ''}`} key={product.id}>
          <div className="pedir-product-image">{product.imageUrl ? <img src={product.imageUrl} alt="" loading="lazy" /> : <span>{product.emoji || '🥡'}</span>}</div>
          <div className="pedir-product-main"><strong>{product.name}</strong><small>{product.categories.map(item => categoryLabel(item)).join(' · ')} · {formatUsd(product.salePrice)}</small>
            {!product.categories.includes('bebidas') && <div className={`pedir-protein-extra${product.allowProteinExtras ? ' is-enabled' : ' is-disabled'}`}><span>{product.allowProteinExtras ? <CirclePlus size={14} /> : <CircleMinus size={14} />}{product.allowProteinExtras ? 'Permite extra de proteína' : 'Sin extra de proteína'}</span><Link to="/menu" state={{ editProductId: product.id }}>Editar en Menú <ChevronRight size={13} /></Link></div>}
            <div className="pedir-product-label"><label htmlFor={`label-${product.id}`}>Etiqueta</label><StyledSelect id={`label-${product.id}`} className="pedir-label-select" value={product.menuLabel ?? ''} disabled={busy || !product.isActive || !visible} onChange={event => { const value = event.target.value as Label | ''; void save(product, { menuLabel: value || null }, 'Etiqueta guardada') }}>{labels.map(item => <option key={item.name} value={item.value ?? ''}>{item.name}</option>)}</StyledSelect></div>
          </div>
          <div className="pedir-product-actions">
            <button type="button" className={`pedir-toggle${appearsInStore ? ' selected' : ''}`} disabled={busy || !product.isActive} onClick={() => void save(product, { publicVisible: !visible, ...(visible ? { publicCarousel: false } : {}) }, visible ? 'Producto oculto de la página' : 'Producto visible en la página')}><span>{appearsInStore ? <Eye size={16} /> : <EyeOff size={16} />}{!product.isActive ? 'Inactivo en Menú' : visible ? 'Visible' : 'Oculto'}</span>{product.isActive && <i />}</button>
            <button type="button" className={`pedir-toggle${inCarousel ? ' selected' : ''}`} disabled={busy || settingsLoading || !product.isActive || !visible} onClick={() => { if (inCarousel) toggleCarouselProduct(product); else if (carouselCount >= 8) openFeaturedReplacement(product); else toggleCarouselProduct(product) }} title={inCarousel ? 'Este producto se recomienda al inicio de la tienda' : carouselCount >= 8 ? 'Elige cuál destacado quieres reemplazar' : 'Mostrar este producto entre las recomendaciones del inicio'}><span>{!inCarousel && carouselCount >= 8 ? <ArrowLeftRight size={15} /> : <Flame size={16} />}{inCarousel ? `Destacado · #${carouselIndex + 1}` : carouselCount >= 8 ? 'Reemplazar destacado' : 'Destacar al inicio'}</span>{inCarousel && <i />}</button>
            {filter === 'carousel' && inCarousel && <div className="pedir-order"><label htmlFor={`carousel-position-${product.id}`}>Lugar en recomendados</label><StyledSelect id={`carousel-position-${product.id}`} className="pedir-position-select" aria-label={`Lugar de ${product.name} en recomendados`} value={String(carouselIndex)} disabled={busy || settingsLoading} onChange={event => setCarouselPosition(product, Number(event.target.value))}>{carouselProducts.map((_, index) => <option key={index} value={String(index)}>Lugar {index + 1} · {['Primero','Segundo','Tercero','Cuarto','Quinto','Sexto','Séptimo','Octavo'][index] ?? `${index + 1}`}</option>)}</StyledSelect><small>El primero aparece antes en la tienda.</small></div>}
          </div>
          {busy && <span className="pedir-saving"><Check size={15} /> Guardando…</span>}
        </article>
      })}
      {filtered.length === 0 && <div className="pedir-empty"><span className="pedir-empty-icon"><PackageSearch size={26} /></span><h3>{search ? 'No encontramos ese producto' : 'No hay productos en esta selección'}</h3><p>{search ? <>No hay resultados para <strong>“{search}”</strong>. Prueba otro nombre o limpia los filtros.</> : 'Prueba otra categoría o revisa los filtros seleccionados.'}</p><button type="button" onClick={() => { setSearch(''); setCategory('Todas'); setFilter('all'); setProductPage(1) }}>Ver todos los productos</button></div>}
    </section>
    {filtered.length > PRODUCTS_PER_PAGE && <nav className="pedir-pagination" aria-label="Paginación de productos">
      <button type="button" aria-label="Página anterior" disabled={currentProductPage <= 1} onClick={() => { setProductPage(page => Math.max(1, page - 1)); document.querySelector('.pedir-product-list')?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }}><ChevronLeft size={16} /><span>Anterior</span></button>
      <div className="pedir-pagination-all-pages">{Array.from({ length: pageCount }, (_, index) => index + 1).map(page => <button type="button" key={page} className={page === currentProductPage ? 'active' : ''} aria-current={page === currentProductPage ? 'page' : undefined} onClick={() => { setProductPage(page); document.querySelector('.pedir-product-list')?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }}>{page}</button>)}</div>
      <div className="pedir-pagination-mobile-pages">{getMobilePaginationItems(currentProductPage, pageCount).map(item => typeof item === 'number'
        ? <button type="button" key={`page-${item}`} className={item === currentProductPage ? 'active' : ''} aria-current={item === currentProductPage ? 'page' : undefined} aria-label={`Página ${item}`} onClick={() => { setProductPage(item); document.querySelector('.pedir-product-list')?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }}>{item}</button>
        : <span key={item} aria-hidden="true">…</span>)}</div>
      <button type="button" aria-label="Página siguiente" disabled={currentProductPage >= pageCount} onClick={() => { setProductPage(page => Math.min(pageCount, page + 1)); document.querySelector('.pedir-product-list')?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }}><span>Siguiente</span><ChevronRight size={16} /></button>
    </nav>}
    </section>}
    {replacementDialogOpen && featuredToReplace && createPortal(<div className="pedir-replace-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !savingId) { setReplacementProduct(null); setReplacementFeaturedId(''); setReplacementDialogOpen(false) } }}><section className="pedir-replace-modal" role="dialog" aria-modal="true" aria-labelledby="pedir-replace-title"><header className="pedir-replace-modal-head"><div><span className="pedir-admin-kicker">CAMBIAR PRODUCTO DESTACADO</span><h2 id="pedir-replace-title">¿Cuál sale y cuál entra?</h2><p>El nuevo ocupará el mismo lugar que el producto que elijas.</p></div><button type="button" className="pedir-replace-close" aria-label="Cerrar" disabled={Boolean(savingId)} onClick={() => { setReplacementProduct(null); setReplacementFeaturedId(''); setReplacementDialogOpen(false) }}><X size={19} /></button></header><div className="pedir-replace-comparison"><article className="pedir-replace-product is-out"><span className="pedir-replace-product-label">SALE · #{featuredToReplaceIndex + 1}</span><div className="pedir-replace-product-body"><div className="pedir-replace-product-image">{featuredToReplace.imageUrl ? <img src={featuredToReplace.imageUrl} alt="" /> : <span>{featuredToReplace.emoji || '🥡'}</span>}</div><div><strong>{featuredToReplace.name}</strong><small>{featuredToReplace.categories.map(item => categoryLabel(item)).join(' · ')}</small><b>{formatUsd(featuredToReplace.salePrice)}</b></div></div></article><div className="pedir-replace-swap-icon"><ArrowLeftRight size={21} /></div><article className={`pedir-replace-product is-in${replacementProduct ? '' : ' is-empty'}`}><span className="pedir-replace-product-label">ENTRA · NUEVO DESTACADO</span>{replacementProduct ? <div className="pedir-replace-product-body"><div className="pedir-replace-product-image">{replacementProduct.imageUrl ? <img src={replacementProduct.imageUrl} alt="" /> : <span>{replacementProduct.emoji || '🥡'}</span>}</div><div><strong>{replacementProduct.name}</strong><small>{replacementProduct.categories.map(item => categoryLabel(item)).join(' · ')}</small><b>{formatUsd(replacementProduct.salePrice)}</b></div></div> : <p>Selecciona el producto que quieres destacar.</p>}</article></div><div className="pedir-replace-choose"><div><h3>1. Elige cuál producto sale</h3><p>Toca uno de tus destacados actuales.</p></div><div className="pedir-replace-options">{carouselProductIds.map((id, index) => { const product = products.find(row => row.id === id); if (!product) return null; const isSelected = product.id === replacementFeaturedId; return <button type="button" key={id} className={`pedir-replace-option${isSelected ? ' selected' : ''}`} aria-pressed={isSelected} onClick={() => setReplacementFeaturedId(id)}><span className="pedir-replace-option-image">{product.imageUrl ? <img src={product.imageUrl} alt="" /> : <span>{product.emoji || '🥡'}</span>}</span><span className="pedir-replace-option-copy"><small>Destacado · #{index + 1}</small><strong>{product.name}</strong></span>{isSelected && <Check size={17} />}</button> })}</div></div><div className="pedir-replace-choose"><div><h3>2. Elige cuál producto entra</h3><p>Busca y selecciona el producto que lo reemplazará.</p></div><label className="pedir-replace-search"><Search size={16} /><input value={replacementSearch} onChange={event => setReplacementSearch(event.target.value)} placeholder="Buscar producto para destacar" />{replacementSearch && <button type="button" aria-label="Limpiar búsqueda" onClick={() => setReplacementSearch('')}><X size={15}/></button>}</label><div className="pedir-replace-options">{replacementCandidates.map(product => <button type="button" key={product.id} className={`pedir-replace-option${replacementProduct?.id === product.id ? ' selected' : ''}`} aria-pressed={replacementProduct?.id === product.id} onClick={() => setReplacementProduct(product)}><span className="pedir-replace-option-image">{product.imageUrl ? <img src={product.imageUrl} alt="" /> : <span>{product.emoji || '🥡'}</span>}</span><span className="pedir-replace-option-copy"><small>{product.categories.map(item => categoryLabel(item)).join(' · ')} · {formatUsd(product.salePrice)}</small><strong>{product.name}</strong></span>{replacementProduct?.id === product.id && <Check size={17} />}</button>)}{replacementCandidates.length === 0 && <p className="pedir-replace-no-results">{replacementSearch ? 'No encontramos productos con ese nombre.' : 'No hay otros productos disponibles para destacar.'}</p>}</div></div><footer className="pedir-replace-modal-footer"><button type="button" className="pedir-replace-cancel" onClick={() => { setReplacementProduct(null); setReplacementFeaturedId(''); setReplacementDialogOpen(false) }} disabled={Boolean(savingId)}>Cancelar</button><button type="button" className="pedir-replace-confirm" onClick={() => void confirmFeaturedReplacement()} disabled={!replacementFeaturedId || !replacementProduct || Boolean(savingId)}>{savingId ? 'Guardando…' : <><ArrowLeftRight size={16} /> Confirmar reemplazo</>}</button></footer></section></div>, document.body)}
    {notice && <Toast type="success" message={notice} onClose={() => setNotice('')} />}
  </main>
}
