# Automatización e Inteligencia Artificial — League App

> Documento vivo. Cómo la plataforma elimina el trabajo manual y usa IA para
> producir una experiencia de nivel LCK a bajo costo operativo. Regla: **cada
> automatización reemplaza un dolor REAL observado**, no uno imaginado.

---

## 1. Filosofía: cero fricción operativa

El objetivo es que operar un torneo requiera **intervención humana mínima**. Todo
se conecta por **eventos**: algo ocurre (fin de partida, inscripción, hora de
check-in) y el sistema reacciona en cadena sin que nadie mueva un dedo.

La automatización no sustituye la visión del organizador; sustituye el trabajo
repetitivo (anotar, copiar, perseguir, exportar).

---

## 2. De manual a automatizado (tabla de transformación)

| Proceso | Antes (manual) | Después (automatizado + IA) |
|---------|----------------|------------------------------|
| **Registro y validación** | Revisar cuenta por cuenta en OP.GG para detectar smurfs/rango | Verificación por API (RSO + Summoner/League-V4); IA detecta anomalías de winrate o cuentas recién subidas |
| **Coordinación de partidas** | Perseguir capitanes por Discord | Bot crea canales de voz, genera y envía el código de torneo; forfeit automático por no-show |
| **Resultados y tabla** | Anotar ganador y KDA a mano en Excel | Webhook de Riot → JSON → recálculo automático de standings, KDA, GPM |
| **Diseño de piezas** | Abrir editor, cambiar textos/fotos, exportar por pieza | Datos inyectados en plantilla parametrizada → imagen publicada al instante |
| **Narrativa / crónicas** | Nadie las escribe (toma mucho tiempo) | LLM lee la línea de tiempo del match y redacta resumen, nota de prensa y guion de caster |

---

## 3. Orquestación por eventos

Arquitectura basada en jobs y colas (outbox transaccional + pg-boss sobre
Postgres, en `apps/worker`; Redis/BullMQ solo si el volumen lo exige),
opcionalmente con un orquestador visual (**n8n**) para flujos que convenga
mantener fuera de código.

Eventos principales y sus reacciones:

```
EVENTO: equipo se inscribe
  → validar elegibilidad (región/elo/institución)
  → IA: señalar cuentas sospechosas para revisión
  → notificar al equipo (estado) por Discord/email

EVENTO: faltan 15 min para la partida
  → bot crea canales de voz por equipo
  → genera código de torneo (Riot) y lo envía al capitán
  → inicia ventana de check-in

EVENTO: se cierra la ventana de check-in
  → si un equipo no hizo check-in → forfeit automático + notificación

EVENTO: termina la partida (callback de Riot o registro manual)
  → persistir Game + raw_payload
  → recalcular Standing (packages/core)
  → derivar stats de jugadores y agregados
  → generar gráfico de resultado/MVP (packages/graphics)
  → generar narrativa (packages/ai)
  → publicar en web, overlays y Discord
```

---

## 4. Dónde entra la IA (y dónde NO)

### Casos de uso de IA
1. **Narrativa de partidas** — LLM lee la timeline del JSON (robos de barón,
   pentakills, picos de oro) y redacta crónica, nota de prensa y guion de caster.
2. **Anti-smurf / integridad** — detección de anomalías en patrones de winrate,
   nivel de cuenta y rendimiento vs. rango declarado (asistida, con revisión
   humana para decisiones sancionadoras).
3. **Resúmenes y destacados** — identificar momentos clave para clips.
4. **Asistencia al organizador** — sugerencias de seeding, detección de conflictos
   de calendario.
5. **Soporte a la comunidad** — respuestas a preguntas frecuentes sobre reglas.

### Dónde NO se usa IA (decisiones deterministas)
- Cálculo de standings, puntos y desempates → **lógica pura en `packages/core`**,
  no IA. Debe ser exacto, auditable y reproducible.
- Validación de reglas de Fearless → determinista.
- Resultados de partida → vienen de datos de Riot, no de inferencia.

> Principio: la IA **narra y asiste**; las **reglas deciden**. Nunca al revés.

---

## 5. Generación dinámica de gráficos

`packages/graphics` convierte datos + plantilla en imagen, sin abrir un editor.

- **Plantillas parametrizadas** (componentes con el design system): resultado de
  partida, MVP, standings, próximos partidos, pick&ban.
- **Motor de render:** Satori (HTML/JSX → SVG → PNG) para piezas estáticas;
  Puppeteer/node-canvas para casos complejos.
- Disparado por evento → `GraphicRender` → `MediaAsset` → publicado en redes y
  Discord automáticamente.
- Consistencia visual garantizada: misma fuente de tokens que la web y los overlays.

---

## 6. Narrativa con IA (detalle)

Pipeline:
```
1. Entrada: timeline + stats del match (Match-V5 raw_payload)
2. Extracción de eventos notables (determinista: barones, pentakills, first blood,
   remontadas por diferencia de oro)
3. Prompt estructurado al LLM con esos hechos + contexto (equipos, historial)
4. Salida: crónica (web), nota de prensa corta (redes), guion de caster
5. Estado draft → revisión opcional → published
```

- **Adaptador LLM intercambiable** (`packages/ai`): el proveedor es
  configuración, no dependencia rígida.
- **Control de alucinaciones:** la IA solo describe hechos extraídos de los datos;
  no inventa resultados ni estadísticas.
- Tono y estilo configurables por organización (voz de marca).

---

## 7. Anti-smurf e integridad competitiva

- Verificación de cuenta vía **RSO** (es la cuenta que dice ser).
- Consulta de rango/historial (Summoner/League-V4).
- **Señales** que la IA pondera: cuenta muy reciente, winrate anómalo, salto de
  rango, nivel bajo con rendimiento alto.
- **Decisión final humana** en casos sancionables (la IA marca, el operador
  resuelve). Registrado en AuditLog.

---

## 8. Herramientas de automatización

| Herramienta | Uso |
|-------------|-----|
| **Outbox + pg-boss** | Colas de jobs en código sobre Postgres (fiable, tipado, sin infraestructura extra) |
| **n8n** (opcional) | Flujos visuales que conviene editar sin desplegar código |
| **Webhooks** | Entrada de eventos de Riot y Discord |
| **Cron / schedulers** | Recordatorios, aperturas/cierres de ventanas |

Criterio: lógica crítica y tipada → jobs en código (pg-boss). Flujos de integración que
cambian seguido o que opera alguien no-dev → n8n.

---

## 9. Orden de construcción (sin recortar la visión)

| Automatización | Cuándo |
|----------------|--------|
| Recálculo de standings y stats (determinista) | Con el core — base |
| Generación de gráficos de resultado | Tras tener datos reales del piloto |
| Bot de Discord (check-in, códigos, forfeit) | Tras validar la coordinación manual |
| Narrativa con IA | Efecto LCK — con partidas reales que narrar |
| Anti-smurf con IA | Madurez — cuando el volumen lo justifique |

> Todo se construye **terminado**; el orden respeta que las features de IA
> necesitan datos reales para diseñarse bien a la primera.
