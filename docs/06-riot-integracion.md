# Integración con Riot Games — League App

> Documento vivo. Cómo se integra la plataforma con las APIs de Riot, y la regla
> de oro que lo gobierna todo: **la liga NO depende de Riot para existir.** La
> integración es una mejora detrás de una capa de abstracción.

---

## 1. Regla de oro

La Production API Key de Riot puede **tardar semanas o ser rechazada.** Por eso:

> Toda funcionalidad que use Riot vive detrás de un **puerto** (`packages/riot`).
> Si Riot no está disponible, un **adaptador manual** cubre lo mismo (resultados
> registrados a mano) y la liga opera igual.

El sistema se diseña para funcionar **con o sin** Riot. Riot elimina trabajo
manual; no es un requisito de arranque.

---

## 2. APIs de Riot que se usan

| API | Para qué | Fase |
|-----|----------|------|
| **Tournament-V5** | Generar códigos de torneo, recibir callbacks de resultado | 2 |
| **Tournament-Stub-V5** | Probar el flujo sin partidas reales (desarrollo) | 2 (dev) |
| **Match-V5** | Estadísticas detalladas de cada partida (KDA, oro, daño, visión) | 2 |
| **Summoner-V4 / League-V4** | Rango e historial (verificación, anti-smurf) | 3 |
| **RSO (Riot Sign-On)** | Login con cuenta Riot, verificación de identidad | 3 |

---

## 3. Flujo con Tournament-V5 (el que elimina lo manual)

```
1. Admin/sistema registra un "provider" y un "tournament" en Riot (una vez).
2. Para cada Game de una serie, el sistema pide a Riot un TOURNAMENT CODE.
3. El código se entrega a los capitanes (vía bot de Discord / portal).
4. Los jugadores crean la partida custom pegando el código → entran a la sala.
5. Al terminar la partida, Riot envía un CALLBACK (webhook) a nuestro endpoint
   con el resultado.
6. Con el match id, se consulta Match-V5 para el JSON completo de estadísticas.
7. Se persiste en Game.raw_payload y se disparan los jobs (standings, stats,
   gráficos, narrativa).
```

Esto reemplaza: crear la sala a mano, invitar jugadores, pedir captura y anotar
el resultado en una hoja.

---

## 4. Obtener la Production API Key

Proceso (según Developer Portal de Riot):
1. Registrar la aplicación en el Developer Portal.
2. Desarrollar un **prototipo funcional** (la plataforma ya operando, aunque sea
   con el adaptador manual, cuenta como prototipo).
3. Solicitar acceso a la **Tournament API** describiendo el uso real (operar
   torneos de comunidad).
4. Esperar aprobación (no inmediata, puede requerir idas y vueltas).

Mientras tanto: usar **Tournament-Stub-V5** y una **Development Key** para
construir y probar todo el flujo sin bloquearse.

---

## 5. Capa de abstracción (puerto `packages/riot`)

Interfaz conceptual que el core y la API consumen (los nombres finales se definen
al construir):

```ts
interface TournamentProviderPort {
  createProvider(region, callbackUrl): Promise<ProviderId>
  createTournament(providerId, name): Promise<TournamentId>
  generateCodes(tournamentId, params): Promise<TournamentCode[]>
  // callback entrante se normaliza a un evento interno de "resultado de partida"
}

interface MatchDataPort {
  getMatch(matchId): Promise<MatchData>   // normaliza Match-V5
}

interface AccountPort {
  verifyAccount(puuid): Promise<AccountInfo>  // Summoner/League-V4 + RSO
}
```

Adaptadores:
- `RiotTournamentAdapter` — implementación real (Tournament-V5).
- `RiotStubAdapter` — usa Tournament-Stub para desarrollo.
- `ManualAdapter` — sin Riot: el admin registra el resultado; el resto del sistema
  no nota la diferencia.

> Beneficio: cambiar de adaptador es configuración, no reescritura.

---

## 6. Webhooks / callbacks

- Endpoint dedicado en `apps/api` para recibir callbacks de Riot.
- **Verificar autenticidad** del callback antes de procesar.
- Idempotencia: un mismo resultado puede llegar más de una vez; no duplicar Games.
- Encolar el procesamiento (BullMQ) y responder rápido a Riot.
- Reintentos y dead-letter para callbacks que fallan.

---

## 7. Rate limits y buenas prácticas

- Respetar los **rate limits** de Riot (por app y por método); usar cola y backoff.
- Cachear datos poco cambiantes (rango, nombre de invocador) en Redis.
- Guardar siempre el **JSON crudo** (`raw_payload`) como fuente de verdad: si se
  cambia el cálculo de una stat, se recalcula desde el crudo sin volver a pedir a
  Riot.
- Usar **PUUID** (no summoner id) como identificador estable (Tournament-V5 ya lo
  usa).

---

## 8. Cumplimiento (resumen, ver `10-legal-cumplimiento.md`)

- Registrar la app; mantener descripción y metadata al día.
- Prohibido: cripto/blockchain, actuar como "data broker", clonar productos Riot.
- Mostrar el **disclaimer obligatorio** de Riot.
- Respetar condiciones de uso de los datos.

---

## 9. Plan de contingencia

| Escenario | Respuesta |
|-----------|-----------|
| Production Key tarda | Operar con `ManualAdapter`; construir con Stub |
| Production Key rechazada | Iterar el prototipo y reintentar; seguir operando manual |
| Riot cambia/deprecia una API (ej. V5→V6) | El puerto aísla el cambio a un adaptador |
| Rate limit excedido | Cola + backoff; priorizar llamadas críticas |
| Callback no llega | Fallback: consultar Match-V5 por polling con el match id |
