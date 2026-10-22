# Sistema de Notificaciones

> Documento vivo. Un solo motor de notificaciones, configurable, multicanal y
> con preferencias por usuario. Ningún módulo envía correos o mensajes por su
> cuenta: todos publican **eventos** y el motor decide a quién, por dónde y cómo.

---

## 1. Principio de diseño

```
Módulo (ej. inscripciones) ──publica evento──► Motor de notificaciones
                                                  │
                    reglas de la organización ────┤
                    preferencias del usuario ─────┤
                    plantilla del tipo + idioma ──┤
                                                  ▼
                              Cola de envío por canal (con reintentos)
                         ┌──────────┬──────────┬───────────┬──────────┐
                       In-app     Correo   Discord DM   Web Push   (SMS/WhatsApp)
```

Beneficio: agregar un canal nuevo (ej. WhatsApp) es agregar **un adaptador**, sin
tocar los módulos.

---

## 2. Canales (y por qué no todos al inicio)

| Canal | Costo | Fase | Uso |
|-------|-------|------|-----|
| **In-app** (bandeja en web/PWA) | Gratis | 1 | Todo; es el historial oficial |
| **Correo** | Muy bajo (Resend / SES / SMTP de Supabase para auth) | 1 | Confirmaciones, resúmenes, avisos importantes |
| **Discord DM + canales** | Gratis | 2 | Recordatorios, check-in, códigos. El canal que más se lee |
| **Web Push (PWA)** | Gratis | 2 | Recordatorios de partida en el teléfono |
| **Push nativo** (Expo) | Gratis | Con app móvil | Igual que web push |
| **SMS / WhatsApp** | De pago por mensaje | Opcional, más adelante | Solo urgencias de eventos presenciales/finales |

> Respuesta a tu duda: sí son muchos servicios, por eso se empieza con in-app +
> correo + Discord (prácticamente gratis) y el teléfono queda solo para urgencias.

---

## 3. Catálogo de eventos notificables

### Para jugadores / capitanes
| Evento | Destinatarios | Canales por defecto |
|--------|---------------|---------------------|
| Nuevo torneo publicado (que coincide con su perfil/elegibilidad) | Jugadores elegibles, seguidores de la org | In-app, Discord (canal anuncios) |
| Inscripción recibida / aprobada / rechazada (con motivo) | Capitán + roster | In-app, correo, Discord |
| Invitación a equipo / solicitud aceptada | Jugador / capitán | In-app, Discord |
| Cambio de roster aprobado / rechazado | Capitán | In-app |
| Calendario publicado / partida reprogramada | Roster de ambos equipos | In-app, correo, Discord |
| Recordatorio de partida (T-24h, T-1h) | Roster | Discord, push |
| Check-in abierto / por cerrar | Roster | Discord, push |
| Código de torneo disponible | Capitán (y roster) | Discord DM, in-app |
| Forfeit aplicado | Ambos equipos | In-app, Discord |
| Resultado confirmado | Ambos equipos | In-app, Discord |
| Disputa abierta / resuelta | Partes involucradas | In-app, correo |
| Sanción aplicada | Jugador/equipo | In-app, correo |
| Clasificaste / eliminado / avance de fase | Equipo | In-app, Discord |
| Cambio en el reglamento | Inscritos | In-app, correo |

### Para staff / admins
| Evento | Destinatarios | Canales |
|--------|---------------|---------|
| Nueva inscripción | Tournament managers del evento | In-app, Discord (canal staff) |
| Cupo lleno / lista de espera | Managers | In-app |
| Disputa nueva | Referees asignados | In-app, Discord staff |
| Alerta de integridad (roster no coincide, smurf) | Referees, admins | In-app, Discord staff |
| Partida sin resultado tras X tiempo | Referee | In-app, Discord staff |
| Fallo de integración (Riot, Discord, redes) | Super admin | In-app, correo |
| Publicación en redes falló | Social manager | In-app |

### Para fans / seguidores
- Partido de mi equipo favorito empieza / terminó.
- Mi equipo clasificó.

---

## 4. Configuración (dos niveles)

### Nivel organización (admin)
- Activar/desactivar cada tipo de evento.
- Canales permitidos por tipo.
- **Plantillas editables** por tipo, canal e idioma, con variables
  (`{{team.name}}`, `{{match.scheduled_at}}`, `{{tournament.name}}`) y vista previa.
- Tiempos de recordatorio (ej. 24 h, 1 h, 15 min).
- Por torneo: sobreescribir lo anterior (ej. relámpago solo Discord).

### Nivel usuario
- Elegir canales por categoría (partidas, equipo, anuncios, marketing).
- **Las notificaciones críticas no se pueden desactivar** (código de partida,
  forfeit, sanciones), solo cambiar el canal.
- Horario de silencio (no aplica a notificaciones de partida inminente).
- Marketing/anuncios: **opt-in explícito** (cumplimiento legal).

---

## 5. Reglas técnicas

- **Idempotencia**: un evento no genera notificaciones duplicadas (clave única
  por evento + destinatario + canal).
- **Reintentos con backoff** por canal; dead-letter tras N fallos.
- **Agrupación (digest)**: muchas inscripciones juntas → un resumen para staff.
- **Registro de entrega**: enviado, entregado, leído, fallido (visible en admin).
- **Rate limits** de Discord y del proveedor de correo respetados por la cola.
- Los textos se renderizan en el idioma del usuario (i18n desde el inicio).

---

## 6. Entidades de datos (resumen; ver `03-modelo-datos.md`)

`NotificationType`, `NotificationTemplate`, `NotificationRule`,
`UserNotificationPreference`, `Notification` (bandeja in-app),
`NotificationDelivery` (un registro por canal), `PushSubscription`.
