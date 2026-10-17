import type { CSSProperties } from 'react'
import { Gift } from 'lucide-react'

const artwork = '/optimized/customer-profile/'
const chapters = [
  { title: 'Tu próxima historia empieza aquí', message: 'Cada visita te acerca a algo delicioso.', image: '/optimized/customer-profile/reward-gift.webp', color: '#e8b743', theme: 'welcome' },
  { title: '¡El primer paso sabe bien!', message: 'Tu primer sello ya es parte de la historia.', image: `${artwork}reward-rice.webp`, color: '#f7aa56', theme: 'food' },
  { title: 'Ya tienes una buena excusa', message: 'Volver tiene su recompensa.', image: `${artwork}reward-noodles.webp`, color: '#ed9861', theme: 'food' },
  { title: '¡Esto se está poniendo bueno!', message: 'Tu tarjeta empieza a llenarse de sabor.', image: `${artwork}reward-rice.webp`, color: '#ee7950', theme: 'food' },
  { title: 'Cada vez más cerca', message: 'Tus visitas están dando sus frutos.', image: `${artwork}reward-noodles.webp`, color: '#f19b4d', theme: 'food' },
  { title: '¡Vas por la mitad!', message: 'La otra mitad promete saber aún mejor.', image: '/optimized/customer-profile/reward-gift.webp', color: '#ffd369', theme: 'milestone' },
  { title: 'Ya se siente la recompensa', message: 'Sigue sumando momentos con Full China.', image: `${artwork}reward-rice.webp`, color: '#f3b34d', theme: 'food' },
  { title: 'Entraste en la recta final', message: 'Tu próximo premio está tomando forma.', image: `${artwork}reward-noodles.webp`, color: '#ffc15a', theme: 'final' },
  { title: '¡Casi lo logras!', message: 'Ya falta muy poco para tu próxima recompensa.', image: `${artwork}reward-rice.webp`, color: '#ffd66c', theme: 'final' },
  { title: '¡A una visita del premio!', message: 'Tu siguiente sello completa esta historia.', image: '/optimized/customer-profile/reward-gift.webp', color: '#ffe18c', theme: 'final' },
]

type Props = { stamps: number; threshold: number; rewards: number; description: string }

export default function CustomerRewardJourney({ stamps, threshold, rewards, description }: Props) {
  const chapterIndex = Math.min(9, Math.floor(stamps / threshold * 10))
  const remaining = threshold - stamps
  const chapter = chapters[chapterIndex]
  const available = rewards > 0
  const title = available ? '¡Tu recompensa te espera!' : remaining === 1 ? '¡A una visita del premio!' : chapter.title
  const image = available ? '/optimized/customer-profile/reward-gift.webp' : chapter.image
  return <section className={`customer-reward-journey journey-${available ? 'ready' : chapter.theme}`} style={{ '--journey-accent': chapter.color } as CSSProperties} aria-label="Tu próxima recompensa">
    <div className="customer-journey-scene" key={`${stamps}-${available}`}>
      <div className="customer-journey-copy">
        <small>{available ? 'RECOMPENSA DISPONIBLE' : 'TU CAMINO AL PREMIO'}</small>
        <h3>{title}</h3>
        <p>{available ? `${rewards} ${rewards === 1 ? 'premio disponible' : 'premios disponibles'} para ti.` : chapter.message}</p>
        {!available && <p className="customer-journey-remaining">Te {remaining === 1 ? 'falta' : 'faltan'} <b>{remaining} {remaining === 1 ? 'visita' : 'visitas'}</b> para desbloquearlo.</p>}
      </div>
      <img src={image} className={`customer-journey-art${image.endsWith('reward-gift.webp') ? ' customer-journey-gift' : ''}`} alt="" loading="lazy" decoding="async" />
    </div>
    <div className="customer-journey-prize"><Gift size={17} aria-hidden="true" /><span>{description}</span></div>
  </section>
}
