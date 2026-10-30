# Módulo 10B — Agente de observador (datos en vivo del cliente de LoL)

> Spec para Claude Code. El ejecutable ligero que corre en la PC del espectador,
> lee el cliente de LoL y alimenta los overlays del m10a con datos EN VIVO (draft,
> oro, kills, objetivos). Es la parte más delicada del producto: depende de APIs
> locales de Riot que pueden cambiar con parches. Aislar bien para que un cambio
> de Riot no rompa el resto. Referencias: `docs/16-media-social-broadcast.md §4`,
> `docs/05-plataformas.md §7`. Estándares: `docs/17-estandares-ingenieria.md`.

---

## Realidad técnica (confirmada)
Los datos en vivo NO vienen de la web API de Riot; viven solo en la PC que
observa/juega:
- **Draft (picks & bans):** API local del cliente (**LCU**), vía su lockfile.
- **Partida en curso:** **Live Client Data API** en `https://127.0.0.1:2999`
  (incluye modo espectador).
- La lectura de memoria que usaban herramientas viejas ya **no es posible**
  (anti-cheat Vanguard). Solo LCU + puerto 2999.
Una web en la nube no puede leer `127.0.0.1` del caster (seguridad del
navegador): por eso hace falta un agente local que haga de puente.

---

## Alcance

### 1. App `apps/observer-agent` (Electron o Tauri)
- Ejecutable ligero para **Windows** (donde corre LoL). Instalador con
  auto-actualización.
- UI mínima: el usuario pega un **Stream Token** (lo genera el estudio del m10a
  para una partida) y ve el estado de conexión (LoL detectado, enviando datos).
- Detecta el **lockfile** del cliente (LCU) y el puerto **2999**.
- Lee: fase del juego (champ select / in game / post game), draft (picks, bans,
  hovers), y en partida oro, kills, objetivos (dragón, barón, torres), items,
  tiempo.
- **Optimización:** hace `diff` local y solo envía por WebSocket cuando algo
  cambia (no el JSON completo cada tick). Cadencia razonable (p. ej. 1 s en
  partida, inmediato en eventos de draft/objetivos).
- Guard: si no detecta LoL, lo dice; no crashea.

### 2. Canal en la nube (API)
- Endpoint WebSocket autenticado por el Stream Token (ligado a una
  `broadcast_session`/partida). Verificar el token; un token no sirve para otra
  partida ni tras expirar.
- Normaliza el evento del agente y actualiza `live_match_state` (fuente
  `observer_agent`), que el m10a ya emite a los overlays por Realtime.
- **Data enrichment:** al llegar "slot 1 = Lee Sin, Riot ID X", el backend cruza
  con la DB de la liga e inyecta foto, rol, logo del equipo y stats para el
  overlay. (El overlay del m10a ya sabe pintar esto.)
- Idempotencia y tolerancia a reconexión del agente.

### 3. Fearless y lower-thirds en vivo
- Al detectar un lock-in en el draft, disparar el lower-third automático con las
  stats del jugador (la lógica de qué mostrar ya existe; aquí es el gatillo en
  vivo).
- Marcar los campeones de Fearless leyendo lo que el agente reporta del draft,
  además de lo que ya hay en la DB de la serie.

### 4. Seguridad y robustez
- El agente solo lee local y solo envía a tu backend; nada más.
- Token de un solo uso/por partida, con expiración, revocable desde el estudio.
- Versionado del protocolo agente↔backend para sobrevivir a cambios; si el
  formato de Riot cambia, el agente se actualiza sin tocar overlays ni web.
- Fallback total: si el agente falla, el productor sigue con el marcador manual
  del m10a. La transmisión nunca depende 100% del agente.

---

## Lo que NO va
- Overlays y estudio (ya existen en m10a; este módulo solo los alimenta en vivo).
- Distribución en Mac/Linux (LoL compite en Windows; valorar después).

## Criterios de aceptación
- [ ] El agente compila a un ejecutable Windows y arranca pegando un token.
- [ ] Con LoL en modo espectador (o un simulador del puerto 2999 para tests),
      el agente detecta draft y datos de partida y los envía; el overlay del m10a
      se actualiza en vivo.
- [ ] Solo envía diffs; reconecta sin perder estado.
- [ ] Token inválido/expirado es rechazado; un token no sirve para otra partida.
- [ ] Si el agente se cae, el estudio sigue con marcador manual.
- [ ] Tests con un mock del LCU/2999 (no requiere LoL real en CI). Prueba manual
      documentada con el cliente real (paso del usuario).

## Notas
- **Validar en prototipo** qué expone exactamente el modo espectador en la
  versión actual del cliente, antes de pulir. Proyectos de referencia de la
  comunidad (RCVolus league-prod-toolkit, LeagueBroadcast) resuelven esto; se
  estudian como referencia, no se copian.
- Esta es la pieza con más riesgo de mantenimiento del producto: mantenerla
  aislada en su app y detrás de un protocolo versionado es lo que protege al resto.
