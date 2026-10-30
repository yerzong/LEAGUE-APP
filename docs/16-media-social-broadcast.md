# Media, Redes Sociales y Transmisión

> Documento vivo. Cubre: subida de imágenes con quitar fondo, publicación
> multi-red desde la plataforma, seguimiento del stream y la UI en vivo de las
> partidas (draft, marcador, scoreboard) con diseño propio.

---

## 1. Media: subida, procesamiento y quitar fondo

### Flujo de subida
```
Usuario sube imagen → validación (tipo, peso, dimensiones)
→ Supabase Storage (bucket "originals", privado)
→ job de procesamiento:
     1. Re-encode a WebP/AVIF + tamaños (thumb, md, lg)
     2. Quitar fondo (solo fotos de perfil y logos, si el usuario lo pide)
     3. Moderación automática (contenido inapropiado)
→ bucket "public" + registro MediaAsset
→ el usuario ve la vista previa y confirma (puede revertir a la original)
```

### Quitar fondo
| Opción | Tipo | Costo | Decisión |
|--------|------|-------|----------|
| **rembg** (Python, modelos tipo U²-Net/BiRefNet) | Self-hosted, open source | Solo cómputo | **Recomendada**: microservicio Python (tú sabes Python) |
| API comercial (ej. remove.bg) | SaaS | Por imagen | Respaldo si la calidad no alcanza |
| Librería en navegador (ej. @imgly/background-removal) | Cliente | Gratis | Cuidado: licencia AGPL; revisar antes de usar |

- La versión **sin fondo** se guarda aparte: es la que se usa en gráficos de MVP,
  lower-thirds y posts (efecto LCK con el jugador recortado).
- Recomendación de producto: pedir al jugador una foto tipo "busto" con buena luz
  (guía visual en el upload).

### Moderación
- Moderación automática de imágenes (proveedor de IA de visión) + cola de
  revisión humana para casos dudosos.
- Logos y nombres de equipo pasan por moderación antes de ser públicos.
- Reportes de usuarios → módulo de moderación.

---

## 2. Gestión de redes sociales (publicar en todas desde la app)

### Realidad de las APIs (investigado, 2026)
- **X (Twitter):** pago por uso, sin plan gratuito para publicar
  (~0.015 USD por post y ~0.20 USD si lleva enlace). Fuente:
  [docs.x.com](https://docs.x.com/x-api/getting-started/pricing),
  [posteverywhere.ai](https://posteverywhere.ai/blog/schedule-x-twitter-posts-api).
- **Instagram / Facebook (Meta Graph API):** gratis pero con revisión de la app
  (app review) y cuenta profesional.
- **TikTok (Content Posting API):** requiere auditoría de la app para publicar
  públicamente.
- **YouTube:** cuota por unidades.
- Cada red tiene su propio flujo de autorización y su propia revisión. Por eso
  muchos equipos usan una **API unificada** (servicios de pago que publican en
  ~10–15 redes con una sola integración). Fuente:
  [blotato.com](https://www.blotato.com/blog/social-media-api),
  [dev.to](https://dev.to/shreyvijayvargiya/social-media-posting-automation-free-tools-apis-2026-eh3).

> Contenido reformulado para cumplir con restricciones de licencia de las fuentes.

### Diseño
Puerto `SocialPublisherPort` con adaptadores intercambiables:
- `UnifiedSocialAdapter` (API unificada de pago) — **recomendado para arrancar**:
  evita 4 revisiones de apps distintas.
- Adaptadores directos (Meta, X, TikTok, YouTube) — cuando el volumen haga
  que el costo de la API unificada no valga la pena.
- `DiscordAdapter` — nativo y gratis, siempre directo.
- n8n puede orquestar la publicación si se prefiere flujo visual.

### Módulo de redes (admin)
- **Cuentas conectadas** de la organización (OAuth por red).
- **Composer**: un post, adaptado por red (texto, límite de caracteres, formato
  de imagen 1:1, 4:5, 9:16), vista previa por red.
- **Calendario editorial**: programar publicaciones.
- **Publicación automática por evento** (configurable): resultado de partida,
  MVP, standings de la jornada, inicio de stream. Con opción "requiere
  aprobación" antes de publicar.
- **Texto asistido por IA** (copy del post a partir de los datos).
- Historial: publicado/fallido, enlace al post, métricas básicas si la red las da.

---

## 3. Seguimiento del stream

- Canales de transmisión de la organización registrados (Twitch, YouTube, Kick).
- **Detección de "en vivo"**: Twitch EventSub (`stream.online/offline`), YouTube
  Live API, polling como respaldo.
- Al iniciar stream: aviso en Discord/redes, banner "EN VIVO" en el home y en la
  página del evento, embed del stream.
- Asociar stream ↔ partida para que el VOD quede en la página de la partida.
- Métricas: viewers, pico, duración (para el media kit).

---

## 4. UI en vivo de las partidas (draft, marcador, scoreboard)

### De dónde salen los datos en vivo (hallazgo técnico importante)
La API web de Riot **no** da datos de draft ni de la partida en tiempo real.
Los datos en vivo solo existen **en la computadora** que está en la partida o
como espectador:
- **Selección de campeones**: API local del cliente de LoL (LCU) de quien
  observa/está en el lobby.
- **Partida en curso**: Live Client Data API, servidor local en el puerto 2999
  de la máquina que corre el juego (incluido el modo espectador).
- La lectura de memoria que usaban herramientas antiguas ya **no es posible** por
  el anti-cheat Vanguard.

Fuentes: [oracle-devrel/leagueoflegends-optimizer](https://github.com/oracle-devrel/leagueoflegends-optimizer/blob/main/articles/article4.md),
[floh22/LeagueBroadcast](https://github.com/floh22/LeagueBroadcast/blob/v2/README.md),
[RCVolus/league-prod-toolkit](https://github.com/RCVolus/league-prod-toolkit).

### Consecuencia de arquitectura: el Agente de Observador
```
PC del observador (Windows, cliente LoL como espectador en el lobby)
  └─ apps/observer-agent (Electron/Node)
       ├─ lee LCU (draft: picks, bans, timers, jugadores)
       ├─ lee Live Client Data :2999 (oro, kills, objetivos, items, tiempo)
       └─ envía eventos normalizados por WebSocket autenticado
                         ▼
               Plataforma (canal realtime de la partida)
                         ▼
     apps/overlays (OBS)   ·   web pública (marcador en vivo)   ·   app móvil
```

- Por eso **sí hace falta una persona como observador en las partidas
  transmitidas**. En las no transmitidas no hace falta: el resultado llega por la
  API de torneos.
- El agente se vincula a la partida con un token de un solo uso desde el panel
  de producción.
- Proyectos open source de la comunidad (RCVolus) resuelven esto; se estudian
  como referencia antes de construir el agente propio.
- **Validar en prototipo** qué datos exactos expone el modo espectador.

### Visión de producto del stream (el diferenciador vendible)

El valor no es el overlay en sí, es el **cero configuración** para el caster:
la plataforma YA sabe quién juega, con qué logo, qué stats y cómo va en la tabla.
El caster solo elige el partido y pega **un enlace** en OBS; todo se llena solo.
Esto resuelve el dolor real de las ligas amateur (logos a mano, nombres con
errores, pelearse con puertos locales) y es la base del SaaS en marca blanca.

Producción **descentralizada**: el que espectea la partida, el que transmite en
OBS y el que controla las gráficas pueden ser tres personas en tres lugares,
conectadas por el canal en tiempo real de la plataforma. Detalle y arquitectura
en `docs/specs/m10a-overlays-estudio.md` y `docs/specs/m10b-agente-observador.md`.

Funciones diferenciadoras (ninguna liga amateur las tiene juntas):
1. **Lower-thirds automáticos con stats históricas** al hacer lock-in de un
   campeón (sale de la DB de la liga, sin que el caster escriba nada).
2. **Memoria de Fearless** automática entre games de una serie (el motor ya
   calcula los bloqueos).
3. **Cambio de escena en OBS** automático según el estado del juego (obs-websocket).
4. **Votación de MVP por QR** en pantalla, en vivo.
5. **Slots de patrocinadores dinámicos** (logo en el timer de barón, etc.).

### Overlays con diseño personalizado
- Cada overlay es una página web con **temas** (tokens del design system):
  la organización cambia colores, logo y tipografías sin tocar código.
- Overlays: draft (con Fearless: campeones bloqueados de la serie), scoreboard
  in-game propio, marcador de serie, lower-thirds, escenas (inicio, espera,
  intermedio, MVP, resultado, próximos partidos), patrocinador en rotación.
- **Panel de producción** para mostrar/ocultar elementos en vivo y lanzar
  lower-thirds a demanda.
- **Respaldo manual**: si el agente falla, el productor actualiza el marcador a
  mano desde el panel.
- Los mismos datos alimentan el **marcador en vivo** de la web y la app.

---

## 5. Gráficos automáticos (plantillas)

- Plantillas por tipo (resultado, MVP, standings, próximo partido, anuncio de
  torneo, bienvenida de equipo) en varios formatos (1:1, 4:5, 9:16, 16:9).
- Render en servidor (Satori → PNG o navegador headless).
- Usan la foto **sin fondo** del jugador y el logo del equipo.
- Flujo: evento → render → biblioteca de media → (opcional aprobación) →
  publicación en redes y Discord.
- Editor de plantillas con vista previa usando datos reales (fase 3). Diseño
  base hecho en Figma por ti.
