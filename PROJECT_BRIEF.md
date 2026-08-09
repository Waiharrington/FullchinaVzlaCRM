# FullChinaVzla — PWA

## Objetivo

Construir una PWA responsive para administrar la operación diaria de FullChinaVzla
desde computadora, tablet y teléfono.

**Acuerdo inicial: USD 450**, aceptado y con contrato listo. El proyecto completo
por fases supera **USD 1000**.

## Stack

- React + Vite + TypeScript.
- Supabase self-hosted existente en el VPS para autenticación y PostgreSQL.
- Esquema PostgreSQL aislado: `fullchinavzla`.
- Vercel para hosting.
- PWA instalable mediante `vite-plugin-pwa`.

## Roles

- `owner`: acceso total, costos, rentabilidad, reportes y configuración.
- `manager`: operación, producción, inventario, compras y gastos.
- `cashier`: comandas, ventas, cobros y cierres autorizados.

## Núcleo funcional

1. Ventas, comandas, métodos de pago y créditos con abonos.
2. Ingredientes e inventario en unidades base.
3. Compras, proveedores y gastos.
4. Lotes de preparación: materia prima consumida, merma, rendimiento y
   porciones producidas.
5. Productos vendibles y recetas que consumen ingredientes o porciones.
6. Costos y margen estimado por producto.
7. Cierres diarios y reportes semanales.
8. Nómina básica, adelantos y adicionales por producción.

## Decisiones de la primera versión

- Un solo negocio y una sola ubicación.
- Tres usuarios iniciales.
- La aplicación requiere conexión para registrar operaciones. La PWA puede
  cachear la interfaz, pero no se promete sincronización transaccional offline.
- Sin facturación fiscal, delivery externo, conexión directa con puntos de
  venta ni contabilidad tributaria.
- No se creará un proyecto independiente en Supabase Cloud.
- Sin despliegues ni nuevas modificaciones remotas del Supabase del VPS hasta
  revisar la migración, crear backup y recibir autorización.
- El esquema SQL debe quedar versionado en migraciones y protegido con RLS.
- El esquema está expuesto explícitamente en PostgREST. `anon` no posee acceso;
  `authenticated` y `service_role` reciben únicamente los permisos necesarios.

## Reglas de calidad

- Mobile-first, pero la caja debe ser eficiente en tablet y computadora.
- No mostrar costos, márgenes ni nómina al rol `cashier`.
- Dinero almacenado con tipos decimales, nunca `float`.
- Cantidades de inventario almacenadas en unidades base normalizadas.
- Movimientos de inventario append-only; las correcciones se realizan con
  movimientos de ajuste.
- Builds, lint y pruebas focalizadas deben pasar antes de integrar cada módulo.
