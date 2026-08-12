# Punto de entrada para otra IA

Lee en este orden:

1. `AGENTS.md`
2. `docs/HANDOFF.md`
3. `docs/REQUIREMENTS_REUNION_1.md`
4. `docs/PHASE_0_SECURITY_PAYMENTS.md`
5. `docs/PHASE_1_CASH_ROLES.md`
6. `docs/DATABASE.md` solo si tocarás backend

Estado rápido:

- Caja, Comandas, Equipo, Compras, Producción, Recetas y Nómina tienen
  persistencia real contra Supabase. La infraestructura de demo fue eliminada.
- Almacén, Fidelización, Gastos, Marketing, Menú semanal y partes de otros
  módulos todavía mezclan interfaz avanzada con datos locales o estáticos;
  inspecciona cada servicio antes de llamarlo "terminado".
- El VPS ya recibió las migraciones de seguridad, pagos, caja operativa y PIN
  seguro del 2026-08-08.
- El acceso por PIN usa `supabase/functions/pin-login/index.ts`, hashes bcrypt y
  tokens magic-link de un solo uso. No sustituirlo por contraseñas `VITE_*`.
- Build, lint y 11 pruebas automatizadas pasan.
- Producción está publicada en `https://fullchina-vzla-crm.vercel.app` y el PIN
  de Dueña fue probado allí. No hubo commit ni push en esta fase.

Reglas obligatorias:

- No tocar el VPS sin autorización explícita, backup y verificación.
- No hacer deploy, commit o push sin autorización explícita.
- Usar únicamente el esquema remoto `fullchinavzla`, nunca `public`.
- No ejecutar directamente los SQL iniciales que todavía contienen el nombre
  histórico `foodtruck`.
- No exponer secretos ni convertir datos demo en afirmaciones de funcionalidad.
