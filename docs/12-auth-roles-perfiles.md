# Autenticación, Roles, Permisos y Perfiles

> Documento vivo. Cómo entra un usuario, qué datos completa, cómo vincula su
> cuenta de Riot y qué puede hacer según su rol.

---

## 1. Métodos de login

Implementado con **Supabase Auth** (ya contratado), que trae proveedores OAuth
listos (Google, Apple, Discord, Twitch, entre otros), magic link, OTP por teléfono
y MFA (TOTP).

| Método | Incluido | Notas |
|--------|----------|-------|
| Correo + contraseña | ✅ Lanzamiento | Con verificación de correo obligatoria |
| Magic link (correo sin contraseña) | ✅ Lanzamiento | Reduce fricción |
| **Discord** | ✅ Lanzamiento | **El principal.** La comunidad ya vive ahí; vincula el bot automáticamente |
| Google | ✅ Lanzamiento | Cobertura general |
| Apple | ⏳ Con app iOS | Apple lo exige si la app iOS ofrece otros logins sociales |
| Twitch | ⏳ Opcional | Útil para streamers / casters |
| Teléfono (OTP SMS) | ❌ No como login | Cuesta por SMS. Solo como dato opcional de contacto |
| **Riot (RSO)** | ⚠️ Vinculación, no login | RSO requiere aprobación de Riot. Se usa para **vincular y verificar** la cuenta de juego, no como login principal |

**Vinculación de identidades:** un usuario puede conectar varios proveedores a la
misma cuenta (ej. entró con Google y luego vincula Discord). Se usa el correo
verificado para evitar cuentas duplicadas.

**Seguridad:**
- **MFA obligatorio** para roles de staff (super admin, admin, operator).
- Sesiones con expiración; cierre de sesión en todos los dispositivos.
- Rate limiting en login y recuperación de contraseña.
- Registro de inicios de sesión (IP, dispositivo) para staff.

---

## 2. Vinculación de cuenta Riot (requisito para competir)

Un usuario puede registrarse y navegar sin cuenta Riot, pero **no puede unirse a
un equipo ni inscribirse** hasta vincularla y verificarla.

Riot eliminó en 2022 la API de "código de verificación de terceros"; la vía
oficial hoy es RSO. Por eso hay dos métodos:

| Método | Cuándo | Cómo funciona |
|--------|--------|---------------|
| **RSO (OAuth de Riot)** | Cuando Riot apruebe el cliente RSO | El usuario inicia sesión en Riot y autoriza; obtenemos el PUUID verificado |
| **Verificación por ícono** (respaldo) | Mientras no haya RSO | El usuario escribe su Riot ID (`Nombre#TAG`); el sistema le pide poner un ícono de invocador específico al azar; consultamos la API y confirmamos el cambio. Validar en prototipo. |

Datos que se guardan: PUUID (identificador estable), Riot ID, región, nivel,
rango actual y snapshots de rango (para peak rank).

Reglas:
- **Un PUUID solo puede estar vinculado a un usuario.** Si alguien intenta
  vincular una cuenta ya vinculada → proceso de disputa con soporte.
- Una cuenta principal por usuario para competir; cuentas secundarias opcionales
  declaradas (ayudan a la detección de smurfs).
- Re-sincronización periódica (Riot ID y rango cambian).

---

## 3. Perfil de usuario

### Datos obligatorios (al registrarse)
- Correo verificado.
- Nombre de usuario público (único, usado en la web).
- País y región de juego.
- Fecha de nacimiento (para restricciones de edad y menores).
- Aceptación de términos y privacidad (con versión aceptada).

### Datos obligatorios para competir
- Cuenta Riot vinculada y verificada.
- Rol principal y secundario (top, jungle, mid, adc, support).

### Datos condicionales (solo si el torneo lo exige)
- **Nombre legal completo**: para torneos con premio en efectivo o eventos
  presenciales.
- **Teléfono**: solo para eventos presenciales o finales (contacto urgente).
- **Correo institucional**: torneos universitarios.
- **Datos de pago de premios**: se piden al ganar, no antes.

### Datos opcionales (perfil público)
- Foto de perfil (con **quitar fondo automático**, ver `16-media-social-broadcast.md`).
- Banner del perfil.
- Biografía corta.
- Redes sociales: Twitch, YouTube, TikTok, X, Instagram, Kick.
- Campeones favoritos.
- Disponibilidad horaria (ayuda a capitanes a buscar jugadores).
- "Busco equipo" (aparece en el buscador de agentes libres).

### Privacidad (principio: pedir lo mínimo y en el momento que hace falta)
- Cada dato tiene **visibilidad**: público, solo equipo, solo staff, privado.
- Nombre legal, teléfono, fecha de nacimiento: **nunca públicos**.
- La edad pública se muestra como "+18" o nada; nunca la fecha.
- **Menores de edad (decisión: sin edad mínima propia):** la plataforma no
  impone una edad mínima adicional; aplica la que exige Riot para tener cuenta
  (verificar en sus términos vigentes). Para menores de 18 (México):
  - Consentimiento de padre/madre/tutor registrado para competir.
  - Obligatorio también para premios en efectivo, eventos presenciales y para
    **usar su foto en publicaciones, overlays y redes**.
  - Sin consentimiento: puede competir con avatar genérico y sin aparecer en
    posts con foto.
  - El sistema marca al menor en el roster para que el staff lo vea.
  - Validar con un abogado bajo la ley mexicana de datos personales vigente.
- El usuario puede **descargar y borrar** sus datos (derechos ARCO / GDPR). Al
  borrar, el historial competitivo se anonimiza (no se pierden resultados).

> Corrección a tu idea: pedir nombre completo, edad y teléfono a todos al
> registrarse sube el abandono y te obliga a proteger datos sensibles que no
> necesitas. Se piden solo cuando un torneo los requiere.

---

## 4. Roles

Dos niveles: **roles de plataforma** (globales) y **roles de organización**
(por tenant, base del SaaS). Más los **roles de equipo**.

### Roles de plataforma
| Rol | Quién | Puede |
|-----|-------|-------|
| **Super Admin** | Tú (dueño de la plataforma) | Todo: organizaciones, usuarios globales, configuración, facturación SaaS, impersonar (con auditoría) |
| Soporte de plataforma | Staff de soporte (futuro SaaS) | Ver usuarios/organizaciones, resolver incidencias, sin borrar |

### Roles de organización
| Rol | Puede |
|-----|-------|
| **Owner** | Todo dentro de la organización, incluida marca y staff |
| **Admin** | Torneos, equipos, usuarios, patrocinadores, contenido, notificaciones |
| **Tournament Manager** | Crear y gestionar torneos asignados |
| **Referee / Árbitro** | Validar resultados, gestionar disputas y sanciones de partidas asignadas |
| **Moderador** | Moderar perfiles, fotos, nombres de equipo, reportes |
| **Content / Social Manager** | Publicaciones, plantillas gráficas, redes, noticias |
| **Producer / Caster** | Panel de transmisión, overlays, agente de observador |
| **Analista** (opcional) | Ver estadísticas y reportes, sin editar |
| **Designer** | Plantillas gráficas, biblioteca de media, tomar solicitudes de diseño |
| **Video Editor** | Clips, highlights, VODs, tomar solicitudes de edición |
| **Streamer / Creador oficial** | Co-streaming con overlays oficiales, acceso a assets y calendario de transmisiones |
| **Observer** | Operar el agente de observador en partidas transmitidas |
| **Community Manager** | Discord, anuncios, soporte a equipos |

> El staff de la liga es amplio (streamers, creadores, casters, designers,
> editores, jugadores casuales que ayudan). Por eso los roles son
> **personalizables** y una persona puede tener varios (ej. caster + streamer).

### Roles de equipo
| Rol | Puede |
|-----|-------|
| **Capitán** | Gestionar roster, inscribir a torneos, check-in, reportar resultado, solicitar reprogramación |
| Co-capitán | Lo mismo que capitán excepto disolver el equipo o transferir capitanía |
| Jugador titular / suplente | Ver calendario, hacer su check-in, recibir código |
| Coach / Manager | Ver todo del equipo, sin jugar |

### Roles de usuario general
| Rol | Puede |
|-----|-------|
| Jugador registrado | Perfil, equipos, inscripciones |
| Fan / espectador | Seguir equipos/jugadores, recibir notificaciones, comentar (futuro) |

---

## 5. Modelo de permisos (RBAC granular)

Los roles son **conjuntos de permisos**, no `if (rol === 'admin')` en el código.

- Permiso = `recurso:acción` (ej. `tournament:create`, `match:result.override`,
  `user:ban`, `social:publish`).
- Rol = lista de permisos. Roles del sistema predefinidos + **roles
  personalizados** por organización (útil para el SaaS).
- Permisos con **alcance**: global, organización, torneo (ej. un referee solo de
  un torneo), equipo.
- Validación en **dos capas**: API (guards de NestJS) y base de datos (Row Level
  Security de Postgres/Supabase) como defensa en profundidad.
- Acciones sensibles exigen **confirmación + motivo** y quedan en auditoría.

---

## 6. Flujos clave

### Onboarding de jugador
```
Registro (Discord/Google/correo) → verificar correo → datos básicos
→ vincular Riot → verificar Riot → elegir roles → perfil listo
→ crear equipo / unirse por invitación / marcarse como agente libre
```

### Unirse a un equipo
- Por **invitación** del capitán (link o búsqueda de usuario).
- Por **solicitud** del jugador (el capitán acepta).
- Se valida exclusividad y elegibilidad **al momento** de aceptar.

### Transferir capitanía / disolver equipo
- Transferir: capitán elige nuevo capitán, éste acepta.
- Disolver: solo sin inscripciones activas; el historial queda archivado.
