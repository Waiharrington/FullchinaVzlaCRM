# Fase 1: roles reales y caja operativa

Fecha: 2026-08-08.

## Entregado

- Usuarios reales de ejemplo para Dueña, Gerencia y Caja, enlazados a
  `fullchinavzla.profiles` con roles internos `owner`, `manager` y `cashier`.
- Inicio de sesión real verificado individualmente.
- Rechazo de usuarios autenticados que no tengan perfil FullChina activo.
- PIN individual de cuatro dígitos validado exclusivamente en el VPS. Los PIN
  se almacenan como hashes bcrypt y nunca como variables `VITE_*`.
- Cinco intentos fallidos por cliente producen un bloqueo de quince minutos.
- Un PIN válido genera un token de acceso de un solo uso y después una sesión
  normal de Supabase, por lo que conserva los permisos RLS del usuario.
- Protección de rutas por rol, además de la seguridad RLS del backend.
- Caja principal preparada para futuras cajas adicionales.
- Apertura con fondos iniciales en USD y bolívares.
- Entradas, salidas, retiros, gastos y ajustes append-only.
- Efectivo esperado, conteo físico, diferencia e historial de turnos.
- Todo pago nuevo requiere una sesión de caja abierta.
- Cierre operativo disponible para cashier, manager y owner. La consolidación
  financiera diaria permanece separada y reservada a owner/manager.

## Migración aplicada

- `supabase/migrations/20260808004000_cash_register_sessions.sql`
- `supabase/migrations/20260808005000_secure_pin_login.sql`

Objetos principales:

- `cash_registers`
- `cash_sessions`
- `cash_movements`
- `payments.cash_session_id`
- RPCs de apertura, movimiento, consulta, arqueo, cierre e historial
- `pin_credentials`, `pin_rate_limits`, `fn_verify_pin_login` y
  `fn_set_user_pin`
- Edge Function `supabase/functions/pin-login/index.ts`

Antes de aplicarla se creó un backup conjunto de `auth` y `fullchinavzla`, se
copió localmente y se verificó su hash. La ubicación y las credenciales no se
guardan dentro del repositorio.

## Validación realizada

- Los tres usuarios iniciaron sesión y obtuvieron su rol esperado.
- Gerencia fue redirigida al intentar abrir Nómina.
- Caja fue redirigida al intentar abrir Finanzas.
- Visual desktop 1280×900 y móvil 390×844.
- Sin desbordamiento horizontal a 390 px.
- Flujo real: apertura USD 10/Bs. 100, retiro USD 2, arqueo USD 8/Bs. 100 y
  cierre con diferencia cero.
- Base de datos: doble apertura rechazada; pago sin caja rechazado sin dejar
  orden huérfana; movimientos vinculados al turno.
- Los PIN de Dueña, Gerencia y Caja generaron sesiones reales con roles
  `owner`, `manager` y `cashier` respectivamente.
- Límite verificado: cuatro respuestas 401 y bloqueo 429 desde el quinto
  intento. Los registros de prueba se limpiaron al terminar.

## Pendiente deliberado

- El efectivo cobrado se concilia actualmente en su equivalente USD. El modelo
  conserva fondos y movimientos manuales en USD/VES, pero todavía falta que el
  POS capture la moneda física original de cada pago en efectivo.
