# REQUIREMENTS_REUNION_1.md — Requisitos Reunión Inicial

**Fecha de reunión**: 2026-08-08
**Documento fuente**: Transcripción y resumen de la primera reunión con la clienta
**Proyecto**: FullChinaVzla — negocio de comida china venezolana
**Acuerdo inicial**: USD 450, aceptado y con contrato listo. El proyecto completo por fases supera USD 1000.

---

## HECHO (completado)

| # | Requisito | Estado | Notas |
|---|-----------|--------|-------|
| 1 | Esquema SQL `fullchinavzla` aplicado en VPS | ✅ | Tras caja operativa: 30 tablas, 38 funciones, 34 triggers, 11 vistas, 75 políticas |
| 2 | Frontend scaffold funcional | ✅ | Login, navegación, responsive layout |
| 3 | Demo mode eliminada | ✅ | Infraestructura demo (datos hardcodeados, DemoDataProvider, isDemoMode) eliminada completamente |
| 4 | Build/Lint/Test pasan | ✅ | Verificado 2026-08-11; 11 pruebas automatizadas |
| 5 | Backup del VPS realizado | ✅ | 2026-08-08, antes de cambios de seguridad |
| 6 | Acceso anónimo revocado | ✅ | 2026-08-08 |
| 7 | Migraciones atomicas de pagos agregadas | ✅ | 2026-08-08, insert-only con validación |
| 8 | Usuarios reales por rol | ✅ | Dueña, Gerencia y Caja; login y restricciones verificados |
| 9 | Caja operativa | ✅ | Apertura, movimientos, arqueo, diferencia, cierre e historial |

---

## EN PROGRESO

| # | Requisito | Estado | Notas |
|---|-----------|--------|-------|
| 1 | ~~Selector de rol demo~~ | ✅ Eliminado | Se eliminó junto con la infraestructura demo; la autenticación es real con Supabase |
| 2 | Sustituir datos demo por persistencia real | 🔄 | Caja, Comandas, Equipo, Compras, Producción, Recetas y Nómina ahora usan Supabase real. Pendientes: Almacén, Fidelización, Gastos, Marketing, Menú semanal |

---

## PENDIENTE

### Módulos Core (confirmados en reunión)

| # | Módulo | Descripción | Prioridad |
|---|--------|-------------|-----------|
| 1 | **Dashboard / Inicio** | Centro de control: ventas, comparaciones, últimas comandas, producción, porciones, cuentas por cobrar, info financiera, acciones rápidas | P0 |
| 2 | **Ventas / POS** | Selección rápida de productos, búsqueda, cantidades, cliente, modalidad (Mesa/Pickup/Delivery), cobro. Soporte para variantes y extras de productos | P0 |
| 3 | **Comandas** | Estados: Nueva → En preparación → Lista → Delivery/Despacho → Entregada. Múltiples comandas abiertas simultáneamente. Impresión de ticket | P0 |
| 4 | **Caja** | Apertura, movimientos, cierre, historial. Representa dinero físicamente disponible. Preparado para dos cajas futuras. Usuario que maneja la caja | P0 |
| 5 | **Clientes** | Registro rápido: nombre, apellido, teléfono, cédula (opcional), cumpleaños, crédito/límite. Ficha: historial, consumo mes, ticket promedio, favoritos, saldo, visitas, última visita | P0 |
| 6 | **Crédito** | Crear crédito + abono. Clientes específicos con límite | P0 |
| 7 | **Inventario** | Lista de ingredientes con stock actual. Actualización: transferencias almacén + producción - ventas ± ajustes | P0 |
| 8 | **Cierre de caja** | Resumen del día por rol | P0 |

### Módulos Adicionales (confirmados en reunión)

| # | Módulo | Descripción | Prioridad |
|---|--------|-------------|-----------|
| 9 | **Almacén** ⭐ NUEVO | Separar almacén de inventario operativo. Flujo: Compra → Almacén → Producción/Procesamiento → Transferencia → Inventario operativo → Venta. Historial de transferencias | P1 |
| 10 | **Menú** ⭐ NUEVO | Módulo separado de recetas. Productos con fotos, descripción, precio, variantes, extras, disponibilidad, categorías. Platos temporales/semanales: Activo/Inactivo/Programado | P1 |
| 11 | **Promociones** | Separadas del menú. Combinar productos existentes con precio promocional, vigencia, activa/inactiva. Conectar con WhatsApp/marketing | P1 |
| 12 | **Recetas** | Ingredientes, cantidad, unidad, costo, preparación, costo total, costo por porción, cantidad producida. Venta → receta → descuento automático inventario | P1 |
| 13 | **Producción** | Lotes: materia prima utilizada, cantidad entrada, cantidad producida, merma, costo total, costo por porción, fecha, historial. Ejemplo: 10kg pollo → 40 porciones | P1 |
| 14 | **Compras y Proveedores** | Registrar compras con proveedor. Asociar establecimiento a compras y productos habituales | P1 |
| 15 | **Gastos** | Categorías: fijos (nómina, delivery, sistema, comisiones, mantenimiento, limpieza) y variables (pan, reparaciones, compras puntuales). Análisis por categoría y establecimiento | P1 |
| 16 | **Finanzas** | Consolidado: ventas - gastos = resultado. Ingresos, egresos, ventas por método de pago, cuentas por cobrar/pagar, rentabilidad, punto de equilibrio, comparaciones por períodos | P1 |
| 17 | **Nómina** | Empleados, salario/pago, valores adicionales, descuentos, vales/anticipos, comisiones, pago por producción, total a pagar, historial. Alimenta Finanzas automáticamente | P1 |
| 18 | **Fidelización** ⭐ NUEVO | Medir por cantidad de visitas (confirmado por dueña, pendiente confirmar con esposo). Recompensas por recurrencia (ej: 10 visitas → recompensa). Identificar: frecuentes, inactivos | P1 |
| 19 | **Marketing / WhatsApp** ⭐ NUEVO | Automatizaciones: cumpleaños, agradecimiento post-compra, reactivación (configurable, ej: 21 días), promociones. Segmentación: todos, frecuentes, inactivos, fieles. Módulo: Automatizaciones, Campañas, Plantillas, Segmentos, Historial | P1 |

### Módulos Futuros

| # | Módulo | Descripción | Prioridad |
|---|--------|-------------|-----------|
| 20 | **Equipo / Usuarios** | Permisos por rol. Ejemplo: caja solo ve ventas+comandas+clientes; dueña ve todo | P2 |
| 21 | **Reportes** | Semanales, por período, comparativos | P2 |
| 22 | **Configuración** | Ajustes del sistema, categorías de gastos, supermercados, etc. | P2 |
| 23 | **Offline sync** | PWA sin conexión (no prometido, pero deseable) | P2 |
| 24 | **Facturación/SENIAT** | No en MVP actual. Dejar arquitectura preparada | P2 |

---

## Decisiones Confirmadas

| # | Decisión | Notas |
|---|----------|-------|
| 1 | Un solo negocio, una sola ubicación | Negocio de comida china venezolana |
| 2 | Tres usuarios iniciales | Dueña, hermano-administración, encargado/cajera |
| 3 | Schema aislado `fullchinavzla` | Ya aplicado en VPS |
| 4 | Supabase self-hosted en VPS | No crear proyecto Cloud separado |
| 5 | Mobile-first | La experiencia móvil es fundamental, no web de escritorio encogida |
| 6 | Comandas abiertas | Cliente puede pedir algo adicional durante su visita; no cerrar automáticamente |
| 7 | Modalidades: Mesa / Pickup / Delivery | Delivery inicia en WhatsApp. Pago móvil puede requerir confirmación antes de cocina |
| 8 | Fidelización por visitas | La dueña prefiere medir por cantidad de visitas, no por dinero. Pendiente confirmar con esposo |
| 9 | Almacén separado de inventario | Compra → Almacén → Producción → Transferencia → Inventario operativo |
| 10 | Menú separado de recetas | Menú = lo que se vende. Receta = cómo se compone y qué descuenta del inventario |
| 11 | Platos temporales/semanales | Crear plato temporal, activar esta semana, desactivar después, conservar en sistema |
| 12 | Gastos fijos vs variables | Categorías con análisis por categoría y establecimiento |
| 13 | Producción: lumpias simplificado | Siempre la misma persona produce. Cantidad × tarifa = pago |
| 14 | Segundo proyecto: tienda online | NO es FullChina. Página simple: catálogo → carrito → WhatsApp. Precio separado (~USD 100) |

---

## Información Pendiente de la Clienta

| # | Item | Notas |
|---|------|-------|
| 1 | Excel de producción | Para migrar datos al sistema |
| 2 | Información del sistema actual | Revisar para migración |
| 3 | Menú completo | Revisar menú físico vs WhatsApp Business |
| 4 | Platos nuevos | Los que no están en el menú actual |
| 5 | Variantes y extras | Ej: fuki con todo, sin camarón, extras |
| 6 | Categorías reales de gastos | Fijos y variables |
| 7 | Lista de proveedores/supermercados | Para asociar a compras |
| 8 | Reglas exactas de fidelización | Cantidad de visitas para recompensa |
| 9 | Confirmar con esposo si "mejor cliente" = más visitas | Pendiente |
| 10 | Definir usuarios y permisos | Quién ve qué |
| 11 | Definir estructura exacta de nómina | Empleados, salarios, descuentos |
| 12 | Flujos detallados: Mesa, Delivery, Pickup | Paso a paso de cada modalidad |
| 13 | Flujo de producción | Paso a paso con datos reales |
| 14 | Flujo Almacén → Inventario | Transferencias y cantidades |
| 15 | Fotos de platos | Para el menú en el sistema |

---

## Preguntas de la Reunión (respondidas)

| Pregunta | Respuesta |
|----------|-----------|
| ¿Nombre comercial? | FullChinaVzla (comida china venezolana) |
| ¿Esquema? | `fullchinavzla` (ya aplicado) |
| ¿Métodos de pago? | Efectivo, tarjeta, pago móvil, combinados |
| ¿Impresión de tickets? | Sí, actualmente la usan |
| ¿Facturación/SENIAT? | Futuro, no en MVP. Dejar preparado |
| ¿Cuántas cajas? | Una actualmente, preparar para dos |
| ¿Quién produce lumpias? | Siempre la misma persona |

---

## Flujo de Negocio Confirmado

### Mesa
```
Cliente llega → Se abre comanda → Se envían productos a cocina
→ Comanda permanece abierta → Cliente puede seguir agregando
→ Solicita pagar → Se cobra → Se cierra la comanda
```

### Delivery
```
Cliente escribe WhatsApp → Consulta menú/promociones
→ Empleado toma pedido → Crea comanda → Informa total
→ Cliente selecciona/paga → Se confirma → Cocina → Delivery → Entregado
```
Excepción: Pago móvil puede requerir confirmación antes de cocina. Efectivo permite enviar a cocina sin cobrar previamente.

### Producción
```
Compra materia prima → Almacén → Procesamiento/Producción
→ Porcionado → Transferencia a inventario operativo → Venta
```

---

## Segundo Proyecto (NO FullChina)

- Tienda online sencilla para otro negocio de la clienta
- Cliente abre enlace → ve catálogo → agrega → carrito → envía pedido a WhatsApp
- Admin básico: agregar/quitar productos, disponibilidad, fotos, descripción, precio, cantidad
- Precio estimado: ~USD 100
- **No mezclar con FullChina**

---

## Notas de la Reunión

- La clienta no considera que su sistema actual sea malo; es funcional para ventas pero no cubre toda la operación
- El hermano maneja la administración y genera reportes diarios manualmente
- La clienta pasa buena parte del día fuera del negocio y quiere ver/controlar desde su teléfono
- La experiencia móvil es prioritaria: "que se sienta como una aplicación"
- La dueña quiere acceso completo desde cualquier lugar
- Actualmente usan WhatsApp Business para delivery y tiene buena parte del menú
