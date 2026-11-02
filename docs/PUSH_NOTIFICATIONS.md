# Notificaciones push de Full China

## Comportamiento

- Cada navegador/teléfono se suscribe desde **Campana → Notificaciones en este dispositivo → Activar**. El permiso del navegador se solicita después de pulsar Activar y, al guardar la suscripción, ese dispositivo muestra **Notificaciones activadas** como confirmación.
- `owner` y `manager` reciben pedidos web nuevos, comandas creadas/cobradas/entregadas y cambios operativos. `cashier` recibe únicamente pedidos web nuevos.
- Los pedidos web se notifican al entrar al buzón de solicitudes, antes de que Caja los confirme. El aviso incluye código web, modalidad y nombre del cliente, sin teléfono, dirección ni notas.
- Los eventos se escriben en una bandeja de salida transaccional. PostgreSQL usa `pg_net` para llamar al endpoint Vercel después del commit; el endpoint reclama un UUID aleatorio, aplica los filtros de rol, entrega Web Push y elimina suscripciones expiradas.
- Al tocar una notificación se abre Comandas o Auditoría dentro de la PWA.

## Variables de entorno

Generar un par VAPID de producción con `npx web-push generate-vapid-keys` y guardarlo directamente en Vercel. Nunca poner la clave privada en `VITE_*`, en el repositorio ni en documentación compartida.

Variables server-side de Vercel:

- `SUPABASE_URL` — URL del Supabase self-hosted.
- `SUPABASE_SERVICE_ROLE_KEY` — clave service role ya administrada por el proyecto; solo runtime server-side.
- `PUSH_VAPID_PUBLIC_KEY` — clave pública del par VAPID.
- `PUSH_VAPID_PRIVATE_KEY` — clave privada VAPID.
- `PUSH_VAPID_SUBJECT` — contacto VAPID, por ejemplo `mailto:soporte@dominio`.

Variable pública necesaria al compilar la PWA:

- `VITE_WEB_PUSH_PUBLIC_KEY` — la misma clave pública VAPID; esta clave sí puede estar en el bundle.

La tabla `push_dispatch_settings` apunta por defecto a `https://fullchina-vzla-crm.vercel.app/api/push-dispatch`. Si cambia el dominio canónico, actualizar `endpoint_url` con un SQL administrativo.

El dispatcher queda **desactivado por defecto** para que instalar el esquema antes de publicar/configurar el sender no genere avisos perdidos ni llene la bandeja de salida. En producción se habilitó el 2026-11-02 después de desplegar la ruta API y guardar las variables anteriores. En nuevas instalaciones, habilitarlo explícitamente solo después de completar esos pasos:

```sql
UPDATE fullchinavzla.push_dispatch_settings SET enabled = true WHERE id;
```

## Requisitos para producción

1. Guardar las variables VAPID en Vercel y configurar `VITE_WEB_PUSH_PUBLIC_KEY` para el build de producción.
2. Confirmar que `pg_net` esté disponible y activo en PostgreSQL self-hosted. La migración falla explícitamente si falta.
3. Crear y validar un backup completo antes de aplicar `20261102020000_push_notifications.sql` al esquema `fullchinavzla`.
4. Publicar el frontend/API en Vercel y activar desde la campana cada dispositivo de Dueña, Gerente y Caja. La aplicación pide permiso a cada navegador al pulsar **Activar**.
5. En iPhone/iPad, abrir el sitio en Safari, añadirlo a la pantalla de inicio y activar las notificaciones desde la PWA instalada; la disponibilidad de Push depende del navegador/plataforma.

La migración solo guarda el endpoint/cifrado de cada suscripción y el payload mínimo del aviso. El endpoint se autentica por el UUID aleatorio del evento; la solicitud de `pg_net` no contiene claves privadas ni la service role key.
