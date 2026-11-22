import { useRef, SyntheticEvent, useLayoutEffect, type RefObject } from 'react'
import { previewImageSource } from '../../lib/publicMenuFormat'
import { getImageWarmupRootMargin } from '../../lib/publicMenuRuntime'

interface UsePublicImagesArgs {
  pageRef: RefObject<HTMLElement | null>
}

export function usePublicImages({ pageRef }: UsePublicImagesArgs) {
  const imageWarmupObserverRef = useRef<IntersectionObserver | null>(null)
  const fullImageRequestsRef = useRef(new WeakMap<HTMLImageElement, string>())

  const revealDecodedImage = (image: HTMLImageElement) => {
    const source = image.currentSrc || image.src
    const reveal = () => {
      if ((image.currentSrc || image.src) !== source) return
      image.dataset.revealedSrc = source
      image.classList.add('public-image-ready')
    }
    if (typeof image.decode === 'function') void image.decode().then(reveal, reveal)
    else reveal()
  }

  const startFullImageUpgrade = (image: HTMLImageElement, fullSource: string) => {
    if (fullImageRequestsRef.current.get(image) === fullSource) return
    fullImageRequestsRef.current.set(image, fullSource)
    image.dataset.imageQuality = 'loading-full'

    const fullImage = new Image()
    fullImage.decoding = 'async'
    fullImage.src = fullSource
    fullImage.onload = () => {
      const decoded = typeof fullImage.decode === 'function' ? fullImage.decode() : Promise.resolve()
      void decoded.catch(() => undefined).then(() => {
        if (image.dataset.fullSrc !== fullSource) return
        image.dataset.imageQuality = 'full'
        image.src = fullSource
      })
    }
    fullImage.onerror = () => {
      if (image.dataset.fullSrc !== fullSource) return
      image.dataset.imageQuality = 'preview'
      fullImageRequestsRef.current.delete(image)
    }
  }

  const prepareImage = (image: HTMLImageElement) => {
    const domSource = image.getAttribute('src') || ''
    const trackedSource = image.dataset.fullSrc

    if (trackedSource && ['preview', 'loading-full'].includes(image.dataset.imageQuality || '') && domSource === image.dataset.previewSrc) {
      if (image.loading === 'eager') startFullImageUpgrade(image, trackedSource)
      return
    }
    if (trackedSource && image.dataset.imageQuality === 'full' && domSource === trackedSource) return

    const fullSource = domSource
    const previewSource = previewImageSource(fullSource)
    if (!previewSource || previewSource === fullSource) {
      image.dataset.fullSrc = fullSource
      image.dataset.imageQuality = 'full'
      if (image.complete && image.naturalWidth > 0) revealDecodedImage(image)
      return
    }

    image.dataset.fullSrc = fullSource
    image.dataset.previewSrc = previewSource
    image.dataset.imageQuality = 'preview'
    image.classList.remove('public-image-ready', 'public-image-error')
    image.src = previewSource
    if (image.loading === 'lazy' && imageWarmupObserverRef.current) imageWarmupObserverRef.current.observe(image)
    else startFullImageUpgrade(image, fullSource)
  }

  const handleImageLoad = (event: SyntheticEvent<HTMLElement>) => {
    const image = event.target
    if (image instanceof HTMLImageElement) revealDecodedImage(image)
  }

  const handleImageError = (event: SyntheticEvent<HTMLElement>) => {
    const image = event.target
    if (image instanceof HTMLImageElement) image.classList.add('public-image-error')
  }

  const prepareImagesIn = (root: ParentNode) => {
    const images: HTMLImageElement[] = []
    if (root instanceof HTMLImageElement) images.push(root)
    root.querySelectorAll('img').forEach(image => images.push(image))
    images.forEach(image => {
      // El banner tiene su propia precarga/decodificación antes de cambiar
      // de producto. No debe entrar al swap global de preview: ese flujo
      // oculta el <img> al cambiar src y deja ver el fondo oscuro un instante.
      if (image.classList.contains('public-recommended-img')) return
      const source = image.currentSrc || image.src
      const decodedFullUpgrade = image.dataset.imageQuality === 'full'
        && image.dataset.fullSrc === image.getAttribute('src')
        && image.classList.contains('public-image-ready')
      if (!decodedFullUpgrade && image.dataset.revealedSrc !== source) image.classList.remove('public-image-ready', 'public-image-error')
      prepareImage(image)
    })
  }
  const prepareImagesInRef = useRef(prepareImagesIn)
  prepareImagesInRef.current = prepareImagesIn

  // Las imágenes se preparan al montarse y cuando React añade o cambia un
  // nodo. Antes este escaneo recorría todos los <img> después de cada render,
  // incluso al escribir en un formulario o cambiar una cantidad del carrito.
  useLayoutEffect(() => {
    const root = pageRef.current
    if (!root) return
    const warmupObserver = typeof IntersectionObserver === 'undefined'
      ? null
      : new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (!entry.isIntersecting || !(entry.target instanceof HTMLImageElement)) return
          const image = entry.target
          warmupObserver?.unobserve(image)
          // Dos pantallas de anticipación dejan que la foto esté lista antes
          // de que el usuario llegue a su categoría, sin pedir todo el menú a la vez.
          image.loading = 'eager'
          const fullSource = image.dataset.fullSrc
          if (fullSource) startFullImageUpgrade(image, fullSource)
        })
      }, { rootMargin: getImageWarmupRootMargin() })
    imageWarmupObserverRef.current = warmupObserver
    prepareImagesInRef.current(root)
    const observer = new MutationObserver(records => {
      records.forEach(record => {
        if (record.type === 'attributes' && record.target instanceof HTMLImageElement) {
          prepareImagesInRef.current(record.target)
          return
        }
        record.addedNodes.forEach(node => {
          if (node instanceof HTMLElement) prepareImagesInRef.current(node)
        })
      })
    })
    observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['src'] })
    return () => {
      observer.disconnect()
      warmupObserver?.disconnect()
      if (imageWarmupObserverRef.current === warmupObserver) imageWarmupObserverRef.current = null
    }
  }, [pageRef])
  return { handleImageLoad, handleImageError }
}
