import { useEffect, useState } from 'react'
import { LoaderCircle, ReceiptText } from 'lucide-react'
import { getCustomerOrderForRepeat, getPublicCatalog, type CustomerRepeatOrder } from '../lib/publicOrders'

function productImage(url: string) {
  const match = url.match(/^\/productos\/([^/?#]+)\.(?:png|jpe?g|webp)([?#].*)?$/i)
  return match ? `/optimized/productos/${match[1]}.webp${match[2] || ''}` : url
}

export default function CustomerOrderItems({ orderId, orderNumber }: { orderId: string; orderNumber: string }) {
  const [order, setOrder] = useState<CustomerRepeatOrder | null>(null)
  const [images, setImages] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [unavailable, setUnavailable] = useState(false)

  useEffect(() => {
    let active = true
    setLoading(true)
    setUnavailable(false)
    void Promise.all([getCustomerOrderForRepeat(orderId), getPublicCatalog().catch(() => [])])
      .then(([result, catalog]) => {
        if (!active) return
        setOrder(result)
        setImages(Object.fromEntries(catalog.filter(product => product.imageUrl).map(product => [product.id, productImage(product.imageUrl!)])))
      })
      .catch(() => { if (active) setUnavailable(true) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [orderId])

  if (loading) return <div className="customer-order-items-status" aria-live="polite"><LoaderCircle size={18} className="customer-repeat-order-spinner" />Cargando los productos…</div>
  if (unavailable || !order) return <div className="customer-order-items-status"><ReceiptText size={24} /><strong>Comanda {orderNumber}</strong><span>No pudimos mostrar el detalle de este pedido.</span></div>
  return <div className="customer-order-items-list">
    {order.items.map((item, index) => <article key={`${item.productId}-${index}`}>
      {images[item.productId] ? <img src={images[item.productId]} alt="" loading="lazy" decoding="async" onError={event => { event.currentTarget.hidden = true }} /> : <span className="customer-order-item-placeholder"><ReceiptText size={19} /></span>}
      <div><strong>{item.productName}</strong><small>{item.quantity} × {item.productName}{item.notes ? ` · ${item.notes}` : ''}</small></div>
    </article>)}
  </div>
}
