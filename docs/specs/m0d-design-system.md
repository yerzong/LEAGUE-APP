# Módulo 0D — Design System base (estilo "limpio y afilado")

> Spec para Claude Code. Objetivo: fijar el lenguaje visual y los componentes
> genéricos ANTES de construir módulos de negocio, para que todo nazca con el
> mismo estándar y re-estilizar en el futuro sea cambiar tokens, no reescribir.
> Dirección elegida: **limpio y afilado, tipo LoL Esports oficial** — negro,
> plata, líneas finas, poco glass. El glass es un acento, no la base.

---

## Principios visuales (el "estándar")

1. **Base oscura, acento plata.** Fondo `--color-bg`, superficies con borde fino
   `--color-border`, texto plata/blanco. Nada de gradientes pesados ni glass de
   fondo.
2. **Afilado:** esquinas poco redondeadas (`--radius-sm`/`md`), líneas de 1px,
   mayúsculas con `letter-spacing` en títulos y etiquetas (estilo broadcast).
3. **Jerarquía por contraste y tipografía**, no por color saturado. El color
   saturado (acentos de circuito) se usa con medida: estados, etiquetas, el lado
   del equipo, el circuito activo.
4. **Glass solo como acento premium** (`.glass` util): tarjeta de MVP, panel de
   partido en vivo, modales destacados. Nunca en tablas ni fondos grandes
   (rendimiento y contraste).
5. **Movimiento con propósito:** transiciones rápidas (120–200 ms), entradas
   sutiles. Respetar `prefers-reduced-motion`. Sin animaciones decorativas que
   distraigan.
6. **Todo sale de tokens.** Cero hex sueltos, cero tamaños mágicos en
   componentes. Si un color o espacio no está en los tokens, se agrega al token,
   no al componente.

---

## Alcance (un solo módulo, se puede dividir en ramas encadenadas)

### 1. Base shadcn/ui en `packages/ui`
- Inicializar shadcn/ui (estilo "new-york", base color neutral) adaptado a los
  tokens existentes de `docs/08-design-system.md` (no usar su paleta por
  defecto; mapear a `--color-*` ya definidos).
- Modo oscuro por defecto y único por ahora (la app es dark-first).
- Reutilizar el `Button` y `FormField` que ya existen; migrarlos al patrón
  shadcn si hace falta, sin perder su API.

### 2. Componentes genéricos (átomos y moléculas)
Traer y re-estilizar al estándar afilado:
- Átomos: Button, Input, Textarea, Select, Checkbox, Switch, RadioGroup, Label,
  Badge, Avatar, Separator, Skeleton, Spinner, Tooltip, Kbd.
- Moléculas: FormField (ya existe), Card, Dialog (modal), AlertDialog
  (ConfirmDialog con motivo obligatorio para acciones sensibles), Dropdown,
  Tabs, Toast/Sonner, Command (paleta de comandos), Pagination, Popover, Sheet.
- Organismos base: DataTable (paginación, orden, filtro, selección múltiple,
  acciones en lote, estado de carga/vacío/error), AppShell (sidebar + topbar
  para `/admin` y `/app`), PageHeader, EmptyState, ErrorState.

Cada componente: tipado estricto, accesible (teclado + foco visible), con una
story en Storybook.

### 3. Utilidades de estilo
- `.glass` (o componente `GlassPanel`): `backdrop-filter: blur()` + capa
  translúcida + borde sutil, pensado para acentos. Documentar cuándo NO usarlo.
- Utilidades de "sharp": bordes, esquinas, etiquetas en mayúsculas, números
  tabulares.
- Clase de foco visible consistente para accesibilidad.

### 4. Animaciones (Motion / Framer Motion)
- Instalar `motion` (Framer Motion v12+). Crear primitivas reutilizables:
  `FadeIn`, `SlideUp`, `Stagger` (listas), transición de página.
- Todas respetan `prefers-reduced-motion` (si está activo, sin animación).
- Duraciones/curvas desde los tokens (`--duration-*`, `--ease-*`).

### 5. Página de demostración (aprobación visual)
- `/admin/kitchen-sink` (solo visible para super_admin en dev): muestra TODOS
  los componentes, estados, los acentos por circuito y un ejemplo de tarjeta con
  glass. Es donde Gerson aprueba el estándar antes de construir módulos.
- Aplicar el AppShell a `/admin` y `/app` con navegación de ejemplo.

---

## Reglas de implementación (SOLID / genérico)
- Componentes **presentacionales puros** en `packages/ui`: sin fetch, sin lógica
  de negocio, props tipadas. Se reutilizan en web, overlays y (futuro) móvil.
- Variantes con `cva` (class-variance-authority), no con condicionales de estilo
  sueltos.
- Nada de valores de color/tamaño inline: solo clases de token.
- La app consume `packages/ui`; no redefine componentes base localmente.

## Criterios de aceptación
- [ ] `pnpm lint typecheck test build` pasa.
- [ ] Storybook muestra todos los componentes con sus variantes y estados.
- [ ] `/admin/kitchen-sink` renderiza todos los componentes; `/admin` y `/app`
      usan el AppShell.
- [ ] No hay valores hex ni tamaños mágicos en componentes (todo por tokens):
      revisable con una búsqueda simple.
- [ ] `prefers-reduced-motion` desactiva las animaciones.
- [ ] Contraste AA en texto sobre superficies y sobre glass.
- [ ] DataTable funciona con datos de ejemplo (orden, filtro, paginación,
      selección, estados vacío/carga/error).

## Fuera de alcance
Pantallas de negocio reales (equipos, torneos). Esto es solo el kit visual y los
componentes genéricos que esas pantallas usarán después.

## Notas
- La dirección visual puede evolucionar: como todo sale de tokens y componentes
  genéricos, un restyle futuro es cambiar tokens, no reescribir módulos.
- Glass y animaciones: empezar conservador. Es más fácil agregar efecto después
  que quitarlo de toda la app.
