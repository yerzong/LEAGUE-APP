# Módulo 08 — Integración Riot Tournament API

> Spec para Claude Code. El gran automatizador: códigos de torneo y resultados
> automáticos, con la **regla de oro** de que la liga opera igual sin Riot
> (adaptador manual del m05 sigue siendo el fallback). Implementa los puertos de
> `packages/integrations/riot` detrás de los que ya está el sistema.
> Referencias: `docs/06-riot-integracion.md` (completo), `docs/13 §7`,
> `docs/03-modelo-datos.md §6.4, §12`. Estándares: `docs/17-estandares-ingenieria.md`.

---

## Alcance

### 1. Adaptadores Riot (`packages/integrations/riot`)
- `RiotTournamentAdapter` (Tournament-V5): crear provider, crear tournament,
  generar `tournamentCode` con `allowedParticipants` (PUUIDs del roster
  congelado), `teamSize` (1–5 según el modo), mapa, pickType, spectatorType.
- `MatchDataAdapter` (Match-V5): dado un match id, traer el JSON completo y
  normalizarlo a los tipos del dominio.
- `RiotStubAdapter` (Tournament-Stub) para desarrollo/CI.
- Mantener el `ManualAdapter` como fallback (ya existe del m05).
- Selección por config (`RIOT_PROVIDER=riot|stub|manual`). API key en `.env`.
- Rate limiting + backoff; cache de datos poco cambiantes.

### 2. Base de datos
- `riot_providers`, `riot_tournaments` (`docs/03 §12`), `riot_tournament_codes`
  (`§6.4`): código por game, PUUIDs permitidos, estado. `inbound_webhooks` para
  los callbacks (idempotente por `idempotency_key`).

### 3. Flujo de código de partida
- Al abrir un game de una serie (m05), generar el `tournamentCode` con el roster
  congelado y entregarlo: en el centro de partida (`/app`) y por Discord (m07) al
  capitán.
- Guardar el código y su estado (active/used/revoked).

### 4. Callbacks y resultados automáticos
- Endpoint en `apps/api` para el callback de Riot: verificar autenticidad,
  idempotencia, encolar. Al llegar: con el match id, consultar Match-V5, persistir
  `games.raw_match_payload`, derivar participantes y resultado, y **completar la
  partida por el flujo del m05** (recalcular standings, avanzar bracket, emitir
  eventos). Sustituye al doble reporte cuando el torneo está en modo automático.
- Fallback: si el callback no llega en X tiempo, polling de Match-V5 por el código.

### 5. Verificación de integridad (engancha m05/m13)
- Al recibir el resultado, comparar participantes reales (PUUIDs) contra el
  roster; discrepancia → alerta de integridad (tabla ya existe).
- Soporte Fearless real: al generar el draft/record por game, usar los bloqueos
  que el core ya calcula.

### 6. Verificación de cuenta por RSO (si Riot lo aprueba)
- Si hay cliente RSO, añadir el `RSOAdapter` para vincular cuenta (m02 usa el de
  ícono); seleccionable por config. Si no, no bloquea nada.

### 7. Admin
- En el torneo: elegir supervisión "automático (Riot)"; ver estado de la
  integración, códigos generados, callbacks recibidos; botón de regenerar código.
- `/admin` monitor de salud de la API de Riot (parte del monitor de automatización).

---

## Lo que NO va
- Overlays / datos en vivo de la partida (eso es LCU/Live Client en el módulo de
  broadcast, no la web API de Riot).
- Pro-stats (m09; este módulo solo trae y guarda el `raw_match_payload`).

## Criterios de aceptación
- [ ] Con `RIOT_PROVIDER=stub`, el flujo completo funciona en CI sin tocar Riot
      real: generar código → simular callback → completar partida → standings.
- [ ] El código se genera con los PUUIDs correctos del roster y el teamSize del
      modo.
- [ ] El callback es idempotente (un resultado repetido no duplica games).
- [ ] Un participante fuera del roster dispara alerta de integridad.
- [ ] Si Riot no está disponible, el torneo puede seguir en modo manual sin tocar
      el core ni la web.
- [ ] La API key nunca se expone ni se commitea; en prod se prohíbe el stub.
- [ ] `pnpm lint typecheck test build` pasa.

## Notas
- **Production Key de Riot:** se solicita mostrando la plataforma como prototipo;
  tarda y puede rebotar. Por eso todo el módulo funciona con Stub primero, y el
  cambio a real es config. Paso del usuario: registrar la app y pedir la key.
- No cripto, no data broker, disclaimer visible (`docs/10`): ya cubierto; mantener.
