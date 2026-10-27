# Módulo 0DEV — Herramientas de desarrollo (seed de demo + autollenar)

> Spec para Claude Code. Herramientas SOLO para desarrollo que permiten ver los
> procesos con datos realistas sin capturar todo a mano. **Nunca deben activarse
> en producción.** Los datos se crean pasando por la lógica real (casos de uso /
> servicios), no con inserts crudos, para que reflejen el comportamiento real
> (validaciones, auditoría, eventos, standings). Referencias:
> `docs/03-modelo-datos.md`, specs de m02/m04/m05, `docs/17-estandares-ingenieria.md`.

---

## Principios

1. **Solo dev.** Todo se activa con una bandera explícita (p. ej.
   `SEED_ENABLED=true` / `NEXT_PUBLIC_DEV_TOOLS=true`) y está ausente o
   bloqueado en producción. El seed se niega a correr si detecta un proyecto que
   no sea penta-dev (verificar por URL/ref), para no tocar producción jamás.
2. **Datos realistas, no crudos.** El seed usa los casos de uso de la API (crear
   usuario, crear equipo, inscribir, generar fixtures, reportar) o funciones de
   servicio equivalentes, de modo que lo sembrado sea indistinguible de lo real.
3. **Idempotente y reversible.** `seed:demo` se puede correr varias veces sin
   duplicar (usa un prefijo/marca `demo:`), y `seed:reset` borra exactamente lo
   que el seed creó, respetando la inmutabilidad de `audit_logs` (anonimiza si
   algo tiene auditoría, no borra el log).

---

## Alcance

### 1. Seed de demo (`packages/db` o `apps/api`, script ejecutable con pnpm)
`pnpm seed:demo` crea en penta-dev un escenario completo y coherente:
- **~24 jugadores** con perfil completo, cuentas Riot "verificadas" (vía el
  adaptador stub, con rangos variados para probar elegibilidad), roles y algunos
  marcados como agentes libres.
- **8 equipos** con roster de 5 + suplente, logos placeholder, capitanes.
- **1 temporada** activa y **1 circuito**.
- **Un torneo relámpago** (eliminación simple, 8 equipos) con inscripciones
  aprobadas y fixtures generados, listo para jugar.
- **Un torneo tipo liga** (round robin, 6 equipos) con algunas jornadas ya
  jugadas, para ver standings poblados con desempates.
- **Un torneo en inscripción abierta** para probar el flujo de inscribirse.
- Marcar todo con prefijo `demo:` (en nombres/slugs/emails `*@demo.penta.local`)
  para poder identificarlo y limpiarlo.

`pnpm seed:reset`: elimina/anonimiza únicamente lo marcado `demo:`.

Salida del comando: un resumen legible (cuántos jugadores, equipos, torneos, y
los enlaces `/torneos/[slug]` creados) para abrir directo en el navegador.

### 2. Botón "rellenar con datos de ejemplo" (web, solo dev)
- Visible solo si `NEXT_PUBLIC_DEV_TOOLS=true`. Un botón flotante discreto
  (globito) o un control en los formularios largos.
- En el **wizard de torneo**: precarga pasos con una configuración de ejemplo
  válida (el usuario revisa y ajusta). No envía solo; llena los campos.
- En el **formulario de perfil** y **crear equipo**: rellena con datos de ejemplo.
- Nunca aparece en build de producción (tree-shaking por la bandera + guard).

### 3. Página de herramientas de dev (opcional, `/admin/dev`, solo dev)
- Botones para: correr seed, resetear seed, crear "un torneo listo para jugar",
  simular el resultado de una partida pendiente (para ver avanzar el bracket sin
  2 navegadores). Todo detrás de la bandera dev y de rol super_admin.

---

## Lo que NO va
- Nada que quede accesible en producción.
- Inserts crudos que salten validaciones (romperían el propósito de "ver el
  proceso real").
- Datos de personas reales; todo ficticio y marcado como demo.

## Criterios de aceptación
- [ ] `pnpm seed:demo` puebla penta-dev y imprime el resumen con enlaces; correrlo
      dos veces no duplica.
- [ ] `pnpm seed:reset` deja penta-dev como antes del seed (sin romper auditoría).
- [ ] El seed se **niega a correr** si el proyecto objetivo no es penta-dev.
- [ ] Con `NEXT_PUBLIC_DEV_TOOLS=true`, el botón de autollenar aparece en wizard,
      perfil y crear equipo; con la bandera apagada, NO aparece ni en el bundle.
- [ ] Tras el seed, al abrir `/torneos` se ven los torneos demo; el relámpago
      tiene bracket y el de liga tiene standings con desempates.
- [ ] `pnpm lint typecheck test build` pasa; sin hex ni estilos sueltos; textos
      dev pueden ir en inglés (son herramientas internas) o i18n.
- [ ] El guard de producción está testeado (si la bandera/entorno es prod, los
      comandos y el botón no hacen nada).

## Notas
- Objetivo: que Gerson corra un comando y de inmediato vea la plataforma llena y
  "viva" para explorar todos los procesos (perfiles, equipos, inscripciones,
  bracket, standings) sin capturar nada a mano.
- El botón de autollenar es comodidad; el seed es lo que de verdad da el
  escenario completo.
