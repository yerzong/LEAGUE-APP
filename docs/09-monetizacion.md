# Monetización — League App

> Documento vivo. Cómo la liga genera ingresos y cuándo activar cada vía.
> Regla: **no monetizar antes de validar.** El piloto es gratuito o simbólico.

---

## 1. Contexto de mercado (validado)

- El mercado de plataformas de gestión de torneos de esports fue de ~882 M USD en
  2025, proyectado a ~2.33 B USD para 2032 (CAGR ~14.8%). Fuente:
  [guideflow.com](https://www.guideflow.com/blog/esports-tournament-software).
- El **patrocinio** es la mayor fuente de ingresos del esports: ~40% del revenue
  en 2025. Fuente:
  [dignitas.gg](https://dignitas.gg/articles/how-esports-organizations-generate-revenue-beyond-tournament-winnings).
- Riot (2026) eliminó topes a cuotas de inscripción, premios, patrocinios y venta
  de entradas para torneos de comunidad. Fuentes:
  [lolesports.com](https://lolesports.com/en-us/news/lol-esports-community-competition-guidelines),
  [esports.net](https://www.esports.net/news/league-of-legends-community-competition-guidelines-update/).

> Contenido reformulado para cumplir con restricciones de licencia de las fuentes.

---

## 2. Las dos vías de ingreso

### Vía B2C — La liga como marca organizadora
Ingresos directos de la comunidad y de marcas:

| Fuente | Descripción | Cuándo activar |
|--------|-------------|----------------|
| Cuotas de inscripción | Por equipo, por torneo | Tras validar en piloto (gratis/simbólico primero) |
| Pases de temporada | Acceso o beneficios premium por temporada | Liga en marcha |
| Patrocinios | Secciones patrocinadas ("MVP presentado por X"), branding | Con métricas reales del piloto |
| Merchandising | Jerseys, periféricos, coleccionables de marca | Cuando haya audiencia fiel |
| Entradas a eventos | Finales presenciales, watch parties | Cuando el tamaño lo justifique |
| Contenido / media | Patrocinio de clips, transmisiones, highlights | Con audiencia establecida |

### Vía B2B — La plataforma como SaaS (futuro)
Solo tras validar la liga (Fase 5 del roadmap):

| Fuente | Descripción |
|--------|-------------|
| Licencia marca blanca | Rentar el motor de torneos a otros organizadores |
| Suscripción por torneo/temporada | Pago por uso de la plataforma |
| Fee por inscripciones | Comisión sobre pagos procesados (si se ofrece pago integrado) |
| Servicios premium | Overlays, narrativa IA, soporte de producción |

---

## 3. El patrocinio como motor principal

Dado que el patrocinio domina el revenue del esports, es la vía a profesionalizar:

- **Activaciones por sección:** "MVP de la jornada presentado por [Marca]",
  "Jugada del día by [Marca]", branding en overlays y gráficos.
- **Nichos de alto valor:** el circuito femenil y el universitario son
  especialmente atractivos para marcas que buscan diversidad o sector estudiantil.
- **Patrocinadores endémicos** (periféricos, sillas, energéticos) y **no
  endémicos** (bancos, telcos, retail) que buscan audiencia joven.
- **Entregable comercial:** un **media kit** con métricas reales (audiencia,
  equipos, alcance, demografía) producido tras el piloto y la Fase 2.

> Restricción Riot: NO se permiten patrocinadores prohibidos (casas de apuestas,
> cripto no regulada). Ver `10-legal-cumplimiento.md`.

---

## 4. Cuándo se activa cada vía (alineado al roadmap)

| Fase | Monetización |
|------|--------------|
| Fase 0–1 (piloto) | **Ninguna o simbólica.** Objetivo: validar y producir portafolio |
| Fase 2 (automatización) | Preparar media kit; primeras cuotas de inscripción |
| Fase 3 (efecto LCK) | Primeras activaciones de patrocinio por sección |
| Fase 4 (Temporada 1) | Inscripciones + pases + patrocinios + merch |
| Fase 5 (SaaS) | Ingresos B2B de marca blanca |

---

## 5. Pagos (consideración técnica)

- Procesador recomendado: **Stripe** (suscripciones, pagos únicos, payouts) por su
  madurez en modelos de membresía y marketplace.
- Mantener pagos **detrás de una abstracción** (igual que Riot) para poder cambiar
  de procesador o añadir métodos locales (ej. pagos regionales) sin reescribir.
- Cumplimiento fiscal y de facturación según el país de operación (definir con la
  constitución legal de la marca/empresa).

---

## 6. Qué NO hacer

- ❌ Cobrar inscripción antes de que la marca tenga prestigio demostrable.
- ❌ Prometer bolsas de premios que no están respaldadas.
- ❌ Aceptar patrocinadores prohibidos por Riot (riesgo de perder la licencia).
- ❌ Construir pagos integrados complejos antes de tener demanda real.
