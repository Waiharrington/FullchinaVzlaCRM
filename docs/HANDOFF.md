# Estado y continuidad de FullChinaVzla

Última actualización: 2026-09-02.

## Resumen

FullChinaVzla es una PWA React/Vite con Supabase self-hosted. El acuerdo inicial
de USD 450 fue aceptado y el contrato está listo; el alcance completo se
entregará por fases y superará USD 1000.

La infraestructura de demo (datos hardcodeados, modo demo, `DemoDataProvider`)
fue eliminada en la fase de integración. El estado actual por módulo es:

- **Real (persistencia completa contra `fullchinavzla`)**: Caja, Comandas, Equipo,
  Compras, Producción, Recetas, Nómina, Auditoría, Almacén, Fidelización, Gastos,
  Menú semanal, Promociones.
- **Externo pendiente**: Marketing/WhatsApp — cola real (`whatsapp_messages`), pero
  el envío por WhatsApp requiere proveedor externo.

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

## Estado de persistencia por módulo

La infraestructura de demo (datos hardcodeados, modo demo, `DemoDataProvider`)
fue eliminada en la fase de integración. El estado actual por módulo es:

- **Real (persistencia completa contra `fullchinavzla`)**: Caja, Comandas, Equipo,
  Compras, Producción, Recetas, Nómina, Auditoría, Almacén, Fidelización, Gastos,
  Menú semanal, Promociones.
- **Externo pendiente**: Marketing/WhatsApp — cola real (`whatsapp_messages`), pero
  el envío por WhatsApp requiere proveedor externo.

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
   - Externo pendiente: **Marketing/WhatsApp** — cola real (`whatsapp_messages`), pero envío por WhatsApp requiere proveedor externo.
6. ~~Recibir menú, variantes, extras, producción en Excel, categorías de gastos, proveedores, reglas de fidelización y permisos finales.~~ (Pendiente, fuera del alcance de esta sesión.)
7. ~~Implementar Almacén separado del inventario operativo, producción, compras, gastos, finanzas, nómina, clientes/crédito, fidelización y WhatsApp.~~ (Pendiente, fuera del alcance de esta sesión.)
8. Ejecutar migración `20260811000000_audit_logs.sql` en VPS (requiere autorización y backup previo).
9. Ejecutar migración `20260825000000_block_duplicate_open_table_order.sql` en VPS (requiere autorización y backup previo) — _trigger que bloquea dos órdenes dine-in abiertas para la misma mesa_.

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
```

Para probar persistencia real debe usarse una sesión autenticada con PIN y la
configuración local autorizada, sin copiar secretos a la documentación.
