# Lógica de negocio

## 1. Propósito

La aplicación sostiene una progresión de ciclos de abstinencia organizada alrededor de una **soul**. Una soul vive mientras sus ciclos se cierren con éxito y muere de forma permanente cuando un consumo no supera el mínimo del ciclo.

La regla de negocio vive en `src/domain/cycle.ts` y `src/domain/dates.ts`. La app actual es local-first: el cliente ejecuta esas reglas y guarda el progreso en IndexedDB. Las referencias a la API y a SQLite en este documento describen el servidor legado, conservado para migración y para una futura sincronización.

## 2. Conceptos principales

### Usuario

- Se crea con `POST /api/users`.
- No hay autenticación tradicional: el cliente guarda un UUID en `localStorage` y lo envía en el header `x-user-id`.
- Un usuario puede tener muchas souls a lo largo del tiempo, pero **solo una viva a la vez**.
- Los contactos de responsabilidad pertenecen al usuario, no a una soul concreta.

### Soul

Una soul tiene:

- `id`;
- `name` (1 a 40 caracteres);
- `status`: `alive` o `dead`;
- `max_purity_days`: máxima racha histórica persistida;
- `created_at`;
- `died_at` (fecha de calendario, solo si murió).

El estado inicial es `alive` y la máxima pureza persistida es `0`. Una soul muerta no puede renombrarse, no puede iniciar ciclos y no puede volver a estar viva. Su historial permanece consultable.

La máxima pureza que muestra la interfaz es:

```text
max(max_purity_days, díasLimpiosDelCicloActivo)
```

Así el orbe no queda desactualizado mientras el ciclo sigue abierto. El valor persistido se actualiza al cerrar un ciclo.

### Ciclo

Un ciclo contiene:

- `cycle_number` secuencial dentro de la soul;
- `min_clean_days` obligatorio;
- `start_date` (`AAAA-MM-DD`, día de calendario local);
- `status`: `active`, `completed` o `failed`;
- `final_clean_days` (días logrados al cerrar);
- `deficit_days`;
- `end_reason`: `consumption` cuando corresponde;
- `ended_at` (fecha de calendario del cierre);
- `next_cycle_id` cuando se creó un ciclo siguiente.

Solo puede existir **un ciclo activo por soul**. El primer ciclo se crea junto con la soul.

### Meta

La meta es opcional y vive en `cycle_goals`, no como un campo editable del ciclo. Cada fila registra `goal_days` y `created_at`. La meta vigente es la última fila de ese ciclo.

- Un ciclo puede no tener ninguna meta.
- Se puede fijar una meta en cualquier momento si no existe.
- Una meta existente solo puede ampliarse cuando ya fue alcanzada.
- La nueva meta debe superar los días limpios actuales y el mínimo del ciclo.
- Todo cambio queda auditado en `cycle_goals` y en `events_log`.

### Días limpios

No se cargan check-ins. Se calculan como diferencia de días de calendario:

```text
díasLimpios = max(0, fechaHasta - start_date)
```

El servidor usa la fecha local del servidor para el estado y la fecha elegida por el usuario para registrar un consumo. El cliente usa la misma lógica para mostrar el contador, pero la decisión siempre la toma el servidor.

## 3. Fechas

- Todas las fechas de negocio son `AAAA-MM-DD` y representan un día completo en la zona local.
- No se guardan horas en `start_date`, `ended_at`, `died_at` ni en las metas.
- `created_at` de auditoría sigue siendo un timestamp ISO; no participa de los cálculos de progresión.
- La diferencia se calcula normalizando ambos días a UTC, de modo que los cambios de horario de verano no alteran el número de días.
- Una fecha de inicio no puede ser futura.
- La fecha de consumo debe ser válida, no futura y no anterior al inicio del ciclo.

## 4. Creación de una soul y su primer ciclo

`POST /api/souls` recibe:

```json
{
  "name": "Aurora",
  "minCleanDays": 8,
  "goalDays": 12,
  "startDate": "2026-10-25"
}
```

- `name` es obligatorio.
- `minCleanDays` es un entero positivo.
- `goalDays` es opcional. Si existe, debe ser mayor que el mínimo.
- `startDate` es opcional; por defecto se usa la fecha local actual. No puede ser futura.
- No puede existir otra soul viva para el usuario.

La operación es transaccional:

1. Inserta la soul viva con máxima pureza `0`.
2. Inserta el ciclo `1` en estado `active`.
3. Si hay meta, inserta la primera fila de `cycle_goals`.
4. Registra `soul_created`.

La respuesta incluye la soul completa con sus ciclos y metas. El cliente recarga el estado.

## 5. Reglas de consumo

`POST /api/cycles/:cycleId/admit-consumption` es el **único cierre posible** de un ciclo. Recibe:

```json
{
  "eventDate": "2026-11-04",
  "nextGoalAdditionalDays": 2
}
```

- `eventDate` es obligatoria y debe estar entre `start_date` y la fecha local actual.
- `nextGoalAdditionalDays` es opcional. Es un entero no negativo que se suma al próximo mínimo para definir la meta del ciclo siguiente. Si se omite o vale `0`, el ciclo siguiente nace sin meta.

El servidor calcula `cleanDays = calendarDaysBetween(start_date, eventDate)` y aplica la función pura [`evaluateConsumption`](./src/domain/cycle.ts):

### Caso A: `cleanDays <= minCleanDays`

- El ciclo pasa a `failed`.
- `final_clean_days` guarda los días logrados.
- `deficit_days = max(0, metaVigente - cleanDays)` (o `0` si no hay meta).
- La soul pasa a `dead` y `died_at` guarda la fecha del consumo.
- No se crea un ciclo siguiente.
- Se registran `consumption_admitted` y `soul_died`.
- Se intenta notificar a los contactos si la responsabilidad está configurada.

La comparación es estricta: llegar exactamente al mínimo **no** alcanza.

### Caso B: `cleanDays > minCleanDays`

- El ciclo pasa a `completed`.
- `final_clean_days` guarda los días logrados.
- `deficit_days = max(0, metaVigente - cleanDays)` (o `0` si no hay meta).
- La soul sigue viva y su máxima pureza se actualiza con `max(valorAnterior, cleanDays)`.
- Se crea automáticamente el ciclo siguiente.

El próximo mínimo es:

```text
próximoMínimo = max(cleanDays, metaVigente o 0) + 1
```

El ciclo siguiente:

- empieza en la **fecha del consumo** (`eventDate`);
- tiene `cycle_number = cycleNumber + 1`;
- nace `active`;
- no tiene meta si `nextGoalAdditionalDays` se omite o vale `0`;
- si `nextGoalAdditionalDays > 0`, recibe una meta igual a `próximoMínimo + nextGoalAdditionalDays`.

La creación del ciclo siguiente ocurre dentro de la misma transacción que el cierre, después de marcar el ciclo actual como cerrado para respetar el índice único de ciclo activo por soul.

### Ejemplos

| Mínimo | Meta vigente | Días al consumir | Resultado | Próximo mínimo | Meta siguiente con amplitud 2 |
|---|---|---|---|---|---|
| 8 | 12 | 10 | Completa, déficit 2 | 13 | 15 |
| 8 | 12 | 14 | Completa, déficit 0 | 15 | 17 |
| 8 | 16 (ampliada) | 14 | Completa, déficit 2 | 17 | 19 |
| 8 | — | 10 | Completa, déficit 0 | 11 | 13 |
| 8 | 12 | 8 | Falla, muere | — | — |

## 6. Fijar y ampliar metas

`POST /api/cycles/:cycleId/goal` recibe `{ "goalDays": 14 }` y opera solo sobre un ciclo activo de una soul viva del usuario.

La función pura `validateGoal` aplica:

1. `goalDays` debe ser un entero positivo.
2. Si ya existe una meta y `cleanDays < metaActual`, se rechaza con “Todavía no alcanzaste la meta actual”.
3. `goalDays` debe ser mayor que `max(cleanDays, minCleanDays)`.

Esto permite dos flujos:

- **Ciclo sin meta:** se puede fijar una meta en cualquier momento, siempre que supere los días actuales y el mínimo.
- **Ciclo con meta:** la meta solo puede ampliarse después de alcanzarla. Una meta no puede reducirse, retirarse ni cambiarse por otra menor.

Cada cambio inserta una fila en `cycle_goals`. Los cálculos de consumo usan siempre la última meta registrada.

## 7. Muerte y memoria

La muerte es permanente:

- la soul pasa a `dead`;
- no puede renombrarse;
- no puede tener ciclos activos;
- no se puede “revivir”;
- todos sus ciclos, metas y eventos se conservan;
- el usuario puede crear otra soul, pero solo una estará viva a la vez.

La pantalla Soul muestra una sección **Memoria** con las souls muertas, su máxima pureza, la fecha de muerte y el detalle de sus ciclos. `GET /api/souls/:id` también permite consultar una soul archivada.

## 8. Renombrar

`POST /api/souls/:soulId/name` acepta un nombre:

- obligatorio;
- recortado (`trim`);
- de 1 a 40 caracteres;
- solo para una soul viva del usuario.

El cambio se audita como `soul_renamed`.

## 9. Coach reflexivo

`POST /api/coach/reflection` recibe una reflexión de entre 1 y 10.000 caracteres y devuelve feedback.

- Si existe `OPENAI_API_KEY`, se consulta el modelo configurado en `OPENAI_MODEL` o, por defecto, `gpt-4o-mini`.
- El prompt pide una respuesta empática, firme, breve y orientada a propósito, templanza y autocontrol.
- El coach no decide estados, mínimos, déficits, metas ni consecuencias.
- La reflexión y la respuesta se registran en `events_log`, asociadas al ciclo activo si el cliente lo envía.
- Si no existe la clave de OpenAI, se devuelve un mensaje fijo de coach no configurado; no se rechaza la operación.

## 10. Red de apoyo y notificaciones

Los contactos se agregan con `POST /api/contacts` con nombre no vacío y correo válido. Se listan en `GET /api/state`.

El correo de responsabilidad solo se intenta cuando:

- `ACCOUNTABILITY_ENABLED=true`;
- existe al menos un contacto;
- están configurados `SMTP_HOST`, `SMTP_USER` y `SMTP_PASSWORD`.

En esta versión se intenta notificar cuando un consumo hace morir a la soul. Si la responsabilidad está habilitada pero falta configuración SMTP, la operación de notificación falla y se informa `notificationError`, pero el cierre ya quedó persistido.

Web Push valida las claves VAPID cuando `WEB_PUSH_ENABLED=true`, pero no hay un flujo de envío Push conectado a los ciclos.

## 11. Persistencia y auditoría

SQLite se inicializa en `DATABASE_FILE` o en `./data/abstinencia.sqlite`.

Relaciones:

- `users`: perfil local.
- `souls`: cada soul, viva o muerta; índice único parcial de una viva por usuario.
- `cycles`: ciclos de cada soul; índice único parcial de un activo por soul; número de ciclo único por soul.
- `cycle_goals`: historial de metas de cada ciclo.
- `accountability_contacts`: contactos por usuario.
- `events_log`: auditoría con referencias opcionales a soul y ciclo.
- `offline_operations`: estructura preparada para operaciones offline del servidor, no usada por los endpoints actuales.

Las operaciones que cambian la progresión son transaccionales. Las tablas dependientes usan borrado en cascada.

## 12. Funcionamiento offline

El cliente registra en `localStorage` las solicitudes mutantes que fallan por error de red. Al volver el evento `online`, las reintenta en orden.

- Las solicitudes `GET` no se encolan.
- Una respuesta HTTP de error no se convierte en éxito ni se encola: el error se propaga.
- Si una solicitud reintentada vuelve a fallar, permanece en la cola.
- El servidor sigue siendo la autoridad cuando la operación finalmente se procesa.
- Las operaciones que dependen de un estado que pudo cambiar (por ejemplo, admitir consumo) pueden ser rechazadas al reintentarse; el cliente muestra el error del servidor.
- La apertura usa la copia local del shell (HTML y archivos que referencia) del service worker en [`public/sw.js`](./public/sw.js): no espera a la red. Esa copia se actualiza en segundo plano y la versión nueva se usa en la siguiente apertura. Una respuesta de error de la red no reemplaza la copia.

## 13. Estados y transiciones

```text
Usuario nuevo
  -> sin souls

Crear soul con primer ciclo
  -> soul alive
  -> ciclo 1 active
  -> meta inicial opcional

Fijar meta
  -> cycle_goals agrega una meta
  -> la última meta pasa a ser la vigente

Ampliar meta
  -> solo si cleanDays >= meta vigente
  -> la nueva meta supera cleanDays y el mínimo

Admitir consumo con cleanDays <= mínimo
  -> ciclo failed
  -> soul dead (permanente)
  -> sin ciclo siguiente

Admitir consumo con cleanDays > mínimo
  -> ciclo completed
  -> soul alive
  -> ciclo siguiente active desde eventDate
  -> próximo mínimo = max(cleanDays, meta vigente o 0) + 1
  -> meta siguiente opcional según nextGoalAdditionalDays

Crear otra soul después de una muerte
  -> la soul muerta queda en Memoria
  -> nueva soul alive con ciclo 1
```

## 14. Archivos de referencia

- Reglas puras: [`src/domain/cycle.ts`](./src/domain/cycle.ts)
- Fechas de calendario: [`src/domain/dates.ts`](./src/domain/dates.ts)
- Pruebas de reglas: [`src/domain/cycle.test.ts`](./src/domain/cycle.test.ts)
- Pruebas de fechas: [`src/domain/dates.test.ts`](./src/domain/dates.test.ts)
- Endpoints y transacciones: [`src/server/app.ts`](./src/server/app.ts)
- Esquema SQLite: [`src/server/db.ts`](./src/server/db.ts)
- Integraciones de IA, correo y Push: [`src/server/services.ts`](./src/server/services.ts)
- Cliente: [`src/client/App.tsx`](./src/client/App.tsx)
- Cola offline: [`src/client/offline.ts`](./src/client/offline.ts)
- Service worker: [`public/sw.js`](./public/sw.js)
