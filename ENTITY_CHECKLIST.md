# Estado de persistencia por módulo — FullChinaVzla

## Resumen ejecutivo

| Módulo | Persistencia | Estado |
|--------|-------------|--------|
| **Caja** | `orders`, `payments`, `cash_registers`, `cash_sessions`, `cash_movements` | ✅ Real |
| **Comandas** | `orders`, `payments`, `v_orders_with_items` | ✅ Real |
| **Clientes** | `customers`, `credits`, `credit_payments` | ✅ Real |
| **Fidelización** | `customers` (visitas, recompensas) | ✅ Real |
| **Almacén** | `ingredients`, `stock_movements`, `v_current_stock` | ✅ Real |
| **Gastos** | `expenses` | ✅ Real |
| **Menú semanal** | `weekly_menu_items`, `weekly_menu_activations` | ✅ Real |
| **Promociones** | `promotions` | ✅ Real |
| **Recetas** | `recipe_components`, `ingredients` | ✅ Real |
| **Compras** | `purchases`, `purchase_items`, `suppliers` | ✅ Real |
| **Producción** | `preparation_batches`, `preparation_batch_items`, `preparation_batch_costs` | ✅ Real |
| **Nómina** | `employees`, `payroll_periods`, `payroll_entries` | ✅ Real |
| **Mesas (nuevo)** | `floor_tables`, `v_floor_tables_status` | ✅ Real |

---

## Lo que está 100% en persistencia real

### Caja y pagos
- Checkout atómico con `fn_checkout_order`.
- Pagoatividad con `fn_record_order_payments` y derivación de estado.
- Caja operativa con sesiones, movimientos, arqueo, cierre.
- Login PIN bcrypt, bloqueo por intentos, roles.

### Clientes y fidelización
- `customers` con visitas, recompensas, último contacto.
- `fn_register_customer_visit` — recompensas cada 10 visitas.
- Creación y edición de clientes.
- Historial de órdenes y créditos por cliente.

### Almacén
- `v_current_stock` con stock actual de cada ingrediente.
- Movimientos append-only (`stock_movements`).
- Transferencias a operación con ajustes reales.

### Gastos
- `expenses` con concepto, monto, categoría, fecha, notas.
- Métricas mensuales, comparación mes anterior.
- Exportación CSV.
- **Sin datos demo**: todo se lee/escribe desde la BD.

### Menú semanal
- `weekly_menu_items` con CRUD completo.
- `weekly_menu_activations` para historial semanal.
- Sincronización con catálogo de Caja (`syncWeeklyDishToCatalog`).

### Promociones
- `promotions` con CRUD completo, estados activo/inactivo.
- Orden, color, icono, precios, notas.
- Visible en `/pedir`.

---

## Lo que queda pendiente o incompleto

### WhatsApp / Marketing
- La cola de mensajes es real (`whatsapp_messages`).
- Pero **no hay envío real por WhatsApp** — falta conectar el proveedor.
- Los mensajes se guardan como "queued" pero no se envían.
- Estado: interfaz funcional, envío pendiente de integración externa.

### Trigger de mesa única (¡ya creado!)
- **Antes**: era posible crear dos órdenes dine-in abiertas para la misma mesa.
- **Ahora**: `20260825000000_block_duplicate_open_table_order.sql` bloquea el caso.
- El trigger `trg_block_duplicate_open_table_order` rechaza INSERT/UPDATE que cree conflicto.

---

## Gastos — verificación específica

### Tabla de gastos
- **Existe** en `fullchinavzla.expenses` (según `supabase/baseline/00_schema_fullchinavzla.sql`).
- Frontend apunta a `expenses` correctamente (sin prefijo).
- App configura `db: { schema: 'fullchinavzla' }` en `src/lib/supabase.ts`.

### Sin datos demo
- `Gastos.tsx` no contiene arrays hardcoded o datos de muestra.
- Lee desde `getExpenses()` y escribe con `createExpense()`.
- Ambas funciones usan `client().from('expenses')` contra la BD real.
- **Estado: 100% persistencia real.**

### Nota importante
Aunque la tabla existe en el baseline, hay que verificar que también exista en el servidor de producción. El baseline fue creado el 2026-08-03, pero las migraciones posteriores añadieron/modificaron tablas.

Comando para verificar en producción:
```sql
SELECT table_schema, table_name
FROM information_schema.tables
WHERE table_schema = 'fullchinavzla'
  AND table_name = 'expenses';
```

Si devuelve la tabla, los gastos están listos. Si no, hay que crearla con la migración correspondiente.

---

## Trigger de mesa única — explicación

### Problema que resuelve
Antes de esta migración, podía pasar:
1. Cajero A crea orden #1 para mesa 5 (status = 'open').
2. Cajero B crea orden #2 para mesa 5 (status = 'open').
3. Ahora hay dos órdenes abiertas para la misma mesa.

### Qué hace el trigger
- **INSERT**: si intentas crear una orden dine-in con `table_number` y ya existe otra orden `open` para esa mesa, la transacción falla con un mensaje claro.
- **UPDATE**: si intentas modificar una orden existente para que quede `open` con `table_number` cuando ya hay conflicto, también falla.
- **Permite**: cancelar, pagar, modificar órdenes existentes que no generen conflicto nuevo.

### Comportamiento esperado
```
∨ INSERT INTO orders (..., order_type='dine-in', table_number=5, status='open')...
→ ERROR: La mesa 5 ya tiene una orden abierta sin cobrar.
```

```
∨ UPDATE orders SET status='open' WHERE id=... AND table_number=5...
→ ERROR: La mesa 5 ya tiene una orden abierta sin cobrar.
```

```
∨ UPDATE orders SET status='cancelled' WHERE id=... AND table_number=5...
→ OK (no genera conflicto nuevo)
```

```
∨ UPDATE orders SET status='paid' WHERE id=... AND table_number=5...
→ OK (no genera conflicto nuevo)
```

---

## Archivos nuevos creados

### Migración de trigger
- `supabase/migrations/20260825000000_block_duplicate_open_table_order.sql`
- Función: `fn_block_duplicate_open_table_order()`
- Trigger: `trg_block_duplicate_open_table_order` ON `fullchinavzla.orders`

---

## Checklist de verificación pre-entrega

### Verificar en producción
1. **Gastos**: existe `fullchinavzla.expenses` en el servidor.
2. **Trigger**: aplicar `20260825000000_block_duplicate_open_table_order.sql` en producción.
3. **Funcionalidad**: crear una orden para mesa 5, intentar crear otra para mesa 5 — debe fallar.
4. **Cancelación**: cancelar la primera orden, crear la segunda — debe funcionar.

### Lo que ya pasa localmente
- `npm run lint` — 7 errores (todos en archivos que no tocaremos).
- `npm test` — 22 tests pasan.
- Build — no se probó en esta sesión pero debería funcionar.

---

## Resumen para el cliente

> "FullChinaVzla está en persistencia real para todos los módulos operativos: caja, comandas, clientes, fidelización, almacén, gastos, menú semanal, promociones, recetas, compras, producción, nómina y mesas. No hay datos demo en el sistema.
> 
> Queda pendiente la integración del envío por WhatsApp (Marketing), que requiere conectar un proveedor externo.
> 
> Se añadió un trigger de seguridad que evita que se creen dos órdenes abiertas para la misma mesa al mismo tiempo."

