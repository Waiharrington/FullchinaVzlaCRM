# Clienta Food Truck — PWA

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
vivirán en un esquema aislado por negocio; provisionalmente se utilizará
`foodtruck` hasta confirmar el nombre comercial.

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
  pages/        Login, Inicio, Caja, Inventario, Más
  test/         Setup de testing
```

## Continuidad y demo

Documentación para que cualquier IA pueda retomar el repositorio:

- [`AGENTS.md`](AGENTS.md) — Instrucciones operativas obligatorias
- [`docs/AI_START_HERE.md`](docs/AI_START_HERE.md) — Punto de entrada (lee esto primero)
- [`docs/HANDOFF.md`](docs/HANDOFF.md) — Estado actual, pendientes, verificaciones
- [`docs/DEMO_WEDNESDAY.md`](docs/DEMO_WEDNESDAY.md) — Plan ejecutable para la demo del miércoles
- [`PROJECT_BRIEF.md`](PROJECT_BRIEF.md) — Requisitos y decisiones de diseño
- [`docs/DATABASE.md`](docs/DATABASE.md) — Modelo de datos completo
