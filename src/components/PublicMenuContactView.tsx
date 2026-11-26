import type { Dispatch, MouseEvent as ReactMouseEvent, SetStateAction } from 'react'
import { Banknote, Bitcoin, ChevronRight, CreditCard, Landmark, MapPin, MessageSquareText, Navigation, Pause, Play, Smartphone, Volume2, VolumeX } from 'lucide-react'
import { TruckScene } from '../pedir-v2/TruckScene'
import { LoyaltyCard } from '../pedir-v2/LoyaltyCard'
import { Fit } from '../pedir-v2/ui'
import { STORE_MAP_EMBED_URL, type PublicOrderPageSettings, type PublicOrderReel } from '../lib/publicOrderPageSettings'

type PublicMenuContactViewProps = {
  variant: 'mobile' | 'desktop'
  pageSettings: Pick<PublicOrderPageSettings, 'contactDays' | 'contactAddress' | 'contactDirectionsUrl'>
  formattedOpenTime: string
  formattedCloseTime: string
  publicWhatsappPhone: string
  publicInstagramUrl: string
  publicFacebookUrl: string
  mapPreviewUrl: string
  currentInstagramReels: PublicOrderReel[]
  instagramReels: Array<{ reel: PublicOrderReel; position: number }>
  instagramActiveIndex: number
  instagramAudioEnabled: boolean
  instagramPlaybackStarted: boolean
  instagramDesktopPlaybackConfirmed: boolean
  instagramPaused: boolean
  toggleInstagramAudio: (event: ReactMouseEvent<HTMLButtonElement>) => void
  toggleInstagramPlayback: (event: ReactMouseEvent<HTMLElement>) => void
  startInstagramReelWithSound: (event: ReactMouseEvent<HTMLButtonElement>) => void
  handleInstagramProfileClick: (event: ReactMouseEvent<HTMLAnchorElement>) => void
  setInstagramPaused: Dispatch<SetStateAction<boolean>>
  setInstagramActiveIndex: Dispatch<SetStateAction<number>>
  setInstagramDesktopPlaybackConfirmed: Dispatch<SetStateAction<boolean>>
  openCustomerProfile: () => void
}

export function PublicMenuContactView({
  variant,
  pageSettings,
  formattedOpenTime,
  formattedCloseTime,
  publicWhatsappPhone,
  publicInstagramUrl,
  publicFacebookUrl,
  mapPreviewUrl,
  currentInstagramReels,
  instagramReels,
  instagramActiveIndex,
  instagramAudioEnabled,
  instagramPlaybackStarted,
  instagramDesktopPlaybackConfirmed,
  instagramPaused,
  toggleInstagramAudio,
  toggleInstagramPlayback,
  startInstagramReelWithSound,
  handleInstagramProfileClick,
  setInstagramPaused,
  setInstagramActiveIndex,
  setInstagramDesktopPlaybackConfirmed,
  openCustomerProfile,
}: PublicMenuContactViewProps) {
  const mobile = variant === 'mobile'

  const content = <section className="public-contact-view public-contact-page pd-contact">
    <header className="pd-contact-top">
      <TruckScene />
      <div className="pd-contact-hello">
        <h1><Fit>Aquí te <span>esperamos</span></Fit></h1>
        <p>{pageSettings.contactAddress}</p>
        <nav className="pd-contact-actions" aria-label="Formas de contacto">
          {publicWhatsappPhone && <a className="is-whatsapp" href={'https://wa.me/' + publicWhatsappPhone} target="_blank" rel="noopener noreferrer"><i><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 11.5a8.5 8.5 0 0 1-12.6 7.4L3 21l2.1-5.4A8.5 8.5 0 1 1 21 11.5Z" /><path d="M8.5 9.5c0 3.5 2.500 6 6 6l1-1.500-2-1.200-1 .8c-1-.4-1.700-1.100-2.100-2.100l.8-1-1.200-2z" /></svg></i><span>WhatsApp</span></a>}
          <a className="is-map" href={pageSettings.contactDirectionsUrl} target="_blank" rel="noopener noreferrer"><i><Navigation size={25} aria-hidden="true" /></i><span>Cómo llegar</span></a>
          <a className="is-instagram" href={publicInstagramUrl} onClick={handleInstagramProfileClick}><i><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect width="18" height="18" x="3" y="3" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="0.75" fill="currentColor" stroke="none" /></svg></i><span>Instagram</span></a>
          {publicFacebookUrl && <a className="is-facebook" href={publicFacebookUrl} target="_blank" rel="noopener noreferrer"><i><MessageSquareText size={25} aria-hidden="true" /></i><span>Facebook</span></a>}
        </nav>
      </div>
    </header>

    <div className="pd-contact-body">
      <section className="pd-board" aria-label="Horario y formas de pago">
        <div className="pd-board-hours">
          <h2>Horario</h2>
          <p>{pageSettings.contactDays}</p>
          <strong><span>{formattedOpenTime}</span><i aria-hidden="true" /><span>{formattedCloseTime}</span></strong>
        </div>
        <div className="pd-board-pay">
          <h2>Se paga con</h2>
          <ul>
            <li><Banknote size={20} aria-hidden="true" />Efectivo USD</li>
            <li><Banknote size={20} aria-hidden="true" />Efectivo Bs.</li>
            <li><Smartphone size={20} aria-hidden="true" />Pago móvil</li>
            <li><CreditCard size={20} aria-hidden="true" />Punto de venta</li>
            <li><Bitcoin size={20} aria-hidden="true" />Binance</li>
            <li><Landmark size={20} aria-hidden="true" />Transferencia Bs.</li>
          </ul>
          <p className="pd-board-mixed">¿Quieres combinar dos? También vale el pago mixto.</p>
        </div>
      </section>

      <section className={'pd-place public-contact-location-stage' + (mapPreviewUrl === STORE_MAP_EMBED_URL ? ' is-store-map' : '')} aria-label="Ubicación">
        <iframe
          title="Ubicación de Full China en Google Maps"
          src={mapPreviewUrl}
          loading="eager"
          referrerPolicy="no-referrer-when-downgrade"
          allowFullScreen
        />
        {mapPreviewUrl === STORE_MAP_EMBED_URL && <span className="public-contact-brand-pin" aria-hidden="true"><img src="/optimized/root/logo.webp" alt="" /></span>}
        <a className="pd-place-go" href={pageSettings.contactDirectionsUrl} target="_blank" rel="noopener noreferrer"><MapPin size={18} aria-hidden="true" /><span>Abrir en el mapa</span><ChevronRight size={17} aria-hidden="true" /></a>
      </section>

      <section className="pd-cinema public-contact-instagram-studio" aria-label="Videos de Instagram">
        <div className="pd-cinema-head">
          <h2><Fit>El wok en movimiento</Fit></h2>
          <button type="button" className="public-instagram-audio-toggle" onClick={toggleInstagramAudio} title={instagramAudioEnabled ? 'Silenciar videos' : 'Activar sonido de los videos'} aria-label={instagramAudioEnabled ? 'Silenciar videos' : 'Activar sonido de los videos'} aria-pressed={instagramAudioEnabled}>
            {instagramAudioEnabled ? <Volume2 size={17} /> : <VolumeX size={17} />}
          </button>
        </div>
        <div className="pd-cinema-stage">
        {mobile ? <div className="public-instagram-reel-stage public-instagram-mobile-stage" aria-label="Reel destacado de Full China">
          {instagramReels.map(({ reel, position }) => {
            const reelIndex = currentInstagramReels.indexOf(reel)
            const isActive = reelIndex === instagramActiveIndex
            return (
              <div
                key={reel.src}
                className={'public-instagram-reel is-reel-' + (position + 1)}
                data-active={isActive ? 'true' : undefined}
                onClick={!isActive ? () => { setInstagramPaused(false); setInstagramActiveIndex(reelIndex) } : undefined}
              >
                <video autoPlay={isActive && instagramPlaybackStarted && !instagramPaused} muted={!instagramAudioEnabled} playsInline preload="none" disableRemotePlayback controlsList="noremoteplayback" poster={reel.poster} data-active={isActive ? 'true' : undefined} onClick={isActive ? toggleInstagramPlayback : undefined} onTimeUpdate={event => {
                  if (!isActive) return
                  const video = event.currentTarget
                  const progress = video.duration > 0 ? video.currentTime / video.duration : 0
                  video.closest<HTMLElement>('.public-instagram-reel')?.style.setProperty('--reel-progress', String(progress))
                }} onEnded={() => { if (isActive) { setInstagramPaused(false); setInstagramActiveIndex(current => (current + 1) % currentInstagramReels.length) } }}>
                  <source data-src={reel.src} type="video/mp4" />
                </video>
                <span className="public-instagram-reel-shade" aria-hidden="true" />
                {isActive && <span className="public-instagram-mobile-frame-label" aria-hidden="true"><i /> EN ESCENA <b>{String(reelIndex + 1).padStart(2, '0')} / 06</b></span>}
                <span className="public-instagram-reel-progress" aria-hidden="true" />
                {isActive && !instagramPlaybackStarted && <button type="button" className="public-instagram-start-prompt" onClick={toggleInstagramPlayback} aria-label="Toca para ver el reel"><Play size={14} fill="currentColor" /><span>Toca para ver</span></button>}
                {isActive && instagramPlaybackStarted && <button type="button" className="public-instagram-play-toggle" aria-label={instagramPaused ? 'Reanudar video' : 'Pausar video'} title={instagramPaused ? 'Reanudar video' : 'Pausar video'} onClick={toggleInstagramPlayback}>{instagramPaused ? <Play size={15} fill="currentColor" /> : <Pause size={15} />}</button>}
              </div>
            )
          })}
        </div> : <div className="public-instagram-reel-stage public-instagram-desktop-stage" aria-label="Reel destacado de Full China">
          {(() => {
            const reel = currentInstagramReels[instagramActiveIndex % currentInstagramReels.length]
            return (
              <div
                key={reel.src}
                className="public-instagram-reel public-instagram-desktop-reel"
                data-active="true"
              >
                <video autoPlay={instagramDesktopPlaybackConfirmed && !instagramPaused} muted={!instagramAudioEnabled} playsInline preload="none" disableRemotePlayback controlsList="noremoteplayback" poster={reel.poster} data-active="true" onPlay={event => { event.currentTarget.closest('.public-instagram-desktop-reel')?.setAttribute('data-video-playing', 'true'); setInstagramDesktopPlaybackConfirmed(true) }} onPause={event => event.currentTarget.closest('.public-instagram-desktop-reel')?.removeAttribute('data-video-playing')} onClick={toggleInstagramPlayback} onTimeUpdate={event => {
                  const video = event.currentTarget
                  const progress = video.duration > 0 ? video.currentTime / video.duration : 0
                  video.closest<HTMLElement>('.public-instagram-reel')?.style.setProperty('--reel-progress', String(progress))
                }} onEnded={() => { setInstagramPaused(false); setInstagramActiveIndex(current => (current + 1) % currentInstagramReels.length) }}>
                  <source data-src={reel.src} type="video/mp4" />
                </video>
                <span className="public-instagram-reel-shade" aria-hidden="true" />
                <span className="public-instagram-mobile-frame-label" aria-hidden="true"><i /> EN ESCENA <b>{String(instagramActiveIndex + 1).padStart(2, '0')} / {String(currentInstagramReels.length).padStart(2, '0')}</b></span>
                <span className="public-instagram-reel-progress" aria-hidden="true" />
                <button type="button" className="public-instagram-play-toggle" aria-label="Pausar o reanudar video" title="Pausar o reanudar video" onClick={toggleInstagramPlayback}>{instagramPaused ? <Play size={15} fill="currentColor" /> : <Pause size={15} />}</button>
              </div>
            )
          })()}
          {!instagramAudioEnabled && (
            <button
              type="button"
              className="public-instagram-start-prompt public-instagram-desktop-start-prompt"
              onClick={startInstagramReelWithSound}
              aria-label="Toca para ver el reel"
              style={{
                position: 'absolute',
                zIndex: 100,
                top: '50%',
                left: '50%',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                minHeight: 42,
                padding: '0 16px',
                border: '1px solid rgba(255, 200, 61, .9)',
                borderRadius: 999,
                background: 'rgba(12, 12, 15, .94)',
                color: '#fff',
                font: '750 12px/1 Inter, system-ui, sans-serif',
                whiteSpace: 'nowrap',
                cursor: 'pointer',
                boxShadow: '0 6px 20px rgba(0, 0, 0, .65)',
                transform: 'translate(-50%, -50%)',
              }}
            >
              <Play size={14} fill="currentColor" style={{ color: '#ffc83d', fill: '#ffc83d' }} />
              <span>Toca para ver</span>
            </button>
          )}
        </div>}
        <div className="public-instagram-filmstrip" role="group" aria-label="Elegir un reel">
          {currentInstagramReels.map((reel, reelIndex) => (
            <button key={reel.src} type="button" className={reelIndex === instagramActiveIndex ? 'is-active' : ''} aria-label={'Reproducir reel ' + (reelIndex + 1)} aria-pressed={reelIndex === instagramActiveIndex} onClick={() => { setInstagramPaused(false); setInstagramActiveIndex(reelIndex) }}>
              <img src={reel.poster} alt="" loading="lazy" />
              <span>{String(reelIndex + 1).padStart(2, '0')}</span>
            </button>
          ))}
        </div>
        </div>
      </section>

      <section className="pd-club" aria-label="Programa de fidelidad">
        <div>
          <h2><Fit>Cada visita <em>te premia</em></Fit></h2>
          <p>Un sello por visita. Con 10, tu recompensa Full China.</p>
        </div>
        <div className="pd-club-card"><LoyaltyCard interactive /></div>
        <div className="pd-club-stamps" aria-hidden="true">{Array.from({ length: 10 }, (_, index) => <i key={index} className={index < 6 ? 'is-earned' : ''}><img src="/optimized/pedir-v2/wok-mark.webp" alt="" /></i>)}</div>
        <button type="button" onClick={openCustomerProfile}>Únete gratis <ChevronRight size={17} aria-hidden="true" /></button>
      </section>
    </div>
  </section>

  return mobile ? <div className="public-mobile-tab-content" key="contacto">{content}</div> : content
}
