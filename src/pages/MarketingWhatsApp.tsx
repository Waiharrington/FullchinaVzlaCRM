import { useEffect, useState } from 'react'
import { getCustomers, getWhatsAppMessages, queueWhatsAppMessage, type Customer, type WhatsAppMessage } from '../lib/dataService'
import { useAuth } from '../context/auth-context'
import { dateKeyInTimeZone } from '../lib/money'
import { MessageSquare, Cake, Sparkles, Send, Users, CheckCircle2, Clock } from 'lucide-react'
import './MarketingWhatsApp.css'

export function MarketingWhatsApp() {
  const { user } = useAuth()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [messages, setMessages] = useState<WhatsAppMessage[]>([])
  const [selectedSegment, setSelectedSegment] = useState<'all' | 'loyal' | 'inactive' | 'birthday'>('birthday')
  
  // Custom message state
  const [targetCustomer, setTargetCustomer] = useState('')
  const [customMsg, setCustomMsg] = useState('¡Hola! En Full China tenemos promociones especiales en tallarines y arroz frito hoy. ¡Pide tu delivery!')
  const [sentNotice, setSentNotice] = useState('')

  const todayStr = dateKeyInTimeZone()
  const birthdayCustomers = customers.filter(c => c.birthday === todayStr)
  const inactiveThreshold = dateKeyInTimeZone(new Date(Date.now() - 21 * 86400000))
  const inactiveCustomers = customers.filter(c => c.lastVisit && c.lastVisit < inactiveThreshold)
  const loyalCustomers = customers.filter(c => c.totalVisits >= 10)

  useEffect(() => {
    Promise.all([getCustomers(), getWhatsAppMessages()]).then(([customerData, messageData]) => {
      setCustomers(customerData)
      setMessages(messageData)
      setTargetCustomer(customerData[0]?.id || '')
    }).catch(error => setSentNotice(error instanceof Error ? error.message : 'No se pudieron cargar los datos'))
  }, [])

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    const target = customers.find(c => c.id === targetCustomer)
    if (!target || !user || !target.phone) return

    const newMsg: WhatsAppMessage = {
      id: `wm-${Date.now()}`,
      templateType: 'promo',
      customerName: target.name,
      phone: target.phone,
      message: customMsg,
      sentAt: `${dateKeyInTimeZone()} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
      status: 'queued'
    }
    await queueWhatsAppMessage({ customerId: target.id, phone: target.phone, message: customMsg, userId: user.id })
    setMessages(prev => [newMsg, ...prev])
    setSentNotice(`Mensaje guardado en la cola para ${target.name}. Falta conectar el proveedor de WhatsApp para enviarlo.`)
    setTimeout(() => setSentNotice(''), 4000)
  }

  return (
    <div className="whatsapp-page">
      {/* Metrics Banner */}
      <div className="almacen-metrics-grid">
        <div className="almacen-metric-card">
          <div className="metric-icon-box green">
            <MessageSquare size={24} />
          </div>
          <div className="metric-info-group">
            <span className="metric-label">Mensajes en historial</span>
            <span className="metric-large-val">{messages.length} Mensajes</span>
            <span className="metric-sub-text">Campañas de WhatsApp</span>
          </div>
        </div>

        <div className="almacen-metric-card">
          <div className="metric-icon-box purple">
            <Cake size={24} />
          </div>
          <div className="metric-info-group">
            <span className="metric-label">Cumpleañeros Hoy</span>
            <span className="metric-large-val">{birthdayCustomers.length} Cliente(s)</span>
            <span className="metric-sub-text">Regalo automático activo</span>
          </div>
        </div>

        <div className="almacen-metric-card">
          <div className="metric-icon-box orange">
            <Clock size={24} />
          </div>
          <div className="metric-info-group">
            <span className="metric-label">Clientes Inactivos</span>
            <span className="metric-large-val">{inactiveCustomers.length} Clientes</span>
            <span className="metric-sub-text">Sin visitar &gt; 21 días</span>
          </div>
        </div>

        <div className="almacen-metric-card">
          <div className="metric-icon-box red">
            <Users size={24} />
          </div>
          <div className="metric-info-group">
            <span className="metric-label">Clientes Fieles (VIP)</span>
            <span className="metric-large-val">{loyalCustomers.length} Fieles</span>
            <span className="metric-sub-text">&ge; 10 visitas registradas</span>
          </div>
        </div>
      </div>

      <div className="whatsapp-grid">
        {/* Left Column: Templates & Automation Controls */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="whatsapp-card">
            <div className="prod-card-header-bar">
              <div className="header-title-group">
                <div className="card-header-icon-red" style={{ background: '#22c55e' }}>
                  <Sparkles size={18} />
                </div>
                <div>
                  <h2 className="prod-card-title">Plantillas & Automatizaciones de WhatsApp</h2>
                  <span className="metric-sub-text">Mensajes predefinidos configurables para la clienta</span>
                </div>
              </div>
              <span className="whatsapp-badge-green">Proveedor pendiente de conexión</span>
            </div>

            {/* Template 1: Cumpleaños */}
            <div className="template-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 800, color: '#fff', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Cake size={16} color="#ec4899" />
                  <span>Mensaje de Cumpleaños (Automático 8:00 AM)</span>
                </span>
                <span style={{ fontSize: '11px', background: 'rgba(236, 72, 153, 0.15)', color: '#ec4899', padding: '2px 8px', borderRadius: '6px', fontWeight: 700 }}>Auto-Disparador</span>
              </div>
              <div className="chat-bubble-mock">
                ¡Feliz Cumpleaños [Nombre]! 🎉 En <strong>Full China</strong> te regala una ración de lumpias gratis hoy en tu compra. ¡Te esperamos! 🥡
              </div>
            </div>

            {/* Template 2: Agradecimiento */}
            <div className="template-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 800, color: '#fff', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <MessageSquare size={16} color="#3b82f6" />
                  <span>Agradecimiento Post-Compra / Delivery</span>
                </span>
                <span style={{ fontSize: '11px', background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', padding: '2px 8px', borderRadius: '6px', fontWeight: 700 }}>10 min post-venta</span>
              </div>
              <div className="chat-bubble-mock">
                ¡Muchas gracias por tu compra en <strong>Full China</strong>, [Nombre]! 🥡 Esperamos que disfrutes tu pedido. ¡Vuelve pronto!
              </div>
            </div>

            {/* Template 3: Reactivación 21 Días */}
            <div className="template-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 800, color: '#fff', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Clock size={16} color="#f97316" />
                  <span>Reactivación de Clientes Inactivos (21 días sin ir)</span>
                </span>
                <span style={{ fontSize: '11px', background: 'rgba(249, 115, 22, 0.15)', color: '#f97316', padding: '2px 8px', borderRadius: '6px', fontWeight: 700 }}>Configurable</span>
              </div>
              <div className="chat-bubble-mock">
                ¡Hola [Nombre]! Te extrañamos en <strong>Full China</strong>. 🍜 Muestra este mensaje y recibe un 15% de descuento en tu plato favorito esta semana.
              </div>
            </div>
          </div>

          {/* History of Sent Messages */}
          <div className="whatsapp-card">
            <h3 className="prod-card-title">Historial de Envíos de WhatsApp</h3>
            <div className="table-responsive-wrapper">
              <table className="almacen-table">
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th>Teléfono</th>
                    <th>Tipo</th>
                    <th>Enviado</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {messages.map(msg => (
                    <tr key={msg.id}>
                      <td style={{ fontWeight: 700, color: '#fff' }}>{msg.customerName}</td>
                      <td>{msg.phone}</td>
                      <td>
                        <span style={{ textTransform: 'capitalize', fontSize: '11px', background: 'rgba(255, 255, 255, 0.08)', padding: '2px 8px', borderRadius: '6px' }}>
                          {msg.templateType}
                        </span>
                      </td>
                      <td>{msg.sentAt}</td>
                      <td>
                        <span style={{ color: '#22c55e', fontWeight: 700, fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <CheckCircle2 size={12} /> {msg.status === 'sent' ? 'Enviado' : msg.status === 'queued' ? 'En cola' : 'Fallido'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column: Send Campaign / Custom Message Simulator */}
        <div className="whatsapp-card">
          <div className="prod-card-header-bar">
            <div className="header-title-group">
              <div className="card-header-icon-red" style={{ background: '#25d366' }}>
                <Send size={18} />
              </div>
              <div>
                <h3 className="prod-card-title">Enviar Mensaje / Promoción</h3>
                <span className="metric-sub-text">Segmentar y enviar por WhatsApp</span>
              </div>
            </div>
          </div>

          {sentNotice && (
            <div style={{ background: 'rgba(34, 197, 94, 0.15)', border: '1px solid rgba(34, 197, 94, 0.3)', color: '#22c55e', padding: '10px 14px', borderRadius: '8px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle2 size={16} />
              <span>{sentNotice}</span>
            </div>
          )}

          <form onSubmit={handleSendMessage} className="transfer-form-box">
            <div className="select-field-group">
              <label className="field-label">Seleccionar Segmento de Clientes</label>
              <select 
                className="field-select"
                value={selectedSegment}
                onChange={e => setSelectedSegment(e.target.value as 'all' | 'loyal' | 'inactive' | 'birthday')}
              >
                <option value="birthday">Cumpleañeros de Hoy ({birthdayCustomers.length})</option>
                <option value="loyal">Clientes Fieles / VIP ({loyalCustomers.length})</option>
                <option value="inactive">Clientes Inactivos &gt; 21 días ({inactiveCustomers.length})</option>
                <option value="all">Todos los Clientes ({customers.length})</option>
              </select>
            </div>

            <div className="select-field-group">
              <label className="field-label">Cliente Específico Destino</label>
              <select 
                className="field-select"
                value={targetCustomer}
                onChange={e => setTargetCustomer(e.target.value)}
              >
                {customers.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.phone}) - {c.totalVisits} visitas
                  </option>
                ))}
              </select>
            </div>

            <div className="select-field-group">
              <label className="field-label">Mensaje a Enviar</label>
              <textarea 
                rows={4}
                className="field-select"
                style={{ resize: 'vertical' }}
                value={customMsg}
                onChange={e => setCustomMsg(e.target.value)}
              />
            </div>

            <button type="submit" className="btn-whatsapp" style={{ marginTop: '8px' }}>
              <Send size={16} />
              <span>Enviar por WhatsApp</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
