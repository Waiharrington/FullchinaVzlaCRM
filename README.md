# FullChinaVzla — PWA

## Comandos

```bash
# Instalar dependencias
npm install

# Desarrollo
npm run dev

# Build producción
npm run build

# Preview build
npm run preview

# Lint
npm run lint

# Test
npm test
```

## Backend

La aplicación utilizará el Supabase self-hosted existente en el VPS. Sus tablas
viven en el esquema aislado `fullchinavzla`.

No se deben aplicar migraciones ni modificar la configuración de PostgREST del
VPS sin revisar primero el SQL y obtener autorización.

## Variables de entorno

En PowerShell, copia `.env.example` a `.env` y configura:

```powershell
Copy-Item .env.example .env
```

- `VITE_SUPABASE_URL` — URL del proyecto Supabase
- `VITE_SUPABASE_ANON_KEY` — Anon key del proyecto
- `VITE_DEMO_MODE` — `true` para usar sin credenciales

## Estructura

```
src/
  components/   Layout, Sidebar, BottomNav
  context/      AuthContext (Supabase + modo demo)
  lib/          Cliente Supabase
  pages/        Operación, administración, clientes y reportes
  test/         Setup de testing
```

## Continuidad y documentación

Documentación para que cualquier IA pueda retomar el repositorio:

- [`AGENTS.md`](AGENTS.md) — Instrucciones operativas obligatorias
- [`docs/AI_START_HERE.md`](docs/AI_START_HERE.md) — Punto de entrada (lee esto primero)
- [`docs/HANDOFF.md`](docs/HANDOFF.md) — Estado actual, pendientes, verificaciones
- [`PROJECT_BRIEF.md`](PROJECT_BRIEF.md) — Requisitos y decisiones de diseño
- [`docs/DATABASE.md`](docs/DATABASE.md) — Modelo de datos completo
- [`docs/REQUIREMENTS_REUNION_1.md`](docs/REQUIREMENTS_REUNION_1.md) — Requisitos reunión inicial
- [`docs/PHASE_0_SECURITY_PAYMENTS.md`](docs/PHASE_0_SECURITY_PAYMENTS.md) — Seguridad y pagos aplicados
- [`docs/PHASE_1_CASH_ROLES.md`](docs/PHASE_1_CASH_ROLES.md) — Roles reales y caja operativa
