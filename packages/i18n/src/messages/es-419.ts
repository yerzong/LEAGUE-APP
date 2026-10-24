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
  auth: {
    login: {
      title: 'Inicia sesión',
      subtitle: 'Entra para competir en {brand}.',
      submit: 'Entrar',
      noAccount: '¿No tienes cuenta?',
      register: 'Regístrate',
    },
    register: {
      title: 'Crea tu cuenta',
      subtitle: 'Únete a {brand}.',
      submit: 'Crear cuenta',
      hasAccount: '¿Ya tienes cuenta?',
      login: 'Inicia sesión',
      sent: 'Te enviamos un correo para confirmar tu cuenta. Ábrelo en este navegador.',
    },
    magicLink: {
      title: 'Entrar sin contraseña',
      submit: 'Enviar enlace',
      sent: 'Te enviamos un enlace de acceso. Ábrelo en este navegador.',
    },
    oauth: {
      discord: 'Continuar con Discord',
      google: 'Continuar con Google',
    },
    fields: {
      email: 'Correo',
      password: 'Contraseña',
      passwordHint: 'Mínimo 8 caracteres.',
    },
    or: 'o',
    signOut: 'Cerrar sesión',
    errors: {
      invalidEmail: 'Escribe un correo válido.',
      invalidPassword: 'La contraseña debe tener entre 8 y 72 caracteres.',
      invalidCredentials: 'Correo o contraseña incorrectos.',
      emailNotConfirmed: 'Confirma tu correo antes de entrar.',
      rateLimited: 'Demasiados intentos. Espera un momento.',
      callback: 'No pudimos completar el inicio de sesión. Inténtalo de nuevo.',
      unknown: 'Algo salió mal. Inténtalo de nuevo.',
    },
  },
  shell: {
    navigation: 'Navegación principal',
    openMenu: 'Abrir menú',
    closeMenu: 'Cerrar menú',
    nav: {
      adminHome: 'Inicio',
      kitchenSink: 'Componentes',
      portalHome: 'Inicio',
    },
  },
  common: {
    close: 'Cerrar',
    cancel: 'Cancelar',
    loading: 'Cargando',
    retry: 'Reintentar',
  },
  dataTable: {
    filterPlaceholder: 'Buscar',
    previousPage: 'Anterior',
    nextPage: 'Siguiente',
    pageInfo: 'Página {page} de {count}',
    selectAll: 'Seleccionar todos',
    selectRow: 'Seleccionar fila',
    selectedInfo: '{count} seleccionados',
    sortBy: 'Ordenar por {column}',
  },
  kitchenSink: {
    eyebrow: 'Design system',
    title: 'Kitchen sink',
    description:
      'Todos los componentes y estados del estándar visual. Apruébalo aquí antes de construir módulos.',
    sections: {
      foundations: 'Fundamentos',
      buttons: 'Botones',
      forms: 'Formularios',
      indicators: 'Indicadores',
      surfaces: 'Superficies y glass',
      overlays: 'Diálogos y menús',
      navigation: 'Navegación',
      data: 'Tabla de datos',
      states: 'Estados vacío y error',
      motion: 'Movimiento',
    },
  },
  // Keyed by the reason codes of the eligibility engine (@league/core). Rank
  // placeholders receive the already formatted rank name.
  eligibility: {
    reasons: {
      riot_account_not_verified: 'Tu cuenta de Riot no está verificada.',
      region_not_allowed:
        'Tu región no está permitida en este torneo. Regiones válidas: {allowed}.',
      country_not_allowed: 'Tu país no está permitido en este torneo. Países válidos: {allowed}.',
      rank_below_min: 'Tu rango ({rank}) está por debajo del mínimo ({min}).',
      rank_above_max: 'Tu rango ({rank}) supera el máximo permitido ({max}).',
      peak_rank_above_max:
        'Tu rango más alto de los últimos {windowDays} días ({peak}) supera el máximo permitido ({max}).',
      team_average_below_min:
        'El rango promedio del equipo ({average}) está por debajo del mínimo ({min}).',
      team_average_above_max:
        'El rango promedio del equipo ({average}) supera el máximo permitido ({max}).',
      account_level_below_min: 'Tu cuenta es nivel {level}; se requiere al menos el nivel {min}.',
      account_too_new: 'Tu cuenta tiene {days} días; se requieren al menos {min}.',
      ranked_games_below_min:
        'Llevas {games} partidas clasificatorias esta temporada; se requieren al menos {min}.',
      birth_date_missing: 'Necesitamos tu fecha de nacimiento para verificar la edad mínima.',
      underage: 'Este torneo requiere una edad mínima de {min} años.',
      gender_not_declared: 'Este torneo requiere que hayas declarado tu género en tu perfil.',
      gender_not_allowed: 'Este torneo es exclusivo para las categorías que indica su reglamento.',
      gender_declared_too_late:
        'Tu género debe estar declarado desde antes del anuncio del torneo.',
      institution_not_verified: 'Necesitas un correo institucional verificado.',
      institution_mismatch: 'Tu institución no corresponde a la de este torneo.',
      active_roster_in_restricted_tier:
        'Tienes un roster activo en una categoría (Tier {tier}) que este torneo no admite.',
      exclusivity_conflict:
        'Ya formas parte de otro roster activo dentro del mismo ámbito de exclusividad.',
      exclusivity_cooldown:
        'Saliste de un equipo hace poco; podrás unirte a otro a partir del {availableAt}.',
      sanctioned: 'Tienes una sanción vigente.',
      legal_name_missing: 'Debes capturar tu nombre legal para participar en torneos con premios.',
    },
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
