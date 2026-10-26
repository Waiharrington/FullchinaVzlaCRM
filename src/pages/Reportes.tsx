import { useAuth } from '../context/auth-context'
import './Reportes.css'
import { useState } from 'react'
import { BarChart3, LoaderCircle, Send } from 'lucide-react'
import { ReportExplorer } from '../components/ReportExplorer'
import { supabase } from '../lib/supabase'

export function Reportes() {
  const { user } = useAuth()
  const [sendingTestEmail, setSendingTestEmail] = useState(false)
  const [testEmailMessage, setTestEmailMessage] = useState('')

  const sendTestEmail = async () => {
    if (!supabase || sendingTestEmail) return
    setSendingTestEmail(true)
    setTestEmailMessage('')
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      if (sessionError || !session?.access_token) throw new Error('Tu sesión venció. Inicia sesión otra vez.')
      const response = await fetch('/api/daily-sales-email-test', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const result = await response.json().catch(() => ({})) as { error?: string; sent?: boolean; recipient?: string }
      if (!response.ok || !result.sent) throw new Error(result.error ?? 'No se pudo enviar el correo de prueba.')
      setTestEmailMessage(`Correo enviado a ${result.recipient}.`)
    } catch (error) {
      setTestEmailMessage(error instanceof Error ? error.message : 'No se pudo enviar el correo de prueba.')
    } finally {
      setSendingTestEmail(false)
    }
  }

  if (user?.role === 'cashier') {
    return (
      <div className="page animate-fade-in management-workspace management-workspace--reports" key="reportes-restricted">
        <header className="page-header management-workspace-header">
          <div>
            <h1 className="page-title"><BarChart3 size={22} className="page-title-icon" /> Reportes</h1>
            <p className="page-subtitle">Acceso restringido</p>
          </div>
        </header>
        <div className="card restricted-card">
          <p>No tiene permisos para ver reportes financieros.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="page animate-fade-in management-workspace management-workspace--reports" key="reportes-full">
      <header className="page-header management-workspace-header">
        <div>
          <h1 className="page-title"><BarChart3 size={22} className="page-title-icon" /> Reportes</h1>
          <p className="page-subtitle">Análisis de ventas y rendimiento</p>
        </div>
        {user?.role === 'owner' && (
          <div className="report-email-test-wrap">
            <div className="report-email-test-action">
              <button className="report-email-test-button" type="button" onClick={sendTestEmail} disabled={sendingTestEmail}>
                {sendingTestEmail ? <LoaderCircle size={16} className="report-email-test-loading" /> : <Send size={16} />}
                {sendingTestEmail ? 'Enviando prueba…' : 'Enviar correo de prueba'}
              </button>
              <span>Se enviará a 1803andrea14@gmail.com</span>
            </div>
            {testEmailMessage && <span className="report-email-test-message" role="status">{testEmailMessage}</span>}
          </div>
        )}
      </header>

      <ReportExplorer />
    </div>
  )
}
