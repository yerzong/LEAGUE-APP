# Módulo 07 — Bot de Discord

> Spec para Claude Code. Lleva la operación a donde vive la comunidad. Se engancha
> al motor de notificaciones del m06 (implementa el `DiscordAdapter` que quedó
> registrado) y añade comandos e interacción. Referencias:
> `docs/05-plataformas.md §6`, `docs/14-modulos-funcionales.md §7`,
> `docs/15-notificaciones.md`, `docs/03-modelo-datos.md §12`.
> Estándares: `docs/17-estandares-ingenieria.md`.

---

## Alcance

### 1. App `apps/bot` (discord.js)
- Proceso Node con discord.js, tipado, que arranca junto al stack (`pnpm dev`) y
  se despliega como worker aparte. Config por `.env` (token del bot, client id);
  nunca en el repo.
- Registro de slash commands por guild.
- Guard: si falta el token, el bot no arranca pero el resto del stack sí.

### 2. Vinculación de cuenta Discord ↔ usuario de la plataforma
- Tabla `discord_guilds`, `discord_channel_links`, `discord_temp_channels`
  (`docs/03 §12`), más el vínculo usuario↔discord (reusar `accounts` provider
  `discord` del m00c/Supabase Auth: el usuario ya entra con Discord, así que su
  Discord ID está disponible; mapearlo).
- Comando `/vincular` si hiciera falta para usuarios que entraron por correo.

### 3. Canal de notificaciones Discord (implementa el puerto del m06)
- `DiscordAdapter` del `NotificationChannelPort`: envía DM al usuario o publica
  en un canal, según el tipo de notificación. Respeta preferencias y las reglas
  de notificación ya existentes.
- Avisos de staff (nueva inscripción, disputa, alerta) a un canal privado
  configurado (`discord_channel_links` con propósito `staff`).

### 4. Operación de partida por Discord
- **Check-in** por comando/botón (`/checkin`) que llama a la API del m05.
- **Canales de voz temporales** por partida/equipo al abrir el check-in; borrarlos
  al terminar (`discord_temp_channels`).
- **Código de torneo** por DM al capitán (cuando exista m08; por ahora el mensaje
  de "tu partida está lista" con el enlace al centro de partida).
- **Recordatorios** automáticos (a través del motor de notificaciones).
- **Forfeit** avisado en el canal cuando el m05 lo marca.
- **Resultado** publicado al confirmarse.

### 5. Comandos de consulta
- `/proximo` (próxima partida del equipo del usuario), `/tabla <torneo>`
  (standings), `/perfil [usuario]`, `/equipo <nombre>`. Leen de la API pública o
  autenticada; respuestas con embeds usando los colores de marca.

### 6. Roles automáticos (opcional dentro del módulo)
- Asignar rol de Discord "jugador verificado" cuando el usuario vincula Riot;
  rol por equipo/torneo. Configurable por `discord_guilds.settings`.

### 7. Admin
- `/admin/discord`: conectar el servidor, elegir canales (anuncios, resultados,
  staff, categoría de voz), activar/desactivar funciones del bot, ver estado.

---

## Lo que NO va
- Riot Tournament codes reales (m08); por ahora el bot avisa y enlaza al centro
  de partida.
- Overlays / transmisión (m de broadcast).

## Criterios de aceptación
- [ ] El bot arranca con token válido y registra los slash commands; sin token,
      el resto del stack sigue corriendo.
- [ ] `DiscordAdapter` entrega una notificación real por DM/canal al aprobar una
      inscripción (probado en un server de pruebas).
- [ ] `/checkin` registra el check-in vía la API del m05.
- [ ] Se crean y borran canales de voz temporales de una partida.
- [ ] `/proximo`, `/tabla`, `/perfil`, `/equipo` responden con datos reales.
- [ ] Avisos de staff llegan al canal configurado.
- [ ] `pnpm lint typecheck test build` pasa; tests con discord.js mockeado (no
      llamar a Discord real en CI). Un E2E/manual documentado en un server real.
- [ ] Textos en es-419; embeds con tokens de marca.

## Notas
- Requiere crear la app/bot en el Discord Developer Portal y añadir el token a
  `.env` (paso del usuario, igual que el OAuth del login).
- Toda la lógica de negocio sigue en la API; el bot es un cliente más del puerto
  y de la API, no reimplementa reglas.
