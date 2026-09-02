import { useEffect, useState } from 'react'
import { getCustomers, getWhatsAppMessages, queueWhatsAppMessage, type Customer, type WhatsAppMessage } from '../lib/dataService'
import { useAuth } from '../context/auth-context'
import { StyledSelect } from '../components/StyledSelect'
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
    <div className="page whatsapp-page animate-fade-in management-workspace management-workspace--whatsapp">
      <header className="page-header management-workspace-header">
        <div>
          <h1 className="page-title"><MessageSquare size={22} className="page-title-icon" /> Marketing por WhatsApp</h1>
          <p className="page-subtitle">Automatiza conversaciones y crea campañas para tus clientes.</p>
        </div>
        <span className="wa-provider-state"><span /> Proveedor por conectar</span>
      </header>

      <section className="wa-metrics management-workspace-metrics" aria-label="Resumen de marketing">
        <article className="wa-metric wa-metric--green"><span className="wa-metric-icon"><MessageSquare size={20} /></span><div><small>Mensajes</small><strong>{messages.length}</strong><span>En el historial</span></div></article>
        <article className="wa-metric wa-metric--purple"><span className="wa-metric-icon"><Cake size={20} /></span><div><small>Cumpleañeros</small><strong>{birthdayCustomers.length}</strong><span>Hoy</span></div></article>
        <article className="wa-metric wa-metric--orange"><span className="wa-metric-icon"><Clock size={20} /></span><div><small>Inactivos</small><strong>{inactiveCustomers.length}</strong><span>Más de 21 días</span></div></article>
        <article className="wa-metric wa-metric--red"><span className="wa-metric-icon"><Users size={20} /></span><div><small>Clientes VIP</small><strong>{loyalCustomers.length}</strong><span>10 o más visitas</span></div></article>
      </section>

      <main className="wa-studio">
        <section className="wa-panel wa-automations">
          <header className="wa-panel-header">
            <span className="wa-panel-icon"><Sparkles size={19} /></span>
            <div><span className="wa-eyebrow">Siempre activas</span><h2>Automatizaciones</h2><p>Mensajes preparados para cada momento del cliente.</p></div>
            <span className="wa-count">3 plantillas</span>
          </header>

          <div className="wa-template-grid">
            <article className="wa-template wa-template--birthday">
              <header><span className="wa-template-icon"><Cake size={17} /></span><span className="wa-template-badge">8:00 a. m.</span></header>
              <div><small>Cumpleaños</small><h3>Un detalle en su día</h3><p>Se activa automáticamente para los clientes que cumplen años hoy.</p></div>
              <blockquote>¡Feliz cumpleaños [Nombre]! 🎉 En <strong>Full China</strong> te regalamos una ración de lumpias gratis hoy.</blockquote>
            </article>

            <article className="wa-template wa-template--thanks">
              <header><span className="wa-template-icon"><MessageSquare size={17} /></span><span className="wa-template-badge">10 min después</span></header>
              <div><small>Post-compra</small><h3>Gracias por elegirnos</h3><p>Acompaña cada compra y mantiene presente la marca.</p></div>
              <blockquote>¡Muchas gracias por tu compra, [Nombre]! 🥡 Esperamos que disfrutes tu pedido. ¡Vuelve pronto!</blockquote>
            </article>

            <article className="wa-template wa-template--inactive">
              <header><span className="wa-template-icon"><Clock size={17} /></span><span className="wa-template-badge">21 días</span></header>
              <div><small>Reactivación</small><h3>Es hora de volver</h3><p>Recupera clientes que llevan más de tres semanas sin visitarnos.</p></div>
              <blockquote>¡Hola [Nombre]! Te extrañamos en <strong>Full China</strong>. 🍜 Recibe 15% de descuento esta semana.</blockquote>
            </article>
          </div>
        </section>

        <aside className="wa-panel wa-composer">
          <header className="wa-panel-header">
            <span className="wa-panel-icon wa-panel-icon--send"><Send size={19} /></span>
            <div><span className="wa-eyebrow">Campaña manual</span><h2>Crear mensaje</h2><p>Selecciona el público y personaliza el contenido.</p></div>
          </header>

          {sentNotice && <div className="wa-notice" role="status"><CheckCircle2 size={16} /><span>{sentNotice}</span></div>}

          <form onSubmit={handleSendMessage} className="wa-compose-form">
            <label><span>Segmento</span><StyledSelect value={selectedSegment} onChange={e => setSelectedSegment(e.target.value as 'all' | 'loyal' | 'inactive' | 'birthday')}>
              <option value="birthday">Cumpleañeros de hoy ({birthdayCustomers.length})</option>
              <option value="loyal">Clientes fieles / VIP ({loyalCustomers.length})</option>
              <option value="inactive">Clientes inactivos ({inactiveCustomers.length})</option>
              <option value="all">Todos los clientes ({customers.length})</option>
            </StyledSelect></label>

            <label><span>Destinatario</span><StyledSelect value={targetCustomer} onChange={e => setTargetCustomer(e.target.value)}>
              {customers.map(c => <option key={c.id} value={c.id}>{c.name} ({c.phone}) · {c.totalVisits} visitas</option>)}
            </StyledSelect></label>

            <label className="wa-message-field"><span>Mensaje <small>{customMsg.length} caracteres</small></span><textarea rows={5} value={customMsg} onChange={e => setCustomMsg(e.target.value)} /></label>

            <button type="submit" className="wa-send-button"><Send size={16} /><span>Guardar en cola</span></button>
            <p className="wa-compose-hint">El envío se habilitará al conectar el proveedor de WhatsApp.</p>
          </form>
        </aside>

        <section className="wa-panel wa-history">
          <header className="wa-panel-header">
            <span className="wa-panel-icon wa-panel-icon--history"><MessageSquare size={19} /></span>
            <div><span className="wa-eyebrow">Seguimiento</span><h2>Historial de envíos</h2><p>Mensajes manuales y automatizados registrados.</p></div>
            <span className="wa-count">{messages.length} envíos</span>
          </header>

          {messages.length === 0 ? (
            <div className="wa-empty"><span><Send size={22} /></span><div><strong>Aún no hay mensajes</strong><p>Los envíos aparecerán aquí cuando guardes tu primera campaña.</p></div></div>
          ) : (
            <div className="wa-table-wrap"><table className="wa-table"><thead><tr><th>Cliente</th><th>Teléfono</th><th>Tipo</th><th>Fecha</th><th>Estado</th></tr></thead><tbody>
              {messages.map(msg => <tr key={msg.id}><td><strong>{msg.customerName}</strong></td><td>{msg.phone}</td><td><span className="wa-type">{msg.templateType}</span></td><td>{msg.sentAt}</td><td><span className={`wa-status wa-status--${msg.status}`}><CheckCircle2 size={12} />{msg.status === 'sent' ? 'Enviado' : msg.status === 'queued' ? 'En cola' : 'Fallido'}</span></td></tr>)}
            </tbody></table></div>
          )}
        </section>
      </main>
    </div>
  )
}
