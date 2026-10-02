# Pruebas locales seguras

## Protección activa

En `npm run dev`, el cliente Supabase bloquea por defecto las solicitudes que
pueden modificar datos (`POST`, `PATCH`, `PUT`, `DELETE`) y las llamadas a
Edge Functions. Esto cubre las rutas de comandas, pagos, inventario, compras,
finanzas y administración que comparten este cliente. Las lecturas siguen
usando `VITE_SUPABASE_URL`, así que el modo actual es de solo lectura y puede
mostrar información del backend configurado.

La protección no cambia producción. En desarrollo, las escrituras solo se
pueden habilitar explícitamente con `VITE_SUPABASE_ALLOW_LOCAL_WRITES=true`
cuando tanto `VITE_SUPABASE_URL` como el destino HTTP usan `localhost`,
`127.0.0.1` o `::1`. Una URL remota continúa bloqueada aunque se active esa
variable.

## Preparar una base local completa

Este checkout incluye un baseline y migraciones, pero no trae una instancia
local configurada. Para probar los flujos con escrituras, hay que iniciar una
instancia Supabase/PostgreSQL local aislada, aplicar ahí el baseline y las
migraciones de este proyecto, cargar únicamente datos ficticios y apuntar un
archivo `.env.local` a las URLs y claves locales. No copies el `.env` actual ni
datos de producción al entorno de pruebas.

Cuando esa instancia esté disponible, se puede habilitar escritura solo en el
destino loopback con `VITE_SUPABASE_ALLOW_LOCAL_WRITES=true`. Mantén esa
variable ausente o en `false` para cualquier URL remota. Nunca se deben
ejecutar migraciones contra el servidor compartido para preparar pruebas.
