# Lógica de negocio

## 1. Propósito

La aplicación local permite llevar una progresión de ciclos
de abstinencia. La aplicación registra una `soul` por usuario, mide los días
transcurridos desde el inicio de cada ciclo y decide si la progresión continúa o
se rompe.

La regla de negocio vive en el servidor. El frontend muestra el estado y calcula
datos visuales, pero el servidor es la autoridad para cerrar ciclos, actualizar
la progresión y cambiar el estado de la `soul`.

## 2. Conceptos principales

### Usuario y soul

- Cada usuario se crea desde `POST /api/users`.
- El usuario no tiene autenticación tradicional: el cliente conserva un UUID en
  `localStorage` y lo envía en el header `x-user-id`.
- La `soul` comienza con:
  - nombre: `Soul`;
  - estado: `alive`;
  - máxima pureza histórica: `0` días.
- Una soul viva puede renombrarse.
- Una soul muerta no puede renombrarse.
- La máxima pureza se conserva como el mayor número de días alcanzado; nunca
  disminuye.

### Ciclo

Un ciclo contiene:

- número secuencial (`cycle_number`);
- mínimo obligatorio (`min_clean_days`);
- meta adicional (`target_goal_days`);
- fecha y hora de inicio (`start_date`);
- estado: `active`, `completed` o `failed`;
- déficit acumulado (`deficit_days`);
- fecha de cierre (`ended_at`).

Solo puede existir un ciclo activo operativo por usuario. El frontend busca el
primer ciclo con estado `active` y lo usa como ciclo actual.

### Días limpios

Los días limpios no se cargan mediante check-ins. Se calculan desde
`start_date` hasta el momento de la operación:

```text
max(0, floor((ahora - start_date) / 86.400.000))
```

Por lo tanto, el valor es entero y se redondea hacia abajo. El cliente utiliza
la misma fórmula para mostrar el contador, pero el resultado que decide el
estado siempre es el calculado por el servidor.

## 3. Creación de un ciclo

La creación se realiza con `POST /api/cycles` y requiere:

```json
{
  "minCleanDays": 8,
  "targetGoalDays": 12,
  "startDate": "2026-10-25",
  "endDate": "2026-11-06"
}
```

Validaciones:

1. Ambos valores deben ser enteros positivos.
2. La meta debe ser estrictamente mayor que el mínimo.
3. El mínimo nuevo debe superar estrictamente la máxima pureza histórica de la
   soul.
4. El número del ciclo se calcula como el último número registrado más uno.
5. El `startDate` no puede ser futuro y el ciclo queda `active`.
6. No se puede crear otro ciclo si ya existe uno `active` para el usuario.

La interfaz inicializa los campos con mínimo `1` y meta `2`, pero la validación
definitiva es la del servidor.

## 4. Evaluación de un ciclo

La función pura [`evaluateCycle`](./src/domain/cycle.ts) recibe:

- `previousCleanDays`: máxima pureza previa;
- `minCleanDays`: mínimo del ciclo;
- `targetGoalDays`: meta del ciclo;
- `cleanDays`: días transcurridos en el ciclo actual.

También valida que:

- `previousCleanDays` sea entero no negativo;
- `minCleanDays` sea entero positivo;
- `targetGoalDays` sea entero y mayor que `minCleanDays`;
- `cleanDays` sea entero no negativo.

### Caso A: se alcanza la meta

Si `cleanDays >= targetGoalDays`:

- el resultado es `completed`;
- el déficit es `0`;
- la soul sigue viva;
- no se calcula un mínimo siguiente dentro de la función (`nextMinCleanDays`
  es `null`).

El endpoint que cierra el ciclo traduce ese `null` a `cleanDays + 1` para
crear el próximo ciclo.

### Caso B: se supera el mínimo, pero no la meta

Si `minCleanDays < cleanDays < targetGoalDays`:

```text
deficitDays = targetGoalDays - cleanDays
nextMinCleanDays =
  max(previousCleanDays + 1, cleanDays + deficitDays + 1)
```

El resultado es `completed`, no `failed`, y la soul sigue viva. El siguiente
ciclo se crea automáticamente con el mínimo penalizado calculado.

Como `cleanDays + deficitDays` equivale a la meta original, el mínimo suele ser
la meta original más un día. El `max` además garantiza que no se retroceda
respecto de la máxima pureza histórica.

### Caso C: no se supera el mínimo

Si `cleanDays <= minCleanDays`:

- el resultado es `failed`;
- la soul muere (`soulDies: true`);
- no se calcula un mínimo siguiente;
- el déficit devuelto por la regla pura es `0`.

El servidor marca el ciclo como `failed`, cambia la soul a `dead` y conserva el
historial.

> Nota: la comparación es estricta. Llegar exactamente al mínimo no alcanza:
> para continuar hay que tener más días que `minCleanDays`.

## 5. Cierre normal de ciclo

`POST /api/cycles/:cycleId/finish` solo opera sobre un ciclo activo que
pertenezca al usuario indicado por `x-user-id`. El cierre normal no acepta una
fecha enviada por el cliente: usa la fecha y hora del servidor.

El servidor:

1. calcula los días limpios;
2. obtiene la máxima pureza histórica;
3. evalúa el ciclo con `evaluateCycle`;
4. ejecuta la actualización principal dentro de una transacción;
5. actualiza la máxima pureza con el máximo entre el valor anterior y los días
   del ciclo;
6. registra un evento de auditoría.

Si la evaluación falla:

- el ciclo se marca `failed`;
- la soul pasa a `dead`;
- se registra `soul_died`;
- se intenta notificar a los contactos de responsabilidad;
- no se crea otro ciclo automáticamente;
- la respuesta informa `status: "failed"` y `nextMinCleanDays: null`.

Si la evaluación continúa:

- el ciclo se marca `completed`;
- se guarda el déficit;
- se registra `cycle_consumed`;
- se crea automáticamente el siguiente ciclo `active`;
- el siguiente ciclo conserva el `target_goal_days` del ciclo anterior;
- la respuesta informa `status: "active"` porque ya existe un nuevo ciclo
  activo.

## 6. Admitir consumo

`POST /api/cycles/:cycleId/admit-consumption` representa una admisión
consciente de consumo y también cierra el ciclo activo. Recibe `eventDate` en
formato `AAAA-MM-DD`; debe ser una fecha válida, no futura y no anterior al
inicio del ciclo. El servidor calcula los días para esa fecha y aplica la misma
evaluación de mínimo, meta y penalización.

Si no se supera el mínimo:

- la soul pasa a `dead`;
- el ciclo pasa a `failed`;
- se registra `consumption_admitted`;
- se intenta notificar a los contactos;
- no se crea un ciclo siguiente.

Si se supera el mínimo:

- el ciclo pasa a `completed`;
- se guarda el déficit;
- se registra `consumption_admitted`;
- se crea el ciclo siguiente con el mínimo calculado;
- la soul sigue viva.

La interfaz solicita confirmación antes de enviar esta operación.

## 7. Metas y nombre de la soul

### Renombrar

`POST /api/soul/name` acepta un nombre:

- obligatorio;
- recortado (`trim`);
- de entre 1 y 40 caracteres.

Solo una soul viva puede cambiar de nombre.

### Meta inmutable

La meta se define al crear el ciclo y no puede editarse después. Si se desea
otra meta, debe crearse un nuevo ciclo cuando la progresión lo permita.

## 8. Derrota

No existe un endpoint independiente para admitir derrota. La derrota ocurre
cuando se cierra un ciclo con `cleanDays <= minCleanDays`, o cuando se admite un
consumo bajo esa misma condición.

La regla pura sí contempla el resultado de fallo cuando el ciclo no supera el
mínimo. En ese caso la soul muere y la progresión no continúa automáticamente.

## 9. Coach reflexivo

`POST /api/coach/reflection` recibe una reflexión de entre 1 y 10.000
caracteres y devuelve feedback.

- Si existe `OPENAI_API_KEY`, se consulta el modelo configurado en
  `OPENAI_MODEL` o, por defecto, `gpt-4o-mini`.
- El prompt pide una respuesta empática, firme, breve y orientada a propósito,
  templanza y autocontrol.
- El coach no decide estados, mínimos, déficits ni consecuencias.
- La reflexión y la respuesta se registran en `events_log`.
- Si no existe la clave de OpenAI, se devuelve un mensaje fijo de coach no
  configurado; no se rechaza la operación.

## 10. Red de apoyo y notificaciones

Los contactos se agregan mediante `POST /api/contacts` con nombre no vacío y
correo válido. Se listan junto con el estado general mediante `GET /api/state`.

El correo de responsabilidad solo se intenta cuando:

- `ACCOUNTABILITY_ENABLED=true`;
- existe al menos un contacto;
- están configurados `SMTP_HOST`, `SMTP_USER` y `SMTP_PASSWORD`.

Si la responsabilidad está habilitada pero falta configuración SMTP, la
operación lanza un error. Las notificaciones actuales se disparan al fallar un
ciclo o al admitir consumo cuando la soul muere.

Web Push tiene una función de configuración que valida las claves VAPID cuando
`WEB_PUSH_ENABLED=true`, pero no hay un flujo de envío de notificaciones Push
conectado a los ciclos en el estado actual.

## 11. Persistencia y auditoría

SQLite se inicializa en el archivo de `DATABASE_FILE` o, por defecto,
`./data/abstinencia.sqlite`. Las relaciones principales son:

- `users`: perfil y estado acumulado de la soul;
- `cycles`: progresión y resultado de cada ciclo;
- `accountability_contacts`: contactos del usuario;
- `events_log`: reflexiones, cambios y cierres relevantes;
- `offline_operations`: estructura preparada para operaciones offline del
  servidor, actualmente no utilizada por los endpoints relevados.

Las tablas relacionadas con usuario tienen borrado en cascada donde está
declarado. Las transacciones se usan para actualizar de forma conjunta la soul,
el ciclo siguiente y los eventos de cierre.

## 12. Funcionamiento offline

El cliente registra en `localStorage` las solicitudes mutantes que fallan por
un error de red. Al volver el evento `online`, las reintenta en orden.

- Las solicitudes `GET` no se encolan.
- Una solicitud que recibe una respuesta HTTP de error no se convierte en
  éxito ni se encola: el error se propaga.
- Si una solicitud reintentada vuelve a fallar, permanece en la cola.
- El service worker cachea la carcasa de la aplicación y responde con caché
  para solicitudes `GET` cuando existe.
- El servidor sigue siendo la autoridad cuando la operación finalmente se
  procesa.

## 13. Estados y transiciones

```text
Usuario nuevo
  -> soul alive, sin ciclo

Crear ciclo
  -> ciclo active

Cerrar ciclo con cleanDays >= targetGoalDays
  -> ciclo completed
  -> nuevo ciclo active
  -> soul alive

Cerrar ciclo con minCleanDays < cleanDays < targetGoalDays
  -> ciclo completed con deficit_days
  -> nuevo ciclo active con mínimo penalizado
  -> soul alive

Cerrar o admitir consumo con cleanDays <= minCleanDays
  -> ciclo failed
  -> soul dead
  -> sin nuevo ciclo automático
```

## 14. Archivos de referencia

- Reglas puras y validaciones: [`src/domain/cycle.ts`](./src/domain/cycle.ts)
- Pruebas de reglas: [`src/domain/cycle.test.ts`](./src/domain/cycle.test.ts)
- Endpoints y transacciones: [`src/server/app.ts`](./src/server/app.ts)
- Esquema SQLite: [`src/server/db.ts`](./src/server/db.ts)
- Integraciones de IA, correo y Push: [`src/server/services.ts`](./src/server/services.ts)
- Cliente y flujos de UI: [`src/client/main.tsx`](./src/client/main.tsx)
- Cola offline: [`src/client/offline.ts`](./src/client/offline.ts)
- Service worker: [`public/sw.js`](./public/sw.js)
