# Visión de Producto — League App

> Documento vivo. El "norte" del proyecto. Todo lo demás (técnico, diseño,
> operación) existe para servir lo que está escrito aquí.

---

## 1. Qué es

Una **marca y liga amateur de League of Legends** para la comunidad
hispanohablante, con identidad visual y producción tipo **LCK / LPL**, operada
sobre una **plataforma propia** que automatiza lo que hoy se hace a mano
(hojas de cálculo, capturas por Discord, diseño pieza por pieza).

No es "otra herramienta de brackets". Es una **competición con marca** que hace
sentir a un jugador amateur como una estrella profesional.

---

## 2. El problema real

El amateur hispanohablante de LoL se gestiona casi todo a mano:

- Inscripción y validación de cuentas en hojas de cálculo.
- Coordinación de partidas persiguiendo capitanes por Discord.
- Resultados anotados a mano desde capturas de pantalla.
- Diseño de cada pieza de redes una por una.
- Cero narrativa, cero estadísticas, cero sensación de "evento serio".

Consecuencia: los equipos sienten que juegan un torneo improvisado y abandonan.

---

## 3. La propuesta de valor

**Para el equipo amateur:** competir en una liga que se ve y se siente
profesional — perfil con estadísticas, transmisiones con overlays, gráficos de
resultado estilo LCK, narrativa de sus partidas. Prestigio por aparecer ahí.

**Para el organizador (tú):** operar múltiples torneos en paralelo (liga,
relámpago, femenil, universitario) con el mínimo trabajo manual gracias a la
automatización y la IA.

**Para el patrocinador:** acceso a una audiencia joven, segmentada y activa, con
activaciones de marca claras (secciones patrocinadas, nichos como femenil o
universitario).

---

## 4. Diferenciador central

> El diferenciador NO es la tecnología. Es la **experiencia**: hacer sentir
> estrella al amateur. La tecnología es el medio para producir esa experiencia a
> bajo costo operativo y de forma repetible.

Esto significa que el diseño y la producción pesan tanto como el código.

---

## 5. Público objetivo

| Segmento | Descripción | Por qué le importa |
|----------|-------------|--------------------|
| Equipos amateur | Jugadores por debajo del circuito oficial que quieren competir en serio | Prestigio, estadísticas, sentirse pro |
| Jugadoras (femenil) | Comunidad que busca un espacio competitivo seguro | Entorno dedicado, visibilidad |
| Universitarios | Representar a su escuela | Identidad, rivalidad, comunidad |
| Audiencia / fans | Siguen a los equipos y streams | Narrativa, clips, producción |
| Patrocinadores | Marcas locales, periféricos, no endémicas | Audiencia segmentada y activa |

---

## 6. Los dos negocios (orden deliberado)

1. **La liga / marca** — se construye primero. Es el producto B2C y de patrocinios.
2. **La plataforma SaaS** — se extrae después, solo si la liga funciona. Es el
   producto B2B (motor de torneos en marca blanca para otros organizadores).

La plataforma se construye *operando la propia liga*: somos nuestro cliente #1.
El motor de torneos se aísla desde el día 1 para que el SaaS sea posible, pero no
se invierte en features de SaaS hasta validar la liga. (Detalle en `01-roadmap.md`.)

---

## 7. Principios de producto

1. **EXISTIR antes que IMPRESIONAR.** Primero lo mínimo para operar; lo
   espectacular se construye encima.
2. **Validar antes de automatizar.** La automatización resuelve dolores reales
   de un piloto, no imaginados.
3. **La liga no depende de Riot para existir.** La API de torneos es una mejora,
   detrás de una capa de abstracción, no un requisito de arranque.
4. **Multi-torneo desde el día 1.** Una organización contiene N torneos de N tipos.
5. **Diseño como ventaja competitiva**, no como adorno.
6. **El motor de torneos vive aislado** para habilitar el SaaS futuro sin reescritura.

---

## 8. Métricas de éxito (cómo sabemos que funciona)

**Fase piloto:**
- Equipos inscritos vs. meta (ej. llenar 16–32 slots).
- Tasa de no-shows / forfeits.
- Partidas completadas sin intervención manual crítica.
- Clips e imágenes producidas con estética LCK.

**Liga en marcha:**
- Retención de equipos entre temporadas.
- Crecimiento de audiencia (views, Discord, redes).
- Ingresos por patrocinio / inscripción.
- Tiempo operativo por torneo (debe bajar temporada a temporada).

---

## 9. Riesgos y mitigaciones

| Riesgo | Mitigación |
|--------|------------|
| Production API Key de Riot tarda o rebota | La liga opera con registro manual; Riot va detrás de una abstracción |
| Pocos equipos en el piloto | Inscripción gratuita/simbólica + foco en diseño que enamore |
| Sobre-construir antes de validar | Roadmap por fases con criterios de salida estrictos |
| Costos de operación (servidores, IA) | Empezar con herramientas existentes; construir propio solo lo validado |
| Cambios en políticas de Riot | Mantener registro de visibilidad al día; cumplir guidelines (ver `10-legal`) |
| Dependencia de una sola persona (tú) | Documentar operaciones (`11-operaciones`) y automatizar lo repetitivo |
