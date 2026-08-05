import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAuth } from '../context/auth-context'
import {
  getSuppliers,
  getIngredients,
  getUnits,
  createPurchase,
  type Supplier,
  type Ingredient,
} from '../lib/dataService'
import {
  ArrowLeft,
  Calendar,
  CreditCard,
  Info,
  Trash2,
  Plus,
  Upload,
  FileText,
  X,
  CheckCircle,
  Package,
  XCircle,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import './Compras.css'

interface PurchaseItemRow {
  tempId: string
  ingredientId: string
  quantity: string
  unitId: string
  unitCost: string
}

export function Compras() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [units, setUnits] = useState<Array<{ id: string; name: string; symbol: string }>>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [supplierId, setSupplierId] = useState('')
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0])
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('transfer')
  const [paymentStatus, setPaymentStatus] = useState('paid')
  const [notes, setNotes] = useState('')
  const [discount, setDiscount] = useState('0')

  const [items, setItems] = useState<PurchaseItemRow[]>([])
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null)
  const [invoiceFileName, setInvoiceFileName] = useState('')

  const fetchData = useCallback(async () => {
    try {
      const [supp, ingr, un] = await Promise.all([
        getSuppliers(),
        getIngredients(),
        getUnits(),
      ])
      setSuppliers(supp)
      setIngredients(ingr)
      setUnits(un)
    } catch (e) {
      console.error('Error loading data:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const addItem = () => {
    setItems([
      ...items,
      {
        tempId: `item-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        ingredientId: '',
        quantity: '1',
        unitId: units[0]?.id ?? '',
        unitCost: '0',
      },
    ])
  }

  const removeItem = (tempId: string) => {
    setItems(items.filter((i) => i.tempId !== tempId))
  }

  const updateItem = (tempId: string, field: keyof PurchaseItemRow, value: string) => {
    setItems(items.map((i) => (i.tempId === tempId ? { ...i, [field]: value } : i)))
  }

  const subtotal = useMemo(() => {
    return items.reduce((sum, item) => {
      const qty = parseFloat(item.quantity) || 0
      const cost = parseFloat(item.unitCost) || 0
      return sum + qty * cost
    }, 0)
  }, [items])

  const transportVal = 0
  const discountVal = parseFloat(discount) || 0
  const taxes = (subtotal - discountVal) * 0.12
  const totalFinal = subtotal + transportVal - discountVal + taxes
  const pendingBalance = paymentStatus === 'pending' ? totalFinal : 0

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) {
      setInvoiceFile(file)
      setInvoiceFileName(file.name)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setInvoiceFile(file)
      setInvoiceFileName(file.name)
    }
  }

  const removeFile = () => {
    setInvoiceFile(null)
    setInvoiceFileName('')
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const handleSave = async () => {
    if (!supplierId || items.length === 0) return
    if (!user) return

    setSaving(true)
    try {
      await createPurchase({
        supplierId,
        purchaseDate,
        invoiceNumber: invoiceNumber || undefined,
        notes: notes || undefined,
        userId: user.id,
        items: items
          .filter((i) => i.ingredientId)
          .map((i) => ({
            ingredientId: i.ingredientId,
            quantity: parseFloat(i.quantity) || 0,
            unitId: i.unitId,
            unitCost: parseFloat(i.unitCost) || 0,
          })),
      })
      navigate('/compras')
    } catch (e) {
      console.error('Error saving purchase:', e)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="compras-page">
        <div className="compras-loading">
          <div className="spin"><Package size={32} /></div>
          <p>Cargando datos...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="compras-page">
      <div className="compras-topbar">
        <button className="compras-back" onClick={() => navigate(-1)}>
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="compras-title">Registrar compra</h1>
          <p className="compras-subtitle">Registra una nueva compra a proveedores y controla tus costos.</p>
        </div>
      </div>

      <div className="compras-layout">
        <div className="compras-main">
          <div className="compras-card">
            <h2 className="compras-card-title">Datos de la compra</h2>
            <div className="compras-form-grid">
              <div className="compras-field">
                <label className="compras-label">Proveedor <span className="required">*</span></label>
                <select
                  className="compras-select"
                  value={supplierId}
                  onChange={(e) => setSupplierId(e.target.value)}
                >
                  <option value="">Seleccionar proveedor</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div className="compras-field">
                <label className="compras-label">Fecha <span className="required">*</span></label>
                <div className="compras-input-icon">
                  <Calendar size={16} className="input-icon" />
                  <input
                    type="date"
                    className="compras-input with-icon"
                    value={purchaseDate}
                    onChange={(e) => setPurchaseDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="compras-field">
                <label className="compras-label">Número de factura <span className="required">*</span></label>
                <input
                  type="text"
                  className="compras-input"
                  placeholder="FAC-0004587"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                />
              </div>

              <div className="compras-field">
                <label className="compras-label">Forma de pago <span className="required">*</span></label>
                <div className="compras-input-icon">
                  <CreditCard size={16} className="input-icon" />
                  <select
                    className="compras-select with-icon"
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                  >
                    <option value="cash">Efectivo</option>
                    <option value="transfer">Transferencia bancaria</option>
                    <option value="card">Tarjeta</option>
                    <option value="other">Otro</option>
                  </select>
                </div>
              </div>

              <div className="compras-field">
                <label className="compras-label">Estado de pago <span className="required">*</span></label>
                <div className="compras-select-wrapper">
                  <span className={`status-dot ${paymentStatus === 'paid' ? 'green' : 'amber'}`} />
                  <select
                    className="compras-select with-dot"
                    value={paymentStatus}
                    onChange={(e) => setPaymentStatus(e.target.value)}
                  >
                    <option value="paid">Pagado</option>
                    <option value="pending">Pendiente</option>
                  </select>
                </div>
              </div>

              <div className="compras-field">
                <label className="compras-label">Observaciones</label>
                <textarea
                  className="compras-textarea"
                  placeholder="Entrega en bodega. Mercadería en buen estado."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          </div>

          <div className="compras-card">
            <h2 className="compras-card-title">Productos</h2>
            <div className="compras-items-table-wrapper">
              <table className="compras-items-table">
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Cantidad</th>
                    <th>Unidad</th>
                    <th>Precio unitario</th>
                    <th>Total</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => {
                    const qty = parseFloat(item.quantity) || 0
                    const cost = parseFloat(item.unitCost) || 0
                    const rowTotal = qty * cost
                    return (
                      <tr key={item.tempId}>
                        <td>
                          <select
                            className="compras-item-select"
                            value={item.ingredientId}
                            onChange={(e) => updateItem(item.tempId, 'ingredientId', e.target.value)}
                          >
                            <option value="">Seleccionar</option>
                            {ingredients.map((ing) => (
                              <option key={ing.id} value={ing.id}>{ing.name}</option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <input
                            type="number"
                            className="compras-item-input"
                            value={item.quantity}
                            onChange={(e) => updateItem(item.tempId, 'quantity', e.target.value)}
                            min="0.01"
                            step="0.01"
                          />
                        </td>
                        <td>
                          <select
                            className="compras-item-select unit-select"
                            value={item.unitId}
                            onChange={(e) => updateItem(item.tempId, 'unitId', e.target.value)}
                          >
                            {units.map((u) => (
                              <option key={u.id} value={u.id}>{u.symbol}</option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <input
                            type="number"
                            className="compras-item-input"
                            value={item.unitCost}
                            onChange={(e) => updateItem(item.tempId, 'unitCost', e.target.value)}
                            min="0"
                            step="0.01"
                          />
                        </td>
                        <td className="compras-item-total">
                          ${rowTotal.toFixed(2)}
                        </td>
                        <td>
                          <button
                            className="compras-remove-btn"
                            onClick={() => removeItem(item.tempId)}
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <button className="compras-add-btn" onClick={addItem}>
              <Plus size={18} />
              Agregar producto
            </button>
          </div>
        </div>

        <div className="compras-sidebar">
          <div className="compras-card">
            <h2 className="compras-card-title">Resumen de compra</h2>
            <div className="compras-summary">
              <div className="compras-summary-row">
                <span>Subtotal</span>
                <span className="compras-summary-value">${subtotal.toFixed(2)}</span>
              </div>
              <div className="compras-summary-row">
                <span className="with-info">
                  Transporte
                  <Info size={14} className="info-icon" />
                </span>
                <span className="compras-summary-value">${transportVal.toFixed(2)}</span>
              </div>
              <div className="compras-summary-row">
                <span className="with-info">
                  Descuento
                  <Info size={14} className="info-icon" />
                </span>
                <div className="compras-discount-group">
                  <input
                    type="number"
                    className="compras-discount-input"
                    value={discount}
                    onChange={(e) => setDiscount(e.target.value)}
                    min="0"
                    step="0.01"
                  />
                  <span className="compras-summary-value">${discountVal.toFixed(2)}</span>
                </div>
              </div>
              <div className="compras-summary-row">
                <span className="with-info">
                  Impuestos (IVA 12%)
                  <Info size={14} className="info-icon" />
                </span>
                <span className="compras-summary-value">${taxes.toFixed(2)}</span>
              </div>
              <div className="compras-summary-divider" />
              <div className="compras-summary-row total">
                <span>Total final</span>
                <span className="compras-total-final">${totalFinal.toFixed(2)}</span>
              </div>
              <div className="compras-summary-divider" />
              <div className="compras-summary-row">
                <span>Saldo pendiente</span>
                <span className="compras-summary-value">${pendingBalance.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div className="compras-card">
            <h2 className="compras-card-title">Adjuntar factura</h2>
            <div
              className="compras-dropzone"
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleFileDrop}
            >
              <Upload size={32} className="dropzone-icon" />
              <p className="dropzone-text">
                Arrastra tu archivo aquí o{' '}
                <label className="dropzone-link">
                  Buscar archivo
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    className="dropzone-input"
                    onChange={handleFileSelect}
                  />
                </label>
              </p>
              <p className="dropzone-hint">Formatos permitidos: PDF, JPG, PNG (Máx. 10MB)</p>
            </div>
            {invoiceFileName && (
              <div className="compras-file-item">
                <div className="file-info">
                  <FileText size={20} className="file-icon" />
                  <div>
                    <span className="file-name">{invoiceFileName}</span>
                    {invoiceFile && (
                      <span className="file-size">{formatFileSize(invoiceFile.size)}</span>
                    )}
                  </div>
                </div>
                <button className="file-remove" onClick={removeFile}>
                  <X size={16} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="compras-actions">
        <button
          className="compras-btn-save"
          onClick={handleSave}
          disabled={saving || !supplierId || items.length === 0}
        >
          {saving ? (
            <span className="spin"><Package size={18} /></span>
          ) : (
            <CheckCircle size={18} />
          )}
          Guardar compra
        </button>
        <button
          className="compras-btn-save-inventory"
          onClick={handleSave}
          disabled={saving || !supplierId || items.length === 0}
        >
          {saving ? (
            <span className="spin"><Package size={18} /></span>
          ) : (
            <Package size={18} />
          )}
          Guardar y agregar inventario
        </button>
        <button
          className="compras-btn-cancel"
          onClick={() => navigate(-1)}
          disabled={saving}
        >
          <XCircle size={18} />
          Cancelar
        </button>
      </div>
    </div>
  )
}
