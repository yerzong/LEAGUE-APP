# Operaciones — League App

> Documento vivo. El flujo end-to-end de operar un torneo, los roles del staff y
> los procesos de soporte. Es el puente entre la planeación y la realidad del día
> a día: lo que sucede desde "abro inscripciones" hasta "cierro la temporada".

---

## 1. Ciclo de vida de un torneo

```
1. PLANEACIÓN
   └─ Definir tipo, formato, fechas, elegibilidad, premios, patrocinios
   └─ Registrar el evento en el formulario de visibilidad de Riot (región)

2. CONFIGURACIÓN (dashboard admin)
   └─ Crear el torneo con todos los parámetros
   └─ Definir fases, series, draft, puntos, desempates, clasificados

3. INSCRIPCIÓN
   └─ Abrir registro; equipos se inscriben desde el portal
   └─ Validar elegibilidad (manual al inicio, asistida por IA después)
   └─ Aprobar/rechazar; cobrar inscripción si aplica

4. SEEDING Y CALENDARIO
   └─ Asignar seeds; generar fixtures
   └─ Publicar calendario; notificar a equipos

5. OPERACIÓN EN VIVO (por jornada)
   └─ Check-in → canales de voz → códigos de partida
   └─ Partidas → resultados → recálculo de standings/stats
   └─ Gráficos + narrativa + publicación automática

6. AVANCE DE FASE
   └─ Cerrar fase; clasificar según reglas; abrir siguiente fase

7. CIERRE
   └─ Finales, premiación, clausura
   └─ Actualizar circuito de puntos; archivar torneo
   └─ Reporte post-torneo (métricas para media kit)
```

---

## 2. Flujo de una jornada / partida (operación en vivo)

```
T-24h   Recordatorio de partido a los equipos (bot/email)
T-30m   Apertura de check-in
T-15m   Bot crea canales de voz por equipo
        Sistema genera código de torneo (Riot) → al capitán
T-10m   Cierre de check-in
        └─ equipo sin check-in → forfeit automático + notificación
T-0     Equipos crean la partida custom con el código → juegan
Fin     Riot callback (o registro manual) con el resultado
        └─ persistir Game + raw_payload
        └─ recalcular Standing y stats (determinista, packages/core)
        └─ generar gráfico de resultado/MVP
        └─ generar narrativa (IA)
        └─ publicar en web, overlays y Discord
```

Intervención humana objetivo: **mínima**. El operador supervisa, no ejecuta.

---

## 3. Roles del staff

| Rol | Responsabilidad | Acceso en plataforma |
|-----|-----------------|----------------------|
| **Owner** | Dueño de la organización/marca | Total |
| **Admin** | Gestión de torneos, staff, patrocinios | Casi total |
| **Operator / Referee** | Operar jornadas, resolver disputas, check-in | Gestión de partidas y resultados |
| **Caster / Producción** | Transmisión, overlays | Lectura de datos + control de overlays |
| **Community Manager** | Discord, redes, soporte a equipos | Comunicación y contenido |
| **Captain** (jugador) | Gestiona su equipo e inscripción | Su equipo |
| **Player** (jugador) | Compite, ve su perfil | Su perfil |

> Los permisos se evalúan por organización y rol (ver `03-modelo-datos.md`).

---

## 4. Gestión de disputas

- Canal/formulario dedicado para reportar incidencias (resultado erróneo,
  conducta, problemas técnicos).
- El **Operator/Referee** revisa con evidencia (logs, `raw_payload`, capturas).
- Decisiones registradas en **AuditLog** (inmutable, para transparencia).
- Correcciones de resultado solo con override auditado; el sistema recalcula
  standings automáticamente.
- Escalamiento a Admin para sanciones mayores.

---

## 5. Integridad competitiva

- Verificación de cuentas (RSO) y revisión anti-smurf (IA + decisión humana).
- Reglas claras publicadas antes del torneo (nadie sancionado por regla no escrita).
- Sanciones graduales documentadas (advertencia → forfeit → descalificación → veto).
- Trazabilidad total de decisiones.

---

## 6. Soporte a equipos y jugadores

- **FAQ** y reglamento públicos (reduce preguntas repetidas).
- Canal de soporte en Discord atendido por Community Manager.
- Asistente IA para preguntas frecuentes sobre reglas (primer nivel).
- Onboarding claro para equipos nuevos (cómo inscribirse, cómo funciona el check-in).

---

## 7. Comunicación y contenido

| Momento | Pieza | Canal | Automatizable |
|---------|-------|-------|---------------|
| Apertura de inscripciones | Anuncio gráfico | Redes, Discord | Sí |
| Confirmación de inscripción | Notificación | Portal, Discord | Sí |
| Antes de la jornada | Recordatorio + previa | Discord, redes | Sí |
| Resultado de partida | Gráfico + crónica IA | Redes, web, Discord | Sí |
| MVP de jornada | Gráfico (patrocinado) | Redes | Sí |
| Cierre de fase/torneo | Resumen + standings | Web, redes | Sí |

---

## 8. Métricas operativas (qué medir cada torneo)

- Equipos inscritos vs. cupo; tasa de aprobación.
- Tasa de no-shows / forfeits.
- Partidas completadas sin intervención manual.
- Tiempo operativo del staff por jornada (debe bajar con la automatización).
- Incidencias/disputas por jornada.
- Audiencia (views de stream, interacción en redes/Discord).
- Retención de equipos entre jornadas/temporadas.

Estas métricas alimentan el **reporte post-torneo** y el **media kit** comercial
(ver `09-monetizacion.md`).

---

## 9. Checklist pre-lanzamiento de torneo

- [ ] Torneo configurado en el dashboard (todos los parámetros).
- [ ] Evento registrado en visibilidad de Riot (región correcta).
- [ ] Reglamento, código de conducta y disclaimer publicados.
- [ ] Términos y privacidad accesibles.
- [ ] Patrocinadores verificados (no prohibidos).
- [ ] Canales de Discord y bot configurados.
- [ ] Calendario publicado y equipos notificados.
- [ ] Plantillas de gráficos y overlays listas.
- [ ] Staff con roles asignados.
- [ ] Plan de contingencia si Riot API no está disponible (adaptador manual).

---

## 10. Continuidad y escalamiento

- Documentar cada proceso reduce la dependencia de una sola persona.
- Automatizar lo repetitivo libera al staff para lo que agrega valor (producción,
  comunidad, patrocinios).
- Cada temporada: revisar métricas, recortar fricción, mejorar plantillas.
- El objetivo de largo plazo: que operar un torneo nuevo sea **configurar, no
  construir** — lo que a su vez valida el producto para el SaaS futuro.
```
