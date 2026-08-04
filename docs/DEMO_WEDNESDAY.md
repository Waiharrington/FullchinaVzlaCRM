# DEMO_WEDNESDAY.md — Plan Ejecutable Demo Miércoles

**Fecha objetivo**: Miércoles 5 de agosto de 2026
**Precio**: USD 500

## Vertical Slice — Flujo Completo

La demo debe mostrar un **flujo vertical completo** que justifique el precio.
No necesita todo el sistema, pero sí debe parecer una app real.

### Selector de Rol Demo (P0)

El login muestra 3 botones: **Owner**, **Manager**, **Cashier**. Cada uno
controla qué secciones ve el usuario en la UI:

- **Owner**: ve todo (costos, rentabilidad, reportes, configuración)
- **Manager**: operación + reportes (producción, inventario, compras, gastos, reportes)
- **Cashier**: caja, pedidos, clientes/créditos, inventario sin costos

> Esto es un mecanismo **DEMO local**. No es autenticación real ni prueba de
> seguridad RLS. La seguridad real se implementará en Supabase post-demo.

### Flujo Prioritario

```
Login demo → Dashboard → Caja → Crear orden → Agregar productos
→ Cobrar → Recibo/estado paid → Inventario visible
→ Crédito/abono → Cierre/resumen
```

## Cronograma por Bloques

### Lunes 3 agosto (hoy) — Mañana

| Bloque | Tiempo | Entregable |
|--------|--------|------------|
| Selector de rol demo | 30min | Login con 3 botones: Owner, Manager, Cashier |
| Dashboard básico | 1h | Resumen del día: ventas, inventario bajo, órdenes |
| Caja: selector productos | 1.5h | Grid de productos con precios, agregar a orden |

### Lunes 3 agosto — Tarde

| Bloque | Tiempo | Entregable |
|--------|--------|------------|
| Caja: carrito y cobro | 1.5h | Resumen de orden, método de pago, confirmar |
| Inventario: lista | 1h | Ingredientes con stock, productos vendibles |
| Crédito: crear y abonar | 1h | Formulario crédito, lista de créditos, abonar |

### Martes 4 agosto — Mañana

| Bloque | Tiempo | Entregable |
|--------|--------|------------|
| Cierre de caja | 1h | Resumen del día por rol |
| Pulir responsive | 1.5h | Verificar mobile 390x844, desktop 1280px |
| Datos demo | 1h | Dataset coherente: productos, ingredientes, precios |

### Martes 4 agosto — Tarde

| Bloque | Tiempo | Entregable |
|--------|--------|------------|
| Testing visual | 1h | Recorrer flujo completo en ambos tamaños |
| Plan B offline | 1h | Verificar que funciona sin internet |
| Preparación presentación | 1h | Ensayo del flujo, preparar laptop/tablet |

### Miércoles 5 agosto — Mañana

| Bloque | Tiempo | Entregable |
|--------|--------|------------|
| Última revisión | 1h | Build, lint, test, flujo completo |
| Backup | 30min | Asegurar respaldo: conservar `dist/` + copia local etiquetada/ZIP si autorizado |
| **DEMO** | 30-45min | Presentación a la clienta |

## Criterios de Aceptación

### Mobile (390x844 — iPhone 14)

- [ ] Login accesible y claro
- [ ] BottomNav visible y funcional
- [ ] Dashboard con datos visibles sin scroll horizontal
- [ ] Caja: productos en grid de 2 columnas
- [ ] Caja: carrito desplazable
- [ ] Caja: botón cobrar accesible con pulgar
- [ ] Inventario: lista scrolleable
- [ ] Crédito: formulario usable
- [ ] Cierre: resumen legible

### Desktop (1280px)

- [ ] Sidebar visible con 4 secciones
- [ ] Dashboard con cards distribuidas
- [ ] Caja: productos en grid de 3-4 columnas
- [ ] Caja: carrito lateral o modal
- [ ] Inventario: tabla completa
- [ ] Todo el espacio horizontal aprovechado

### Funcional

- [ ] Login demo accede directo (sin credenciales)
- [ ] Selector de rol en login (owner/manager/cashier) — controla visibilidad UI
- [ ] Dashboard muestra datos del día
- [ ] Caja: flujo completo crear→cobrar→confirmar
- [ ] Inventario: lista ingredientes y productos
- [ ] Crédito: crear y abonar
- [ ] Cierre: resumen por rol

## Dataset Demo (sin datos reales)

### Productos vendibles

| Producto | Precio |
|----------|--------|
| Hamburguesa Clásica | $8.00 |
| Hamburguesa Doble | $10.00 |
| Papas Fritas | $4.00 |
| Refresco | $2.00 |
| Hot Dog | $5.00 |
| Tacos (3 und) | $6.00 |
| Agua | $1.50 |
| Postre del día | $3.50 |

### Ingredientes (ejemplo)

| Ingrediedad | Stock | Unidad |
|-------------|-------|--------|
| Pan hamburguesa | 50 | und |
| Carne molida | 10 | lb |
| Papas | 15 | lb |
| Lechuga | 8 | lb |
| Tomate | 6 | lb |
| Queso | 5 | lb |
| Salchicha | 30 | und |
| Tortilla | 40 | und |

### Usuarios demo

| Nombre | Rol | Para mostrar |
|--------|-----|--------------|
| Dueña | owner | Todo: costos, reportes, config |
| Encargado | manager | Operación: inventario, producción |
| Cajera | cashier | Solo ventas: caja, comandas |

## Mock Local vs Real

### Puede ser Mock (datos hardcodeados)

- Dashboard: ventas del día, inventario bajo
- Caja: productos disponibles, precios
- Inventario: lista de ingredientes con stock
- Crédito: lista de créditos demo
- Cierre: resumen del día

### Debe parecer real (interacción funcional)

- Navegación entre páginas
- Crear orden y verla en la lista
- Agregar/quitar productos del carrito
- Procesar cobro y ver confirmación
- Crear crédito y abonar
- Ver cierre del día

### NO construir todavía

- Conexión real a Supabase
- Autenticación real
- Persistencia de datos (todo se resetea al recargar)
- CRUD completo de inventario
- Producción/lotes
- Nómina
- Reportes PDF
- Exportación de datos
- Multi-usuario real
- Offline sync

## Plan B — Si algo falla

1. **Si no compila**: Usar la última versión funcional conocida (guardar `dist/` previo)
2. **Si falla responsive**: Usar solo desktop (1280px)
3. **Si falla un módulo**: Saltarlo, mostrar los que funcionan
4. **Sin internet**: La app funciona en modo demo (sin backend)
5. **Datos faltantes**: Recargar página (datos se resetean, es demo)

## Checklist Final Antes de la Demo

- [ ] Build exitoso (`npm run build`)
- [ ] Sin warnings de lint
- [ ] Todos los tests pasan
- [ ] Flujo completo probado en mobile y desktop
- [ ] Selector de rol demo funciona (owner/manager/cashier)
- [ ] Datos demo coherentes (no vacíos ni absurdos)
- [ ] No hay datos reales de la clienta
- [ ] No hay secretos expuestos
- [ ] Laptop/tablet cargada
- [ ] Navegador abierto en localhost:5173
- [ ] Respaldo: `dist/` conservado + copia local etiquetada/ZIP si autorizado
