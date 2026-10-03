# Estado y continuidad de FullChinaVzla

Última actualización: 2026-10-01.

## Resumen

FullChinaVzla es una PWA React/Vite con Supabase self-hosted. El acuerdo inicial
de USD 450 fue aceptado y el contrato está listo; el alcance completo se
entregará por fases y superará USD 1000.

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
