# Módulo 03 — Navegación y vitrina pública

> Spec para Claude Code. Convierte las páginas sueltas en una app navegable con
> enfoque **vitrina**: el sitio público muestra contenido (liga, equipos,
> jugadores) para enganchar, y ofrece caminos claros para iniciar sesión,
> registrarse o seguir explorando como invitado. No reemplaza módulos previos:
> los conecta. Usa `packages/ui`, `packages/i18n` y el design system afilado.
> Referencias: `docs/14-modulos-funcionales.md §5`, `docs/05-plataformas.md`,
> `docs/08-design-system.md`, `docs/17-estandares-ingenieria.md`.

---

## Principio

Enfoque **vitrina**: cualquiera puede mirar sin cuenta. La cuenta solo hace falta
para competir. El login nunca es una pared en la entrada; es un botón claro,
siempre accesible, sin estorbar el contenido.

---

## Alcance

### 1. Header público (organismo en `packages/ui`, usado en el layout `(public)`)
- Logo PENTA League (enlaza a `/`).
- Navegación principal: Inicio, Torneos, Equipos, Jugadores, (más adelante
  Noticias/En vivo — dejar la estructura lista aunque la sección aún no exista;
  no enlazar a 404).
- Estado **no autenticado**: botones "Iniciar sesión" y "Registrarte".
- Estado **autenticado**: avatar con menú (Mi portal → `/app`, Mi perfil, Mis
  equipos, Cerrar sesión; si es staff, acceso a `/admin`).
- Responsive: en móvil, navegación en un `Sheet` (menú hamburguesa).
- El header lee la sesión en el servidor (Supabase) para saber qué mostrar; sin
  parpadeo de "invitado→logueado".

### 2. Footer público
- Enlaces legales: reglamento, código de conducta, privacidad, términos.
- **Disclaimer obligatorio de Riot** (texto de `docs/10-legal-cumplimiento.md §3`).
- Redes de la liga (placeholders por ahora).
- Enlace a "Conviértete en patrocinador" (a futuro; puede ir a un mailto o
  sección simple).

### 3. Home (vitrina) — reconstruir `(public)/page.tsx`
Secciones (con datos reales cuando existan; si una fuente aún no existe, mostrar
un estado vacío elegante, nunca un bloque roto):
- **Hero**: marca, tagline, y CTAs claros: "Explorar torneos" (primario),
  "Crear cuenta para competir" (secundario). Si ya hay sesión: "Ir a mi portal".
- **Temporada activa / próximos partidos**: placeholder con estado vacío
  ("Aún no hay partidos programados") hasta que exista el módulo de torneos.
- **Equipos destacados**: muestra equipos reales desde la BD (los que haya), con
  enlace a su página pública. Estado vacío si no hay.
- **Cómo funciona**: 3–4 pasos (regístrate, vincula Riot, crea o únete a un
  equipo, compite). Enlaza a registro.
- **Franja de llamada final**: "¿Listo para competir?" → registro.

### 4. Páginas índice que faltan (sitio público)
- `/torneos`: listado de torneos (estado vacío por ahora + explicación de los
  tipos de torneo). Estructura lista para cuando exista el módulo de torneos.
- `/equipos`: directorio de equipos con búsqueda básica (los reales de la BD).
- `/jugadores`: directorio/búsqueda de jugadores (datos públicos, respeta
  privacidad del módulo 02).
- `/legal/[doc]` o páginas simples para reglamento, privacidad, términos,
  código de conducta (contenido desde los docs; pueden ser estáticas por ahora).

### 5. Navegación coherente entre zonas
- Desde el header público, el usuario logueado llega a `/app` en un clic.
- Desde `/app` y `/admin` (AppShell del design system), un enlace para volver al
  sitio público.
- Breadcrumbs donde aporten (ej. equipo → jugador).
- Página **404 y error** propias, con la marca y un botón para volver al inicio.

### 6. SEO y metadatos básicos
- `metadata` por página (título, descripción) en español.
- Open Graph básico para que al compartir un equipo/jugador salga bien.
- `sitemap.ts` y `robots.ts` para el sitio público.

---

## Reglas de implementación
- Header, Footer, Hero, SectionHeading, EmptyState de vitrina: componentes en
  `packages/ui` (presentacionales), consumidos por la web. Reutilizables en móvil
  a futuro.
- Nada hardcodeado de marca: nombre y logo desde la config de marca; textos desde
  `packages/i18n`.
- Sin hex ni estilos sueltos (lo bloquea la regla de ESLint).
- Lecturas públicas: por la API o por Supabase con RLS; nunca exponer datos
  privados (respetar lo del módulo 02).
- Accesibilidad: navegación por teclado, foco visible, `aria` en el menú y el
  Sheet, contraste AA.

## Criterios de aceptación
- [ ] Desde `/` sin sesión se puede: ir a login, a registro, y navegar a
      Torneos, Equipos y Jugadores. **No hay callejón sin salida.**
- [ ] Con sesión, el header muestra el avatar y el acceso a `/app`; staff ve
      acceso a `/admin`.
- [ ] El footer muestra el disclaimer de Riot y los enlaces legales funcionan.
- [ ] `/equipos` lista equipos reales de penta-dev; `/jugadores` respeta la
      privacidad.
- [ ] Páginas 404/error con la marca.
- [ ] Responsive real en móvil (menú hamburguesa, sin scroll horizontal).
- [ ] `pnpm lint typecheck test build` pasa; E2E: invitado navega la vitrina,
      llega a login y a registro; usuario logueado ve su acceso al portal.
- [ ] Toda la UI con `packages/ui` e i18n; sin hex sueltos.

## Fuera de alcance
- Contenido real de torneos, standings en vivo, noticias, media (módulos
  propios). Aquí solo la estructura, los enlaces y los estados vacíos elegantes.
- Rediseño del AppShell de `/app` y `/admin` (ya existe); solo añadir el enlace
  de retorno al sitio público.

## Notas
- Objetivo de sensación: que al entrar a `/` se entienda en 5 segundos qué es
  PENTA League y haya un botón obvio para entrar o explorar.
- Estados vacíos "elegantes" (no errores) en todo lo que aún no tiene datos: es
  una vitrina en construcción, debe verse intencional, no rota.
