/* Escena de la bienvenida: espera a que los platos estén listos para explotar,
   los mueve con el dedo, el mouse o el teléfono, y los hace saltar al tocarlos.
   No decide nada: abrir la carta sigue siendo el mismo botón. */
export function startWelcomeScene(root: HTMLElement | null) {
  const scene = root?.querySelector<HTMLElement>('[data-welcome-scene]')
  if (!root || !scene) return undefined

  let alive = true
  // Cada plato nace del centro de la caja, esté donde esté su lugar final.
  const place = () => {
    const width = scene.clientWidth
    const height = scene.clientHeight
    scene.querySelectorAll<HTMLElement>('.pd-boom-dish').forEach(dish => {
      const x = parseFloat(dish.style.getPropertyValue('--x')) / 100
      const y = parseFloat(dish.style.getPropertyValue('--y')) / 100
      dish.style.setProperty('--sx', `${(0.5 - x) * width}px`)
      dish.style.setProperty('--sy', `${(0.68 - y) * height}px`)
    })
  }
  place()
  const images = Array.from(scene.querySelectorAll('img'))
  const ready = Promise.all(images.map(image => image.decode().catch(() => undefined)))
  // Nunca esperar más de 1,6 s: en conexiones lentas los platos van llegando.
  void Promise.race([ready, new Promise(resolve => window.setTimeout(resolve, 1600))]).then(() => {
    if (alive) scene.classList.add('is-live')
  })

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return () => { alive = false }

  let frame = 0
  let targetX = 0
  let targetY = 0
  const paint = () => {
    frame = 0
    scene.style.setProperty('--px', targetX.toFixed(3))
    scene.style.setProperty('--py', targetY.toFixed(3))
  }
  const aim = (x: number, y: number) => {
    targetX = Math.max(-1, Math.min(1, x))
    targetY = Math.max(-1, Math.min(1, y))
    if (!frame) frame = requestAnimationFrame(paint)
  }
  const onPointer = (event: PointerEvent) => aim((event.clientX / window.innerWidth) * 2 - 1, (event.clientY / window.innerHeight) * 2 - 1)
  const onRelease = (event: PointerEvent) => { if (event.pointerType !== 'mouse') aim(0, 0) }
  const onTilt = (event: DeviceOrientationEvent) => {
    if (event.gamma == null || event.beta == null) return
    aim(event.gamma / 24, (event.beta - 48) / 28)
  }
  const onTap = (event: MouseEvent) => {
    const dish = (event.target as HTMLElement).closest<HTMLElement>('.pd-boom-dish')
    if (!dish || dish.classList.contains('is-flipped')) return
    dish.classList.add('is-flipped')
    navigator.vibrate?.(10)
    window.setTimeout(() => dish.classList.remove('is-flipped'), 820)
  }
  root.addEventListener('pointermove', onPointer, { passive: true })
  root.addEventListener('pointerup', onRelease)
  root.addEventListener('pointercancel', onRelease)
  scene.addEventListener('click', onTap)
  window.addEventListener('deviceorientation', onTilt, { passive: true })

  const stop = () => {
    alive = false
    cancelAnimationFrame(frame)
    root.removeEventListener('pointermove', onPointer)
    root.removeEventListener('pointerup', onRelease)
    root.removeEventListener('pointercancel', onRelease)
    scene.removeEventListener('click', onTap)
    window.removeEventListener('deviceorientation', onTilt)
  }
  // La bienvenida estática la retira el menú cuando está listo.
  window.addEventListener('fullchina:public-menu-ready', () => { if (!root.isConnected) stop() }, { once: true })
  return stop
}
