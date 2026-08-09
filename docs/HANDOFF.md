# Estado y continuidad de FullChinaVzla

Última actualización: 2026-08-08.

## Resumen

FullChinaVzla es una PWA React/Vite con Supabase self-hosted. El acuerdo inicial
de USD 450 fue aceptado y el contrato está listo; el alcance completo se
entregará por fases y superará USD 1000.

El repositorio contiene una interfaz amplia, pero no todos los módulos tienen
persistencia real. Caja y Comandas sí registran órdenes y pagos contra el
esquema remoto `fullchinavzla`. Almacén, Fidelización, Gastos, Marketing,
Menú semanal y partes de otros módulos todavía usan datos locales o de muestra.

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
- Build, lint y 3 pruebas automatizadas pasan. También se probó el flujo real
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
- Si la consulta falla, se usa la última tasa válida guardada y la interfaz la
  identifica como `referencia guardada`. Si no existe una tasa válida, no se
  inventa una conversión.
- El recibo PDF conserva la tasa usada para calcular su referencia en Bs.
- Verificación del 2026-08-08: `756.7083 Bs/USD`, fecha informada por el
  proveedor `2026-08-07T00:00:00-04:00`.

## Pendientes prioritarios

1. Completar múltiples comandas abiertas por mesa y permitir agregar consumos.
2. Implementar regla delivery: pago móvil confirmado antes de cocina; efectivo
   puede llegar a cocina pendiente de pago.
3. Capturar moneda física y tasa en pagos en efectivo USD/VES.
4. Sustituir datos demo por persistencia real módulo por módulo.
5. Recibir menú, variantes, extras, producción en Excel, categorías de gastos,
   proveedores, reglas de fidelización y permisos finales.
6. Implementar Almacén separado del inventario operativo, producción, compras,
   gastos, finanzas, nómina, clientes/crédito, fidelización y WhatsApp.

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

Para modo demo, `VITE_DEMO_MODE=true`. Para probar persistencia real debe usarse
una sesión autenticada y la configuración local ya autorizada, sin copiar
secretos a la documentación.
