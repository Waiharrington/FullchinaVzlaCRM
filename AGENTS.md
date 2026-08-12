# AGENTS.md — Instrucciones Operativas

## Objetivo

Construir una PWA responsive para administrar la operación diaria de
FullChinaVzla. **Acuerdo inicial: USD 450**, aceptado y con contrato listo.
El proyecto completo por fases supera **USD 1000**.

## Stack

- React 19 + Vite 6 + TypeScript 5.7
- Supabase JS v2 (self-hosted en VPS)
- React Router v7
- vite-plugin-pwa
- Vitest + Testing Library

## Arquitectura

```
src/
  components/   Layout, Sidebar, BottomNav
  context/      AuthContext (Supabase)
  lib/          Cliente Supabase (configurable con .env)
  pages/        Login, Inicio, Caja, Inventario, Más
  test/         Setup de testing
supabase/
  migrations/   SQL versionado del esquema fullchinavzla
```

## Fuentes de Verdad

| Documento | Propósito |
|-----------|-----------|
| `PROJECT_BRIEF.md` | Requisitos, stack, decisiones de diseño |
| `docs/DATABASE.md` | Modelo de datos completo, migraciones, verificación |
| `docs/HANDOFF.md` | Estado actual, pendientes, verificaciones |
| `docs/REQUIREMENTS_REUNION_1.md` | Requisitos confirmados en reunión inicial (2026-08-08) |
| `docs/AI_START_HERE.md` | Punto de entrada para nuevas IAs |

## Reglas de Seguridad

1. **NO tocar el VPS** — No ejecutar migraciones, no modificar Supabase remoto sin autorización explícita y backup.
2. **NO hacer deploy** — No desplegar a Vercel ni ningún hosting sin autorización.
3. **NO hacer commit** — No hacer git commit, push ni crear PRs sin autorización explícita.
4. **NO exponer secretos** — Nunca incluir API keys, contraseñas ni credenciales en archivos.
5. **Schema `fullchinavzla`** — Todas las tablas y objetos viven en el esquema `fullchinavzla`, nunca en `public`.
6. **Preservar trabajo** — Cada cambio importante debe ser verificable localmente antes de integrar.
7. **Operaciones VPS** — Toda operación futura en VPS exige backup previo y verificación.

## Estado del Repositorio

- Verificar `git status` antes de cada sesión.
- **2026-08-08**: Se realizó backup del VPS antes de cambios de seguridad.
- **2026-08-08**: Se revocó acceso anónimo y se agregaron migraciones atomicas de pagos.

## Antes de Editar Cualquier Archivo

```bash
git status
```

Verificar que no hay cambios pendientes no deseados. Si los hay, documentarlos
antes de continuar.

## Comandos de Desarrollo

```bash
# Instalar dependencias
npm install

# Desarrollo local
npm run dev

# Build producción (DEBE pasar)
npm run build

# Lint (DEBE pasar)
npm run lint

# Test (DEBE pasar)
npm test
```

## Definición de "Terminado"

Una funcionalidad está lista cuando:

1. `npm run build` pasa sin errores
2. `npm run lint` pasa sin warnings
3. `npm test` pasa todos los tests
4. Es responsive en mobile (390x844) y desktop (1280px)
5. No rompe funcionalidad existente
6. No hay datos reales de la clienta en el código

## Roles de Usuario

| Rol | Acceso |
|-----|--------|
| `owner` | Total: costos, rentabilidad, reportes, configuración |
| `manager` | Operación: producción, inventario, compras, gastos |
| `cashier` | Ventas: comandas, cobros, cierres básicos |

> **Nota**: En modo real, Supabase aplica RLS y `get_current_user_role()` para
> controlar acceso a datos. La visibilidad en UI se gestiona con condicionales
> por rol en cada componente.

## Stack de Persistencia

- **PostgreSQL 15+** en Supabase self-hosted
- **Esquema aislado**: `fullchinavzla`
- **RLS habilitado** en todas las tablas
- **Funciones SECURITY DEFINER** para acceso a vistas financieras
- **Pagos inmutables** (solo INSERT)
- **stock_movements append-only** (correcciones vía adjustment)

## Criterios de Calidad

- Mobile-first, pero caja eficiente en tablet y computadora
- No mostrar costos, márgenes ni nómina al rol `cashier`
- Dinero con tipos decimales, nunca `float`
- Cantidades normalizadas a unidades base
- Movimientos de inventario append-only
