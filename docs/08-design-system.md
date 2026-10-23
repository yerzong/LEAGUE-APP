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

## 2. La marca: PENTA League (nombre tentativo)

- **Logo principal:** escudo con alas, corona y cinco estrellas (las cinco
  estrellas = "penta"), monocromo plata `#C9CED6`. Archivos en `brand/logo/`
  (SVG vectorial, PDF, AI, PNG 1x y 4x).
- **Dirección de color:** marca madre **plata monocromo**; cada circuito tiene su
  propio acento (ver sección 3).

### Versiones del logo que faltan
| Versión | Uso | Por qué |
|---------|-----|---------|
| **Isotipo** (escudo + 5 estrellas, sin texto) | Favicon, avatar de redes, ícono de app, marca de agua en overlays | El logo completo no se lee a menos de ~64 px: "ESPORTS" y los detalles de las alas desaparecen |
| **Horizontal** (isotipo + "PENTA LEAGUE" en línea) | Header web, barra de overlays, firmas de correo | El escudo es casi cuadrado y ocupa mucha altura en barras |
| **Negro / oscuro** | Fondos claros, merch, documentos | Hoy solo existe la versión plata |
| **Por circuito** (mismo escudo, acento del circuito) | PENTA Femenil, Relámpago, Ascenso | Familia de marca conectada |

### Pendiente
- Tagline / lema.
- Voz y tono (copys, narrativa IA, redes): directo, competitivo, cercano.
- Nota: si el concepto del logo se generó con IA (Firefly), el trazado final
  vectorial propio es lo que conviene registrar en el IMPI.

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

### Color — Plata monocromo (propuesta v1)

Contraste calculado contra el fondo `#0B0B10` (WCAG: ≥ 4.5 texto normal,
≥ 3 texto grande).

| Token | Hex | Contraste | Uso |
|-------|-----|-----------|-----|
| `--color-bg` | `#0B0B10` | — | Fondo principal |
| `--color-surface` | `#16161F` | — | Cards, paneles |
| `--color-surface-2` | `#1F1F2A` | — | Hover, inputs |
| `--color-border` | `#2A2A36` | — | Bordes, divisores |
| `--color-brand` | `#C9CED6` | 12.4 | Plata del logo: títulos, marca, acentos |
| `--color-brand-bright` | `#E6E9EE` | 16.1 | Destacados, hover de marca |
| `--color-brand-dim` | `#8A909A` | 6.1 | Plata apagada, íconos secundarios |
| `--color-text` | `#F4F5F7` | 18.0 | Texto principal |
| `--color-text-muted` | `#9AA0AA` | 7.5 | Texto secundario |
| `--color-team-blue` | `#4C8DFF` | 6.1 | Lado azul |
| `--color-team-red` | `#F0525C` | 5.7 | Lado rojo |
| `--color-success` | `#3DD68C` | 10.5 | Éxito, victoria |
| `--color-warning` | `#F5B841` | 11.1 | Avisos, check-in por cerrar |
| `--color-danger` | `#F0525C` | 5.7 | Errores (siempre con ícono + texto para no confundir con lado rojo) |

### Acentos por circuito
| Circuito | Token | Hex | Contraste | Nota |
|----------|-------|-----|-----------|------|
| PENTA League (D1) | `--accent-league` | `#C9CED6` | 12.4 | La propia plata |
| Ascenso (D2) | `--accent-ascenso` | `#00C389` | 8.6 | Jade |
| Relámpago | `--accent-flash` | `#FFD400` | 13.7 | Amarillo eléctrico |
| Femenil | `--accent-femenil` | `#E4007C` | 4.3 | Rosa mexicano: **solo texto grande, logos y bloques**; para texto pequeño usar `#FF4DA6` (6.4) |
| Universitario | `--accent-uni` | `#9B7BFF` | 6.2 | Violeta |

> El acento cambia según el torneo que se está viendo (página, overlay,
> gráfico). La plata se mantiene como marca madre en todo.

### Tipografía (propuesta v1, todas con licencia libre OFL)
| Token | Fuente | Por qué |
|-------|--------|---------|
| `--font-display` | **Saira Condensed** (Bold / ExtraBold) | Letras cuadradas con esquinas suavizadas, como las del logo; condensada para broadcast |
| `--font-body` | **Inter** | Lectura clara en web y móvil |
| `--font-numeric` | **Inter** con `font-variant-numeric: tabular-nums` (o **JetBrains Mono** en tablas densas) | Números del mismo ancho para marcadores, KDA y standings |

- Fuentes libres (Google Fonts / OFL) y **auto-alojadas** en la web: no dependen
  de la suscripción de Adobe ni de servicios externos.
- Adobe Fonts queda para piezas de diseño (posters, videos), no para la web.
- Escala tipográfica modular 1.25. Títulos de overlay en mayúsculas.

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
