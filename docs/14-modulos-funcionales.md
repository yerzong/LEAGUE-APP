# Mapa de Módulos Funcionales

> Documento vivo. Inventario completo de módulos por aplicación, para que nada
> se quede fuera. Cada módulo se construye, prueba y valida por separado (ver
> `17-estandares-ingenieria.md`). La columna **Fase** indica cuándo se construye
> (monetización siempre al final).

---

## 1. ¿Sitio web o app web? Las dos, en un solo producto

Una sola aplicación Next.js con **tres zonas** y permisos distintos:

| Zona | Ruta | Para quién | Tipo |
|------|------|-----------|------|
| **Sitio público** | `/` | Fans, patrocinadores, buscadores (SEO) | Sitio (renderizado en servidor, indexable) |
| **Portal del jugador** | `/app` | Jugadores y capitanes | App web instalable (**PWA**) |
| **Consola de administración** | `/admin` | Super admin y staff | App web (escritorio primero) |

Superficies adicionales fuera de la web:
- **Overlays de transmisión** (`apps/overlays`) — fuentes de navegador para OBS.
- **Agente de observador** (`apps/observer-agent`) — app de escritorio en la PC
  del observador que lee datos del cliente de LoL en vivo.
- **Bot de Discord** (`apps/bot`).
- **App móvil** (`apps/mobile`, Expo) — futuro, reutiliza la misma API.

> Todas consumen **la misma API y los mismos paquetes**. La app móvil no
> reimplementa lógica: reutiliza servicios, tipos y validaciones.

---

## 2. Consola de administración (`/admin`)

### 2.1 Super Admin (nivel plataforma)
| Módulo | Capacidades | Fase |
|--------|-------------|------|
| Dashboard global | KPIs: usuarios, equipos, torneos activos, partidas hoy, incidencias, estado del sistema | 1 |
| Organizaciones | Crear/editar/suspender organizaciones (base SaaS) | 1 (una), 5 (multi) |
| Usuarios globales | Buscar, ver detalle, roles, sanciones globales, impersonar con auditoría | 1 |
| Configuración de plataforma | Feature flags, límites globales, parámetros por defecto | 1 |
| Salud del sistema | Estado de jobs, webhooks, APIs externas (Riot, Discord, redes), errores | 2 |
| Auditoría global | Búsqueda en el registro de auditoría | 1 |
| Planes y facturación SaaS | Planes, suscripciones de organizaciones | 5 |

### 2.2 Administración de organización
| Módulo | Capacidades | Fase |
|--------|-------------|------|
| **Dashboard** | Próximas partidas, inscripciones pendientes, disputas abiertas, alertas de integridad, actividad reciente | 1 |
| **Usuarios** | Lista con filtros (rol, región, rango, verificación Riot, sancionado), detalle, historial, notas internas, acciones (verificar, sancionar, cambiar rol) | 1 |
| **Equipos** | Lista con filtros, detalle (roster, historial, torneos, sanciones), aprobar/editar logo y nombre, forzar cambios de roster | 1 |
| **Agentes libres** | Jugadores buscando equipo (también visible en portal) | 2 |
| **Eventos / Torneos** | Lista, wizard de creación, detalle con seguimiento completo (ver sección 3) | 1 |
| **Plantillas de torneo** | Guardar configuraciones como plantilla ("Relámpago 2v2 ARAM") y clonar | 1 |
| **Circuitos y temporadas** | Crear temporadas/splits, circuitos de puntos, rankings | 2 |
| **Calendario maestro** | Vista de todas las partidas de todos los torneos; detección de choques; arrastrar para reprogramar | 1 |
| **Partidas** | Lista global; filtros por estado (pendiente check-in, en vivo, disputa) | 1 |
| **Disputas e incidencias** | Bandeja de disputas, evidencias, resolución, historial | 1 |
| **Integridad** | Alertas (participantes no coinciden, smurf sospechoso, cambios de Riot ID), revisión y decisión | 2 |
| **Sanciones** | Registro, alcance, duración, apelaciones | 1 |
| **Moderación** | Cola de fotos, logos, nombres y bios reportados o pendientes | 2 |
| **Staff y permisos** | Invitar staff, asignar roles, roles personalizados, asignar referees a partidas | 1 |
| **Reglamentos** | Editor de reglamentos con versiones; código de conducta | 1 |
| **Notificaciones** | Plantillas, reglas de envío, historial de entregas (ver `15-notificaciones.md`) | 1 |
| **Contenido / Noticias** | Publicar noticias, crónicas IA (revisar y aprobar), destacados del home | 3 |
| **Redes sociales** | Cuentas conectadas, composer multi-red, calendario de publicaciones, publicaciones automáticas | 3 |
| **Plantillas gráficas** | Editor/selector de plantillas (resultado, MVP, standings), vista previa con datos reales | 3 |
| **Solicitudes de contenido** | Tablero para pedir diseños, clips y ediciones: tipo, fecha límite, assignee (designer/editor), estados, entregables ligados a la biblioteca de media | 3 |
| **Creadores y co-streaming** | Registrar streamers/creadores oficiales, darles links de overlays y assets, ver sus transmisiones activas, métricas por creador | 3 |
| **Turnos de staff** | Asignar casters, observers, referees y producers por jornada; disponibilidad del staff | 2 |
| **Media** | Biblioteca de imágenes, clips, logos; quitar fondo; etiquetas | 2 |
| **Transmisión** | Panel de producción: escenas, overlays, control en vivo, agente de observador (ver sección 6) | 3 |
| **Discord** | Configurar servidor, canales, roles, mensajes del bot | 2 |
| **Marca / Apariencia** | Logo, colores, tipografías (tokens del design system), dominio | 1 |
| **Estadísticas y reportes** | Reportes por torneo, audiencia, retención, exportar CSV | 3 |
| **Patrocinadores** | Patrocinadores, activaciones, secciones patrocinadas, entregables | 4 |
| **Premios** | Premios por torneo (efectivo, periférico, merch, prestigio, personalizado), entrega y seguimiento, consentimiento de tutor si es menor | 1 |
| **Clubes** | Organizaciones de esports con varios rosters; verificación de clubes | 1 |
| **Pagos a staff** (solo Owner/Super Admin) | Modelo por rol (voluntario, por evento, por partida, por entregable), registro automático de trabajos, aprobación y pago | 3 |
| **Pagos e inscripciones** | Cuotas, pagos, reembolsos | 4 |
| **Configuración** | Límites (equipos por usuario, etc.), defaults por tipo de torneo, integraciones | 1 |

---

## 3. Evento / Torneo: creación y seguimiento

### 3.1 Wizard de creación (todo configurable)
```
Paso 1  Básico: nombre, tipo (liga/relámpago/femenil/universitario/rangos),
        plantilla de partida, imagen, descripción, tier
Paso 2  Modo de juego: 5v5 / 2v2 / 1v1, mapa (Grieta/ARAM), tipo de pick
Paso 3  Elegibilidad: reglas del motor de elegibilidad (región, rangos, peak,
        edad, institución, exclusividad, tier máximo...)
Paso 4  Roster: titulares, suplentes, coach, límite de cambios, roster lock
Paso 5  Formato: fases (agregar/ordenar), formato por fase, Bo1/Bo3/Bo5,
        draft estándar/Fearless, puntos, desempates, clasificados por fase
Paso 6  Calendario: fechas de inscripción, inicio, días/horarios de jornada,
        ventanas de check-in, duración estimada de partida
Paso 7  Supervisión: nivel (automático/doble reporte/árbitro/transmitido)
Paso 8  Comunicación: notificaciones a activar, canales, plantillas
Paso 9  Premios (opcional): sin premios / por lugar / MVP / especiales; tipo
        (efectivo, periférico, merch, prestigio, personalizado), monto o
        descripción, imagen, reparto (equipo/por jugador). Patrocinio (fase 4)
Paso 1b Participantes: independientes / solo clubes / mixto, máximo de rosters
        por club; modalidad online / presencial / híbrida (+ sede)
Paso 10 Revisión: resumen + vista previa del bracket + publicar
```
- Guardar como **borrador** en cualquier paso.
- **Al publicar, el sistema genera automáticamente** fases, grupos, bracket
  vacío y calendario tentativo según el formato.
- Al cerrar inscripciones, genera **fixtures** con seeding (manual, aleatorio o
  por rango promedio).

### 3.2 Edición después de publicar
Todo es editable, pero con **reglas de seguridad** según el estado:

| Estado | Qué se puede editar libremente | Qué requiere confirmación + aviso |
|--------|-------------------------------|-----------------------------------|
| Borrador | Todo | — |
| Inscripción abierta | Textos, fechas, cupo | Elegibilidad, formato (avisa a inscritos) |
| En curso | Textos, horarios de partidas futuras | Formato de fases futuras; reglas (nueva versión del reglamento) |
| Fases ya jugadas | — | Resultados (override auditado; recalcula standings) |

### 3.3 Página de seguimiento del evento (admin)
Pestañas:
- **Resumen**: estado, progreso por fase, próximas partidas, alertas.
- **Inscripciones**: pendientes/aprobadas/lista de espera, elegibilidad por
  jugador con motivo de falla, aprobar/rechazar en lote.
- **Participantes**: rosters congelados, cambios solicitados.
- **Fases y bracket**: vista de bracket/grupos, avanzar fase, regenerar.
- **Calendario**: partidas de este evento, reprogramaciones.
- **Partidas**: estado en vivo, check-in, código, resultado, referee.
- **Standings**: tablas en vivo, desempates explicados.
- **Disputas**: de este evento.
- **Comunicación**: anuncios a participantes, historial de notificaciones.
- **Contenido**: gráficos y crónicas generadas para este evento.
- **Transmisión**: partidas marcadas para stream.
- **Auditoría**: todo lo que se cambió en el evento.
- **Configuración**: los parámetros del wizard, editables según la tabla 3.2.

---

## 4. Portal del jugador (`/app`, PWA)

| Módulo | Capacidades | Fase |
|--------|-------------|------|
| Onboarding | Registro, verificación, vincular Riot, roles | 1 |
| Mi perfil | Foto (quitar fondo), banner, bio, redes, privacidad | 1 |
| Mis equipos | Crear equipo, invitar, aceptar solicitudes, roles internos, logo | 1 |
| Agentes libres | Buscar jugadores/equipos por rol, rango, horario | 2 |
| Explorar torneos | Torneos abiertos con indicador "eres elegible / no por X motivo" | 1 |
| Inscripción | Elegir roster, validar elegibilidad, aceptar reglamento, pagar (fase 4) | 1 |
| Mi calendario | Próximas partidas propias, exportar a Google/Apple Calendar (ICS) | 1 |
| Centro de partida | Check-in, código de torneo, lobby esperado, reportar resultado, subir evidencia, solicitar reprogramación, abrir disputa | 1 |
| Mis estadísticas | Pro-stats, radar, campeones, evolución, logros | 3 |
| Notificaciones | Bandeja + preferencias por canal y tipo | 1 |
| Seguir | Seguir equipos/jugadores (también para fans) | 2 |
| Ajustes | Cuentas vinculadas, seguridad, MFA, descargar/borrar datos | 1 |

---

## 5. Sitio público (`/`)

| Sección | Contenido | Fase |
|---------|-----------|------|
| Home | Temporada activa, partidas en vivo y próximas, destacados, noticias | 1 |
| Torneos | Liga, relámpago, femenil, universitario: tablas, brackets, calendario | 1 |
| **Detalle de evento** | Info, reglamento, participantes, bracket/grupos, calendario, resultados, standings en vivo, stats del torneo (top KDA, campeones más jugados), media, patrocinadores | 1 |
| Detalle de partida | Resultado por partida, draft (picks y bans), stats por jugador, línea de tiempo, crónica IA, VOD/stream | 1 (básico), 3 (completo) |
| Equipos | Perfil, roster, historial, logros, logo | 1 |
| Jugadores | Perfil con pro-stats (radar: agresividad, visión, farm, KP), campeones, head-to-head, historial de equipos | 1 (básico), 3 (pro-stats) |
| Resultados y standings en vivo | Actualización en tiempo real | 2 |
| Rankings | Ranking del circuito/temporada, top jugadores por stat | 2 |
| Noticias / Narrativa | Crónicas y notas generadas por IA (revisadas) | 3 |
| Media | Clips, galería estilo LCK | 3 |
| En vivo | Stream embebido + marcador | 3 |
| Patrocinadores y media kit | Logos, activaciones, PDF de media kit | 4 |
| Legal | Reglamento, código de conducta, privacidad, términos, disclaimer de Riot | 1 |

---

## 6. Transmisión y overlays

| Módulo | Capacidades | Fase |
|--------|-------------|------|
| Panel de producción (admin) | Elegir partida en vivo, escenas, mostrar/ocultar elementos, lower-thirds a demanda, marcador manual de respaldo | 3 |
| Agente de observador | App de escritorio en la PC del observador: lee selección de campeones y datos en vivo, los envía a la plataforma | 3 |
| Overlay de draft | Picks y bans en tiempo real, Fearless (campeones bloqueados de la serie) | 3 |
| Overlay in-game | Marcador, oro, torres, dragones, barón, scoreboard personalizado | 3 |
| Overlay de escenas | Inicio, espera, intermedio, MVP, resultado final, próximos partidos | 3 |
| Lower-thirds | Cintillo con stats históricas del jugador | 3 |
| Seguimiento de stream | Estado del stream, viewers, enlaces (Twitch/YouTube/Kick) | 3 |

Detalle técnico en `16-media-social-broadcast.md`.

---

## 7. Bot de Discord

| Comando / función | Fase |
|-------------------|------|
| Vincular cuenta de Discord con la plataforma | 1 |
| Check-in (`/checkin`) | 2 |
| Canales de voz temporales por partida | 2 |
| Entrega de código de torneo por DM al capitán | 2 |
| Recordatorios configurables | 2 |
| Forfeit automático + aviso | 2 |
| Publicar resultados y gráficos | 2 |
| Consultas: `/proximo`, `/tabla`, `/perfil`, `/equipo` | 2 |
| Roles automáticos (jugador verificado, equipo, torneo) | 2 |
| Avisos de staff (nueva inscripción, disputa) en canal privado | 2 |

---

## 8. App móvil (futuro, Expo / React Native)

Reutiliza API, tipos, validaciones y lógica de `packages/*`.
- Seguir equipos/jugadores, notificaciones push nativas.
- Centro de partida (check-in, código) — lo más usado por jugadores.
- Resultados, standings y perfiles.
- No incluye consola de administración.

---

## 9. Componentes genéricos transversales (se construyen una vez)

- Inputs, selects, date pickers, uploads con recorte y quitar fondo.
- **Modal de confirmación** para acciones importantes (con motivo obligatorio en
  acciones sensibles).
- **Toasts** de éxito/error en cada acción.
- Tablas de datos genéricas: paginación, filtros, orden, búsqueda, selección
  múltiple, acciones en lote, exportar.
- Formularios generados por esquema (mismo esquema Zod en front y back).
- Estados vacíos, carga (skeletons) y error consistentes.
- Wizard (pasos) genérico.
- Vista de bracket y de grupos reutilizable.
- Timeline de auditoría reutilizable.
