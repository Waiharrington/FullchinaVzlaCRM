# PHASE_0_SECURITY_PAYMENTS.md — Fase 0: Seguridad y Pagos

**Fecha**: 2026-08-08
**Objetivo**: Asegurar el VPS y agregar atomicidad a los pagos antes de continuar con funcionalidad

---

## Resumen Ejecutivo

El 2026-08-08 se realizaron tres operaciones críticas en el VPS para preparar el
entorno de producción antes de implementar funcionalidad adicional:

1. Backup completo del estado actual
2. Revocación del acceso anónimo
3. Agregado de migraciones atomicas de pagos

---

## Operaciones Realizadas

### 1. Backup del VPS

| Campo | Detalle |
|-------|---------|
| Fecha | 2026-08-08 |
| Tipo | Backup completo antes de cambios de seguridad |
| Propósito | Preservar estado actual antes de modificar configuración de acceso |

> **Regla**: Toda operación futura en VPS exige backup previo y verificación.

### 2. Revocación de Acceso Anónimo

| Campo | Detalle |
|-------|---------|
| Fecha | 2026-08-08 |
| Acción | Se revocó el acceso anónimo al esquema `fullchinavzla` |
| Propósito | Asegurar que solo usuarios autenticados puedan acceder a los datos |

**Qué significa**:
- El rol `anon` ya no tiene grants sobre las tablas del esquema `fullchinavzla`
- Todas las operaciones requieren autenticación
- El RLS sigue habilitado con 72 políticas

### 3. Migraciones Atómicas de Pagos

| Campo | Detalle |
|-------|---------|
| Fecha | 2026-08-08 |
| Acción | Se agregaron migraciones atomicas para la tabla `payments` |
| Propósito | Asegurar que los pagos sean inmutables y estén validados contra concurrencia |

**Componentes implementados en esta fase**:

| Función/Trigger | Propósito |
|-----------------|-----------|
| `fn_validate_payment_before_insert()` | BEFORE INSERT: bloquea fila de orden `FOR UPDATE`, valida `amount > 0`, orden existente y no cancelada, previene sobrepago |
| `fn_derive_order_status_from_payments()` | AFTER INSERT: deriva estado `paid` cuando `total_paid = total_amount` |

**Funciones preexistentes (no nuevas en esta fase)**:

| Función/Trigger | Propósito |
|-----------------|-----------|
| `fn_protect_payment_update()` | BEFORE UPDATE: impide modificación de pagos existentes (ya existía en el esquema inicial) |

**Garantías**:
- Pagos inmutables (solo INSERT)
- Prevención de sobrepago concurrente
- Derivación automática de estado de orden únicamente con igualdad exacta: `total_paid = total_amount`
- Bloqueo `FOR UPDATE` para evitar race conditions

### 4. RPCs de Órdenes (Caja y Comandas conectadas)

| Función | Propósito |
|---------|-----------|
| `fn_record_order_payments()` | Registra pagos para una orden existente; usa `fn_validate_payment_before_insert` y `fn_derive_order_status_from_payments` |
| `fn_checkout_order()` | Crea orden + items + pagos en una transacción atómica; usa precio del catálogo de `sellable_products` |

**Notas**:
- `fn_checkout_order` garantiza consistencia: si falla cualquier paso, se revierte todo
- El precio se toma del catálogo en el momento del checkout, no del frontend
- Caja y Comandas ya están conectadas al backend usando estas RPCs

---

## Reglas de Seguridad Activas

### Operaciones VPS

1. **NO tocar el VPS** sin autorización explícita
2. **SIEMPRE hacer backup** antes de cualquier operación en VPS
3. **Verificar** después de cada operación
4. **No exponer** IPs, claves, contraseñas ni tokens en documentación

### Código

1. **NO hacer commit/push** sin autorización explícita
2. **NO hacer deploy** sin autorización
3. **Schema `fullchinavzla`** — Nunca exponer en `public`
4. **No incluir datos reales** de la clienta en el código

### Datos

1. **Pagos inmutables** — Solo INSERT, nunca UPDATE/DELETE
2. **stock_movements append-only** — Correcciones vía adjustment
3. **Créditos** — Status derivado en vista, no campo stored
4. **Vistas financieras** — Acceso exclusivo vía RPC SECURITY DEFINER

---

## Verificación Post-Operación

| Verificación | Estado |
|--------------|--------|
| Backup completado | ✅ |
| Acceso anónimo revocado | ✅ |
| Migraciones de pagos aplicadas | ✅ |
| Pagos inmutables verificados | ✅ |
| RLS habilitado | ✅ |
| Esquema `fullchinavzla` intacto | ✅ |

---

## Próximos Pasos

1. Hacer una prueba visual con sesión real de cada rol antes del despliegue.
2. Implementar funcionalidad restante sobre la base de pagos atómicos.

---

## Auditoría

| Elemento | Cantidad | Estado |
|----------|----------|--------|
| Tablas protegidas con inmutabilidad | 1 (`payments`) | ✅ |
| Funciones de validación de pagos | 3 | ✅ |
| Triggers de protección | 3 | ✅ |
| RLS policies | 72 | ✅ |
| Acceso anónimo | Revocado | ✅ |
