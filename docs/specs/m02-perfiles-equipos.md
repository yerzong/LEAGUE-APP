# Módulo 02 — Perfiles, cuenta de Riot y equipos

> Spec para Claude Code. Primer módulo con pantallas reales que el usuario usa:
> completar perfil, vincular cuenta de Riot (método de ícono) y crear/gestionar
> equipos. Se apoya en el auth del 00c, el design system y `packages/core`
> (reglas de membresía). Referencias: `docs/03-modelo-datos.md` (§2, §4),
> `docs/12-auth-roles-perfiles.md`, `docs/13-reglas-integridad.md`,
> `docs/14-modulos-funcionales.md`. Estándares: `docs/17-estandares-ingenieria.md`.

---

## Alcance (una rama; se puede dividir en áreas encadenadas)

### 1. Migración de base de datos (Supabase CLI, contra penta-dev)
Añadir a las tablas existentes, siguiendo `03-modelo-datos.md`:
- Ampliar `users` con columnas de perfil del §2 que falten: `avatar_media_id`
  (nullable, sin media aún), `country_code`, `game_region`, `primary_role`,
  `secondary_role`, `bio`, `is_free_agent`. (Nada de foto/quitar-fondo todavía.)
- `user_social_links`, `user_private_data` (RLS estricta), `user_privacy_settings`.
- `riot_accounts`, `riot_verification_attempts`, `riot_rank_snapshots`,
  `riot_id_history`.
- `teams` (con `club_id` nullable), `team_members`, `team_invitations`,
  `team_join_requests`, `team_name_history`, `free_agent_listings`.
- `clubs` y `club_members` pueden crearse vacíos ahora (solo tablas) o diferirse;
  priorizar equipos independientes.
- Todas con RLS y los índices clave de `03-modelo-datos.md §15–16`, en especial:
  - `UNIQUE (puuid) WHERE unlinked_at IS NULL`
  - `UNIQUE (team_id, user_id) WHERE left_at IS NULL`
  - unicidad de nombre/tag de equipo permanente por organización.
- Regenerar tipos a `packages/db`.

### 2. Perfil de usuario (portal `/app`)
- Ver y editar perfil: display name, username (único), país, región de juego,
  rol principal/secundario, bio, redes sociales (lista).
- Datos privados (`user_private_data`) en un formulario aparte, nunca públicos.
- Ajustes de privacidad por campo (public/team/staff/private).
- Onboarding: si faltan datos obligatorios, guiar a completarlos.
- Foto de perfil: **subir imagen simple** a Supabase Storage (sin quitar fondo;
  eso es otro módulo). Dejar `avatar_media_id` listo para cuando exista media.

### 3. Vinculación de cuenta de Riot (método de ícono)
Mientras no haya RSO aprobado (`12-auth-roles-perfiles.md §2`):
- El usuario escribe su Riot ID (`Nombre#TAG`) y región.
- El sistema crea un `riot_verification_attempt` con un `expected_icon_id` al
  azar y le pide poner ese ícono de invocador en su cuenta.
- Un endpoint consulta la API de Riot (a través de `packages/integrations/riot`,
  adaptador de verificación por ícono) y confirma si el ícono coincide.
- Al confirmar: crear `riot_accounts` (con PUUID, Riot ID, región, nivel, rango),
  marcar `verified_at`, respetar `UNIQUE(puuid)`.
- Guardar `riot_rank_snapshots` inicial.
- Errores claros: cuenta ya vinculada a otro usuario, ícono no coincide, intento
  expirado, Riot ID no encontrado.
- La llamada a Riot vive en la API (server-side), nunca expone la API key.

### 4. Equipos (portal `/app`)
- Crear equipo: nombre, tag, logo (imagen simple), región, descripción.
  Validar unicidad de nombre/tag por organización.
- Ver equipo: roster, roles internos (capitán, co-capitán, jugador, suplente,
  coach, manager), historial.
- Invitaciones: el capitán invita por búsqueda de usuario o por link; el invitado
  acepta/rechaza. Solicitudes de ingreso: el jugador pide, el capitán decide.
- Gestión de roster: añadir/quitar, cambiar rol interno, transferir capitanía,
  disolver equipo (solo sin inscripciones activas — por ahora siempre, no hay
  torneos aún).
- Validaciones de membresía usando `packages/core` donde aplique (p. ej. un
  jugador no puede estar dos veces en el mismo equipo activo). La exclusividad
  entre torneos se evaluará en el módulo de inscripciones; aquí solo la del equipo.
- "Buscar equipo" (free agent): marcarse disponible con roles y horario.

### 5. API (NestJS)
Módulos `identity`, `riot-accounts`, `teams` con la estructura hexagonal del
00c: casos de uso, validación Zod (`packages/contracts`), permisos, auditoría en
acciones sensibles (disolver equipo, transferir capitanía, desvincular Riot).
Todas las escrituras pasan por la API.

### 6. Páginas públicas mínimas (sitio `/`)
- Página pública de un equipo (`/equipos/[slug]`): nombre, logo, roster, región.
  Respeta la privacidad de los jugadores. (Las stats llegan en otro módulo.)
- Página pública de un jugador (`/jugadores/[username]`): datos públicos y
  Riot ID verificado. Sin pro-stats todavía.

---

## Lo que NO va en este módulo
- Quitar fondo de fotos / microservicio de media (módulo de media).
- RSO de Riot (hasta que Riot lo apruebe; por ahora método de ícono).
- Clubes completos con varios rosters (se puede diferir; priorizar equipos).
- Pro-stats, torneos, inscripciones, calendario.

## Criterios de aceptación
- [ ] `supabase db push` aplica la migración en penta-dev; RLS verificada con
      tests (un usuario no ve datos privados de otro; un no-miembro no ve el
      roster privado).
- [ ] `pnpm lint typecheck test build` pasa; E2E de: completar perfil, vincular
      Riot (con la API de Riot mockeada/stub), crear equipo, invitar y aceptar.
- [ ] No se puede vincular una cuenta Riot ya vinculada a otro usuario.
- [ ] No se puede crear un equipo con nombre/tag duplicado en la organización.
- [ ] Un jugador no aparece dos veces en el roster activo de un equipo.
- [ ] Acciones sensibles quedan en `audit_logs`.
- [ ] Toda la UI usa componentes de `packages/ui`; sin hex ni estilos sueltos.
- [ ] Textos en español desde `packages/i18n`.

## Notas
- Para los tests que tocan Riot, usar un adaptador stub (no llamar a la API real
  en CI). El adaptador real se prueba aparte.
- Priorizar el flujo del piloto: registrarse → verificar Riot → crear equipo →
  invitar. Eso es lo mínimo para que, en el módulo de torneos, un equipo pueda
  inscribirse.
