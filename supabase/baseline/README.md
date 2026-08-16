# Baseline reproducible del esquema `fullchinavzla`

Esta carpeta resuelve el problema de que las **migraciones iniciales usan el nombre de
esquema incorrecto** (`foodtruck`) y por eso no se pueden aplicar en limpio. Ver
[`../migrations/LEEME-ANTES-DE-EJECUTAR.md`](../migrations/LEEME-ANTES-DE-EJECUTAR.md).

## Qué hay aquí

| Archivo | Qué es |
|---|---|
| `00_schema_fullchinavzla.sql` | El esquema inicial completo (tablas, funciones, triggers, vistas, RLS, grants) ya con el nombre correcto `fullchinavzla`. Es el `sed 's/foodtruck/fullchinavzla/g'` del archivo `20260803000000_initial_foodtruck_schema.sql`, más `CREATE SCHEMA IF NOT EXISTS fullchinavzla;` al inicio para ser autónomo. |

`00_schema_fullchinavzla.sql` **reemplaza** a `migrations/20260803000000_initial_foodtruck_schema.sql`
como punto de partida. No apliques el archivo `foodtruck` original: crearía un esquema
`foodtruck` vacío y paralelo al real.

## Cómo reconstruir la base desde cero (entorno nuevo / recuperación)

Aplica, **en este orden**, contra una base PostgreSQL 15+ con los roles de Supabase
(`anon`, `authenticated`, `service_role`) ya creados:

1. `supabase/baseline/00_schema_fullchinavzla.sql`  ← el esquema base ya corregido.
2. Todas las migraciones en `supabase/migrations/` **con fecha `20260805000000` en
   adelante**, en orden de nombre. Esas ya usan `fullchinavzla` y se apoyan sobre el
   baseline (renombran `sale_price`→`price`, agregan `mobile`/`binance`/`zelle`, checkout
   atómico, sesiones de caja, auditoría, pedidos web, consumo de inventario, etc.).

**No apliques** `20260803000000_initial_foodtruck_schema.sql` ni
`20260803000001_rollback_foodtruck_schema.sql`: quedan como registro histórico del trabajo
del 2026-08-03, pero su nombre de esquema es incorrecto y el rollback contiene un
`DROP SCHEMA ... CASCADE` peligroso (ver el LEEME).

## Por qué el baseline y las migraciones incrementales son compatibles

El baseline crea el esquema tal como estaba el 2026-08-03 (incluye `sale_price`, el CHECK de
`payments` sin `mobile`, etc.). Las migraciones posteriores parten de ese estado y lo
evolucionan hasta el esquema desplegado hoy. Aplicar baseline + incrementales en orden
reproduce exactamente lo que corre en el VPS.

## Importante

- Esto **no** modifica el VPS. El esquema real ya está aplicado allí.
- Si alguna vez hay que aplicar esto en producción, primero **backup** y revisión manual,
  según las reglas del proyecto (`PROJECT_BRIEF.md`).
