import type { CustomerOption } from './model'
import type { NavigateFunction } from 'react-router-dom'
import { MoneyWithBcv } from '../../components/MoneyWithBcv'
import { PrintChoiceDialog } from '../../components/PrintChoiceDialog'
import { type ThermalReceiptData } from '../../lib/thermalReceipt'
import { formatUsd } from '../../lib/money'
import { type OrderType } from '../../lib/orderDefaults'
import { type Product, type CartItem, type OrderResult } from '../../lib/dataService'
import { Printer, CheckCircle, CheckCircle2, Share2, ListOrdered, ChefHat, BellRing, Flame } from 'lucide-react'
import { formatProductTitle } from '../../lib/textFormat'
import { ORDER_TYPE_LABELS, FOOD_IMAGES, getProductImage } from '../caja/model'
import type { Dispatch, SetStateAction } from 'react'

export interface SaleSuccessScreenProps {
  embedded: boolean
  printPrompt: ThermalReceiptData | null
  resolvePrintPrompt: (shouldPrint: boolean) => Promise<void>
  currentOrder: OrderResult
  orderNo: string
  bcvRate: number | null
  paymentLabel: string
  setShowConfirmation: Dispatch<SetStateAction<boolean>>
  setCart: Dispatch<SetStateAction<CartItem[]>>
  setCurrentOrder: Dispatch<SetStateAction<OrderResult | null>>
  setCustomerName: Dispatch<SetStateAction<string>>
  setSelectedCustomer: Dispatch<SetStateAction<CustomerOption | null>>
  setDeliveryFee: Dispatch<SetStateAction<string>>
  onClose: (() => void) | undefined
  navigate: NavigateFunction
  handlePrintReceipt: () => void
  formattedTime: string
  formattedDate: string
  orderType: OrderType
  products: Product[]
}

export function SaleSuccessScreen({ embedded, printPrompt, resolvePrintPrompt, currentOrder, orderNo, bcvRate, paymentLabel, setShowConfirmation, setCart, setCurrentOrder, setCustomerName, setSelectedCustomer, setDeliveryFee, onClose, navigate, handlePrintReceipt, formattedTime, formattedDate, orderType, products }: SaleSuccessScreenProps) {
  return (
    <div className={`page animate-fade-in ${embedded ? 'caja-embedded' : ''}`}>

        {printPrompt && <PrintChoiceDialog documentName="el recibo de venta" onPrint={() => resolvePrintPrompt(true)} onSkip={() => resolvePrintPrompt(false)} />}

        <div className="caja-success-layout">

          {/* LEFT COLUMN: Success Hero Card + Timeline */}

          <div className="success-left-col">

            {/* Confetti Hero Card */}

            <div className="success-hero-card">

              <div className="confetti-dots-bg" />

              <div className="big-check-circle">

                <CheckCircle size={44} className="check-icon-glow" />

              </div>

              <h1 className="success-hero-title">{currentOrder.paymentMethod === 'personal_account' ? '¡Consumo registrado!' : '¡Pedido cobrado con éxito!'}</h1>

              <p className="success-hero-sub">{currentOrder.paymentMethod === 'personal_account' ? 'El consumo quedó asignado a la cuenta personal y el pedido fue enviado a cocina.' : 'Gracias por tu venta. El pedido ha sido enviado a cocina.'}</p>



              {/* 3 Metrics Row */}

              <div className="success-metrics-row">

                <div className="metric-box">

                  <span className="metric-box-label">Número de pedido</span>

                  <span className="metric-box-val text-red">{orderNo}</span>

                </div>

                <div className="metric-box">

                  <span className="metric-box-label">Total</span>

                  <MoneyWithBcv usd={currentOrder.total} rate={currentOrder.bcvRate || bcvRate} className="metric-box-val" align="center" />

                </div>

                <div className="metric-box">

                  <span className="metric-box-label">Método de pago</span>

                  <span className="metric-box-val font-bold">{paymentLabel}</span>

                </div>

              </div>



              {/* Status Badges */}

              <div className="success-status-badges-row">

                <span className="badge-status green"><CheckCircle2 size={14} className="text-green" /> Pagado</span>

                <span className="badge-status gold"><ChefHat size={14} /> Enviado a cocina</span>

              </div>

            </div>



            {/* Action Buttons Bar */}

            <div className="success-actions-bar mt-4">

              <button

                className="btn-success-primary"

                onClick={() => { setShowConfirmation(false); setCart([]); setCurrentOrder(null); setCustomerName(''); setSelectedCustomer(null); setDeliveryFee('') }}

              >

                <span>+</span> Nueva venta

              </button>

              <button className="btn-success-secondary" onClick={() => embedded ? onClose?.() : navigate('/comandas')}>

                <ListOrdered size={16} /> Ver comanda

              </button>

              <button className="btn-success-secondary" onClick={handlePrintReceipt}>

                <Printer size={16} /> Imprimir recibo

              </button>

              <button className="btn-success-secondary" onClick={async () => {

                const text = `Pedido #${orderNo} · Total ${currentOrder ? formatUsd(currentOrder.total) : ''}`

                if (navigator.share) await navigator.share({ title: 'Comprobante Full China', text })

                else if (navigator.clipboard) await navigator.clipboard.writeText(text)

              }}>

                <Share2 size={16} /> Compartir comprobante

              </button>

            </div>



            {/* Timeline Card */}

            <div className="activity-timeline-card mt-4">

              <h3 className="timeline-card-title">Actividad del pedido</h3>



              <div className="timeline-steps-wrap">

                <div className="timeline-line-bg" />



                <div className="timeline-step active">

                  <div className="step-icon-circle">

                    <CheckCircle size={16} />

                  </div>

                  <div className="step-info">

                    <span className="step-title">Pago confirmado</span>

                    <span className="step-time">{formattedTime}</span>

                    <span className="step-desc">El pago ha sido procesado correctamente.</span>

                  </div>

                </div>



                <div className="timeline-step active">

                  <div className="step-icon-circle">

                    <ChefHat size={16} />

                  </div>

                  <div className="step-info">

                    <span className="step-title">Comanda enviada</span>

                    <span className="step-time">{formattedTime}</span>

                    <span className="step-desc">La comanda ha sido enviada a cocina.</span>

                  </div>

                </div>



                <div className="timeline-step active">

                  <div className="step-icon-circle">

                    <BellRing size={16} />

                  </div>

                  <div className="step-info">

                    <span className="step-title">Cocina notificada</span>

                    <span className="step-time">{formattedTime}</span>

                    <span className="step-desc">El equipo de cocina ha sido notificado del pedido.</span>

                  </div>

                </div>

              </div>

            </div>

          </div>



          {/* RIGHT COLUMN: Ticket Receipt Card */}

          <div className="success-right-col">

            <div className="ticket-receipt-card">

              <div className="ticket-header-logo">

                <span className="ticket-logo-icon"><Flame size={20} /></span>

                <span className="ticket-logo-text">FULL CHINA</span>

                <span className="ticket-sub-title">Comprobante de venta</span>

              </div>



              <div className="ticket-dashed-line" />



              <div className="ticket-meta-row">

                <span>Pedido: <strong className="text-red">{orderNo}</strong></span>

                <span>{formattedDate} {formattedTime}</span>

              </div>

              <div className="ticket-meta-row">

                <span>{ORDER_TYPE_LABELS[orderType].label}</span>

                <span>Atendido por: Admin</span>

              </div>



              <div className="ticket-dashed-line" />



              <div className="ticket-items-list">

                {currentOrder.items.map((item, idx) => {

                  const prod = products.find(p => p.id === item.productId)

                  const imgUrl = prod ? getProductImage(prod) : FOOD_IMAGES.default



                  return (

                    <div key={idx} className="ticket-item-row">

                      <img src={imgUrl} alt={item.productName} className="ticket-item-thumb" loading="lazy" decoding="async" />

                      <div className="ticket-item-info">

                        <span className="ticket-item-name">{formatProductTitle(item.productName)}</span>

                      </div>

                      <MoneyWithBcv usd={item.price * item.quantity} rate={currentOrder.bcvRate || bcvRate} className="ticket-item-price" compact />

                    </div>

                  )

                })}

              </div>



              <div className="ticket-dashed-line" />



              <div className="ticket-totals-list">

                <div className="ticket-total-line">

                  <span>Subtotal</span>

                  <MoneyWithBcv usd={currentOrder.total} rate={currentOrder.bcvRate || bcvRate} compact />

                </div>

                <div className="ticket-total-line">

                  <span>Descuento</span>

                  <MoneyWithBcv usd={0} rate={currentOrder.bcvRate || bcvRate} compact />

                </div>

              </div>



              <div className="ticket-total-final-row">

                <span className="ticket-final-label">Total</span>

                <MoneyWithBcv usd={currentOrder.total} rate={currentOrder.bcvRate || bcvRate} className="ticket-final-val" />

              </div>



              <div className="ticket-payment-method">

                <span>Método de pago:</span>

                <span className="font-bold">{paymentLabel}</span>

              </div>



              <div className="ticket-footer-text">

                &nbsp;

              </div>

            </div>

          </div>

        </div>

      </div>
  )
}
