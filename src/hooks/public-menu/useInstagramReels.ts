import type { PublicOrderReel } from '../../lib/publicOrderPageSettings'
import { useMemo, useEffect, MouseEvent as ReactMouseEvent, type Dispatch, type SetStateAction } from 'react'
import { instagramReelOrder, startInstagramVideo } from '../../lib/publicMenuRuntime'
import { type DesktopTab } from '../../lib/publicMenuTypes'

interface UseInstagramReelsArgs {
  currentInstagramReels: PublicOrderReel[]
  currentTab: DesktopTab
  instagramActiveIndex: number
  instagramAudioEnabled: boolean
  instagramDesktopPlaybackConfirmed: boolean
  instagramPaused: boolean
  instagramPlaybackStarted: boolean
  setInstagramAudioEnabled: Dispatch<SetStateAction<boolean>>
  setInstagramDesktopPlaybackConfirmed: Dispatch<SetStateAction<boolean>>
  setInstagramPaused: Dispatch<SetStateAction<boolean>>
  setInstagramPlaybackStarted: Dispatch<SetStateAction<boolean>>
}

export function useInstagramReels({ currentInstagramReels, currentTab, instagramActiveIndex, instagramAudioEnabled, instagramDesktopPlaybackConfirmed, instagramPaused, instagramPlaybackStarted, setInstagramAudioEnabled, setInstagramDesktopPlaybackConfirmed, setInstagramPaused, setInstagramPlaybackStarted }: UseInstagramReelsArgs) {
  const instagramReels = useMemo(() => instagramReelOrder(currentInstagramReels, instagramActiveIndex), [currentInstagramReels, instagramActiveIndex])

  // Warm only the selected reel's metadata while Contact is visible. That
  // resolves duration/container headers without autoplaying or downloading
  // the other five videos; full buffering starts only after an explicit tap.
  useEffect(() => {
    if (currentTab !== 'contacto') return
    const timer = window.setTimeout(() => {
      const videos = Array.from(document.querySelectorAll<HTMLVideoElement>('.public-instagram-reel video'))
      videos.forEach(video => {
        const playbackStarted = video.closest('.public-instagram-desktop-reel') ? instagramDesktopPlaybackConfirmed : instagramPlaybackStarted
        video.muted = !instagramAudioEnabled
        if (video.dataset.active === 'true' && video.offsetParent !== null && playbackStarted && !instagramPaused) startInstagramVideo(video)
        else if (video.dataset.active === 'true' && video.offsetParent !== null) {
          video.pause()
          video.preload = 'metadata'
          if (!video.src) {
            const source = video.dataset.src || video.querySelector('source')?.dataset.src
            if (source) {
              video.src = source
              video.load()
            }
          }
        }
        else { video.pause(); video.currentTime = 0 }
      })
    }, 180)
    return () => window.clearTimeout(timer)
  }, [currentTab, instagramActiveIndex, instagramAudioEnabled, instagramPlaybackStarted, instagramDesktopPlaybackConfirmed, instagramPaused])

  const toggleInstagramAudio = (event: ReactMouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
    const activeVideo = Array.from(document.querySelectorAll<HTMLVideoElement>('.public-instagram-reel video'))
      .find(video => video.dataset.active === 'true' && video.offsetParent !== null)
    const isDesktopPlayback = Boolean(activeVideo?.closest('.public-instagram-desktop-reel'))
    const hasStarted = isDesktopPlayback ? instagramDesktopPlaybackConfirmed : instagramPlaybackStarted
    const startingPlayback = !hasStarted
    const nextEnabled = startingPlayback ? true : !instagramAudioEnabled
    setInstagramAudioEnabled(nextEnabled)
    if (startingPlayback) {
      if (!isDesktopPlayback) setInstagramPlaybackStarted(true)
      setInstagramPaused(false)
    }
    document.querySelectorAll<HTMLVideoElement>('.public-instagram-reel video').forEach(video => {
      const isActiveReel = video.dataset.active === 'true' && video.offsetParent !== null
      if (!isActiveReel) {
        video.muted = true
        return
      }

      // The reel source is lazy-loaded after entering the tab. If the user
      // taps the audio control before that timer fires, attach it here so
      // unmuting and play() still happen in the same user gesture.
      if (!video.src) {
        const source = video.dataset.src || video.querySelector('source')?.dataset.src
        if (source) {
          video.src = source
          video.load()
        }
      }
      video.muted = !nextEnabled
      if (!startingPlayback && instagramPaused) video.pause()
      else void video.play().catch(() => undefined)
    })
  }

  const toggleInstagramPlayback = (event: ReactMouseEvent<HTMLElement>) => {
    event.preventDefault()
    event.stopPropagation()
    const video = event.currentTarget.closest<HTMLElement>('.public-instagram-reel')?.querySelector('video')
    if (!video || video.dataset.active !== 'true') return
    const isDesktopPlayback = Boolean(video.closest('.public-instagram-desktop-reel'))
    const hasStarted = isDesktopPlayback ? instagramDesktopPlaybackConfirmed : instagramPlaybackStarted

    if (!video.paused) {
      video.pause()
      setInstagramPaused(true)
      return
    }

    if (!video.src) {
      const source = video.dataset.src || video.querySelector('source')?.dataset.src
      if (source) {
        video.src = source
      }
    }
    if (video.preload !== 'auto') {
      video.preload = 'auto'
      video.load()
    }
    const firstPlayback = !hasStarted || video.currentTime === 0
    if (firstPlayback) {
      video.muted = false
      setInstagramAudioEnabled(true)
      if (!isDesktopPlayback) setInstagramPlaybackStarted(true)
    } else {
      video.muted = !instagramAudioEnabled
    }
    setInstagramPaused(false)
    void video.play().catch(() => undefined)
  }

  const startInstagramReelWithSound = (event: ReactMouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
    // En escritorio el CTA «Toca para ver» es hermano del frame del reel,
    // no descendiente suyo. Búscalo desde el stage antes de intentar play().
    const stage = event.currentTarget.closest<HTMLElement>('.public-instagram-desktop-stage')
    const reel = event.currentTarget.closest<HTMLElement>('.public-instagram-desktop-reel')
      ?? stage?.querySelector<HTMLElement>('.public-instagram-desktop-reel')
    const video = reel?.querySelector('video')
    if (!video || video.dataset.active !== 'true') return

    if (!video.src) {
      const source = video.dataset.src || video.querySelector('source')?.dataset.src
      if (source) {
        video.src = source
        video.load()
      }
    }

    video.muted = false
    setInstagramAudioEnabled(true)
    setInstagramDesktopPlaybackConfirmed(true)
    setInstagramPaused(false)
    void video.play().catch(() => undefined)
  }
  return { instagramReels, toggleInstagramAudio, toggleInstagramPlayback, startInstagramReelWithSound }
}
