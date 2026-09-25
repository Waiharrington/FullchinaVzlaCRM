import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { deleteWhatsAppSegment, deleteWhatsAppTemplate, getCustomers, getWhatsAppMessages, getWhatsAppSegments, getWhatsAppTemplates, queueWhatsAppMessages, saveWhatsAppSegment, saveWhatsAppTemplate, type Customer, type WhatsAppMessage, type WhatsAppSegment, type WhatsAppTemplate } from '../lib/dataService'
import { useAuth } from '../context/auth-context'
import { StyledSelect } from '../components/StyledSelect'
import { DateField } from '../components/DateField'
import { dateKeyInTimeZone } from '../lib/money'
import { MessageSquare, Cake, Bot, Send, Users, CheckCircle2, Clock, Plus, X, Pencil, Trash2, UserRound, ChevronLeft, ChevronRight, CalendarDays, Clock3, Timer } from 'lucide-react'
import './MarketingWhatsApp.css'

const formatMessageDate = (value: string) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const datePart = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Caracas', day: '2-digit', month: '2-digit', year: 'numeric',
  }).format(date)
  const timePart = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Caracas', hour: 'numeric', minute: '2-digit', hour12: true,
  }).format(date).toLowerCase()
  return `${datePart} ${timePart}`
}

export function MarketingWhatsApp() {
  const MODAL_PAGE_SIZE = 10
  const { user } = useAuth()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [messages, setMessages] = useState<WhatsAppMessage[]>([])
  const [segments, setSegments] = useState<WhatsAppSegment[]>([])
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([])
  const [editingTemplate, setEditingTemplate] = useState<WhatsAppTemplate | null>(null)
  const [selectedSegment, setSelectedSegment] = useState('birthday')
  const [audienceMode, setAudienceMode] = useState<'segment' | 'recipient'>('segment')
  
  // Custom message state
  const [targetCustomer, setTargetCustomer] = useState('')
  const [customMsg, setCustomMsg] = useState('¡Hola! En Full China tenemos promociones especiales en tallarines y arroz frito hoy. ¡Pide tu delivery!')
  const [sentNotice, setSentNotice] = useState('')
  const [showSegmentModal, setShowSegmentModal] = useState(false)
  const [editingSegmentId, setEditingSegmentId] = useState<string | null>(null)
  const [segmentName, setSegmentName] = useState('')
  const [segmentDescription, setSegmentDescription] = useState('')
  const [segmentCustomerIds, setSegmentCustomerIds] = useState<string[]>([])
  const [segmentSearch, setSegmentSearch] = useState('')
  const [segmentSaving, setSegmentSaving] = useState(false)
  const [audienceModal, setAudienceModal] = useState<{ title: string; subtitle: string; customers: Customer[] } | null>(null)
  const [segmentPage, setSegmentPage] = useState(1)
  const [audiencePage, setAudiencePage] = useState(1)
  const [historyPage, setHistoryPage] = useState(1)
  const [scheduleMode, setScheduleMode] = useState<'none' | 'time' | 'delay' | 'date'>('none')
  const [scheduleTime, setScheduleTime] = useState('08:00')
  const [scheduleAmount, setScheduleAmount] = useState('10')
  const [scheduleUnit, setScheduleUnit] = useState<'minutos' | 'horas' | 'días'>('minutos')
  const [scheduleDate, setScheduleDate] = useState('')

  const todayStr = dateKeyInTimeZone()
  const birthdayCustomers = customers.filter(c => c.birthday === todayStr)
  const inactiveThreshold = dateKeyInTimeZone(new Date(Date.now() - 21 * 86400000))
  const inactiveCustomers = customers.filter(c => c.lastVisit && c.lastVisit < inactiveThreshold)
  const loyalCustomers = customers.filter(c => c.totalVisits >= 10)

  useEffect(() => {
    Promise.all([getCustomers(), getWhatsAppMessages(), getWhatsAppSegments(), getWhatsAppTemplates()]).then(([customerData, messageData, segmentData, templateData]) => {
      setCustomers(customerData)
      setMessages(messageData)
      setSegments(segmentData)
      setTemplates(templateData)
      setTargetCustomer(customerData[0]?.id || '')
    }).catch(error => setSentNotice(error instanceof Error ? error.message : 'No se pudieron cargar los datos'))
  }, [])

  const openNewTemplate = () => {
    setScheduleMode('none'); setScheduleTime('08:00'); setScheduleAmount('10'); setScheduleUnit('minutos'); setScheduleDate('')
    setEditingTemplate({ id: '', name: '', category: 'custom', description: '', message: '', scheduleLabel: '', isActive: true, createdAt: '', updatedAt: '' })
  }
  const openEditTemplate = (template: WhatsAppTemplate) => {
    const label = template.scheduleLabel?.toLowerCase() ?? ''
    const timeMatch = label.match(/(\d{1,2}):(\d{2})/)
    const delayMatch = label.match(/(\d+)\s*(min|hora|día)/)
    if (timeMatch) { setScheduleMode('time'); setScheduleTime(`${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}`) }
    else if (delayMatch) { setScheduleMode('delay'); setScheduleAmount(delayMatch[1]); setScheduleUnit(delayMatch[2].startsWith('min') ? 'minutos' : delayMatch[2].startsWith('hora') ? 'horas' : 'días') }
    else if (/^\d{4}-\d{2}-\d{2}$/.test(label)) { setScheduleMode('date'); setScheduleDate(label) }
    else setScheduleMode('none')
    setEditingTemplate(template)
  }
  const scheduleLabel = scheduleMode === 'time' ? `A las ${scheduleTime}` : scheduleMode === 'delay' ? `${scheduleAmount} ${scheduleUnit} después` : scheduleMode === 'date' ? `El ${scheduleDate}` : ''
  const saveTemplate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!user || !editingTemplate?.name.trim() || !editingTemplate.message.trim()) return
    try {
      const saved = await saveWhatsAppTemplate({ id: editingTemplate.id || undefined, name: editingTemplate.name, category: editingTemplate.category, description: editingTemplate.description ?? '', message: editingTemplate.message, scheduleLabel, isActive: editingTemplate.isActive, userId: user.id })
      setTemplates(prev => editingTemplate.id ? prev.map(item => item.id === saved.id ? saved : item) : [...prev, saved].sort((a, b) => a.name.localeCompare(b.name)))
      setEditingTemplate(null)
      setSentNotice('Plantilla guardada correctamente.')
      setTimeout(() => setSentNotice(''), 4000)
    } catch (error) { setSentNotice(error instanceof Error ? error.message : 'No se pudo guardar la plantilla') }
  }
  const removeTemplate = async (template: WhatsAppTemplate) => {
    if (!window.confirm(`¿Eliminar la plantilla “${template.name}”?`)) return
    try { await deleteWhatsAppTemplate(template.id); setTemplates(prev => prev.filter(item => item.id !== template.id)) }
    catch (error) { setSentNotice(error instanceof Error ? error.message : 'No se pudo eliminar la plantilla') }
  }

  const customSegment = segments.find(segment => segment.id === selectedSegment)
  const currentSegmentCustomers = selectedSegment === 'birthday'
    ? birthdayCustomers
    : selectedSegment === 'loyal'
      ? loyalCustomers
      : selectedSegment === 'inactive'
        ? inactiveCustomers
        : selectedSegment === 'all'
          ? customers
        : customers.filter(customer => customSegment?.customerIds.includes(customer.id))

  const filteredSegmentCustomers = customers.filter(customer => customer.name.toLowerCase().includes(segmentSearch.toLowerCase()) || customer.phone.includes(segmentSearch))
  const segmentPageCount = Math.max(1, Math.ceil(filteredSegmentCustomers.length / MODAL_PAGE_SIZE))
  const visibleSegmentCustomers = filteredSegmentCustomers.slice((segmentPage - 1) * MODAL_PAGE_SIZE, segmentPage * MODAL_PAGE_SIZE)
  const audiencePageCount = audienceModal ? Math.max(1, Math.ceil(audienceModal.customers.length / MODAL_PAGE_SIZE)) : 1
  const visibleAudienceCustomers = audienceModal?.customers.slice((audiencePage - 1) * MODAL_PAGE_SIZE, audiencePage * MODAL_PAGE_SIZE) ?? []
  const historyPageCount = Math.max(1, Math.ceil(messages.length / MODAL_PAGE_SIZE))
  const visibleMessages = messages.slice((historyPage - 1) * MODAL_PAGE_SIZE, historyPage * MODAL_PAGE_SIZE)

  useEffect(() => {
    setSegmentPage(1)
  }, [segmentSearch])

  useEffect(() => {
    setAudiencePage(1)
  }, [audienceModal])

  useEffect(() => {
    setSegmentPage(page => Math.min(page, segmentPageCount))
  }, [segmentPageCount])

  useEffect(() => {
    setAudiencePage(page => Math.min(page, audiencePageCount))
  }, [audiencePageCount])

  useEffect(() => {
    setHistoryPage(page => Math.min(page, historyPageCount))
  }, [historyPageCount])

  useEffect(() => {
    if (!audienceModal && !showSegmentModal) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previousOverflow }
  }, [audienceModal, showSegmentModal])

  const openAudienceModal = (title: string, subtitle: string, audience: Customer[]) => {
    setAudienceModal({ title, subtitle, customers: audience })
  }

  const openNewSegment = () => {
    setEditingSegmentId(null)
    setSegmentName('')
    setSegmentDescription('')
    setSegmentCustomerIds([])
    setSegmentSearch('')
    setShowSegmentModal(true)
  }

  const openEditSegment = (segment: WhatsAppSegment) => {
    setEditingSegmentId(segment.id)
    setSegmentName(segment.name)
    setSegmentDescription(segment.description ?? '')
    setSegmentCustomerIds(segment.customerIds)
    setSegmentSearch('')
    setShowSegmentModal(true)
  }

  const handleSaveSegment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !segmentName.trim() || segmentCustomerIds.length === 0) return
    setSegmentSaving(true)
    try {
      const saved = await saveWhatsAppSegment({ id: editingSegmentId ?? undefined, name: segmentName, description: segmentDescription, customerIds: segmentCustomerIds, userId: user.id })
      setSegments(prev => editingSegmentId ? prev.map(segment => segment.id === saved.id ? saved : segment) : [...prev, saved].sort((a, b) => a.name.localeCompare(b.name)))
      setSelectedSegment(saved.id)
      setShowSegmentModal(false)
      setSentNotice(`Segmento “${saved.name}” guardado con ${saved.customerIds.length} clientes.`)
      setTimeout(() => setSentNotice(''), 4000)
    } catch (error) { setSentNotice(error instanceof Error ? error.message : 'No se pudo guardar el segmento') }
    finally { setSegmentSaving(false) }
  }

  const handleDeleteSegment = async (segment: WhatsAppSegment) => {
    if (!window.confirm(`¿Eliminar el segmento “${segment.name}”?`)) return
    try {
      await deleteWhatsAppSegment(segment.id)
      setSegments(prev => prev.filter(item => item.id !== segment.id))
      if (selectedSegment === segment.id) setSelectedSegment('birthday')
    } catch (error) { setSentNotice(error instanceof Error ? error.message : 'No se pudo eliminar el segmento') }
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    const audience = audienceMode === 'segment' ? currentSegmentCustomers : customers.filter(customer => customer.id === targetCustomer)
    const recipients = audience.filter(customer => customer.phone.trim())
    if (recipients.length === 0) {
      setSentNotice('No hay clientes con teléfono en la selección.')
      return
    }

    await queueWhatsAppMessages({ customerIds: recipients.map(customer => customer.id), customers, message: customMsg, userId: user.id })
    const sentAt = `${dateKeyInTimeZone()} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    const newMessages: WhatsAppMessage[] = recipients.map((target, index) => ({ id: `wm-${Date.now()}-${index}`, templateType: audienceMode === 'segment' ? (customSegment?.name ?? selectedSegment) : 'custom', customerName: target.name, phone: target.phone, message: customMsg, sentAt, status: 'queued' }))
    setMessages(prev => [...newMessages, ...prev])
    setSentNotice(`${recipients.length} mensaje${recipients.length === 1 ? '' : 's'} guardado${recipients.length === 1 ? '' : 's'} en la cola.`)
    setTimeout(() => setSentNotice(''), 4000)
  }

  return (
    <div className="page whatsapp-page animate-fade-in management-workspace management-workspace--whatsapp">
      <header className="page-header management-workspace-header">
        <div>
          <h1 className="page-title"><MessageSquare size={22} className="page-title-icon" /> Marketing por WhatsApp</h1>
          <p className="page-subtitle">Automatiza conversaciones y crea campañas para tus clientes.</p>
        </div>
        <div className="wa-header-actions">
          <span className="wa-provider-state"><span /> Proveedor por conectar</span>
        </div>
      </header>

      <section className="wa-metrics management-workspace-metrics" aria-label="Resumen de marketing">
        <article className="wa-metric wa-metric--green"><span className="wa-metric-icon"><MessageSquare size={20} /></span><div><small>Mensajes</small><strong>{messages.length}</strong><span>En el historial</span></div></article>
        <button type="button" className="wa-metric wa-metric--purple" onClick={() => openAudienceModal('Cumpleañeros de hoy', 'Clientes que cumplen años hoy.', birthdayCustomers)}><span className="wa-metric-icon"><Cake size={20} /></span><div><small>Cumpleañeros</small><strong>{birthdayCustomers.length}</strong><span>Ver lista <span aria-hidden="true">→</span></span></div></button>
        <button type="button" className="wa-metric wa-metric--orange" onClick={() => openAudienceModal('Clientes inactivos', 'Clientes sin visitas en más de 21 días.', inactiveCustomers)}><span className="wa-metric-icon"><Clock size={20} /></span><div><small>Inactivos</small><strong>{inactiveCustomers.length}</strong><span>Ver lista <span aria-hidden="true">→</span></span></div></button>
        <button type="button" className="wa-metric wa-metric--red" onClick={() => openAudienceModal('Clientes VIP', 'Clientes con 10 o más visitas.', loyalCustomers)}><span className="wa-metric-icon"><Users size={20} /></span><div><small>Clientes VIP</small><strong>{loyalCustomers.length}</strong><span>Ver lista <span aria-hidden="true">→</span></span></div></button>
      </section>

      <section className="wa-panel wa-lists-panel" aria-labelledby="wa-lists-title">
        <header className="wa-panel-header"><span className="wa-panel-icon wa-panel-icon--lists"><Users size={19} /></span><div><span className="wa-eyebrow">Audiencias guardadas</span><h2 id="wa-lists-title">Listas de difusión</h2><p>Crea y administra los grupos de clientes para tus campañas.</p></div><button type="button" className="wa-inline-create" onClick={openNewSegment}><Plus size={14} /> Crear lista</button></header>
        {segments.length === 0 ? <div className="wa-lists-empty"><Users size={18} /><span>Aún no tienes listas personalizadas. Crea una para agrupar clientes frecuentes, empresas o promociones.</span><button type="button" onClick={openNewSegment}>Crear mi primera lista</button></div> : <div className="wa-lists-grid">{segments.map(segment => <article className="wa-list-card" key={segment.id}><div className="wa-list-card-top"><span className="wa-list-card-icon"><Users size={16} /></span><div><h3>{segment.name}</h3><p>{segment.description || 'Lista personalizada de clientes'}</p></div></div><div className="wa-list-card-meta"><strong>{segment.customerIds.length}</strong><span>clientes seleccionados</span></div><div className="wa-list-card-actions"><button type="button" onClick={() => openAudienceModal(segment.name, segment.description || 'Clientes de esta lista de difusión.', customers.filter(customer => segment.customerIds.includes(customer.id)))}><Users size={14} /> Ver clientes</button><button type="button" aria-label={`Editar ${segment.name}`} onClick={() => openEditSegment(segment)}><Pencil size={14} /></button><button type="button" aria-label={`Eliminar ${segment.name}`} onClick={() => handleDeleteSegment(segment)}><Trash2 size={14} /></button></div></article>)}</div>}
      </section>

      <main className="wa-studio">
        <div className="wa-side-stack">
          <section className="wa-panel wa-automations">
            <header className="wa-panel-header">
              <span className="wa-panel-icon"><Bot size={19} /></span>
              <div><span className="wa-eyebrow">Siempre activas</span><h2>Automatizaciones</h2><p>Mensajes preparados para cada momento del cliente.</p></div>
              <button type="button" className="wa-inline-create" onClick={openNewTemplate}><Plus size={14} /> Nueva plantilla</button>
            </header>

            <div className="wa-template-grid">
              {templates.map(template => <article className="wa-template" key={template.id}>
                <header><span className="wa-template-icon"><Bot size={17} /></span><span className="wa-template-badge">{template.scheduleLabel || (template.isActive ? 'Activa' : 'Pausada')}</span></header>
                <div><small>{template.category}</small><h3>{template.name}</h3><p>{template.description || 'Plantilla editable para campañas y mensajes de Full China.'}</p></div>
                <blockquote>{template.message}</blockquote>
                <footer><button className="wa-template-action wa-template-action--edit" type="button" onClick={() => openEditTemplate(template)}><Pencil size={13} /> Editar</button><button className="wa-template-action wa-template-action--delete" type="button" onClick={() => removeTemplate(template)}><Trash2 size={13} /> Eliminar</button></footer>
              </article>)}
              {templates.length === 0 && <div className="wa-empty"><strong>No hay plantillas todavía</strong><p>Crea la primera plantilla para comenzar.</p></div>}
            </div>
          </section>

          <section className="wa-panel wa-history">
            <header className="wa-panel-header">
              <span className="wa-panel-icon wa-panel-icon--history"><MessageSquare size={19} /></span>
              <div><span className="wa-eyebrow">Seguimiento</span><h2>Historial de envíos</h2><p>Mensajes manuales y automatizados recientes.</p></div>
              <span className="wa-count">{messages.length} recientes</span>
            </header>

            {messages.length === 0 ? (
              <div className="wa-empty"><span><Send size={22} /></span><div><strong>Aún no hay mensajes</strong><p>Los envíos aparecerán aquí cuando guardes tu primera campaña.</p></div></div>
            ) : (
              <div className="wa-table-wrap"><table className="wa-table"><thead><tr><th>Cliente</th><th>Teléfono</th><th>Tipo</th><th>Fecha</th><th>Estado</th></tr></thead><tbody>
                {visibleMessages.map(msg => <tr key={msg.id}><td><strong>{msg.customerName}</strong></td><td>{msg.phone}</td><td><span className="wa-type">{msg.templateType}</span></td><td>{formatMessageDate(msg.sentAt)}</td><td><span className={`wa-status wa-status--${msg.status}`}><CheckCircle2 size={12} />{msg.status === 'sent' ? 'Enviado' : msg.status === 'queued' ? 'En cola' : 'Fallido'}</span></td></tr>)}
              </tbody></table><div className="wa-modal-pagination wa-history-pagination"><span>Mostrando {(historyPage - 1) * MODAL_PAGE_SIZE + 1}–{Math.min(historyPage * MODAL_PAGE_SIZE, messages.length)} de {messages.length}</span><div><button type="button" aria-label="Página anterior" disabled={historyPage === 1} onClick={() => setHistoryPage(page => page - 1)}><ChevronLeft size={15} /></button><strong>Página {historyPage} de {historyPageCount}</strong><button type="button" aria-label="Página siguiente" disabled={historyPage === historyPageCount} onClick={() => setHistoryPage(page => page + 1)}><ChevronRight size={15} /></button></div></div></div>
            )}
          </section>
        </div>

        <aside className="wa-panel wa-composer">
          <header className="wa-panel-header">
            <span className="wa-panel-icon wa-panel-icon--send"><Send size={19} /></span>
            <div><span className="wa-eyebrow">Campaña manual</span><h2>Crear mensaje</h2><p>Selecciona el público y personaliza el contenido.</p></div>
          </header>

          {sentNotice && <div className="wa-notice" role="status"><CheckCircle2 size={16} /><span>{sentNotice}</span></div>}
          <form onSubmit={handleSendMessage} className="wa-compose-form">
            <div className="wa-audience-switch" role="tablist" aria-label="Tipo de público">
              <button type="button" role="tab" aria-selected={audienceMode === 'segment'} className={audienceMode === 'segment' ? 'active' : ''} onClick={() => setAudienceMode('segment')}><Users size={15} /> Segmento</button>
              <button type="button" role="tab" aria-selected={audienceMode === 'recipient'} className={audienceMode === 'recipient' ? 'active' : ''} onClick={() => setAudienceMode('recipient')}><UserRound size={15} /> Destinatario</button>
            </div>

            {audienceMode === 'segment' ? <label><span>Lista de difusión</span><StyledSelect value={selectedSegment} onChange={e => setSelectedSegment(e.target.value)}>
              <option value="birthday">Cumpleañeros de hoy ({birthdayCustomers.length})</option>
              <option value="loyal">Clientes fieles / VIP ({loyalCustomers.length})</option>
              <option value="inactive">Clientes inactivos ({inactiveCustomers.length})</option>
              <option value="all">Todos los clientes ({customers.length})</option>
              {segments.map(segment => <option key={segment.id} value={segment.id}>{segment.name} ({segment.customerIds.length})</option>)}
            </StyledSelect><small className="wa-audience-hint">{currentSegmentCustomers.filter(customer => customer.phone.trim()).length} clientes con WhatsApp disponible</small></label> : <label><span>Destinatario</span><StyledSelect value={targetCustomer} onChange={e => setTargetCustomer(e.target.value)}>
              {customers.map(c => <option key={c.id} value={c.id}>{c.name} ({c.phone || 'sin teléfono'}) · {c.totalVisits} visitas</option>)}
            </StyledSelect></label>}

            <label className="wa-message-field"><span>Mensaje <small>{customMsg.length} caracteres</small></span><textarea rows={5} value={customMsg} onChange={e => setCustomMsg(e.target.value)} /></label>

            <button type="submit" className="wa-send-button"><Send size={16} /><span>Guardar en cola</span></button>
            <p className="wa-compose-hint">El envío se habilitará al conectar el proveedor de WhatsApp.</p>
          </form>
        </aside>
      </main>

      {editingTemplate && createPortal(<div className="wa-modal-backdrop" role="presentation" onClick={() => setEditingTemplate(null)}><section className="wa-standard-modal wa-segment-modal wa-template-modal" role="dialog" aria-modal="true" aria-labelledby="wa-template-title" onClick={event => event.stopPropagation()}>
        <header className="wa-segment-modal-header"><div><span className="wa-eyebrow">Plantillas</span><h2 id="wa-template-title">{editingTemplate.id ? 'Editar plantilla' : 'Nueva plantilla'}</h2><p>Personaliza el contenido que usará Full China.</p></div><button type="button" className="wa-modal-close" aria-label="Cerrar" onClick={() => setEditingTemplate(null)}><X size={18} /></button></header>
        <form onSubmit={saveTemplate} className="wa-segment-form">
          <label><span>Nombre</span><input value={editingTemplate.name} onChange={event => setEditingTemplate({ ...editingTemplate, name: event.target.value })} maxLength={100} placeholder="Ej. Promoción de viernes" required /></label>
          <label><span>Categoría</span><input value={editingTemplate.category} onChange={event => setEditingTemplate({ ...editingTemplate, category: event.target.value })} maxLength={60} placeholder="Promoción, cumpleaños, post-compra..." required /></label>
          <label><span>Descripción <small>Opcional</small></span><input value={editingTemplate.description ?? ''} onChange={event => setEditingTemplate({ ...editingTemplate, description: event.target.value })} maxLength={180} /></label>
          <div className="wa-schedule-field"><span className="wa-field-label">Programación <small>Opcional</small></span><div className="wa-schedule-mode"><StyledSelect value={scheduleMode} onChange={event => setScheduleMode(event.target.value as typeof scheduleMode)} aria-label="Tipo de programación"><option value="none">Sin programación</option><option value="time">A una hora fija</option><option value="delay">Después de un evento</option><option value="date">En una fecha</option></StyledSelect>{scheduleMode === 'time' && <label className="wa-schedule-control"><Clock3 size={15} /><input type="time" value={scheduleTime} onChange={event => setScheduleTime(event.target.value)} aria-label="Hora de envío" /></label>}{scheduleMode === 'delay' && <label className="wa-schedule-control"><Timer size={15} /><input type="number" min="1" value={scheduleAmount} onChange={event => setScheduleAmount(event.target.value)} aria-label="Cantidad de demora" /><StyledSelect value={scheduleUnit} onChange={event => setScheduleUnit(event.target.value as typeof scheduleUnit)} aria-label="Unidad de demora"><option>minutos</option><option>horas</option><option>días</option></StyledSelect></label>}{scheduleMode === 'date' && <label className="wa-schedule-control"><CalendarDays size={15} /><DateField calendar value={scheduleDate} onChange={setScheduleDate} placeholder="Fecha de envío" showCalendarIcon={false} /></label>}</div></div>
          <label className="wa-message-field"><span>Mensaje <small>{editingTemplate.message.length} caracteres</small></span><textarea rows={7} value={editingTemplate.message} onChange={event => setEditingTemplate({ ...editingTemplate, message: event.target.value })} placeholder="Usa [Nombre] para personalizar" required /></label>
          <label className="wa-template-active-toggle"><input type="checkbox" checked={editingTemplate.isActive} onChange={event => setEditingTemplate({ ...editingTemplate, isActive: event.target.checked })} /><span className="wa-toggle-track" aria-hidden="true"><span /></span><span><strong>Plantilla activa</strong><small>Disponible para automatizaciones</small></span></label>
          <div className="wa-segment-form-actions"><button type="button" className="wa-cancel-button" onClick={() => setEditingTemplate(null)}>Cancelar</button><button type="submit" className="wa-send-button">Guardar plantilla</button></div>
        </form>
      </section></div>, document.body)}

      {audienceModal && createPortal(<div className="wa-modal-backdrop" role="presentation" onClick={() => setAudienceModal(null)}><section className="wa-standard-modal wa-audience-modal" role="dialog" aria-modal="true" aria-labelledby="wa-audience-title" onClick={event => event.stopPropagation()}><header className="wa-segment-modal-header"><div><span className="wa-eyebrow">Lista de clientes</span><h2 id="wa-audience-title">{audienceModal.title}</h2><p>{audienceModal.subtitle} · {audienceModal.customers.length} clientes</p></div><button type="button" className="wa-modal-close" aria-label="Cerrar" onClick={() => setAudienceModal(null)}><X size={18} /></button></header>{audienceModal.customers.length === 0 ? <div className="wa-audience-empty">No hay clientes en esta lista todavía.</div> : <><div className="wa-audience-list">{visibleAudienceCustomers.map(customer => <div className="wa-audience-row" key={customer.id}><span className="wa-member-avatar">{customer.name.slice(0, 1).toUpperCase()}</span><div><strong>{customer.name}</strong><small>{customer.phone || 'Sin teléfono'} · {customer.totalVisits} visitas</small></div><span className={customer.phone ? 'wa-phone-ready' : 'wa-phone-missing'}>{customer.phone ? 'WhatsApp listo' : 'Sin teléfono'}</span></div>)}</div><div className="wa-modal-pagination"><span>Mostrando {(audiencePage - 1) * MODAL_PAGE_SIZE + 1}–{Math.min(audiencePage * MODAL_PAGE_SIZE, audienceModal.customers.length)} de {audienceModal.customers.length}</span><div><button type="button" aria-label="Página anterior" disabled={audiencePage === 1} onClick={() => setAudiencePage(page => page - 1)}><ChevronLeft size={15} /></button><strong>Página {audiencePage} de {audiencePageCount}</strong><button type="button" aria-label="Página siguiente" disabled={audiencePage === audiencePageCount} onClick={() => setAudiencePage(page => page + 1)}><ChevronRight size={15} /></button></div></div></>}</section></div>, document.body)}

      {showSegmentModal && createPortal(<div className="wa-modal-backdrop" role="presentation" onClick={() => !segmentSaving && setShowSegmentModal(false)}>
        <section className="wa-standard-modal wa-segment-modal" role="dialog" aria-modal="true" aria-labelledby="wa-segment-title" onClick={event => event.stopPropagation()}>
          <header className="wa-segment-modal-header"><div><span className="wa-eyebrow">Audiencias</span><h2 id="wa-segment-title">{editingSegmentId ? 'Editar segmento' : 'Crear segmento'}</h2><p>Arma una lista de difusión con clientes seleccionados.</p></div><button type="button" className="wa-modal-close" aria-label="Cerrar" onClick={() => setShowSegmentModal(false)}><X size={18} /></button></header>
          <form onSubmit={handleSaveSegment} className="wa-segment-form">
            <label><span>Nombre del segmento</span><input value={segmentName} onChange={event => setSegmentName(event.target.value)} maxLength={80} placeholder="Ej. Clientes de cumpleaños" required /></label>
            <label><span>Descripción <small>Opcional</small></span><input value={segmentDescription} onChange={event => setSegmentDescription(event.target.value)} maxLength={160} placeholder="Para explicar cuándo usar esta lista" /></label>
            <div className="wa-member-picker"><div className="wa-member-picker-head"><span>Clientes de la lista <strong>{segmentCustomerIds.length}</strong></span><input value={segmentSearch} onChange={event => setSegmentSearch(event.target.value)} placeholder="Buscar cliente..." aria-label="Buscar cliente" /></div><div className="wa-member-list">{visibleSegmentCustomers.map(customer => <label key={customer.id} className="wa-member-row"><input type="checkbox" checked={segmentCustomerIds.includes(customer.id)} onChange={event => setSegmentCustomerIds(prev => event.target.checked ? [...prev, customer.id] : prev.filter(id => id !== customer.id))} /><span className="wa-member-avatar">{customer.name.slice(0, 1).toUpperCase()}</span><span className="wa-member-copy"><strong>{customer.name}</strong><small>{customer.phone || 'Sin teléfono'}</small></span></label>)}{visibleSegmentCustomers.length === 0 && <div className="wa-audience-empty">No se encontraron clientes.</div>}</div><div className="wa-modal-pagination"><span>{filteredSegmentCustomers.length === 0 ? 'Sin resultados' : `Mostrando ${(segmentPage - 1) * MODAL_PAGE_SIZE + 1}–${Math.min(segmentPage * MODAL_PAGE_SIZE, filteredSegmentCustomers.length)} de ${filteredSegmentCustomers.length}`}</span><div><button type="button" aria-label="Página anterior" disabled={segmentPage === 1} onClick={() => setSegmentPage(page => page - 1)}><ChevronLeft size={15} /></button><strong>Página {segmentPage} de {segmentPageCount}</strong><button type="button" aria-label="Página siguiente" disabled={segmentPage === segmentPageCount} onClick={() => setSegmentPage(page => page + 1)}><ChevronRight size={15} /></button></div></div></div>
            <div className="wa-segment-form-actions"><button type="button" className="wa-cancel-button" onClick={() => setShowSegmentModal(false)}>Cancelar</button><button type="submit" className="wa-send-button" disabled={segmentSaving || !segmentName.trim() || segmentCustomerIds.length === 0}>{segmentSaving ? 'Guardando…' : editingSegmentId ? 'Guardar cambios' : 'Crear segmento'}</button></div>
          </form>
        </section>
      </div>, document.body)}
    </div>
  )
}
