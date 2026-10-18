import type { CSSProperties } from 'react'
import { Gift } from 'lucide-react'

const artwork = '/optimized/customer-profile/'
const chapters = [
  { title: 'Tu próxima historia empieza aquí', message: 'Cada visita te acerca a algo delicioso.', mobileMessage: 'Cada visita suma al premio.', image: '/optimized/customer-profile/reward-gift.webp', color: '#e8b743', theme: 'welcome' },
  { title: '¡El primer paso sabe bien!', message: 'Tu primer sello ya es parte de la historia.', mobileMessage: 'Tu primer sello ya cuenta.', image: `${artwork}reward-rice.webp`, color: '#f7aa56', theme: 'food' },
  { title: 'Ya tienes una buena excusa', message: 'Volver tiene su recompensa.', mobileMessage: 'Volver tiene premio.', image: `${artwork}reward-noodles.webp`, color: '#ed9861', theme: 'food' },
  { title: '¡Esto se está poniendo bueno!', message: 'Tu tarjeta empieza a llenarse de sabor.', mobileMessage: 'Tu tarjeta ya va tomando forma.', image: `${artwork}reward-rice.webp`, color: '#ee7950', theme: 'food' },
  { title: 'Cada vez más cerca', message: 'Tus visitas están dando sus frutos.', mobileMessage: 'Tus visitas dan frutos.', image: `${artwork}reward-noodles.webp`, color: '#f19b4d', theme: 'food' },
  { title: '¡Vas por la mitad!', message: 'La otra mitad promete saber aún mejor.', mobileMessage: 'La segunda mitad te espera.', image: '/optimized/customer-profile/reward-gift.webp', color: '#ffd369', theme: 'milestone' },
  { title: 'Ya se siente la recompensa', message: 'Sigue sumando momentos con Full China.', mobileMessage: 'Sigue sumando momentos.', image: `${artwork}reward-rice.webp`, color: '#f3b34d', theme: 'food' },
  { title: 'Entraste en la recta final', message: 'Tu próximo premio está tomando forma.', mobileMessage: 'El premio está más cerca.', image: `${artwork}reward-noodles.webp`, color: '#ffc15a', theme: 'final' },
  { title: '¡Casi lo logras!', message: 'Ya falta muy poco para tu próxima recompensa.', mobileMessage: 'Falta poco para el premio.', image: `${artwork}reward-rice.webp`, color: '#ffd66c', theme: 'final' },
  { title: '¡A una visita del premio!', message: 'Tu siguiente sello completa esta historia.', mobileMessage: 'Un sello más y lo tienes.', image: '/optimized/customer-profile/reward-gift.webp', color: '#ffe18c', theme: 'final' },
]

type Props = { stamps: number; threshold: number; rewards: number; description: string }

export default function CustomerRewardJourney({ stamps, threshold, rewards, description }: Props) {
  const chapterIndex = Math.min(9, Math.floor(stamps / threshold * 10))
  const remaining = threshold - stamps
  const chapter = chapters[chapterIndex]
  const available = rewards > 0
  const title = available ? '¡Tu recompensa te espera!' : remaining === 1 ? '¡A una visita del premio!' : chapter.title
  const image = available ? '/optimized/customer-profile/reward-gift.webp' : chapter.image
  const message = available ? `${rewards} ${rewards === 1 ? 'premio disponible' : 'premios disponibles'} para ti.` : remaining === 1 ? 'Tu siguiente sello completa esta historia.' : chapter.message
  const mobileMessage = available ? rewards === 1 ? 'Premio listo para ti.' : `${rewards} premios listos.` : remaining === 1 ? 'Un sello más y lo tienes.' : chapter.mobileMessage
  return <section className={`customer-reward-journey journey-${available ? 'ready' : chapter.theme}`} style={{ '--journey-accent': chapter.color } as CSSProperties} aria-label="Tu próxima recompensa">
    {available ? <div className="customer-reward-unlocked">
      <p className="customer-reward-unlocked-intro">{rewards === 1 ? 'Tu recompensa ya está disponible.' : `Tienes ${rewards} recompensas disponibles.`}</p>
      <div className="customer-reward-unlocked-ticket">
        <div className="customer-reward-unlocked-emblem"><Gift size={25} aria-hidden="true" /></div>
        <div className="customer-reward-unlocked-copy">
          <small>PREMIO DESBLOQUEADO</small>
          <strong>{description}</strong>
          <span>¡Completaste tu tarjeta!</span>
        </div>
        <div className="customer-reward-unlocked-seals">
          <small>FULL CHINA</small>
          <strong>{threshold}/{threshold}</strong>
          <span>SELLOS</span>
        </div>
      </div>
    </div> : <>
    <div className="customer-journey-scene" key={`${stamps}-${available}`}>
      <div className="customer-journey-copy">
        <small>{available ? 'RECOMPENSA DISPONIBLE' : 'TU CAMINO AL PREMIO'}</small>
        <h3>{title}</h3>
        <p className="customer-journey-message-desktop">{message}</p>
        <p className="customer-journey-message-mobile">{mobileMessage}</p>
        {!available && <><p className="customer-journey-remaining customer-journey-remaining-desktop">Te {remaining === 1 ? 'falta' : 'faltan'} <b>{remaining} {remaining === 1 ? 'visita' : 'visitas'}</b> para desbloquearlo.</p><p className="customer-journey-remaining customer-journey-remaining-mobile">{remaining === 1 ? '1 visita para el premio.' : `Faltan ${remaining} visitas.`}</p></>}
      </div>
      <img src={image} className={`customer-journey-art${image.endsWith('reward-gift.webp') ? ' customer-journey-gift' : ''}`} alt="" loading="lazy" decoding="async" />
    </div>
    <div className="customer-journey-prize"><Gift size={17} aria-hidden="true" /><span>{description}</span></div>
    </>}
  </section>
}
