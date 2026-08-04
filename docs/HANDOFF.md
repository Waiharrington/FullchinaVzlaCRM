# HANDOFF.md — Estado del Proyecto

**Última actualización**: 2026-08-03

> **Nota sobre el repositorio**: Al 2026-08-03, el repositorio **no tiene commits
> confirmados** y todo el código puede estar **untracked**. No hay remoto confirmado.
> Verificar `git status` antes de cada sesión porque el estado puede cambiar.

## Resumen Ejecutivo

Proyecto en fase **scaffold/demo**. El frontend es funcional con navegación,
login demo y responsive layout. Las páginas son placeholders listos para
recibir lógica. El esquema SQL está completo y probado localmente en
PostgreSQL 15 efímero. **No está conectado al VPS**.

## Estado Actual

### Frontend — Funcional

| Componente | Estado | Notas |
|------------|--------|-------|
| `src/App.tsx` | Listo | Rutas protegidas, demo mode |
| `src/context/AuthContext.tsx` | Listo | Demo user hardcodeado, Supabase listo |
| `src/components/Layout.tsx` | Listo | Sidebar + BottomNav responsive |
| `src/components/Sidebar.tsx` | Listo | Desktop, 4 secciones |
| `src/components/BottomNav.tsx` | Listo | Mobile, 4 secciones |
| `src/pages/Login.tsx` | Listo | Formulario real + demo mode |
| `src/pages/Inicio.tsx` | Placeholder | Card con 3 boxes estáticos |
| `src/pages/Caja.tsx` | Placeholder | Card con 3 boxes estáticos |
| `src/pages/Inventario.tsx` | Placeholder | Card con 3 boxes estáticos |
| `src/pages/Mas.tsx` | Placeholder | Card con 3 boxes estáticos |
| `src/lib/supabase.ts` | Listo | Cliente configurable, demo mode |

### Verificaciones

| Comando | Resultado |
|---------|-----------|
| `npm run build` | Pass (2.89s, 241.48 kB JS gzipped 76.11 kB) |
| `npm run lint` | Pass (0 warnings) |
| `npm test` | Pass (1 test, 179ms) |
| PWA | Generada (sw.js + workbox) |

### Backend — SQL Listo (No aplicado al VPS)

| Archivo | Estado | Verificación |
|---------|--------|--------------|
| `supabase/migrations/20260803000000_initial_foodtruck_schema.sql` | Completo | 27 tablas, 21 funciones, 29 triggers, 10 vistas, 72 RLS |
| `supabase/migrations/20260803000001_rollback_foodtruck_schema.sql` | Completo | Rollback con guardia dinámica |
| `docs/DATABASE.md` | Completo | Documentación exhaustiva del esquema |

**Verificación local**: Migración y rollback probados en PostgreSQL 15 efímero.
No aplicados al VPS sin autorización y backup.

## Archivos Clave

```
AGENTS.md                    — Instrucciones para IAs (obligatorio leer)
PROJECT_BRIEF.md             — Requisitos y decisiones de diseño
docs/DATABASE.md             — Modelo de datos completo
docs/HANDOFF.md              — Este archivo
docs/DEMO_WEDNESDAY.md       — Plan de demo
docs/AI_START_HERE.md        — Punto de entrada
src/                         — Código frontend
supabase/migrations/         — SQL de esquema
```

## Decisiones Tomadas

1. **Schema aislado `foodtruck`** — Provisional hasta confirmar nombre comercial
2. **Supabase self-hosted en VPS** — No crear proyecto Cloud separado
3. **Modo demo sin backend** — Login automático, datos hardcodeados
4. **Mobile-first** — Responsive en 390x844 (mobile) y 1280px (desktop)
5. **Roles**: owner (total), manager (operación), cashier (ventas)
6. **Vistas financieras vía RPC SECURITY DEFINER** — Cashier no ve costos
7. **Pagos inmutables, stock append-only** — Integridad de datos

## Qué es Real vs Mock/Demo

| Funcionalidad | Estado |
|---------------|--------|
| Navegación entre páginas | Real |
| Login/logout demo | Real |
| Responsive sidebar/bottomnav | Real |
| PWA instalable | Real |
| Datos en páginas | **Mock** — placeholders estáticos |
| Conexión a Supabase | **Mock** — demo mode sin backend |
| Lógica de negocio | **No implementada** |
| CRUD de inventario | **No implementada** |
| Flujo de caja/ventas | **No implementado** |
| Cierres diarios | **No implementado** |

## Pendientes (ordenados por prioridad)

### P0 — Crítico para demo miércoles

- [ ] Selector de rol demo en login (owner/manager/cashier) — controla visibilidad UI
- [ ] Dashboard con resumen del día (ventas, inventario bajo, órdenes activas)
- [ ] Caja: crear orden → agregar productos → cobrar → estado paid
- [ ] Caja: selector de productos con precios
- [ ] Caja: método de pago (efectivo, tarjeta, transferencia)
- [ ] Caja: recibo/confirmación visual
- [ ] Inventario: lista de ingredientes con stock actual
- [ ] Inventario: lista de productos vendibles
- [ ] Crédito: crear crédito + abono
- [ ] Cierre de caja: resumen del día
- [ ] Responsive: mobile (390x844) y desktop (1280px)

### P1 — Importante post-demo

- [ ] Producción: lotes de preparación
- [ ] Compras: registrar compras con proveedor
- [ ] Gastos operativos
- [ ] Nómina básica
- [ ] Reportes semanales

### P2 — Futuro

- [ ] Conexión real a Supabase VPS
- [ ] Autenticación real con roles
- [ ] Offline sync
- [ ] Notificaciones
- [ ] Exportación PDF

## Riesgos

1. **Tiempo limitado** — 2 días hasta la demo (miércoles 5 agosto)
2. **Sin backend real** — Todo es demo, no se puede mostrar persistencia
3. **Funcionalidad incompleta** — Solo scaffold, lógica de negocio pendiente
4. **Una persona desarrollando** — Dependencia crítica

## Cómo Iniciar Localmente

```powershell
# 1. Instalar dependencias
npm install

# 2. Configurar .env (copiar de ejemplo en PowerShell)
Copy-Item .env.example .env
# Editar .env si es necesario (para demo, VITE_DEMO_MODE=true es suficiente)

# 3. Ejecutar
npm run dev

# 4. Abrir en navegador
# http://localhost:5173
```

## Variables `.env` (sin secretos)

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co  # Opcional para demo
VITE_SUPABASE_ANON_KEY=your-anon-key                  # Opcional para demo
VITE_DEMO_MODE=true                                   # true para demo sin backend
```

## Checklist Antes de Enseñar a la Clienta

- [ ] `npm run build` pasa
- [ ] `npm run lint` pasa
- [ ] `npm test` pasa
- [ ] Login demo funciona (acceso directo sin credenciales)
- [ ] Navegación funciona en mobile y desktop
- [ ] Dashboard muestra datos demo (no vacío)
- [ ] Caja permite crear orden y "cobrar"
- [ ] Inventario muestra ingredientes y productos
- [ ] Crédito permite crear y abonar
- [ ] Cierre muestra resumen del día
- [ ] No hay datos reales de la clienta en el código
- [ ] No hay secretos expuestos

## Preguntas Pendientes para la Clienta

1. ¿Nombre comercial del negocio? (afecta schema `foodtruck`)
2. ¿Lista inicial de productos y precios?
3. ¿Lista de ingredientes y unidades?
4. ¿Proveedores habituales?
5. ¿Métodos de pago aceptados?
6. ¿Nombres de usuarios reales (o genéricos para demo)?
7. ¿Horario de operación del food truck?
8. ¿Ubicación fija o itinerante?
