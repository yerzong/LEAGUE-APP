# Legal y Cumplimiento — League App

> Documento vivo. Reglas que no se pueden ignorar: romperlas puede costar la
> licencia de Riot o problemas legales. NO es asesoría legal profesional —
> para la constitución de la empresa y temas fiscales, consultar a un abogado.

---

## 1. Licencia de competición de comunidad (Riot Games)

En agosto de 2026 Riot reescribió sus **Community Competition Guidelines** (primera
revisión desde 2020), unificando todo en una sola **Community Competition License**.

Cambios clave a favor del proyecto:
- En la mayoría de casos **ya no se requiere aprobación previa** de Riot; basta
  registrar el evento en su formulario de visibilidad.
- Se **eliminaron los topes** a cuotas de inscripción, premios, patrocinios y venta
  de entradas.

Fuentes:
[lolesports.com](https://lolesports.com/en-us/news/lol-esports-community-competition-guidelines),
[invenglobal.com](https://www.invenglobal.com/articles/24453/lol-amateur-and-event-tournaments-no-longer-require-riot-approval),
[sheepesports.com](https://www.sheepesports.com/en/articles/riot-games-simplifies-community-tournament-rules-though-new-competition-guidelines/en).

> Contenido reformulado para cumplir con restricciones de licencia de las fuentes.

### Advertencias importantes
- La licencia es **revocable, personal, no transferible y limitada.** Hay que
  cumplir las condiciones de forma continua.
- Las reglas tienen **variaciones por región.** Confirmar la variante que aplica al
  país de operación ANTES de lanzar.
- Mantener el **registro de visibilidad al día** cada vez que se opera un evento.

---

## 2. Patrocinadores prohibidos

Riot prohíbe ciertos patrocinadores. NO aceptar:
- Casas de apuestas / gambling.
- Criptomonedas y blockchain no regulados.
- Cualquier categoría que las guidelines de la región marquen como prohibida.

Verificar la lista vigente antes de cerrar cualquier patrocinio.

---

## 3. Uso de la propiedad intelectual de Riot

Reglas del Riot Developer Portal y de marca:
- Solo se pueden usar los assets permitidos (press kit, datos estáticos del juego).
- El producto **no puede parecerse** a los juegos/productos de Riot en estilo o
  función (no clonar su branding).
- **Disclaimer obligatorio**, visible para los usuarios:

  > [Nombre del producto] no está respaldado por Riot Games y no refleja las
  > opiniones o puntos de vista de Riot Games ni de nadie oficialmente involucrado
  > en la producción o gestión de las propiedades de Riot Games. Riot Games y todas
  > las propiedades asociadas son marcas comerciales o marcas registradas de Riot
  > Games, Inc.

Fuente: [developer.riotgames.com](https://developer.riotgames.com/docs/lol).

---

## 4. Riot API — condiciones de uso

- **Registrar la aplicación** en el Developer Portal (obligatorio si sirve a
  jugadores, use o no APIs oficiales).
- **Production API Key**: se solicita presentando un prototipo funcional; la
  aprobación no es inmediata ni garantizada.
- Prohibiciones: **nada de cripto/blockchain**, no actuar como **"data broker"**
  entre la API de Riot y terceros, no clonar sus productos.
- Respetar **rate limits** y las condiciones de uso de los datos.

> Diseño: toda integración con Riot va detrás de una capa de abstracción para que
> la liga opere aunque la key tarde o se revoque (ver `06-riot-integracion.md`).

---

## 5. Datos personales y privacidad

Al manejar datos de jugadores (nombres, cuentas, correos, edades):
- **Política de privacidad** y **términos de servicio** propios, públicos.
- Base legal para el tratamiento (consentimiento al inscribirse).
- Cumplir la normativa del país de operación (ej. LFPDPPP en México, GDPR si hay
  usuarios en la UE).
- **Menores de edad:** muchos jugadores amateur son menores. Definir política de
  edad mínima y, si aplica, consentimiento parental. Punto sensible, tratar con
  cuidado.
- Minimización: recolectar solo los datos necesarios para operar.
- Seguridad: cifrado de secretos, no exponer PII, control de acceso.

---

## 6. Constitución de la marca / empresa

A definir con asesoría profesional (no cubierto por este documento):
- Figura legal (persona física con actividad empresarial, sociedad, etc.).
- Facturación e impuestos según el país.
- Contratos con patrocinadores, jugadores y staff.
- Gestión de premios en efectivo (implicaciones fiscales).
- Propiedad de la marca (registro de nombre y logo).

---

## 7. Código de conducta y reglamento

- **Reglamento oficial** por torneo (elegibilidad, formato, sanciones, disputas).
- **Código de conducta** (anti-toxicidad, anti-trampa, respeto).
- **Proceso de disputas** claro y documentado.
- **Términos de participación** aceptados al inscribirse.

---

## 8. Checklist antes de lanzar un torneo

- [ ] Evento registrado en el formulario de visibilidad de Riot (variante regional).
- [ ] Disclaimer de Riot visible en web y materiales.
- [ ] Reglamento y código de conducta publicados.
- [ ] Términos y política de privacidad accesibles.
- [ ] Patrocinadores verificados contra la lista de prohibidos.
- [ ] Política de edad mínima / consentimiento definida.
- [ ] App registrada en el Developer Portal (si se usan APIs/datos).
