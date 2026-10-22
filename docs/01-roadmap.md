# Roadmap

> Documento vivo. Orden de construcción del producto completo, módulo por
> módulo. Cada módulo se especifica, programa, prueba y valida antes de pasar al
> siguiente. **La monetización va siempre al final.**

---

## Principios

1. **Producto completo, construido en capas terminadas.** Nada se entrega a
   medias; el orden respeta dependencias.
2. **La liga primero, el SaaS después.** La plataforma se construye operando la
   propia liga (somos el cliente #1). El modelo ya es multi-tenant para que el
   SaaS no requiera reescritura.
3. **La liga no depende de Riot para existir.** Riot va detrás de puertos; el
   reporte manual/doble reporte funciona desde el día 1.
4. **Validar con datos reales** antes de afinar lo que depende de ellos (pro-stats,
   overlays, narrativa IA).
5. **Monetización al final**, cuando hay audiencia y métricas que vender.

---

## Fase 0 — Planeación y diseño (actual)

- [x] Documentación de producto, técnica y operativa (`docs/00`–`17`).
- [ ] Nombre de marca, logo, paleta, tipografías.
- [ ] Design system en Figma (tokens + componentes base).
- [ ] Wireframes de flujos críticos: onboarding, crear equipo, wizard de torneo,
      inscripción, centro de partida, página de evento.
- [ ] Registrar la app en el Riot Developer Portal (development key).

**Salida:** marca definida y flujos críticos diseñados.

---

## Fase 1 — Plataforma núcleo (módulos 0–9)

Monorepo, auth, `core`, perfiles y roles, vinculación Riot, equipos, wizard de
torneos, inscripciones con elegibilidad y exclusividad, calendario y partidas con
reporte manual/doble reporte, disputas, standings, sitio público y notificaciones
in-app + correo. (Detalle en `04-arquitectura.md`, sección 9.)

**Salida:** se puede operar un torneo completo de principio a fin en la
plataforma propia, sin Riot API.

**Hito:** **Torneo piloto relámpago** (16–32 equipos) sobre la plataforma propia.
Recolectar feedback y dolores reales.

---

## Fase 2 — Automatización (módulos 10–11)

- Bot de Discord (check-in, canales de voz, códigos, recordatorios, forfeit).
- Riot Tournament API: solicitar Production Key con la plataforma ya operando,
  códigos con lista de cuentas permitidas, callbacks, Match-V5, verificación de
  participantes.

**Salida:** torneos con intervención humana mínima.

---

## Fase 3 — Efecto LCK (módulos 12–16)

- Estadísticas y perfiles con pro-stats, logros, MVP.
- Media con quitar fondo y plantillas gráficas automáticas.
- Redes sociales (publicación multi-red) y seguimiento de stream.
- Transmisión: agente de observador + overlays (draft, scoreboard, escenas).
- Narrativa IA y noticias.

**Salida:** Temporada 1 de la Liga Principal con producción completa.

---

## Fase 4 — App móvil (módulo 17)

Expo / React Native reutilizando contratos y lógica. Solo cuando la PWA se quede
corta (notificaciones ricas, segunda pantalla).

---

## Fase 5 — Monetización (módulo 18)

Media kit con métricas reales, patrocinios y secciones patrocinadas,
inscripciones de pago, pases de temporada, premios, merch. Ver `09-monetizacion.md`.

---

## Fase 6 — SaaS

Multi-organización abierta, planes, onboarding de organizadores, marca blanca y
dominios propios. Solo si la liga propia funciona.

---

## Ciclo por módulo (siempre igual)

```
especificar → diseñar (Figma si tiene UI) → TDD del dominio → API → UI
→ tests E2E → CI verde → staging → validar con usuarios/staff → producción
```

## Lo que NO hacemos

- ❌ Depender de la Riot API para operar.
- ❌ Sanciones automáticas por IA (la IA marca, una persona decide).
- ❌ Pedir datos sensibles a todos al registrarse.
- ❌ Agregar tecnologías porque las sabemos, no porque las necesitamos.
- ❌ Cobrar antes de tener prestigio y audiencia.
