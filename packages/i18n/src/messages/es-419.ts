// `{brand}` is filled from the organization's brand configuration, never hardcoded here.
export const es419 = {
  meta: {
    description: 'Liga amateur de League of Legends con producción profesional.',
  },
  zones: {
    public: 'Sitio',
    portal: 'Portal del jugador',
    admin: 'Consola de administración',
  },
  home: {
    title: 'Bienvenido a {brand}',
    subtitle: 'Compite como profesional. Torneos, equipos y transmisiones en un solo lugar.',
  },
  portal: {
    title: 'Portal del jugador',
    subtitle: 'Aquí verás tus equipos, torneos y partidas.',
  },
  admin: {
    title: 'Consola de administración',
    subtitle: 'Aquí se gestionarán torneos, equipos y la organización.',
  },
  health: {
    label: 'API',
    status: {
      ok: 'ok',
      degraded: 'con fallas',
      down: 'caída',
      unreachable: 'sin conexión',
    },
  },
} as const;

export type Messages = typeof es419;
