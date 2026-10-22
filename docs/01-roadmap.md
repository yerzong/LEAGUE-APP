# Roadmap — League App

> Documento vivo. Orden de construcción y, sobre todo, qué NO construir todavía.
> Regla de oro: **la liga puede operar y sentirse profesional sin una sola línea
> de la API de torneos de Riot al principio.** La automatización llega a resolver
> dolores reales vividos en un piloto, no dolores imaginados.

---

## Principio rector

Se construyen dos negocios distintos, en orden:

1. **La liga / marca** (primero). Cliente: equipos amateur y su audiencia.
   Producto: la competición, la experiencia, los patrocinios.
2. **La plataforma SaaS** (después, solo si la liga funciona). Cliente: otros
   organizadores. Producto: el motor de torciones en marca blanca.

La plataforma se construye *operando la propia liga*. Somos nuestro cliente #1.
El motor de torneos se diseña aislado desde el día 1 para que extraerlo como SaaS
sea posible, pero no se invierte en features de SaaS hasta validar la liga.

---

## Separar dos cosas que se confunden

Cada feature cae en una de dos categorías. No mezclarlas es lo que ordena el roadmap:

- **EXISTIR** — lo mínimo para que la liga opere: reglas, inscripción, calendario,
  resultados, tabla de posiciones.
- **IMPRESIONAR** — lo que la hace sentir LCK: diseño, pro-stats, overlays,
  narrativa con IA, automatización end-to-end.

Lo de EXISTIR va primero y puede hacerse con herramientas simples. Lo de IMPRESIONAR
se construye encima, de forma incremental, una vez hay equipos reales compitiendo.

---

## Fase 0 — Fundación (planeación y marca)

**Objetivo:** tener claridad total antes de tocar código. Enamorar visualmente.

- [ ] Roadmap (este documento).
- [ ] Formatos de competencia y reglas (`02-formatos-competencia.md`).
- [ ] Modelo de datos multi-torneo (`03-modelo-datos.md`).
- [ ] Nombre de marca e identidad visual (logo, paleta, tipografías, tono).
- [ ] Design system base (tokens, componentes, plantillas de resultados).
- [ ] Plantillas de piezas para redes (resultado de partida, MVP, standings).

**No se hace aún:** nada de API de Riot, nada de automatización, nada de backend.

**Criterio de salida:** un equipo que vea la marca y las reglas quiere inscribirse.

---

## Fase 1 — Piloto operado "a mano" (validación)

**Objetivo:** correr un **torneo relámpago** (16–32 equipos, Bo1, un fin de semana)
con inscripción gratuita o simbólica. Validar que la gente viene y que el formato
funciona. NO ganar dinero todavía.

Herramientas aceptables en esta fase (lo que sea más rápido, no lo más elegante):
- Inscripción: un formulario simple + una hoja de cálculo o una tabla mínima.
- Brackets: Toornament / Challonge / start.gg (no reinventar brackets todavía).
- Comunicación: Discord manual.
- Resultados: capturas + registro manual.

**Qué sí construimos propio aquí:** solo si acelera, una web de aterrizaje con la
marca y una página pública de resultados/standings. Nada más.

**Criterio de salida:** el torneo se llenó, terminó sin caos, y salieron clips e
imágenes con estética LCK para el portafolio comercial. Lista de dolores operativos
reales anotada (esto define qué automatizar en la Fase 2).

---

## Fase 2 — Automatizar los dolores reales (el core propio)

**Objetivo:** reemplazar con software el trabajo manual que DEMOSTRÓ ser pesado en
el piloto. Aquí nace el motor de torneos propio.

Candidatos (priorizar según los dolores reales de la Fase 1, no esta lista):
- [ ] Inscripción y gestión de equipos/jugadores propia (sustituye el formulario).
- [ ] Calendario y generación de fixtures por tipo de torneo.
- [ ] Tabla de posiciones y estadísticas calculadas automáticamente.
- [ ] Bot de Discord: check-in, recordatorios, avisos de partida.
- [ ] Páginas públicas de la liga (equipos, jugadores, resultados) con el design system.

**Riot API — entra aquí, no antes:**
- Solicitar la **Production API Key** mostrando este sistema como prototipo
  funcional. (Advertencia: la aprobación puede tardar semanas y no es automática,
  por eso el sistema NO debe depender de ella para existir.)
- Integrar **Tournament-V5** para generar códigos de torneo y recibir resultados
  por webhook (adiós a capturas manuales).
- Integrar **Match-V5** para estadísticas detalladas pospartida.

**Diseño clave:** la integración con Riot va detrás de una capa de abstracción. Si
Riot tarda o rebota, el resto de la plataforma sigue operando con registro manual.

**Criterio de salida:** correr un torneo con intervención humana mínima.

---

## Fase 3 — El efecto LCK (lo que hace volver a los equipos)

**Objetivo:** convertir la liga en algo que da prestigio aparecer. Features de
retención y marca.

- [ ] Perfiles de jugador con pro-stats (radar: agresividad, visión, farm, KP).
- [ ] Historial de campeones, comparativas head-to-head.
- [ ] Overlays web para OBS conectados a datos en vivo (picks & bans, lower-thirds).
- [ ] Narrativa con IA: resúmenes de partida y notas de prensa desde el JSON de match.
- [ ] Generación dinámica de gráficos de resultado/MVP estilo LCK.

**Criterio de salida:** equipos piden inscribirse para "salir en la liga".

---

## Fase 4 — Monetización y Temporada 1

**Objetivo:** abrir inscripciones de la Liga Principal (formato tipo LCK) y circuitos
especializados (femenil, universitario). Activar ingresos.

Modelo de ingresos (validado por mercado, ~40% del revenue de esports es sponsorship):
- Cuotas de inscripción por equipo.
- Pases de temporada / membresías.
- Patrocinios por secciones ("MVP de la jornada presentado por [Marca]").
- Merchandising.
- Venta de entradas a eventos presenciales/finales.

**Entregable comercial:** un media kit con métricas reales del piloto y Fase 2.

**Criterio de salida:** primera temporada con ingresos y patrocinadores.

---

## Fase 5 — Extraer el SaaS (solo si la liga funciona)

**Objetivo:** empaquetar el motor de torneos como producto en marca blanca para
otros organizadores (universidades, marcas, otros torneos).

Precondición: la liga propia es rentable y el motor ya probó aguantar en producción.
No se invierte aquí antes. El aislamiento del core desde la Fase 2 es lo que hace
esto posible sin reescribir todo.

---

## Lo que explícitamente NO hacemos al principio

- ❌ Depender de la Riot API para que la liga exista.
- ❌ RSO (Riot Sign-On) y detección de smurfs con IA en el arranque — son features
  de madurez (Fase 3+).
- ❌ Construir brackets propios en el piloto — usar herramientas existentes.
- ❌ Montar webhooks, overlays y bots antes de tener un equipo compitiendo.
- ❌ Decidir arquitectura técnica pesada antes de que la planeación la justifique.

---

## Cumplimiento legal (recordatorio permanente)

- Operar bajo la **Community Competition License** de Riot (reglas nuevas de 2026,
  sin aprobación previa en la mayoría de casos; confirmar la variante de la región).
- Incluir el disclaimer obligatorio: la liga no está respaldada por Riot Games.
- Respetar la lista de patrocinadores prohibidos (apuestas, cripto no regulada).
- La licencia es revocable: mantener el registro de visibilidad al día.
