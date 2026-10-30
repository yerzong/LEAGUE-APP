# Módulo 10A — Overlays por URL + estudio de producción web

> Spec para Claude Code. El diferenciador de la liga: overlays para OBS que se
> alimentan de la base de datos (cero configuración para el caster) y un panel de
> control web para la producción. **Funciona SIN el agente de escritorio**: usa
> los datos que el staff ya mete (draft, resultados, stats del m05/m09). El
> agente en vivo llega en el m10b. Referencias: `docs/16-media-social-broadcast.md`,
> `docs/05-plataformas.md §7`, `docs/08-design-system.md`.
> Estándares: `docs/17-estandares-ingenieria.md`.

---

## Principio: cero configuración para el caster
La plataforma ya sabe equipos, logos, rosters, stats y standings. El caster elige
un partido y pega **un enlace** en OBS como "fuente de navegador". Todo lo demás
se llena solo. El productor controla las gráficas desde la web, en tiempo real.

---

## Alcance

### 1. Base de datos (`docs/03-modelo-datos.md §11`)
- `overlay_themes`, `overlay_scenes`, `broadcast_sessions`, `live_match_state`
  (estado en vivo emitido por Realtime, fuente `manual` por ahora; el agente del
  m10b lo pondrá como `observer_agent`). RLS: los overlays por URL se leen con un
  **token de overlay** por partida (no requieren login, pero no exponen datos
  privados). El estudio solo para staff/producer. Regenerar tipos.

### 2. App `apps/overlays` (React + Vite) — fuentes de navegador para OBS
Páginas transparentes 1920x1080 que escuchan Realtime y animan con Motion a 60fps:
- **Draft / Picks & Bans:** con soporte visual de **Fearless** (campeones
  bloqueados de la serie, leídos del motor/DB).
- **Scoreboard in-game:** marcador, oro, torres, dragones, barón, tiempo
  (con datos manuales ahora; en vivo con el m10b).
- **Lower-thirds:** cintillo con stats históricas del jugador (de `player_aggregate_stats`
  del m09); disparables a demanda o automáticos al marcar un lock-in.
- **Escenas:** inicio, espera, intermedio, MVP, resultado final, próximos
  partidos. Todas con el tema de marca (tokens), personalizables por `overlay_themes`.
- Cada overlay se sirve en `/overlay/[matchId]/[scene]?token=...`.

### 3. Estudio de producción (web, `/admin` o `/studio/[matchId]`)
- Elegir el partido en vivo; ver los enlaces de overlay listos para copiar a OBS.
- Controles en tiempo real: mostrar/ocultar cada overlay, invertir lados
  (azul/rojo), lanzar un lower-third de jugador, mostrar tabla, cambiar de escena.
- Marcador manual de respaldo (editar oro/kills/objetivos a mano si no hay agente).
- Estado de la sesión de transmisión (`broadcast_sessions`).
- Gestión de temas de overlay (colores, logo) por organización, reusando el
  design system.

### 4. Tiempo real
- El estudio publica cambios de estado; los overlays los reciben por Realtime al
  instante. Un `broadcast_sessions.state` (jsonb) guarda qué está visible, para
  reconectar sin perder el estado.

### 5. Integración OBS (opcional dentro del módulo)
- `obs-websocket` para cambiar escenas de OBS desde el estudio (OBS 28+ lo trae).
  Si el caster no lo conecta, todo funciona igual manual.

### 6. Co-stream de creadores (del m03/decisiones)
- Enlaces de overlay con tema neutro para que creadores registrados hagan
  co-stream con la marca oficial (respetando `costream_policy` del torneo).

---

## Lo que NO va
- Lectura automática del cliente de LoL en vivo (eso es el agente, m10b).
- Votación MVP por QR y slots de patrocinador dinámicos: dejar la estructura,
  construirlos en una segunda pasada o en monetización.

## Criterios de aceptación
- [ ] `supabase db push` con RLS; el overlay por token no expone datos privados.
- [ ] Con el seed demo, abrir `/overlay/[match]/scoreboard` y `/draft` muestra
      equipos, logos y Fearless reales; se ve bien a 1920x1080 con fondo
      transparente.
- [ ] El estudio controla en vivo: mostrar/ocultar, invertir lados, lanzar
      lower-third, cambiar escena; el overlay reacciona por Realtime sin recargar.
- [ ] El marcador manual de respaldo actualiza el overlay.
- [ ] `pnpm lint typecheck test build` pasa; overlays reusan `packages/ui`
      (presentacionales); sin hex ni estilos sueltos.

## Notas
- Meta: un caster puede transmitir un partido demo con overlays de aspecto LCK
  sin configurar nada, solo pegando enlaces. Los datos en vivo (oro/kills
  automáticos) llegan con el m10b; aquí ya queda el marco y el control.
- Para un caster remoto real hace falta estar **desplegado** (no localhost); en
  local sirve para que el equipo de producción pruebe. Considerar despliegue
  antes de usarlo en un torneo real.
