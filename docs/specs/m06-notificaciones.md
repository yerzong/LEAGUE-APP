# Módulo 06 — Motor de notificaciones (in-app + correo)

> Spec para Claude Code. Un solo motor multicanal y configurable: los módulos
> NO envían correos por su cuenta, publican eventos (ya lo hacen a
> `outbox_events`) y este motor decide a quién, por dónde y con qué plantilla.
> Este módulo entrega los canales **in-app** y **correo**. Discord y push llegan
> en módulos siguientes (dejar el puerto listo). Diseño completo en
> `docs/15-notificaciones.md`. Modelo: `docs/03-modelo-datos.md §9`.
> Estándares: `docs/17-estandares-ingenieria.md`.

---

## Alcance

### 1. Migración (Supabase CLI, penta-dev) — `docs/03-modelo-datos.md §9`
- `notification_types` (catálogo), `notification_templates`,
  `notification_rules`, `user_notification_preferences`, `notifications`
  (bandeja in-app), `notification_deliveries` (un registro por canal, con la
  unicidad de idempotencia `source_event_id + user_id + channel`),
  `push_subscriptions` (estructura, sin uso aún).
- Seed del catálogo de tipos (`docs/15 §3`) y plantillas base en es-419.
- RLS: cada usuario ve solo sus notificaciones y preferencias. Regenerar tipos.

### 2. Consumidor del outbox (worker)
- Un procesador que lee `outbox_events` (patrón outbox ya sembrado por m04/m05)
  y los convierte en notificaciones, de forma idempotente (no reprocesar, no
  duplicar). Reintentos con backoff; marca `published_at`.
- Mapear los eventos existentes a tipos de notificación: `registration.approved`,
  `registration.rejected`, `registration.promoted`, `tournament.published`,
  `match.scheduled`, `match.checkin_open`, `match.result_confirmed`,
  `match.forfeit`, `dispute.opened`, `dispute.resolved`, etc. (los que ya se
  emiten; si falta emitir alguno útil, agregarlo en su módulo).

### 3. Motor (API / worker)
- Dado un evento: resolver destinatarios (jugadores del roster, capitán, staff
  del torneo, seguidores), aplicar `notification_rules` de la organización y las
  `user_notification_preferences`, renderizar la plantilla en el idioma del
  usuario, y encolar un `notification_delivery` por canal.
- **Canales de este módulo:** `in_app` (siempre) y `email`.
- Puerto `NotificationChannelPort` con adaptadores: `InAppAdapter`,
  `EmailAdapter`. Dejar registrados (sin implementar) `DiscordAdapter` y
  `PushAdapter` para los módulos siguientes.
- **Notificaciones críticas** (código de partida, forfeit, sanción) no se pueden
  desactivar, solo cambiar de canal (regla de `docs/15 §4`).
- Correo: adaptador detrás de puerto (Resend o SMTP), con `.env` para la API key;
  nunca en el repo. En tests, adaptador fake que captura los envíos.

### 4. API
- Bandeja: listar notificaciones del usuario, marcar leídas, contador de no
  leídas.
- Preferencias: ver y editar por categoría y canal (respetando las críticas).
- Admin: ver/editar `notification_rules` y plantillas de la organización, con
  vista previa; historial de entregas (enviado/entregado/fallido).

### 5. Web
- **Portal `/app`:** campana de notificaciones con contador y bandeja; página de
  preferencias (`/app/ajustes/notificaciones`).
- **Admin `/admin`:** gestión de tipos/plantillas/reglas y un monitor de
  entregas (parte del "monitor de automatización" de `docs/14`).
- Realtime: la campana se actualiza en vivo cuando llega una notificación.

---

## Lo que NO va
- Canal Discord y push nativo (módulos siguientes; puertos ya listos).
- SMS/WhatsApp (solo dejar la puerta, no implementar).
- Envío real de correo en CI (usar el adaptador fake).

## Criterios de aceptación
- [ ] `supabase db push` aplica la migración; RLS con tests (un usuario no lee
      notificaciones de otro).
- [ ] Al aprobar una inscripción (evento real de m04), el capitán y el roster
      reciben una notificación in-app y un correo (fake en test), sin duplicar
      aunque el evento se procese dos veces.
- [ ] Las preferencias del usuario filtran canales; las críticas no se pueden
      apagar.
- [ ] La campana muestra el contador y se actualiza en vivo; marcar leída
      funciona.
- [ ] El admin ve el historial de entregas y puede editar una plantilla con
      vista previa.
- [ ] `pnpm lint typecheck test build` pasa; E2E: generar un evento (aprobar
      inscripción con el seed demo) y ver la notificación en la campana.
- [ ] UI con `packages/ui` e i18n; sin hex ni estilos sueltos.

## Notas
- El outbox ya existe y los módulos ya emiten eventos: este módulo los
  **consume**, no cambia cómo se emiten.
- Priorizar los eventos del flujo del piloto (inscripción y partidas). El resto
  se añade mapeando tipos, sin tocar la arquitectura.
- Proveedor de correo sugerido: Resend (simple, buen free tier) detrás del
  puerto; cambiarlo luego es cambiar el adaptador.
