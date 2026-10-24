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
