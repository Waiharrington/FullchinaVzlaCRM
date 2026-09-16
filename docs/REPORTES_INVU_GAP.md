# Reportes: referencia Invu vs. FullChina

Inspección de la cuenta Invu `Fullchinavzla SIF` el 2026-09-15. La referencia es el comportamiento del catálogo; FullChina usa su propio diseño y únicamente datos que registra.

## Patrón común observado en Invu

- Catálogo agrupado y buscable, con favoritos.
- Cada reporte tiene rango de fechas, horas opcionales y atajos Hoy/Ayer/Semana/Mes.
- Resultados en tabla con búsqueda, paginación, agrupación de columnas y descargas CSV/Excel/PDF (varían según reporte).
- Pestañas separadas para órdenes cerradas, notas de crédito, movimientos y logs de órdenes.

## Implementado localmente

FullChina cuenta con 90 reportes operativos y un catálogo total de 168 reportes, cubriendo las familias observadas en Invu: ventas, finanzas, inventario, fiscalidad, logs operativos, asistencia, requisiciones, gift cards y reportes especiales. Los operativos tienen fechas, búsqueda de filas, paginación, favoritos y exportación CSV, Excel compatible o impresión/PDF. Ventas e historial de inventario también tienen filtro por hora local. Las fuentes se consultan por páginas para no cortar el historial en las primeras 100/1000 filas.

## Diferencias que requieren nueva captura de datos o definición de negocio

- La migración local `20260915010000_report_source_modules.sql` agrega registros auditables para ajustes, eventos de órdenes/cocina/caja, gift cards, asistencia y requisiciones. Está preparada para aplicar después de backup y autorización; aún no se ejecutó en el VPS. Mientras no exista, la interfaz muestra la fuente como pendiente y no intenta romper la página.
- Certificados, beepers, logs de impresión/precuenta, sucursales, comisiones y exportaciones fiscales siguen requiriendo reglas o integración específica antes de habilitar cifras definitivas.
- Reportes por sucursal/bodega, requisiciones y reportes fiscales Xero/DGI no aplican sin definir sucursales, bodegas, integración o jurisdicción fiscal.
- Ventas por empleado, propinas, comisiones, costos laborales, costos primos y Z contable necesitan reglas y conciliación de pagos/turnos antes de presentarse como cifras definitivas.
- La agrupación de columnas interactiva y exportación Excel nativa todavía no están implementadas. CSV abre en Excel.

No se ejecutaron migraciones ni cambios de datos remotos. No deben mostrarse reportes inexistentes como si fueran ceros reales.
