import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Eye, EyeOff, Flame, Search, ShoppingBag, Tag, ExternalLink, Check, ChevronLeft, ChevronRight, Image, ImagePlus, PackageSearch, SlidersHorizontal, ArrowLeft, ArrowLeftRight, CirclePlus, CircleMinus, X, MapPin, Clock, MessageSquareText, Star, Zap, CupSoda, Video, Upload, Camera, Navigation, Wallet, RotateCcw } from 'lucide-react'
import { Link } from 'react-router-dom'
import { StyledSelect } from '../components/StyledSelect'
import { TimeSelect } from '../components/TimeSelect'
import { getAllSellableProducts, updateProduct, type SellableProduct } from '../lib/dataService'
import { formatUsd } from '../lib/money'
import { categoryLabel } from '../lib/menuCategories'
import { useLiveDataRefresh } from '../lib/liveDataRefresh'
import { DEFAULT_PUBLIC_ORDER_PAGE_SETTINGS, DEFAULT_PUBLIC_ORDER_REELS, getPublicOrderMapEmbedUrl, getPublicOrderPageSettings, PUBLIC_ORDER_BANNER_OPTIONS, updatePublicOrderCarouselSelection, updatePublicOrderPageSettings, updatePublicOrderContactSettings, updatePublicOrderReels, type PublicOrderPageSettings, type PublicOrderReel } from '../lib/publicOrderPageSettings'
import { removePublicOrderReelFiles, uploadPublicOrderReel, type UploadedPublicReel } from '../lib/publicOrderReelUpload'
import { getAutomaticPublicCarouselProductIds } from '../lib/publicOrderCarousel'
import { PageSkeleton } from '../components/PageSkeleton'
import Toast from '../components/Toast'
import './PaginaPedir.css'

type Label = NonNullable<SellableProduct['menuLabel']>
const PRODUCTS_PER_PAGE = 12
const REEL_HISTORY_STORAGE_KEY = 'fullchina:public-order-reel-history:v1'
type AdminSection = 'home' | 'cover' | 'contact' | 'videos' | 'products'
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

function readReelHistory(): Record<number, PublicOrderReel> {
  if (typeof window === 'undefined') return {}
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(REEL_HISTORY_STORAGE_KEY) || '{}')
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    return Object.fromEntries(Object.entries(parsed).flatMap(([slot, value]) => {
      const index = Number(slot)
      if (!Number.isInteger(index) || index < 0 || index >= 6 || !value || typeof value !== 'object') return []
      const reel = value as Partial<PublicOrderReel>
      const isLibraryVideo = DEFAULT_PUBLIC_ORDER_REELS.some(item => item.src === reel.src && item.poster === reel.poster)
      const isUploadedVideo = typeof reel.videoPath === 'string'
        && typeof reel.posterPath === 'string'
        && /^instagram\/[1-6]\/[0-9a-f-]{36}\.mp4$/i.test(reel.videoPath)
        && /^instagram\/[1-6]\/[0-9a-f-]{36}\.jpg$/i.test(reel.posterPath)
        && reel.videoPath.replace(/\.mp4$/i, '') === reel.posterPath.replace(/\.jpg$/i, '')
        && typeof reel.src === 'string' && typeof reel.poster === 'string'
      return isLibraryVideo || isUploadedVideo ? [[index, reel as PublicOrderReel]] : []
    }))
  } catch { return {} }
}

function saveReelHistory(history: Record<number, PublicOrderReel>) {
  try { window.localStorage.setItem(REEL_HISTORY_STORAGE_KEY, JSON.stringify(history)) }
  catch { /* La restauración sigue disponible durante esta sesión aunque localStorage esté lleno. */ }
}

function formatContactTime(value: string) {
  const [hourValue, minute = '00'] = value.split(':')
  const hour24 = Number(hourValue)
  if (!Number.isFinite(hour24)) return value
  return `${hour24 % 12 || 12}:${minute} ${hour24 >= 12 ? 'p. m.' : 'a. m.'}`
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
  const [section, setSection] = useState<AdminSection>('home')
  const [products, setProducts] = useState<SellableProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState('')
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('Todas')
  const [filter, setFilter] = useState<'all' | 'labeled' | 'carousel'>('all')
  const [productPage, setProductPage] = useState(1)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [pageSettings, setPageSettings] = useState<PublicOrderPageSettings>(DEFAULT_PUBLIC_ORDER_PAGE_SETTINGS)
  const [settingsSaving, setSettingsSaving] = useState(false)
  const [contactSaving, setContactSaving] = useState(false)
  const [settingsLoading, setSettingsLoading] = useState(true)
  const [settingsError, setSettingsError] = useState('')
  const [reelError, setReelError] = useState('')
  const [reelBusyIndex, setReelBusyIndex] = useState<number | null>(null)
  const [reelUploadProgress, setReelUploadProgress] = useState(0)
  const [previousReels, setPreviousReels] = useState<Record<number, PublicOrderReel>>(readReelHistory)
  const [replacementProduct, setReplacementProduct] = useState<SellableProduct | null>(null)
  const [replacementFeaturedId, setReplacementFeaturedId] = useState('')
  const [replacementDialogOpen, setReplacementDialogOpen] = useState(false)
  const [replacementSearch, setReplacementSearch] = useState('')
  const bannerInputRef = useRef<HTMLInputElement>(null)
  const reelFileInputRefs = useRef<Array<HTMLInputElement | null>>([])
  const [bannerProcessing, setBannerProcessing] = useState(false)

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

  const persistReelSelection = async (slot: number, nextReel: PublicOrderReel) => {
    const nextReels = [...pageSettings.contactReels]
    const previousReel = nextReels[slot]
    const previousHistory = previousReels[slot]
    nextReels[slot] = nextReel
    await updatePublicOrderReels(nextReels)
    setPageSettings(current => ({ ...current, contactReels: nextReels }))
    const nextHistory = { ...previousReels, [slot]: previousReel }
    setPreviousReels(nextHistory)
    saveReelHistory(nextHistory)
    if (previousHistory && (previousHistory.videoPath || previousHistory.posterPath)) {
      await removePublicOrderReelFiles([previousHistory.videoPath, previousHistory.posterPath].filter((path): path is string => Boolean(path))).catch(() => undefined)
    }
    setNotice('Video actualizado en la página de pedir.')
    window.setTimeout(() => setNotice(''), 2800)
  }

  const restorePreviousReel = async (slot: number) => {
    const previousReel = previousReels[slot]
    const currentReel = pageSettings.contactReels[slot]
    if (!previousReel || !currentReel || reelBusyIndex !== null) return
    setReelBusyIndex(slot)
    setReelError('')
    try {
      const nextReels = [...pageSettings.contactReels]
      nextReels[slot] = previousReel
      await updatePublicOrderReels(nextReels)
      setPageSettings(current => ({ ...current, contactReels: nextReels }))
      const nextHistory = { ...previousReels, [slot]: currentReel }
      setPreviousReels(nextHistory)
      saveReelHistory(nextHistory)
      setNotice('Video anterior restaurado. Puedes volver a alternar entre ambos videos.')
      window.setTimeout(() => setNotice(''), 3200)
    } catch (cause) {
      setReelError(cause instanceof Error ? cause.message : 'No se pudo restaurar el video anterior')
    } finally { setReelBusyIndex(null) }
  }

  const replaceReelWithFile = async (slot: number, file?: File) => {
    if (!file) return
    setReelBusyIndex(slot)
    setReelUploadProgress(0)
    setReelError('')
    let uploaded: UploadedPublicReel | null = null
    try {
      uploaded = await uploadPublicOrderReel(slot + 1, file, setReelUploadProgress)
      await persistReelSelection(slot, uploaded)
    } catch (cause) {
      if (uploaded) {
        await removePublicOrderReelFiles([uploaded.videoPath, uploaded.posterPath]).catch(() => undefined)
      }
      setReelError(cause instanceof Error ? cause.message : 'No se pudo guardar el video')
    } finally {
      setReelBusyIndex(null)
      setReelUploadProgress(0)
    }
  }

  const selectProjectReel = async (slot: number, src: string) => {
    const projectReel = DEFAULT_PUBLIC_ORDER_REELS.find(reel => reel.src === src)
    if (!projectReel || reelBusyIndex !== null) return
    setReelBusyIndex(slot)
    setReelError('')
    try { await persistReelSelection(slot, projectReel) }
    catch (cause) { setReelError(cause instanceof Error ? cause.message : 'No se pudo cambiar el video') }
    finally { setReelBusyIndex(null) }
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
      <div className="pedir-heading-copy">{section !== 'home' && <button type="button" className="pedir-back-button" onClick={() => setSection('home')}><ArrowLeft size={16} /> Volver a opciones</button>}<span className="pedir-admin-kicker">TIENDA PARA CLIENTES</span><h1 className="page-title"><ShoppingBag size={22} /> {section === 'cover' ? 'Portada de la tienda' : section === 'contact' ? 'Información del local' : section === 'videos' ? 'Videos de Instagram' : section === 'products' ? 'Productos de la tienda' : 'Página de pedir'}</h1><p className="page-subtitle">{section === 'cover' ? 'Cambia la imagen y los textos que reciben a tus clientes.' : section === 'contact' ? 'Actualiza cómo te encuentran y cuándo pueden visitarte.' : section === 'videos' ? 'Elige un video que ya está en Full China o sube uno desde tu computadora.' : section === 'products' ? 'Elige qué productos aparecen, cómo se destacan y en qué orden.' : '¿Qué quieres cambiar hoy? Elige una tarea y te llevamos al lugar indicado.'}</p></div>
      <a className="pedir-preview-link" href="/pedir" target="_blank" rel="noreferrer"><ExternalLink size={16} /> Ver página pública</a>
    </header>
    {section === 'home' && <section className="pedir-welcome" aria-labelledby="pedir-welcome-title"><div className="pedir-welcome-intro"><span className="pedir-admin-kicker">ASISTENTE DE TIENDA</span><h2 id="pedir-welcome-title">Hola, ¿qué quieres actualizar hoy?</h2><p>Escoge una opción. Te mostraremos solo lo que necesitas para hacer ese cambio.</p></div><div className="pedir-task-grid"><button type="button" className="pedir-task-card" onClick={() => setSection('cover')}><span className="pedir-task-icon"><Image size={20} /></span><strong>La portada</strong><small>Cambiar el banner, la foto o los textos de bienvenida.</small><span className="pedir-task-action">Editar portada <ChevronRight size={15} /></span></button><button type="button" className="pedir-task-card" onClick={() => setSection('contact')}><span className="pedir-task-icon"><MapPin size={20} /></span><strong>Información del local</strong><small>Teléfono, WhatsApp, dirección, horario y redes sociales.</small><span className="pedir-task-action">Editar contacto <ChevronRight size={15} /></span></button><button type="button" className="pedir-task-card" onClick={() => setSection('videos')}><span className="pedir-task-icon"><Video size={20} /></span><strong>Videos de Instagram</strong><small>Escoger uno de los videos actuales o reemplazarlo por un archivo MP4.</small><span className="pedir-task-action">Cambiar videos <ChevronRight size={15} /></span></button><button type="button" className="pedir-task-card" onClick={() => setSection('products')}><span className="pedir-task-icon"><ShoppingBag size={20} /></span><strong>Los productos que se muestran</strong><small>Buscar por categoría, ocultar productos, poner etiquetas o elegir destacados.</small><span className="pedir-task-action">Organizar productos <ChevronRight size={15} /></span></button><Link className="pedir-task-card" to="/menu"><span className="pedir-task-icon"><SlidersHorizontal size={20} /></span><strong>El nombre, la foto o los extras de un producto</strong><small>Abre Menú para editar los datos del producto y las opciones que puede agregar el cliente.</small><span className="pedir-task-action">Ir a Menú <ChevronRight size={15} /></span></Link></div><p className="pedir-welcome-footnote"><PackageSearch size={15} /> Los cambios de la portada, contacto, videos y visibilidad se reflejan en la página pública al guardarlos.</p></section>}
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
    {section === 'videos' && <section className="pedir-reels-section" aria-label="Administrar videos de Instagram">
      <div className="pedir-reels-intro"><div><span className="pedir-admin-kicker">VIDEOS DE INSTAGRAM</span><h2>Elige qué videos aparecen en la tienda</h2><p>Cada espacio corresponde a un video de Instagram. Puedes escoger uno existente o reemplazarlo por un MP4 propio; el cambio se publica al guardarlo.</p></div><div className="pedir-reels-limit"><Video size={17} /><span>MP4 · máximo 25 MB por video</span></div></div>
      <section className="pedir-reels-public-preview" aria-label="Vista previa de los videos en la página pública">
        <div className="pedir-preview-label">VISTA PREVIA · ASÍ SE VERÁ EN CONTACTO</div>
        <article className="pedir-contact-public-card pedir-contact-public-social">
          <header><span><Camera size={14} /> Desde Instagram</span><h3>El wok en movimiento</h3></header>
          <div className="pedir-contact-public-reels" aria-label="Videos de Full China">
            {pageSettings.contactReels.slice(0, 3).map((reel, index) => <div key={`reel-preview-${index}`}><img src={reel.poster} alt={`Vista del video ${index + 1}`} /><span>{String(index + 1).padStart(2, '0')}</span></div>)}
          </div>
          {(pageSettings.contactInstagramUrl || DEFAULT_PUBLIC_ORDER_PAGE_SETTINGS.contactInstagramUrl) && <a className="pedir-contact-public-cta is-instagram" href={pageSettings.contactInstagramUrl || DEFAULT_PUBLIC_ORDER_PAGE_SETTINGS.contactInstagramUrl} target="_blank" rel="noreferrer"><Camera size={16} /><span>Seguir en <strong>Instagram</strong></span><ChevronRight size={17} /></a>}
          {pageSettings.contactFacebookUrl && <a className="pedir-contact-public-cta is-facebook" href={pageSettings.contactFacebookUrl} target="_blank" rel="noreferrer"><MessageSquareText size={16} /><span>Visitar <strong>Facebook</strong></span><ChevronRight size={17} /></a>}
        </article>
      </section>
      {reelError && <div className="pedir-error" role="alert">{reelError}<button type="button" onClick={() => setReelError('')}>Cerrar</button></div>}
      <div className="pedir-reel-grid">{pageSettings.contactReels.map((reel, slot) => { const busy = reelBusyIndex === slot; const selectedProject = DEFAULT_PUBLIC_ORDER_REELS.find(item => item.src === reel.src); return <article className="pedir-reel-card" key={`reel-${slot + 1}`}>
        <div className="pedir-reel-video-wrap"><video src={reel.src} poster={reel.poster} controls playsInline preload="metadata" aria-label={`Vista previa del video ${slot + 1}`} /><span className="pedir-reel-number">Video {slot + 1}</span></div>
        <div className="pedir-reel-controls"><div className="pedir-reel-current"><strong>{reel.videoPath ? 'Video subido' : 'Video de Full China'}</strong><small>{reel.videoPath ? 'Guardado en el almacenamiento de Full China' : selectedProject ? `Video original ${DEFAULT_PUBLIC_ORDER_REELS.indexOf(selectedProject) + 1}` : 'Video seleccionado'}</small></div>
          <label className="pedir-reel-picker"><span>Elegir video existente</span><StyledSelect value={selectedProject?.src ?? ''} disabled={busy || reelBusyIndex !== null} onChange={event => void selectProjectReel(slot, event.target.value)}><option value="" disabled>Selecciona un video de la biblioteca</option>{DEFAULT_PUBLIC_ORDER_REELS.map((item, index) => <option key={item.src} value={item.src}>Video original {index + 1}</option>)}</StyledSelect></label>
          <input ref={node => { reelFileInputRefs.current[slot] = node }} className="pedir-reel-file-input" type="file" accept="video/mp4,.mp4" onChange={event => { void replaceReelWithFile(slot, event.target.files?.[0]); event.currentTarget.value = '' }} />
          <button type="button" className="pedir-reel-upload-button" onClick={() => reelFileInputRefs.current[slot]?.click()} disabled={busy || reelBusyIndex !== null}><Upload size={16} />{busy ? 'Subiendo video…' : 'Cambiar video'}</button>
          {previousReels[slot] && <button type="button" className="pedir-reel-restore-button" onClick={() => void restorePreviousReel(slot)} disabled={reelBusyIndex !== null} title="Restaura el video que estaba en este espacio antes del último cambio"><img src={previousReels[slot].poster} alt="" /><span><strong>{busy ? 'Restaurando…' : 'Volver al video anterior'}</strong><small>{DEFAULT_PUBLIC_ORDER_REELS.some(item => item.src === previousReels[slot].src) ? `Video original ${DEFAULT_PUBLIC_ORDER_REELS.findIndex(item => item.src === previousReels[slot].src) + 1}` : 'Video que estaba activo antes'}</small></span><RotateCcw size={15} /></button>}
          {busy && <div className="pedir-reel-progress" role="status"><div><span>Subiendo y preparando miniatura</span><strong>{reelUploadProgress}%</strong></div><i><b style={{ width: `${reelUploadProgress}%` }} /></i></div>}
        </div>
      </article>})}</div>
      {settingsError && <div className="pedir-error" role="alert">{settingsError}<button type="button" onClick={() => void loadPageSettings()}>Reintentar</button></div>}
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
    {filtered.length > PRODUCTS_PER_PAGE && <nav className="pedir-pagination" aria-label="Paginación de productos"><button type="button" disabled={currentProductPage <= 1} onClick={() => { setProductPage(page => Math.max(1, page - 1)); document.querySelector('.pedir-product-list')?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }}><ChevronLeft size={16} /> Anterior</button><div>{Array.from({ length: pageCount }, (_, index) => index + 1).map(page => <button type="button" key={page} className={page === currentProductPage ? 'active' : ''} aria-current={page === currentProductPage ? 'page' : undefined} onClick={() => { setProductPage(page); document.querySelector('.pedir-product-list')?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }}>{page}</button>)}</div><button type="button" disabled={currentProductPage >= pageCount} onClick={() => { setProductPage(page => Math.min(pageCount, page + 1)); document.querySelector('.pedir-product-list')?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }}>Siguiente <ChevronRight size={16} /></button></nav>}
    </section>}
    {replacementDialogOpen && featuredToReplace && <div className="pedir-replace-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !savingId) { setReplacementProduct(null); setReplacementFeaturedId(''); setReplacementDialogOpen(false) } }}><section className="pedir-replace-modal" role="dialog" aria-modal="true" aria-labelledby="pedir-replace-title"><header className="pedir-replace-modal-head"><div><span className="pedir-admin-kicker">CAMBIAR PRODUCTO DESTACADO</span><h2 id="pedir-replace-title">¿Cuál sale y cuál entra?</h2><p>El nuevo ocupará el mismo lugar que el producto que elijas.</p></div><button type="button" className="pedir-replace-close" aria-label="Cerrar" disabled={Boolean(savingId)} onClick={() => { setReplacementProduct(null); setReplacementFeaturedId(''); setReplacementDialogOpen(false) }}><X size={19} /></button></header><div className="pedir-replace-comparison"><article className="pedir-replace-product is-out"><span className="pedir-replace-product-label">SALE · #{featuredToReplaceIndex + 1}</span><div className="pedir-replace-product-body"><div className="pedir-replace-product-image">{featuredToReplace.imageUrl ? <img src={featuredToReplace.imageUrl} alt="" /> : <span>{featuredToReplace.emoji || '🥡'}</span>}</div><div><strong>{featuredToReplace.name}</strong><small>{featuredToReplace.categories.map(item => categoryLabel(item)).join(' · ')}</small><b>{formatUsd(featuredToReplace.salePrice)}</b></div></div></article><div className="pedir-replace-swap-icon"><ArrowLeftRight size={21} /></div><article className={`pedir-replace-product is-in${replacementProduct ? '' : ' is-empty'}`}><span className="pedir-replace-product-label">ENTRA · NUEVO DESTACADO</span>{replacementProduct ? <div className="pedir-replace-product-body"><div className="pedir-replace-product-image">{replacementProduct.imageUrl ? <img src={replacementProduct.imageUrl} alt="" /> : <span>{replacementProduct.emoji || '🥡'}</span>}</div><div><strong>{replacementProduct.name}</strong><small>{replacementProduct.categories.map(item => categoryLabel(item)).join(' · ')}</small><b>{formatUsd(replacementProduct.salePrice)}</b></div></div> : <p>Selecciona el producto que quieres destacar.</p>}</article></div><div className="pedir-replace-choose"><div><h3>1. Elige cuál producto sale</h3><p>Toca uno de tus destacados actuales.</p></div><div className="pedir-replace-options">{carouselProductIds.map((id, index) => { const product = products.find(row => row.id === id); if (!product) return null; const isSelected = product.id === replacementFeaturedId; return <button type="button" key={id} className={`pedir-replace-option${isSelected ? ' selected' : ''}`} aria-pressed={isSelected} onClick={() => setReplacementFeaturedId(id)}><span className="pedir-replace-option-image">{product.imageUrl ? <img src={product.imageUrl} alt="" /> : <span>{product.emoji || '🥡'}</span>}</span><span className="pedir-replace-option-copy"><small>Destacado · #{index + 1}</small><strong>{product.name}</strong></span>{isSelected && <Check size={17} />}</button> })}</div></div><div className="pedir-replace-choose"><div><h3>2. Elige cuál producto entra</h3><p>Busca y selecciona el producto que lo reemplazará.</p></div><label className="pedir-replace-search"><Search size={16} /><input value={replacementSearch} onChange={event => setReplacementSearch(event.target.value)} placeholder="Buscar producto para destacar" />{replacementSearch && <button type="button" aria-label="Limpiar búsqueda" onClick={() => setReplacementSearch('')}><X size={15}/></button>}</label><div className="pedir-replace-options">{replacementCandidates.map(product => <button type="button" key={product.id} className={`pedir-replace-option${replacementProduct?.id === product.id ? ' selected' : ''}`} aria-pressed={replacementProduct?.id === product.id} onClick={() => setReplacementProduct(product)}><span className="pedir-replace-option-image">{product.imageUrl ? <img src={product.imageUrl} alt="" /> : <span>{product.emoji || '🥡'}</span>}</span><span className="pedir-replace-option-copy"><small>{product.categories.map(item => categoryLabel(item)).join(' · ')} · {formatUsd(product.salePrice)}</small><strong>{product.name}</strong></span>{replacementProduct?.id === product.id && <Check size={17} />}</button>)}{replacementCandidates.length === 0 && <p className="pedir-replace-no-results">{replacementSearch ? 'No encontramos productos con ese nombre.' : 'No hay otros productos disponibles para destacar.'}</p>}</div></div><footer className="pedir-replace-modal-footer"><button type="button" className="pedir-replace-cancel" onClick={() => { setReplacementProduct(null); setReplacementFeaturedId(''); setReplacementDialogOpen(false) }} disabled={Boolean(savingId)}>Cancelar</button><button type="button" className="pedir-replace-confirm" onClick={() => void confirmFeaturedReplacement()} disabled={!replacementFeaturedId || !replacementProduct || Boolean(savingId)}>{savingId ? 'Guardando…' : <><ArrowLeftRight size={16} /> Confirmar reemplazo</>}</button></footer></section></div>}
    {notice && <Toast type="success" message={notice} onClose={() => setNotice('')} />}
  </main>
}
