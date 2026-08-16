# ⛔ Los archivos de esta carpeta están desactualizados

## El nombre del schema es incorrecto

| | |
|---|---|
| ❌ Lo que dicen los archivos | `foodtruck` |
| ✅ El schema real en el servidor | `fullchinavzla` |

El schema se renombró el **2026-08-05** a `fullchinavzla`, porque el negocio es de comida china
venezolana, no un food truck. **`foodtruck` ya no existe** en el servidor.

Los dos archivos `.sql` de esta carpeta mencionan `foodtruck` cientos de veces: en los `CREATE TABLE`,
en los cuerpos de las 21 funciones, en su `SET search_path`, en las 72 políticas RLS y en los `GRANT`.

---

## No hace falta ejecutarlos

El schema **ya está creado y aplicado** en el VPS. Verificado el 2026-08-05:

| | |
|---|---|
| Tablas | 27 |
| Funciones | 21 |
| Políticas RLS | 72 |
| Filas | 0 (proyecto nuevo, aún sin datos) |
| GRANTs para `anon` / `authenticated` / `service_role` | ✅ puestos |
| `PGRST_DB_SCHEMAS` en el VPS | ✅ incluye `fullchinavzla` |
| La app (`src/lib/supabase.ts`) | ✅ usa `db: { schema: 'fullchinavzla' }` |

Respuesta de la API verificada: `fullchinavzla` → **HTTP 200**, `foodtruck` → **HTTP 406**.

---

## Si alguna vez hay que re-ejecutarlos

**Ya no hace falta correr el `sed` a mano.** Hay un baseline corregido y autónomo en
[`../baseline/00_schema_fullchinavzla.sql`](../baseline/00_schema_fullchinavzla.sql) —
es este mismo archivo con `foodtruck`→`fullchinavzla` y `CREATE SCHEMA IF NOT EXISTS`.
El procedimiento completo de reconstrucción desde cero está en
[`../baseline/README.md`](../baseline/README.md): aplicar el baseline y luego las
migraciones con fecha `20260805000000` en adelante, en orden.

Ejecutar el original `20260803000000_initial_foodtruck_schema.sql` **sin** corregir el schema
crearía un schema `foodtruck` nuevo y vacío, paralelo al real. La app seguiría sin funcionar
mientras tú crees que la migración sí se aplicó. Usa el baseline, no el original.

---

## 🔴 Cuidado especial con el rollback

`20260803000001_rollback_foodtruck_schema.sql` termina en:

```sql
DROP SCHEMA IF EXISTS foodtruck CASCADE;
```

Hoy eso es inofensivo **por accidente**: `foodtruck` ya no existe, así que el `DROP` no encuentra nada.

**Pero si alguien le aplica el `sed` de arriba para "actualizarlo", ese `DROP` pasa a apuntar al
schema real y borra `fullchinavzla` entero** — las 27 tablas, las funciones, las políticas y todos
los datos que haya para entonces.

El archivo tiene una guardia que aborta si encuentra filas, pero eso solo protege mientras el schema
esté vacío. En cuanto el negocio empiece a cargar pedidos, esa guardia es lo único que separa este
archivo de la pérdida total.

**Nunca ejecutarlo sin backup y sin revisar a mano a qué schema apunta cada `DROP`.**

---

## Contexto

Estos archivos son de la configuración inicial del 2026-08-03. Durante ese trabajo se rompió el
acceso a los seis proyectos del VPS — la causa fue el `.env` del servidor, **no estas migraciones**,
que están correctamente acotadas a su propio schema.

El detalle completo está en `C:\Users\Waiha\supabase\RUNBOOK-VPS.md`.
