# Design System y Branding — League App

> Documento vivo. La identidad visual es una **ventaja competitiva**, no un
> adorno: es lo que hace que un equipo amateur quiera competir (efecto LCK). Define
> marca, tokens de diseño, componentes y las plantillas que alimentan web,
> overlays y gráficos automáticos.

---

## 1. Por qué el diseño es estratégico aquí

Los equipos amateur abandonan torneos que se sienten improvisados. Lo que hace
adictivas a la LCK/LPL no es solo el nivel de juego: es la **producción** que hace
sentir al jugador una estrella. Si tu plataforma y transmisiones tienen esa
estética limpia, audaz y de alto contraste, los equipos querrán participar **solo
por el prestigio visual** de aparecer ahí.

El design system además garantiza **consistencia automática**: los mismos tokens
alimentan la web, los overlays de OBS y los gráficos generados por IA. Un cambio de
color se propaga a todo sin rediseñar nada a mano.

---

## 2. La marca (pendiente de nombrar)

> **Decisión abierta:** el nombre de la marca aún no está definido. Hasta
> definirlo se usa el placeholder `League App`. Esta sección se completará al
> elegir el nombre.

Elementos a definir:
- **Nombre** de la liga/marca (ver criterios abajo).
- **Logo** (versión completa, isotipo, monocromo, favicon).
- **Tagline** / lema.
- **Voz y tono** de la marca (para copys, narrativa IA, redes).

### Criterios para elegir el nombre
- Memorable y pronunciable en español e inglés (pensando en el SaaS global futuro).
- Dominio `.com`/`.gg` disponible y handles de redes libres.
- No infringir marcas de Riot ni parecerse a sus productos (riesgo legal).
- Evocar competición/élite sin ser genérico ("liga de LoL" no basta).
- Que funcione como marca de **organización** (no atada a un solo torneo), porque
  contiene liga + relámpago + femenil + universitario.

---

## 3. Tokens de diseño

Los tokens son la fuente única de verdad visual. Se definen una vez y se consumen
en todas las superficies (`packages/ui` y `packages/graphics`).

### Color (dirección: alto contraste estilo LCK)
```
--color-bg            Fondo principal (oscuro, dramático)
--color-surface       Superficies/cards
--color-primary       Color de marca (acento principal)
--color-secondary     Acento secundario
--color-accent        Resaltado (MVP, destacados)
--color-text          Texto principal
--color-text-muted    Texto secundario
--color-success/warn/danger   Estados
--color-team-a / team-b       Colores de lado (azul/rojo del juego)
```
> Valores concretos se fijan con la paleta de marca. Mantener **ratios de
> contraste accesibles** (WCAG AA) para legibilidad en pantalla y stream.

### Tipografía
```
--font-display   Titulares audaces (impacto, estilo broadcast)
--font-body       Texto de lectura (limpio, neutro)
--font-mono       Datos/estadísticas (tabular, alineado)
```
Escala tipográfica modular (ej. 1.25). Números **tabulares** para stats y marcadores.

### Espaciado, radios, sombras, motion
```
--space-*     Escala de espaciado (4/8/12/16/24/32...)
--radius-*    Esquinas
--shadow-*    Elevación
--duration-*  Animaciones (transiciones de marcador, entradas de overlay)
--ease-*      Curvas de animación
```

---

## 4. Librería de componentes (`packages/ui`)

Enfoque **atomic design**: átomos → moléculas → organismos. Componentes React
tipados, consumidos por web, portal y (parcialmente) overlays.

| Nivel | Ejemplos |
|-------|----------|
| Átomos | Button, Badge, Avatar, TeamLogo, Stat, Tag, Icon |
| Moléculas | MatchCard, StandingRow, PlayerStatRadar, CountdownTimer |
| Organismos | StandingsTable, BracketView, ScheduleGrid, PlayerProfileHeader |
| Plantillas | TournamentPage, TeamPage, PlayerPage, ResultGraphic |

Patrón recomendado: **container/presentational** (separar lógica de datos de la
presentación) para reutilizar los presentacionales en overlays y gráficos.

---

## 5. Perfiles de jugador con pro-stats (gamificación)

El gancho de retención: dar a cada jugador una página que lo haga sentir pro.

- **Gráfico de radar** con ejes estilo LCK: agresividad, visión, farm,
  participación en kills (KP), supervivencia.
- **Campeones más jugados** con winrate y stats por campeón.
- **Comparativa head-to-head** antes de cada partida.
- **Evolución semanal** (progresión visible → motiva a mejorar números).
- Insignias/logros (MVP de jornada, rachas, hitos).

> Los datos salen de `PlayerAggregateStats`; el componente `PlayerStatRadar` vive
> en `packages/ui` y se reutiliza en web, overlays y gráficos.

---

## 6. Overlays de transmisión (consistencia con la marca)

Los overlays usan los **mismos tokens y componentes** que la web:
- Pantallas: inicio, intermedio, MVP, resultado, próximos partidos.
- Picks & Bans (con indicador visual de Fearless).
- Lower-thirds con stat histórica del jugador.
- Marcador de serie/partida en vivo.

Técnico: páginas web como fuentes de navegador en OBS, datos en tiempo real por
WebSocket. Detalle en `05-plataformas.md`.

---

## 7. Plantillas de gráficos automáticos

`packages/graphics` renderiza datos + plantilla → imagen, sin editor manual.

Plantillas base:
- **Resultado de partida** (equipos, marcador, MVP, campeón).
- **MVP de la jornada** (foto/avatar, stats, patrocinador).
- **Standings** actualizados.
- **Próximos partidos** / fixtures.
- **Anuncios** (inscripciones abiertas, clasificados).

Cada plantilla es un componente parametrizado que comparte tokens con la web →
coherencia visual total y actualización instantánea.

---

## 8. Accesibilidad y responsive

- Contraste **WCAG AA** mínimo en texto y datos.
- Navegación por teclado y foco visible en la web/portal.
- `prefers-reduced-motion` respetado en animaciones.
- Diseño **mobile-first** para el portal del jugador (se usa desde el teléfono).
- Legibilidad en stream (tamaños y contraste pensados para video comprimido).

> Nota: la conformidad WCAG completa requiere pruebas manuales con tecnología de
> asistencia y revisión experta; estos tokens son el punto de partida.

---

## 9. Entregables de diseño

- [ ] Nombre de marca + logo (completa la sección 2).
- [ ] Paleta y tipografías definitivas (valores de los tokens).
- [ ] Biblioteca de tokens en código (`packages/ui`).
- [ ] Componentes base (átomos y moléculas).
- [ ] Plantillas de gráficos (`packages/graphics`).
- [ ] Kit de overlays para OBS.
- [ ] Guía de marca (uso de logo, voz, do's & don'ts).

---

## 10. Herramientas sugeridas

- **Figma** para diseño y prototipo (tokens exportables a código).
- **Tailwind** + CSS variables como implementación de tokens.
- **Storybook** para documentar y probar componentes aislados.
- **Satori/Puppeteer** para render de gráficos (ver `07-automatizacion-ia.md`).
