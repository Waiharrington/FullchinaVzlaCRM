# Desarrollo local con Supabase

La app local envía las solicitudes de autenticación, lecturas y escrituras al
backend configurado en `VITE_SUPABASE_URL`, igual que la app desplegada. No hay
un bloqueo de escrituras activado por `npm run dev`.

Antes de probar acciones desde una instancia local, verifica a qué backend
apunta su archivo `.env`: ventas, pagos, inventario, compras y otras operaciones
pueden modificar los datos de ese backend. Para pruebas aisladas, configura una
instancia local de Supabase/PostgreSQL con datos ficticios. No ejecutes
migraciones contra el servidor compartido sin backup y autorización explícita.
