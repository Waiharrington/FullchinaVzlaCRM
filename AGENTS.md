# AGENTS.md — Instrucciones Operativas

## Objetivo

Construir una PWA responsive para administrar la operación diaria de un food
truck. **Fecha límite: miércoles 5 de agosto de 2026.**
Precio objetivo: **USD 500**.

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
  context/      AuthContext (Supabase + modo demo)
  lib/          Cliente Supabase (configurable con .env)
  pages/        Login, Inicio, Caja, Inventario, Más
  test/         Setup de testing
supabase/
  migrations/   SQL de esquema foodtruck (27 tablas, 21 funciones, 29 triggers, 10 vistas, 72 RLS)
```

## Fuentes de Verdad

| Documento | Propósito |
|-----------|-----------|
| `PROJECT_BRIEF.md` | Requisitos, stack, decisiones de diseño |
| `docs/DATABASE.md` | Modelo de datos completo, migraciones, verificación |
| `docs/HANDOFF.md` | Estado actual, pendientes, verificaciones |
| `docs/DEMO_WEDNESDAY.md` | Plan ejecutable para la demo del miércoles |
| `docs/AI_START_HERE.md` | Punto de entrada para nuevas IAs |

## Reglas de Seguridad

1. **NO tocar el VPS** — No ejecutar migraciones, no modificar Supabase remoto sin autorización explícita y backup.
2. **NO hacer deploy** — No desplegar a Vercel ni ningún hosting sin autorización.
3. **NO hacer commit** — No hacer git commit, push ni crear PRs sin autorización explícita.
4. **NO exponer secretos** — Nunca incluir API keys, contraseñas ni credenciales en archivos.
5. **Schema `foodtruck`** — Todas las tablas y objetos viven en el esquema `foodtruck`, nunca en `public`.
6. **Preservar trabajo** — Cada cambio importante debe ser verificable localmente antes de integrar.

## Estado del Repositorio

- **Sin commits confirmados** — El repositorio puede estar completamente sin commits.
- **Archivos untracked** — Todo el código puede estar untracked. Verificar `git status` antes de cada sesión.
- **Sin remoto confirmado** — No asumir que existe un remote configurado.
- **Respaldo de demo**: Conservar `dist/` generado y crear una copia local etiquetada o ZIP
  **solo si el usuario lo autoriza**. No afirmar que existen respaldos previos.

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

## Definición de "Terminado" para Demo

Una funcionalidad está lista para la demo cuando:

1. `npm run build` pasa sin errores
2. `npm run lint` pasa sin warnings
3. `npm test` pasa todos los tests
4. Funciona en modo demo (`VITE_DEMO_MODE=true`)
5. Es responsive en mobile (390x844) y desktop (1280px)
6. No rompe funcionalidad existente
7. No hay datos reales de la clienta en el código

## Modo Demo

La aplicación soporta modo demo sin conexión a Supabase:

- Variable `VITE_DEMO_MODE=true` en `.env`
- Login automático con usuario demo
- Datos hardcodeados para la demo
- **No requiere backend para la demo del miércoles**

## Selector de Rol Demo (P0)

El login en modo demo muestra 3 botones para elegir rol: **Owner**, **Manager**, **Cashier**.
Esto es un selector **DEMO local** para la presentación del 2026-08-05:

- **NO es autenticación real** — No valida credenciales contra Supabase.
- **NO es prueba de seguridad RLS** — La seguridad real se implementa con
  `get_current_user_role()` y RLS en Supabase post-demo.
- **Solo controla visibilidad en la UI** — Qué secciones y datos ve cada rol.

### Visibilidad por rol en demo

| Rol | Ve | No ve |
|-----|----|-------|
| `owner` | Todo: costos, rentabilidad, reportes, configuración, acciones exclusivas | Nada oculto |
| `manager` | Operación + reportes permitidos: producción, inventario, compras, gastos, reportes | Configuración y acciones exclusivas de owner |
| `cashier` | Caja, pedidos, clientes/créditos operativos, inventario (sin costos) | Costos, márgenes, nómina, configuración, reportes financieros |

### Reglas de visibilidad

- Owner ve **todo** sin restricciones.
- Manager ve operación + reportes, pero **no** configuración ni acciones exclusivas de owner (ej: nómina, bonos, datos financieros sensibles).
- Cashier ve solo caja, pedidos, clientes/créditos operativos e inventario **sin costos**. No ve reportes financieros ni configuración.

## Roles de Usuario

| Rol | Acceso |
|-----|--------|
| `owner` | Total: costos, rentabilidad, reportes, configuración |
| `manager` | Operación: producción, inventario, compras, gastos |
| `cashier` | Ventas: comandas, cobros, cierres básicos |

> **Nota**: Los roles en la UI son un mecanismo DEMO. La seguridad real se
> implementa en Supabase con RLS y `get_current_user_role()` (post-demo).

## Stack de Persistencia

- **PostgreSQL 15+** en Supabase self-hosted
- **Esquema aislado**: `foodtruck` (provisional hasta confirmar nombre comercial)
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
