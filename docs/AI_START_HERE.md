# AI_START_HERE.md — Punto de Entrada

**Si eres una IA leyendo esto, empieza aquí.**

## Orden de Lectura

1. **`AGENTS.md`** — Reglas obligatorias, stack, comandos, definición de terminado
2. **`docs/HANDOFF.md`** — Estado actual, qué existe, qué falta, pendientes P0/P1/P2
3. **`docs/DEMO_WEDNESDAY.md`** — Plan de demo, cronograma, dataset, criterios
4. **`PROJECT_BRIEF.md`** — Requisitos completos del proyecto
5. **`docs/DATABASE.md`** — Modelo de datos (solo si vas a tocar SQL o backend)
6. **`src/`** — Código fuente del frontend

## Estado Rápido

| Aspecto | Estado |
|---------|--------|
| Frontend | Scaffold funcional, páginas son placeholders |
| Backend | SQL completo, no aplicado al VPS |
| Demo mode | Funcional (VITE_DEMO_MODE=true) |
| Build/Lint/Test | Pasan todos |
| Conexión real | No hay (todo es demo) |

## Primera Tarea Recomendada

**Implementar el selector de rol demo en el Login.**

Por qué:
- Es rápido (30 min)
- Mejora inmediatamente la demo
- Permite mostrar diferencias por rol
- No requiere backend

### Cómo hacerlo

1. Abrir `src/pages/Login.tsx`
2. En modo demo, mostrar 3 botones: "Entrar como Dueña", "Entrar como Encargada", "Entrar como Cajera"
3. Abrir `src/context/AuthContext.tsx`
4. Modificar `DEMO_USER` para aceptar el rol seleccionado
5. Actualizar `App.tsx` para leer el rol del contexto
6. Ejecutar `npm run build`, `npm run lint`, `npm test`
7. Verificar que funciona en mobile (390x844) y desktop (1280px)

### Criterio de éxito

- Al hacer clic en cada botón, se accede al dashboard
- El nombre del rol aparece en algún lugar visible
- El sidebar/bottomnav muestra las secciones según el rol (ver §Selector de Rol Demo en AGENTS.md)

> **Nota**: El selector de rol es un mecanismo DEMO local. No es autenticación real
> ni prueba de seguridad RLS. En producción, los roles se controlarán desde
> Supabase con RLS y `get_current_user_role()`.

## Reglas Críticas

1. **NO tocar el VPS** — Sin autorización explícita y backup
2. **NO hacer deploy** — Sin autorización
3. **NO hacer commit** — Sin autorización explícita
4. **NO exponer secretos** — Nunca en archivos
5. **Schema `foodtruck`** — Nunca en `public`
6. **Siempre ejecutar** `npm run build && npm run lint && npm test` antes de entregar
