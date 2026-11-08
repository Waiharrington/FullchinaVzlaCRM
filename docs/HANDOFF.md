# Estado y continuidad de FullChinaVzla

## Proteínas opcionales en el pedido web (2026-11-07)

Se aplicó `20261107000000_allow_removing_included_proteins.sql` al VPS tras validar el respaldo completo `/root/fullchina-backups/fullchinavzla-pre-remove-proteins-20261107.dump` (34.830.717 bytes; SHA-256 `0d58e6c0fd7baeaa615c79a5b4b3426568e179771fbcd7991f9e9fbecdd8b22b`). El grupo **Proteínas incluidas · Full Kilo** quedó con mínimo 0 y máximo 4, y se verificó activo `trg_reconcile_web_order_protein_stock`. En la página pública se muestran todas incluidas por defecto; el cliente puede quitar una sin sustituirla. Al confirmar el pedido web, un ajuste de inventario en la misma transacción compensa la proteína quitada de la receta fija. Pendiente: comprobar un pedido real elegido por la clienta de punta a punta.

Última actualización: 2026-11-04.

## Historial detallado por cuenta y ajuste del correo diario (2026-11-04)

Las ventanas de cuenta en Finanzas ahora incluyen entradas y salidas detalladas del día, con filtros y paginación de 10 o 20 movimientos. El resumen conserva los subtotales por tipo de operación y el saldo inicial/final, facilitando rastrear conceptos como adelantos, comisiones o ajustes. También se integraron desde `master` los cambios `7b93bf8` y `37d2bf9`: el correo diario apila sus secciones para lectura móvil, usa imágenes públicas y ajusta el encabezado/resumen para clientes de correo estrechos. Build y lint pasan; pendiente revisar la ventana con una sesión autenticada.

## Corrección del cobro y aviso de pago (2026-11-03)

La migración `20261102050000_detailed_internal_order_push.sql` tenía un alias SQL incorrecto en el disparador diferido del aviso de cobro: `rows.order_id` no existe en esa consulta. PostgreSQL lanzaba `42P01` al confirmar la transacción y revertía el pago. Se aplicó `20261103010000_fix_paid_order_push_payment_alias.sql` al VPS después de validar el backup `/root/fullchina-backups/fullchinavzla-pre-payment-push-fix-20261103.dump` (6.712.282 bytes, formato custom, 1.659 entradas; SHA-256 `38108ce2eea57fa7bc49045269718fa87bef21315ef00d4846e1e7c61d48f0c8`). Se confirmó el alias corregido, el permiso de ejecución de `service_role` y el trigger `push_order_paid_after_payment` habilitado. El flujo real de pago queda pendiente de confirmación en la operación normal.

## Detalle de notificaciones de comandas internas (2026-11-02)

Se aplicó `20261102050000_detailed_internal_order_push.sql` después de validar `/root/fullchina-backups/fullchinavzla-pre-detailed-internal-order-push-20261102_122301.dump` (33.246.659 bytes; SHA-256 `6d92ff623a6d6a172bd89c03043a6dccd848c6b4246e1bbdf6d08fd653d653f7`; 8.569 entradas de `pg_restore --list`).

El aviso de nueva comanda ahora se genera al terminar la transacción que guarda sus productos, con nombre, cantidades, importes por producto y total USD. El aviso de pago se difiere hasta el commit para incluir método(s) y llegar después del aviso de creación. Se verificaron ambos disparadores diferidos y los estados de fulfillment.

## Filtro de notificaciones operativas (2026-11-02)

Se aplicó `20261102040000_business_push_notifications_only.sql` al VPS después de validar el respaldo completo `/root/fullchina-backups/fullchinavzla-pre-business-push-filter-20261102_121332.dump` (33.248.757 bytes; SHA-256 `e9de613ce4996765509ed2eaa68857b3cb958f0eaa9c76c3fa789cb57debc3f8`; 8.581 entradas de `pg_restore --list`).

Se desactivaron las notificaciones genéricas de auditoría por crear, editar o eliminar registros. Se conservaron las notificaciones específicas de pedidos web y comandas; el cobro ahora detalla los métodos y montos, y los cambios de etapa notifican preparación, pedido listo y entrega. Se verificó que ya no existan los triggers genéricos y que la función de comanda soporte `order_fulfillment`.

## Notificaciones push (2026-11-02)

Se aplicó al VPS `20261102020000_push_notifications.sql` en el esquema
`fullchinavzla`, después de crear y validar el backup completo
`/root/fullchina-backups/fullchinavzla-pre-push-notifications-20261102_054028.dump`
(6.656.937 bytes; `pg_restore --list` verificado). SHA-256:
`70184ea0fc4ce662afad0c3b9c208acc6fad6b9346e1c7fdf1dc6b3522b1d47c`.

El VPS tiene `pg_net` 0.20.3. Se verificaron las tablas, las funciones y sus
permisos: `authenticated` puede registrar/quitar su propia suscripción; solo
`service_role` puede reclamar eventos; `anon` no tiene acceso. Un evento de
prueba fue revertido y se confirmó que no dejó filas ni envió notificaciones.

Antes de completar la activación se creó un segundo backup completo:
`/root/fullchina-backups/fullchinavzla-pre-push-activate-20261102_045111.dump`
(33.229.991 bytes, SHA-256
`f7ec4bb602da32e1c57203813ee84a4313c43703fe3db69d1e458f2aa51f2771`; 8.570
entradas de `pg_restore --list`, validado con la versión del contenedor de BD).
Se completaron los triggers de actividad para las tablas que no tienen el
trigger común de auditoría.

El commit `fe71b48` se publicó en `master` y Vercel terminó el deployment de
producción `READY`. Las variables VAPID quedaron guardadas en Vercel Production;
las claves privadas no están en el repositorio. Se validó la ruta API con
peticiones inválida (400) y UUID inexistente (200, sin reclamar evento). El
dispatcher quedó **activado** (`enabled=true`); un evento técnico sin roles
destinatarios recorrió `pg_net` y la API, y se completó una vez sin enviar aviso.
Hay **0 dispositivos suscritos** al momento de la activación. Cada persona debe
abrir Campana → Notificaciones en este dispositivo → Activar y aceptar el
permiso del navegador para recibir avisos en ese dispositivo.
## Resumen

FullChinaVzla es una PWA React/Vite con Supabase self-hosted. El acuerdo inicial
de USD 450 fue aceptado y el contrato está listo; el alcance completo se
entregará por fases y superará USD 1000.

## Favoritos de clientes autenticados (2026-10-29)

Se aplicó al VPS `20261029000000_customer_favorites.sql` en `fullchinavzla`.
Antes se creó el backup completo `/root/fullchina-backups/fullchinavzla-pre-customer-favorites-20261029-145532Z.dump`
(31.953.217 bytes; formato custom; `pg_restore --list` verificado). SHA-256:
`95c8d7fc1dfaec4bc1f90d0b7f66d46c8698622a24f46a9346c70c02bf6dba20`.

Verificación posterior: tabla `customer_favorites` con RLS habilitado y sin
privilegios directos para `anon` ni `authenticated`; `fn_get_customer_favorites()`
y `fn_sync_customer_favorites(TEXT[])` son `SECURITY DEFINER`, ejecutables solo
por `authenticated`; PostgREST recibió `NOTIFY pgrst, 'reload schema'`. La
interfaz de `/pedir` fusiona favoritos locales y de cuenta, y el perfil muestra
separadamente `Platos favoritos` y `Pedidos recientes`. El frontend está
modificado localmente; no se hizo commit, push ni deploy.

## Migración de celebraciones de fidelidad (2026-10-18)

Se aplicó al VPS `20261018150000_customer_loyalty_stamp_celebration.sql` en
`fullchinavzla`, después de crear el backup completo
`/root/fullchina-backups/fullchina-pre-stamp-celebration-20261018.dump`
(30.686.982 bytes; formato custom, lista de restauración verificada con
`pg_restore --list`). SHA-256 del backup:
`c89af9c7367864004b27119b46ab725b68f6904a84fbe6ff4cefd1b32b53ae36`.

Verificación posterior: columna `customer_loyalty_visits.celebration_seen_at`
presente; `fn_claim_customer_loyalty_celebration()` devuelve `stamp_pending`;
ejecución permitida a `authenticated` y denegada a `anon`; función propiedad
de `supabase_admin` y `SECURITY DEFINER`. La aplicación local muestra el sello
más reciente y luego el premio cuando ambos están pendientes. La migración no
despliega el frontend.

## Corrección de sellos de cuentas nuevas (2026-10-18)

Se confirmó que un cliente activo tenía contador de ciclo positivo sin visitas
pagadas ni recompensas desde la fecha de creación de su cuenta. La función de
registro reiniciaba los contadores generales, pero no `loyalty_cycle_visits`;
por eso podía verse un sello sin visita en el historial ni pedido en Favoritos.

Se aplicó `20261018160000_reset_unbacked_customer_loyalty_cycle.sql` al esquema
`fullchinavzla`, después de crear el backup completo
`/root/fullchina-backups/fullchinavzla-pre-loyalty-cycle-reset-20261018-090346.dump`
(30.689.345 bytes; formato custom y lista verificada con `pg_restore --list`).
SHA-256 del backup: `429c2264f61aeda5c738dcff23e9c04ba01b44c854cfafd837d48235f5490a4b`.

La migración puso en cero el ciclo huérfano existente y añadió un trigger para
que cada cuenta de fidelidad nueva comience en cero. Verificación posterior:
no quedan cuentas activas con sellos de ciclo sin visita/recompensa posterior
al registro; el trigger está habilitado y el perfil afectado quedó en cero.

La infraestructura de demo (datos hardcodeados, modo demo, `DemoDataProvider`)
fue eliminada en la fase de integración. El estado actual por módulo es:

- **Real (persistencia completa contra `fullchinavzla`)**: Caja, Comandas, Equipo,
  Compras, Producción, Recetas, Nómina, Auditoría, Almacén, Fidelización, Gastos,
  Menú semanal, Promociones.
- **Marketing/WhatsApp**: cola real (`whatsapp_messages`) y envío real desde el
  bot (`whatsapp-web.js`), un mensaje cada 8-14 s, con confirmación "Enviar
  ahora" y botón "Detener envío". La migración
  `20261001010000_whatsapp_queue_sender_access.sql` **se aplicó en el VPS el
  2026-10-01** (backup previo `pre_whatsapp_sender_20261001_202527.dump`;
  verificada: grants, policy `whatsapp_messages_update`, índice de cola,
  `anon` sigue sin acceso). El bot quedó desplegado como imagen
  `fullchina-whatsapp-bot:v8` con `WHATSAPP_SEND_QUEUE=true`.
  **Endurecimiento aplicado en el VPS el 2026-10-01 (con autorización)**:
  migración `20261001020000_whatsapp_queue_claims.sql` (reclamo atómico con
  `SKIP LOCKED`, estados `sending`, `batch_id`, RPC solo `service_role`),
  imagen **`fullchina-whatsapp-bot:v10`** (v10 además **deshabilita cualquier
  respuesta a mensajes entrantes**: `WHATSAPP_AUTO_REPLY` apagado por defecto,
  la dueña pidió que el bot solo envíe campañas), token QR rotado a 64
  caracteres (guardado en `/root/.fullchina-qr-token`, permisos 600, no
  copiarlo a docs) y QR publicado **solo en `127.0.0.1:3033` del host**
  (acceso por túnel SSH).
  **El contenedor está DETENIDO a petición de la dueña ("apágalo mientras");
  para reanudar: `docker start fullchina-whatsapp-bot` (cola vacía, no hay
  nada pendiente de enviar).**
  Seguimiento de revisión (2026-10-02): `releaseClaim()` escribe `claimed_at`;
  se comprobó con `SET ROLE service_role + ROLLBACK` que el UPDATE funcionaba
  **solo** por el grant de UPDATE a nivel tabla preexistente (la migración
  `...010000` solo cubría 4 columnas). Se hizo explícito con la migración
  `20261001030000_whatsapp_claimed_at_grant.sql` (aplicada con backup
  `pre_claimed_at_grant_20261002_135214.dump`) y se agregó
  `supabase/verify_whatsapp_sender.sql`: verificación **repetible contra la
  BD real** (grants por columna vía `pg_attribute.attacl`, los 4 UPDATE del
  bot como `service_role` y la RPC de reclamo, todo con ROLLBACK). Ejecutada
  sin errores; conteos idénticos antes/después.
  Backup previo: `pre_queue_claims_20261001_224910.dump` (27 MB, PGDMP).
  Verificado: RPC reclama con `full_name`, cola terminó sin filas atascadas
  en `sending`, QR 404 con token inválido / 200 con token válido / inaccesible
  desde la IP pública.

## Estado verificado

- Producción: `https://fullchina-vzla-crm.vercel.app` en el proyecto Vercel
  `fullchina-vzla-crm`.
- Inicio de sesión por PIN de Dueña verificado directamente en producción el
  2026-08-08. La configuración alojada contiene solo URL, anon key y modo real;
  no contiene contraseñas ni PIN.
- Esquema remoto: `fullchinavzla`.
- Inventario al 2026-08-08 después de caja y PIN seguro: 32 tablas, 40 funciones,
  34 triggers, 11 vistas y 75 políticas RLS.
- Acceso `anon`: sin `USAGE` del esquema y sin privilegios sobre tablas.
- Acceso autenticado: Caja y Comandas usan RPC protegidas por rol.
- Build, lint y 11 pruebas automatizadas pasan. También se probó el flujo real
  de caja y los permisos de los tres roles en navegador.
- PWA generada correctamente con carga diferida por módulo. El archivo inicial
  bajó de aproximadamente 1.37 MB a alrededor de 59 KB; las dependencias
  pesadas se cargan en chunks separados.

## Cambios de la fase 0 aplicados al VPS

Se creó y verificó un backup antes de los cambios. Después se aplicaron:

1. `20260808000000_harden_anon_access.sql`: elimina acceso anónimo.
2. `20260808001000_atomic_order_payments.sql`: pagos simples/combinados,
   referencias obligatorias y cierre exacto de la orden.
3. `20260808002000_order_payment_view.sql`: vista de órdenes con pagos y
   `security_invoker=true`.
4. `20260808003000_atomic_checkout.sql`: crea orden, items y pagos en una sola
   transacción y toma el precio vigente del catálogo.
5. `20260808004000_cash_register_sessions.sql`: apertura, movimientos, arqueo,
   cierre operativo y asociación obligatoria de pagos a un turno.
6. `20260808005000_secure_pin_login.sql`: PIN bcrypt por usuario, límite de
   intentos y cambio de PIN autorizado. La Edge Function `pin-login` canjea un
   PIN válido por un token Supabase de un solo uso; no expone contraseñas.

Los tres roles reales fueron probados también mediante PIN. Tras cinco intentos
fallidos, el mismo cliente queda bloqueado durante quince minutos.

## Corrección del catálogo público aplicada al VPS

El 2026-09-02 se aplicó
`20260902190000_respect_public_catalog_product_images.sql` para que
`fn_get_public_catalog()` devuelva siempre la foto guardada en
`sellable_products.image_url`. La función anterior sustituía las fotos de 39
productos con código `M*` por archivos estáticos antiguos, por lo que Menú y
Pedir mostraban imágenes diferentes.

Antes de la migración se creó y verificó el backup completo
`/root/fullchina-backups/pre_product_image_fix_20260902_185838.dump`
(16.031.415 bytes). Después se verificó el RPC con acceso público: 68 productos,
68 imágenes cargadas y ninguna ruta estática `/productos/M*.jpg`.

No se confirmó una fuga de filas antes del endurecimiento: RLS devolvía cero
filas en las pruebas anónimas. El problema corregido fue el exceso de grants y
la dependencia innecesaria de una sola capa de defensa.

Pruebas SQL locales realizadas:

- pago móvil con referencia;
- pago combinado efectivo + segundo método;
- rechazo sin referencia;
- rechazo por pago incompleto;
- rollback completo: una falla no deja órdenes huérfanas.

## Flujos reales hoy

### Caja

- Selecciona productos desde `sellable_products`.
- Agrupa visualmente las presentaciones de una misma familia (por ejemplo,
  Arroz Frito Especial y Arroz Cantonés) en una sola tarjeta con selector de
  variantes. Cada variante conserva el ID y precio real del catálogo.
- Los productos sin familia continúan como tarjetas directas independientes.
- En tablet (768–1366 px) el catálogo permanece a la izquierda y el pedido a
  la derecha: dos tarjetas por fila, o una entre 768–900 px.
- Admite efectivo, pago móvil, punto, transferencia y pago combinado.
- Pago móvil/transferencia exige referencia.
- Efectivo conserva monto recibido.
- No aplica cargo de servicio automático.
- El checkout real usa `fn_checkout_order`.

### Comandas

- Lista órdenes desde `v_orders_with_items`.
- Conserva pagos y referencias registrados.
- Cobra una orden abierta mediante `fn_record_order_payments`.
- El backend evita sobrepago y solo marca `paid` con cobertura exacta.
- Una orden impaga aparece en Cuentas por cobrar sin importar la etapa operativa.
- Entregar una orden ya no crea un crédito automáticamente. El método Crédito pide autorización y crea la cuenta por cobrar; los abonos se registran desde Créditos.

### Referencia BCV

- Los importes principales en USD muestran debajo su referencia en bolívares
  en Caja, cobro, recibo, Comandas, Menú semanal, Inicio y Clientes.
- Toda la aplicación consume una sola tasa compartida desde
  `https://ve.dolarapi.com/v1/dolares/oficial` y valida que corresponda a la
  fuente `oficial`.
- La tasa se conserva durante 30 minutos y las consultas simultáneas se
  unifican para evitar llamadas duplicadas.
Si la consulta falla, se usa la última tasa válida guardada y la interfaz la
identifica como `referencia guardada`. Si no existe una tasa válida, no se
inventa una conversión.
- El recibo PDF conserva la tasa usada para calcular su referencia en Bs.
- Verificación del 2026-08-08: `756.7083 Bs/USD`, fecha informada por el
  proveedor `2026-08-07T00:00:00-04:00`.

### Campañas de WhatsApp

- La dueña elige público (segmento o un destinatario), redacta el mensaje y
  pulsa **Enviar ahora**; un modal pide confirmación y muestra el conteo y el
  tiempo estimado (unos 11 s por mensaje).
- Al confirmar, la app inserta filas en `whatsapp_messages` con
  `status='queued'`, `batch_id` propio de la campaña y reemplaza `[Nombre]`
  por el nombre de cada cliente.
- El bot consume la cola con la RPC **`claim_next_whatsapp_message`**
  (`UPDATE … FOR UPDATE SKIP LOCKED`): la fila pasa `queued → sending` de
  forma atómica **antes** de enviar, así dos instancias jamás envían la misma
  fila. Luego envía, marca `sent` (o `failed` con el error, con reintentos de
  confirmación) y espera 8-14 s.
- **Sin reenvíos tras reinicio**: si el bot muere con filas en `sending`, al
  arrancar (y en cada ciclo) las cierra como `failed` con el aviso
  "Envío interrumpido… pudo haberse enviado" — nunca vuelven a `queued`.
- **Detener envío** cancela solo el `batch_id` de la campaña activa (o el
  lote activo más reciente si la página se recargó), incluida la fila
  `sending` en curso: el bot re-verifica el estado justo antes de `sendMessage`
  y la omite si fue cancelada.
- La cola está **apagada por defecto**: requiere `WHATSAPP_SEND_QUEUE=true`
  explícito (en el VPS ya lo está), para que un reinicio nunca dispare un
  envío masivo accidental.
- **QR endurecido**: token obligatorio de ≥32 caracteres aleatorios (si es
  débil, p. ej. `change-me`, el servidor QR no arranca y el bot avisa),
  comparación en tiempo constante, rate limit por IP (20 fallos/10 min) y
  bind por defecto en `127.0.0.1` (acceso externo vía
  `ssh -L 3033:127.0.0.1:3033 root@<vps>`; `WHATSAPP_QR_HOST=0.0.0.0` solo
  detrás de un proxy con HTTPS).
- Mientras hay mensajes en cola, la app muestra **Detener envío** y refresca
  el historial cada 6 s. El historial es clicable: muestra el mensaje completo
  y, si falló, `error_message`.
- Variables del bot: `WHATSAPP_SEND_QUEUE` (apagado salvo que sea `true`),
  `WHATSAPP_QUEUE_AUTOMATIONS` sigue en `false` por defecto, `WHATSAPP_QR_HOST`,
  `WHATSAPP_AUTO_REPLY` (apagado: **el bot nunca responde mensajes entrantes,
  solo envía campañas**; el handler de saludos/menú/promos quedó detrás de esta
  variable y solo se activa con `true`).
- Destinatarios: todo cliente con teléfono registrado (el consentimiento se
  otorga físicamente en el local al registrar el número).
- `client.getState()` de whatsapp-web.js devuelve el estado del **socket**
  (`WAWebSocketModel.Socket.state`), no `'READY'`: condicionar el envío a
  `'READY'` hace que el loop salga en silencio sin enviar nada (bug
  corregido el 2026-10-01). La comprobación válida es `client.info` más los
  estados caídos (`closed`, `opening`, `pairing`, etc.).
- Lógica de envío extraída a `whatsapp-bot/queue.js` con pruebas propias
  (`whatsapp-bot` → `npm test`, `node --test`, 15 casos: reclamo único,
  ventana de detención, fallo de envío, cierre de `sending` obsoleto,
  confirmación fallida, cola deshabilitada, etc.).
- Despliegue verificado el 2026-10-01: imagen **`v10`** (antes `v8`→`v9`) en
  `/opt/fullchina-whatsapp-bot-src`, contenedor recreado conservando
  `/opt/fullchina-whatsapp-session` (si Chromium deja `Singleton*` stale hay
  que borrarlos antes de arrancar, o el navegador no abre el perfil).
  Rollback: `docker inspect` de la v8 guardado en `/tmp/bot_v8_inspect.json`
  (temporal) y la configuración original en el env del contenedor.
  **La dueña había pedido detenerlo; en una revisión posterior (2026-10-02) se observó `fullchina-whatsapp-bot` en ejecución. No se modificó su estado durante esta publicación. Verificarlo antes de iniciarlo o detenerlo.**

## Estado de persistencia por módulo

La infraestructura de demo (datos hardcodeados, modo demo, `DemoDataProvider`)
fue eliminada en la fase de integración. El estado actual por módulo es:

- **Real (persistencia completa contra `fullchinavzla`)**: Caja, Comandas, Equipo,
  Compras, Producción, Recetas, Nómina, Auditoría, Almacén, Fidelización, Gastos,
  Menú semanal, Promociones.
- **Marketing/WhatsApp**: cola y envío reales desde el bot; permisos y RPC
  verificados en VPS el 2026-10-02. Estado del contenedor anotado arriba.

## Pendientes prioritarios

1. ~~Completar múltiples comandas abiertas por mesa y permitir agregar consumos.~~ **Cancelado**: la regla es una orden abierta por mesa. Si la mesa está ocupada, el botón queda bloqueado en Caja.
2. Bloquear visualmente mesas ocupadas en el selector de Caja (`table-picker-btn` disabled cuando `occupiedTables.has(n)`).
3. ~~Implementar regla delivery: pago móvil confirmado antes de cocina; efectivo puede llegar a cocina pendiente de pago.~~ (Pendiente, fuera del alcance de esta sesión.)
4. ~~Capturar moneda física y tasa en pagos en efectivo USD/VES.~~ (Pendiente, fuera del alcance de esta sesión.)
5. ~~Sustituir datos demo por persistencia real módulo por módulo.~~ **Completado en esta sesión**:
   - **Almacén**: ❌→✅ Ya usa `getIngredients()`, `getStockMovements()`, `adjustStock()` desde la BD.
   - **Fidelización**: ❌→✅ Ya usa `getCustomers()`, `registerCustomerVisit()` desde la BD.
   - **Gastos**: ❌→✅ Ya usa `getExpenses()`, `createExpense()` contra `fullchinavzla.expenses` (verificado que la tabla existe).
   - **Menú semanal**: ❌→✅ Ya usa `getWeeklyDishes()` y CRUD completo contra `weekly_menu_items` y `weekly_menu_activations`.
   - **Promociones**: ❌→✅ Ya usa CRUD contra `promotions`.
   - **Marketing/WhatsApp** — cola y envío reales desde el bot; permisos y RPC verificados en VPS.
6. ~~Recibir menú, variantes, extras, producción en Excel, categorías de gastos, proveedores, reglas de fidelización y permisos finales.~~ (Pendiente, fuera del alcance de esta sesión.)
7. ~~Implementar Almacén separado del inventario operativo, producción, compras, gastos, finanzas, nómina, clientes/crédito, fidelización y WhatsApp.~~ (Pendiente, fuera del alcance de esta sesión.)
8. Ejecutar migración `20260811000000_audit_logs.sql` en VPS (requiere autorización y backup previo).
9. Ejecutar migración `20260825000000_block_duplicate_open_table_order.sql` en VPS (requiere autorización y backup previo) — _trigger que bloquea dos órdenes dine-in abiertas para la misma mesa_.
10. ~~Ejecutar migración `20261001010000_whatsapp_queue_sender_access.sql` en VPS.~~ **Aplicada el 2026-10-01** (backup previo verificado; bot desplegado como `fullchina-whatsapp-bot:v8`).
11. ~~Ejecutar migración `20261001020000_whatsapp_queue_claims.sql` en VPS y desplegar el bot endurecido.~~ **Aplicada y desplegada el 2026-10-01** (backup `pre_queue_claims_20261001_224910.dump`; imagen `v9`; token QR rotado a 64 chars; QR solo en `127.0.0.1:3033` — acceso con `ssh -L 3033:127.0.0.1:3033 root@<vps>`).
12. Campaña de delivery: antes de reanudar se corrigió el vencimiento de los **21 mensajes pendientes** a "02 de octubre" (los 378 ya enviados conservan "01 de octubre", decisión de la dueña: "los que ya se mandaron ya ni modo").
13. ~~Ajustar el permiso de `claimed_at` y comprobar la migración contra la BD real (revisión externa).~~ **Completado 2026-10-02**: grant explícito en `20261001030000_whatsapp_claimed_at_grant.sql` (backup previo) y verificación real con `supabase/verify_whatsapp_sender.sql` (grants + los 4 UPDATE del bot como `service_role` + RPC, todo con ROLLBACK, sin errores).

Los requisitos completos están en `docs/REQUIREMENTS_REUNION_1.md`.

## Reglas para continuar

- Leer `AGENTS.md` antes de editar.
- No hacer commit, push o deploy sin autorización explícita.
- Antes de cualquier operación futura en VPS: autorización, backup, aplicación
  transaccional y verificación posterior.
- Los dos SQL iniciales conservan `foodtruck` en sus nombres y contenido por
  razones históricas. No ejecutarlos directamente contra producción.
- No incluir secretos, credenciales, IP ni datos reales de la clienta en docs.

## Validación local

```powershell
npm run build
npm test
npm run lint
cd whatsapp-bot; npm test   # pruebas del ciclo de envío (node --test)
```

Para verificar los **permisos reales** del bot contra PostgreSQL (las pruebas
unitarias usan una BD simulada y no cubren grants):

```powershell
docker cp supabase/verify_whatsapp_sender.sql supabase-db:/tmp/
docker exec supabase-db psql -U supabase_admin -d postgres -X -v ON_ERROR_STOP=1 -f /tmp/verify_whatsapp_sender.sql
```

Para probar persistencia real debe usarse una sesión autenticada con PIN y la
configuración local autorizada, sin copiar secretos a la documentación.

## Corrección de sincronización de alertas del dashboard (2026-11-02)

Se aplicó al VPS la migración `20261102010000_fix_dashboard_alert_key_ambiguity.sql` en el esquema `fullchinavzla`, después de crear y validar el backup completo:
`/root/fullchina-backups/fullchinavzla-pre-dashboard-alert-fix-20261102_051321.dump`.

El backup tiene 6.656.649 bytes, formato custom y su lista de restauración fue validada con `pg_restore` del contenedor PostgreSQL (1.613 entradas). SHA-256:
`9f920f8e53842a64b2d1af750a2fdcfa1835e9cfdbb114473dc961cebb170b8b`.

Verificación posterior: la función `fn_sync_dashboard_alerts(jsonb,jsonb)` contiene la directiva `#variable_conflict use_column`; una llamada autenticada con arreglos vacíos completó y se revirtió en una transacción, sin insertar ni resolver alertas. `authenticated` conserva EXECUTE y `anon` no tiene EXECUTE.
## Administrador de Página de pedir (2026-11-07)

Se integraron los cambios remotos `29be756`, `a926b57` y `151db92` que separan la PWA pública de clientes de la PWA administrativa. Se añadió el módulo `/pagina-pedir` para owner/manager, con búsqueda, filtros, visibilidad exclusiva del catálogo público, etiquetas existentes, selección de hasta ocho productos para el carrusel y orden manual. Las recetas y el precio/costo no se editan desde este módulo. La migración `20261107100000_public_order_page_controls.sql` se aplicó después de validar el backup completo `/root/fullchina-backups/fullchinavzla-pre-public-order-page-controls-20261107.dump` (34.911.114 bytes; SHA-256 `99df1556ff682ae8162efe2be083e8a09cbf37026057222c49bf3bf1dc0f9fb2`). Se verificó que el catálogo RPC devuelve las tres opciones para los 72 productos públicos. El carrusel respeta la selección y el orden; si aún no se configura ninguno, conserva las recomendaciones anteriores. Pendiente: validación visual autenticada del módulo publicado por la dueña.

## Portada editable de Página de pedir (2026-11-07)

Trabajo local en curso: añade edición de título móvil, texto de búsqueda, frase pequeña, título y descripción de escritorio, y selección de una imagen de portada entre cuatro recursos locales aprobados. Incluye vista previa adaptable para teléfono y escritorio; el carrusel de platos y el estado/horario dinámico no se reemplazan. El contenido se lee desde `fn_get_public_order_page_settings()` y se guarda mediante `fn_admin_update_public_order_page_settings()`, limitado a `owner` y `manager`. La migración `20261107110000_public_order_page_content.sql` crea la tabla aislada en `fullchinavzla` y un disparador para refresco en vivo.

Se creó y validó el backup completo `/root/fullchina-backups/fullchinavzla-pre-public-order-page-content-20261107.dump` (34.914.190 bytes; 9.508 entradas de restauración; SHA-256 `4f4ffe2ff3e52bb0ba4b2703eca4abc71457d670aeb885552db6ed3ba9ba95da`). Con autorización se aplicó `20261107110000_public_order_page_content.sql` en el VPS. La verificación confirmó los valores predeterminados, RLS activa, sin SELECT directo para `anon`, RPC de lectura permitido a `anon`, y edición RPC disponible solo a `authenticated`/`service_role` (la función restringe la escritura a `owner` y `manager`). La tabla está conectada al refresco en vivo. Build, lint y 23 pruebas enfocadas pasan localmente. Pendiente tras publicar: confirmar visualmente con una sesión autenticada de dueña/gerente y comprobar el cambio reflejado en `/pedir`.

## Selección actual del carrusel de Página de pedir (2026-11-08)

El módulo ahora calcula y muestra como seleccionados los mismos productos que sirven de recomendación automática cuando aún no existe una selección manual. Al primer cambio, una RPC transaccional guarda el orden completo; quitar todos los productos deja el carrusel intencionalmente sin productos, sin reactivar el fallback automático. La lista inicial replica los filtros, agrupación, orden alfabético y variantes recomendadas que usa `PublicMenu`.

Se creó y validó el backup `/root/fullchina-backups/fullchinavzla-pre-public-order-carousel-config-20261108.dump` (34.956.182 bytes; 9.521 entradas de restauración; SHA-256 `5fcba9c19af822208760ee20d62ab453a3806808d4af7c22945763305710e0dc`). Se aplicó `20261108100000_configure_public_order_carousel.sql`. Verificación remota: la selección actual es automática (cero marcas manuales); prueba transaccional de la RPC como `owner` exitosa con rollback; llamada como `cashier` rechazada con `42501`; `anon` no tiene EXECUTE y `authenticated` sí. Build, lint y 14 pruebas enfocadas pasan.
