import { useState, useMemo } from 'react'
import {
  Plus,
  Calendar,
  ArrowLeft,
  Info,
  Trash2,
  Upload,
  FileText,
  X,
  CreditCard
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import './Compras.css'

export interface PurchaseRow {
  id: string
  productName: string
  photoUrl: string
  quantity: number
  unit: string
  unitPrice: number
}

const INGREDIENT_PHOTOS: Record<string, string> = {
  pollo: 'https://images.unsplash.com/photo-1587593810167-a84920ea0781?auto=format&fit=crop&w=200&q=80',
  camaron: 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?auto=format&fit=crop&w=200&q=80',
  arroz: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=200&q=80',
  vegetales: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=200&q=80',
  default: 'https://images.unsplash.com/photo-1541544741938-0af808871cc0?auto=format&fit=crop&w=200&q=80',
}

const MOCK_ITEMS: PurchaseRow[] = [
  { id: '1', productName: 'Pollo', photoUrl: INGREDIENT_PHOTOS.pollo, quantity: 10, unit: 'kg', unitPrice: 3.8 },
  { id: '2', productName: 'Camarón', photoUrl: INGREDIENT_PHOTOS.camaron, quantity: 5, unit: 'kg', unitPrice: 9.5 },
  { id: '3', productName: 'Arroz', photoUrl: INGREDIENT_PHOTOS.arroz, quantity: 25, unit: 'kg', unitPrice: 1.2 },
  { id: '4', productName: 'Vegetales mixtos', photoUrl: INGREDIENT_PHOTOS.vegetales, quantity: 8, unit: 'kg', unitPrice: 2.25 },
]

export function Compras() {
  const navigate = useNavigate()

  const [supplier, setSupplier] = useState('Distribuidora del Mar S.A.')
  const [purchaseDate, setPurchaseDate] = useState('2025-05-24')
  const [invoiceNumber, setInvoiceNumber] = useState('FAC-0004587')
  const [paymentMethod, setPaymentMethod] = useState('Transferencia bancaria')
  const [paymentStatus, setPaymentStatus] = useState('Pagado')
  const [notes, setNotes] = useState('Entrega en bodega. Mercadería en buen estado.')

  const [items, setItems] = useState<PurchaseRow[]>(MOCK_ITEMS)
  const [discount, setDiscount] = useState('0.00')
  const [transportCost] = useState(10.0)
  const [attachedFile, setAttachedFile] = useState<{ name: string; size: string } | null>({
    name: 'FAC-0004587.pdf',
    size: '1.2 MB',
  })

  const subtotal = useMemo(() => {
    return items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
  }, [items])

  const discountVal = parseFloat(discount) || 0
  const taxVal = (subtotal - discountVal) * 0.12
  const totalFinal = subtotal + transportCost - discountVal + taxVal
  const pendingBalance = paymentStatus === 'Pendiente' ? totalFinal : 0

  const handleAddItem = () => {
    const newItem: PurchaseRow = {
      id: String(Date.now()),
      productName: 'Nuevo insumo',
      photoUrl: INGREDIENT_PHOTOS.default,
      quantity: 1,
      unit: 'kg',
      unitPrice: 1.0,
    }
    setItems([...items, newItem])
  }

  const handleRemoveItem = (id: string) => {
    setItems(items.filter((i) => i.id !== id))
  }

  const handleUpdateItem = (id: string, field: keyof PurchaseRow, value: string | number) => {
    setItems(items.map((i) => (i.id === id ? { ...i, [field]: value } : i)))
  }

  return (
    <div className="compras-page animate-fade-in">
      {/* Header Row */}
      <div className="compras-header-row">
        <button className="btn-back-square" onClick={() => navigate(-1)}>
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="compras-page-title">Registrar compra</h1>
          <p className="compras-page-sub">Registra una nueva compra a proveedores y controla tus costos.</p>
        </div>
      </div>

      {/* Main 2-Column Grid */}
      <div className="compras-main-grid">
        {/* LEFT COLUMN: Datos de compra + Productos */}
        <div className="compras-left-col">
          {/* Card 1: Datos de la compra */}
          <div className="compras-card">
            <h2 className="compras-card-title">Datos de la compra</h2>

            <div className="form-fields-grid mt-3">
              {/* Proveedor */}
              <div className="form-group-item">
                <label className="input-label">Proveedor <span className="text-red">*</span></label>
                <select
                  className="input-control-select"
                  value={supplier}
                  onChange={(e) => setSupplier(e.target.value)}
                >
                  <option value="Distribuidora del Mar S.A.">Distribuidora del Mar S.A.</option>
                  <option value="Comercial Oriental C.A.">Comercial Oriental C.A.</option>
                  <option value="Avícola San José">Avícola San José</option>
                </select>
              </div>

              {/* Fecha */}
              <div className="form-group-item">
                <label className="input-label">Fecha <span className="text-red">*</span></label>
                <div className="input-with-icon">
                  <Calendar size={14} className="input-left-icon" />
                  <input
                    type="date"
                    className="input-control"
                    value={purchaseDate}
                    onChange={(e) => setPurchaseDate(e.target.value)}
                  />
                </div>
              </div>

              {/* Número de factura */}
              <div className="form-group-item">
                <label className="input-label">Número de factura <span className="text-red">*</span></label>
                <input
                  type="text"
                  className="input-control"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  placeholder="FAC-0004587"
                />
              </div>

              {/* Forma de pago */}
              <div className="form-group-item">
                <label className="input-label">Forma de pago <span className="text-red">*</span></label>
                <div className="input-with-icon">
                  <CreditCard size={14} className="input-left-icon" />
                  <select
                    className="input-control-select with-icon"
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                  >
                    <option value="Transferencia bancaria">Transferencia bancaria</option>
                    <option value="Efectivo">Efectivo</option>
                    <option value="Pago móvil">Pago móvil</option>
                    <option value="Punto">Punto</option>
                  </select>
                </div>
              </div>

              {/* Estado de pago */}
              <div className="form-group-item">
                <label className="input-label">Estado de pago <span className="text-red">*</span></label>
                <div className="status-select-wrap">
                  <span className={`dot-status ${paymentStatus === 'Pagado' ? 'green' : 'amber'}`} />
                  <select
                    className="input-control-select with-dot"
                    value={paymentStatus}
                    onChange={(e) => setPaymentStatus(e.target.value)}
                  >
                    <option value="Pagado">Pagado</option>
                    <option value="Pendiente">Pendiente</option>
                  </select>
                </div>
              </div>

              {/* Observaciones */}
              <div className="form-group-item">
                <label className="input-label">Observaciones</label>
                <textarea
                  className="input-control-textarea"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Entrega en bodega. Mercadería en buen estado."
                  rows={2}
                />
              </div>
            </div>
          </div>

          {/* Card 2: Productos Table matching target mockup */}
          <div className="compras-card mt-4">
            <h2 className="compras-card-title">Productos</h2>

            <div className="compras-table-wrapper mt-3">
              <table className="compras-products-table">
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
                    const totalRow = item.quantity * item.unitPrice
                    return (
                      <tr key={item.id}>
                        <td>
                          <div className="product-item-cell">
                            <img src={item.photoUrl} alt={item.productName} className="product-mini-thumb" />
                            <input
                              type="text"
                              className="input-table-text"
                              value={item.productName}
                              onChange={(e) => handleUpdateItem(item.id, 'productName', e.target.value)}
                            />
                          </div>
                        </td>
                        <td>
                          <input
                            type="number"
                            className="input-table-num"
                            value={item.quantity}
                            onChange={(e) => handleUpdateItem(item.id, 'quantity', Number(e.target.value))}
                          />
                        </td>
                        <td>
                          <select
                            className="input-table-select"
                            value={item.unit}
                            onChange={(e) => handleUpdateItem(item.id, 'unit', e.target.value)}
                          >
                            <option value="kg">kg</option>
                            <option value="L">L</option>
                            <option value="und">und</option>
                            <option value="g">g</option>
                          </select>
                        </td>
                        <td>
                          <div className="price-input-cell">
                            <span className="currency-symbol">$</span>
                            <input
                              type="number"
                              step="0.01"
                              className="input-table-num"
                              value={item.unitPrice}
                              onChange={(e) => handleUpdateItem(item.id, 'unitPrice', Number(e.target.value))}
                            />
                          </div>
                        </td>
                        <td className="font-bold text-white">${totalRow.toFixed(2)}</td>
                        <td>
                          <button className="btn-remove-row" onClick={() => handleRemoveItem(item.id)}>
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <button className="btn-add-product mt-3" onClick={handleAddItem}>
              <Plus size={16} /> Agregar producto
            </button>
          </div>

          {/* Bottom Action Buttons */}
          <div className="compras-bottom-actions mt-4">
            <button className="btn-action-red" onClick={() => navigate('/compras')}>
              <span>📋</span> Guardar compra
            </button>
            <button className="btn-action-dark-red" onClick={() => navigate('/compras')}>
              <span>📦</span> Guardar y agregar inventario
            </button>
            <button className="btn-action-ghost" onClick={() => navigate(-1)}>
              <span>✕</span> Cancelar
            </button>
          </div>
        </div>

        {/* RIGHT COLUMN: Resumen de compra + Adjuntar factura */}
        <div className="compras-right-col">
          {/* Card 1: Resumen de compra */}
          <div className="compras-card">
            <h2 className="compras-card-title">Resumen de compra</h2>

            <div className="summary-rows-list mt-3">
              <div className="summary-line">
                <span className="summary-label">Subtotal</span>
                <span className="summary-val">${subtotal.toFixed(2)}</span>
              </div>

              <div className="summary-line">
                <span className="summary-label info">
                  Transporte <Info size={12} className="info-icon" />
                </span>
                <span className="summary-val">${transportCost.toFixed(2)}</span>
              </div>

              <div className="summary-line">
                <span className="summary-label info">
                  Descuento <Info size={12} className="info-icon" />
                </span>
                <div className="discount-input-cell">
                  <input
                    type="text"
                    className="discount-inline-input"
                    value={discount}
                    onChange={(e) => setDiscount(e.target.value)}
                  />
                  <span className="summary-val">${discountVal.toFixed(2)}</span>
                </div>
              </div>

              <div className="summary-line">
                <span className="summary-label info">
                  Impuestos (IVA 12%) <Info size={12} className="info-icon" />
                </span>
                <span className="summary-val">${taxVal.toFixed(2)}</span>
              </div>

              <div className="summary-divider" />

              <div className="summary-line total">
                <span className="total-final-label">Total final</span>
                <span className="total-final-val">${totalFinal.toFixed(2)}</span>
              </div>

              <div className="summary-divider" />

              <div className="summary-line">
                <span className="summary-label">Saldo pendiente</span>
                <span className="summary-val">${pendingBalance.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Card 2: Adjuntar factura */}
          <div className="compras-card mt-4">
            <h2 className="compras-card-title">Adjuntar factura</h2>

            <div className="drag-drop-zone mt-3">
              <Upload size={28} className="cloud-upload-icon" />
              <p className="drag-drop-text">
                Arrastra tu archivo aquí o <span className="browse-text">Buscar archivo</span>
              </p>
              <span className="drag-drop-hint">Formatos permitidos: PDF, JPG, PNG (Máx. 10MB)</span>
            </div>

            {attachedFile && (
              <div className="file-attached-card mt-3">
                <div className="pdf-icon-square">
                  <FileText size={18} />
                </div>
                <div className="file-info-text">
                  <span className="file-title">{attachedFile.name}</span>
                  <span className="file-size">{attachedFile.size}</span>
                </div>
                <button className="remove-file-btn" onClick={() => setAttachedFile(null)}>
                  <X size={14} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
