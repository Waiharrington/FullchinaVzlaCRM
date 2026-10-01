import type { InventorySnapshotItem, InventorySnapshotUpdate } from './dataService'
import { normalizeForSearch } from './textFormat'

const MAX_IMPORT_BYTES = 10 * 1024 * 1024
const MAX_IMPORT_ROWS = 1000

export interface InventoryImportChange {
  item: InventorySnapshotItem
  targetOperational: number
  targetWarehouse: number
}

export interface InventoryImportPreview {
  sourceFileName: string
  sourceRowCount: number
  matchedCount: number
  skippedDeliveryCount: number
  skippedNonInventoryCount: number
  movementCount: number
  negativeCount: number
  changes: InventoryImportChange[]
  updates: InventorySnapshotUpdate[]
  unchangedItems: InventorySnapshotItem[]
  missingItems: InventorySnapshotItem[]
  warnings: string[]
}

function headerKey(value: unknown): string {
  return normalizeForSearch(String(value ?? '')).replace(/[^a-z0-9]/g, '')
}

function valueAt(row: unknown[], index: number | undefined): unknown {
  return index === undefined ? undefined : row[index]
}

function parseQuantity(value: unknown, rowNumber: number, field: string): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value !== 'string' || !value.trim()) throw new Error(`Fila ${rowNumber}: falta la cantidad de ${field}.`)
  let text = value.trim().replace(/\s/g, '')
  if (text.includes(',') && text.includes('.')) {
    text = text.lastIndexOf(',') > text.lastIndexOf('.') ? text.replace(/\./g, '').replace(',', '.') : text.replace(/,/g, '')
  } else if (text.includes(',')) {
    text = text.replace(',', '.')
  }
  const parsed = Number(text)
  if (!Number.isFinite(parsed)) throw new Error(`Fila ${rowNumber}: la cantidad de ${field} no es numérica.`)
  return parsed
}

function normalizeUnit(value: unknown): string {
  const unit = headerKey(value)
  if (['kg', 'kilo', 'kilos', 'kilogramo', 'kilogramos'].includes(unit)) return 'kg'
  if (['l', 'lt', 'lts', 'litro', 'litros'].includes(unit)) return 'l'
  if (['u', 'und', 'unidad', 'unidades'].includes(unit)) return 'und'
  if (['por', 'porcion', 'porciones'].includes(unit)) return 'por'
  return unit
}

function normalizedName(value: unknown): string {
  return headerKey(value)
}

function productIdNumber(value: unknown): string | null {
  if (typeof value === 'number' && Number.isInteger(value)) return String(value)
  const text = String(value ?? '').trim().replace(/\.0+$/, '')
  return /^\d+$/.test(text) ? text : null
}

function findHeader(headers: string[], aliases: string[]): number | undefined {
  return headers.findIndex(header => aliases.includes(header)) >= 0
    ? headers.findIndex(header => aliases.includes(header))
    : undefined
}

export async function previewInventoryWorkbook(file: File, inventory: InventorySnapshotItem[]): Promise<InventoryImportPreview> {
  if (!/\.(xlsx|xls)$/i.test(file.name)) throw new Error('Selecciona un archivo Excel .xlsx o .xls.')
  if (file.size > MAX_IMPORT_BYTES) throw new Error('El archivo supera el límite de 10 MB.')
  if (file.size === 0) throw new Error('El archivo está vacío.')

  const XLSX = await import('xlsx')
  const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: false })
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) throw new Error('El archivo no contiene hojas de cálculo.')
  const sheet = workbook.Sheets[sheetName]
  if (!sheet) throw new Error('No se pudo leer la primera hoja del archivo.')
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: null, blankrows: false }) as unknown[][]
  const headerIndex = rows.findIndex(row => Array.isArray(row) && row.some(cell => headerKey(cell) === 'nombredeproducto'))
  if (headerIndex < 0) throw new Error('No encuentro la columna “Nombre de Producto” en la primera hoja.')

  const headers = (rows[headerIndex] as unknown[]).map(headerKey)
  const nameIndex = findHeader(headers, ['nombredeproducto', 'producto', 'nombre'])
  const systemIdIndex = findHeader(headers, ['idsistema', 'idinterno'])
  const productIdIndex = findHeader(headers, ['idproducto', 'idexterno'])
  const skuIndex = findHeader(headers, ['sku', 'codigo', 'codigoproducto'])
  const unitIndex = findHeader(headers, ['unidaddeinventario', 'unidadinventario', 'unidad'])
  const totalIndex = findHeader(headers, ['totalinv', 'totalinventario', 'total'])
  const operationalIndex = findHeader(headers, ['produccioninv', 'stockoperativo', 'produccion'])
  const warehouseIndex = findHeader(headers, ['depositoinv', 'stockdeposito', 'deposito', 'almacen'])
  if (nameIndex === undefined || operationalIndex === undefined || warehouseIndex === undefined) {
    throw new Error('El Excel debe incluir Nombre de Producto, Producción y Depósito para conservar ambas ubicaciones.')
  }
  if (systemIdIndex === undefined && productIdIndex === undefined && skuIndex === undefined) {
    throw new Error('El Excel debe incluir ID Producto, SKU o ID Sistema para identificar cada registro.')
  }

  const dataRows = rows.slice(headerIndex + 1).filter(row => Array.isArray(row) && row.some(value => value !== null && value !== undefined && String(value).trim() !== ''))
  if (dataRows.length === 0) throw new Error('La hoja no contiene filas de inventario.')
  if (dataRows.length > MAX_IMPORT_ROWS) throw new Error(`La hoja supera el límite de ${MAX_IMPORT_ROWS} filas.`)

  const byId = new Map(inventory.map(item => [item.id.toLowerCase(), item]))
  const bySourceKey = new Map(inventory.filter(item => item.sourceKey).map(item => [item.sourceKey!.toLowerCase(), item]))
  const byCode = new Map<string, InventorySnapshotItem[]>()
  for (const item of inventory) {
    if (!item.sourceCode) continue
    const key = item.sourceCode.trim().toLocaleLowerCase('es-VE')
    byCode.set(key, [...(byCode.get(key) ?? []), item])
  }

  const matched = new Map<string, InventoryImportChange>()
  const warnings: string[] = []
  let skippedDeliveryCount = 0
  let skippedNonInventoryCount = 0
  let sourceRowCount = 0
  const errors: string[] = []

  for (let index = 0; index < dataRows.length; index += 1) {
    const row = dataRows[index] as unknown[]
    if (!row.some(value => value !== null && value !== undefined && String(value).trim() !== '')) continue
    sourceRowCount += 1
    const rowNumber = headerIndex + index + 2
    const name = String(valueAt(row, nameIndex) ?? '').trim()
    const nameKey = normalizedName(name)
    const sourceCode = String(valueAt(row, skuIndex) ?? '').trim()
    const productId = productIdNumber(valueAt(row, productIdIndex))
    if (nameKey === 'delivery' || (productId === '57' && sourceCode.toUpperCase() === 'P54')) {
      skippedDeliveryCount += 1
      continue
    }

    let item: InventorySnapshotItem | undefined
    const systemId = String(valueAt(row, systemIdIndex) ?? '').trim()
    if (systemId) item = byId.get(systemId.toLowerCase())
    else if (productId !== null) item = bySourceKey.get(`ingredient:${productId}`)
    else if (sourceCode) {
      const codeMatches = byCode.get(sourceCode.toLocaleLowerCase('es-VE')) ?? []
      const nameMatches = codeMatches.filter(candidate => normalizedName(candidate.name) === nameKey)
      if (nameMatches.length === 1) item = nameMatches[0]
      else if (nameMatches.length > 1 || (codeMatches.length > 1 && nameMatches.length !== 1)) {
        errors.push(`Fila ${rowNumber}: el SKU ${sourceCode} se repite y necesita ID Producto.`)
        continue
      } else if (codeMatches.length === 1) item = codeMatches[0]
    }

    if (!item) {
      errors.push(`Fila ${rowNumber}: no encuentro “${name || sourceCode || productId || 'sin nombre'}” en el inventario actual.`)
      continue
    }
    if (matched.has(item.id)) {
      errors.push(`Fila ${rowNumber}: “${item.name}” aparece más de una vez en el archivo.`)
      continue
    }
    if (item.inventoryClass === 'non_inventory') {
      skippedNonInventoryCount += 1
      continue
    }
    if (sourceCode && item.sourceCode && sourceCode.toLocaleLowerCase('es-VE') !== item.sourceCode.toLocaleLowerCase('es-VE')) {
      errors.push(`Fila ${rowNumber}: el SKU ${sourceCode} no corresponde a “${item.name}”.`)
      continue
    }
    if (name && normalizedName(item.name) !== nameKey) warnings.push(`Fila ${rowNumber}: el ID coincide con “${item.name}”, aunque el nombre del Excel difiere (“${name}”).`)

    const fileUnit = normalizeUnit(valueAt(row, unitIndex))
    const currentUnit = normalizeUnit(item.unitSymbol) || normalizeUnit(item.unitName)
    if (fileUnit && currentUnit && fileUnit !== currentUnit) {
      errors.push(`Fila ${rowNumber}: la unidad ${String(valueAt(row, unitIndex))} no coincide con ${item.unitSymbol} de “${item.name}”.`)
      continue
    }

    let targetOperational: number
    let targetWarehouse: number
    try {
      targetOperational = parseQuantity(valueAt(row, operationalIndex), rowNumber, 'Producción')
      targetWarehouse = parseQuantity(valueAt(row, warehouseIndex), rowNumber, 'Depósito')
      const combined = targetOperational + targetWarehouse
      if (totalIndex !== undefined && valueAt(row, totalIndex) !== null) {
        const statedTotal = parseQuantity(valueAt(row, totalIndex), rowNumber, 'Total')
        if (Math.abs(statedTotal - combined) > 0.000001) throw new Error(`Fila ${rowNumber}: Total no coincide con Producción + Depósito.`)
      }
    } catch (error) {
      errors.push(error instanceof Error ? error.message : `Fila ${rowNumber}: no pude leer sus cantidades.`)
      continue
    }
    matched.set(item.id, { item, targetOperational, targetWarehouse })
  }

  if (errors.length > 0) throw new Error(errors.slice(0, 8).join('\n'))
  const changes = [...matched.values()].filter(({ item, targetOperational, targetWarehouse }) =>
    Math.abs(targetOperational - item.operationalStock) > 0.000000001 || Math.abs(targetWarehouse - item.warehouseStock) > 0.000000001,
  )
  const unchangedItems = [...matched.values()].filter(({ item, targetOperational, targetWarehouse }) =>
    Math.abs(targetOperational - item.operationalStock) <= 0.000000001 && Math.abs(targetWarehouse - item.warehouseStock) <= 0.000000001,
  ).map(change => change.item)
  const updates = [...matched.values()].map(({ item, targetOperational, targetWarehouse }) => ({
    ingredientId: item.id,
    operationalStock: targetOperational,
    warehouseStock: targetWarehouse,
  }))
  const matchedIds = new Set(matched.keys())
  const missingItems = inventory.filter(item => item.isActive && item.inventoryClass !== 'non_inventory' && !matchedIds.has(item.id))

  return {
    sourceFileName: file.name,
    sourceRowCount,
    matchedCount: matched.size,
    skippedDeliveryCount,
    skippedNonInventoryCount,
    movementCount: changes.reduce((sum, { item, targetOperational, targetWarehouse }) =>
      sum + Number(Math.abs(targetOperational - item.operationalStock) > 0.000000001)
        + Number(Math.abs(targetWarehouse - item.warehouseStock) > 0.000000001), 0),
    negativeCount: [...matched.values()].filter(({ targetOperational, targetWarehouse }) => targetOperational < 0 || targetWarehouse < 0).length,
    changes,
    updates,
    unchangedItems,
    missingItems,
    warnings,
  }
}

export async function exportInventoryWorkbook(inventory: InventorySnapshotItem[]): Promise<void> {
  const XLSX = await import('xlsx')
  const headers = [
    'Nombre de Producto', 'ID Producto', 'SKU', 'Unidad', 'Unidad de Inventario',
    'Total', 'Total Inv.', 'Produccion', 'Produccion Inv.', 'Deposito', 'Deposito Inv.',
    'ID Sistema', 'Clase de inventario',
  ]
  const rows = inventory.map(item => {
    const total = item.operationalStock + item.warehouseStock
    const id = item.sourceKey?.match(/^ingredient:(\d+)$/)?.[1] ?? ''
    return [
      item.name, id ? Number(id) : '', item.sourceCode ?? '', item.unitName, item.unitName,
      total, total, item.operationalStock, item.operationalStock,
      item.warehouseStock, item.warehouseStock, item.id, item.inventoryClass,
    ]
  })
  const worksheet = XLSX.utils.aoa_to_sheet([
    ['Inventario FullChinaVzla — exportación actual'],
    headers,
    ...rows,
  ])
  worksheet['!cols'] = [
    { wch: 30 }, { wch: 13 }, { wch: 12 }, { wch: 18 }, { wch: 22 },
    { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 18 }, { wch: 14 }, { wch: 16 },
    { wch: 38 }, { wch: 22 },
  ]
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Inventario')
  const date = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Caracas' })
  XLSX.writeFile(workbook, `inventario-fullchinavzla-${date}.xlsx`, { compression: true, bookType: 'xlsx' })
}
