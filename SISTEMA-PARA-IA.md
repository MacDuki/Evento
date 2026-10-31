# Contexto del sistema para otra IA

## Objetivo

Mantener una PWA local-first para ciclos progresivos de abstinencia. La app ejecuta la lógica de dominio en el cliente y persiste el progreso en IndexedDB, con espejo en localStorage. El backend Node/Express/TypeScript con SQLite queda como legado opcional para migración o sincización futura; no es necesario para usar la app.

> Las referencias a endpoints `/api`, SQLite y `x-user-id` describen el servidor legado. La implementación activa está en `src/client/services/localStore.ts` y reutiliza `src/domain`.

## Invariantes

1. Un usuario puede tener muchas souls, pero **solo una viva a la vez**.
2. Una soul muerta es permanente: no revive, no se renombra y no inicia ciclos.
3. Un ciclo pertenece a una soul y solo puede haber **un ciclo activo por soul**.
4. Un ciclo **no se cierra al alcanzar la meta**. Solo se cierra al admitir un consumo.
5. El primer ciclo se crea junto con la soul en `POST /api/souls`.
6. Los días limpios se calculan por diferencia de fechas de calendario, no con check-ins.
7. El consumo cierra con éxito solo si `cleanDays > minCleanDays`. Si `cleanDays <= minCleanDays`, la soul muere.
8. El próximo mínimo es `max(cleanDays, metaVigente o 0) + 1`.
9. El déficit es `max(0, metaVigente - cleanDays)`; sin meta es `0`.
10. Las metas son opcionales, tienen historial en `cycle_goals` y solo se amplían cuando la meta vigente ya fue alcanzada.
11. Una meta nueva debe superar `max(cleanDays, minCleanDays)`.
12. Las fechas de negocio son días locales `AAAA-MM-DD`, sin horas.
13. La IA solo genera orientación; nunca decide estados, metas ni consecuencias.
14. Las operaciones críticas son transaccionales. El ciclo siguiente se inserta después de cerrar el actual para respetar el índice único de ciclo activo.
15. El servidor devuelve errores de validación como string en `{ "error": "..." }` para que el cliente pueda mostrarlos.

## Modelo de datos

```text
users
  id, email, password_hash, created_at

souls
  id, user_id, name, status ('alive'|'dead'), max_purity_days,
  created_at, died_at
  índice único parcial: una alive por user_id

cycles
  id, soul_id, cycle_number, min_clean_days, start_date,
  status ('active'|'completed'|'failed'), final_clean_days,
  deficit_days, end_reason, ended_at, next_cycle_id, created_at
  índice único parcial: un active por soul_id
  índice único: (soul_id, cycle_number)

cycle_goals
  id, cycle_id, goal_days, created_at

accountability_contacts
  id, user_id, contact_name, contact_email, created_at

events_log
  id, user_id, soul_id, cycle_id, event_type,
  reflection_text, ai_feedback, event_date, created_at
```

La meta vigente de un ciclo es la última fila de `cycle_goals` ordenada por `created_at` y `rowid`.

## Contrato de estado

`GET /api/state` devuelve:

```json
{
  "today": "2026-10-31",
  "soul": null,
  "souls": [
    {
      "id": "uuid",
      "name": "Aurora",
      "status": "alive",
      "maxPurityDays": 6,
      "storedMaxPurityDays": 5,
      "createdAt": "2026-10-20T...",
      "diedAt": null,
      "cycles": [
        {
          "id": "uuid",
          "cycleNumber": 1,
          "minCleanDays": 3,
          "startDate": "2026-10-20",
          "status": "active",
          "finalCleanDays": null,
          "deficitDays": 0,
          "endReason": null,
          "endedAt": null,
          "nextCycleId": null,
          "plannedEndDate": "2026-10-25",
          "goalDays": 5,
          "goals": [{ "days": 5, "createdAt": "..." }],
          "cleanDays": 11
        }
      ]
    }
  ],
  "contacts": []
}
```

- `soul` es la soul viva o `null`.
- `souls` incluye vivas y muertas, con la viva primero y luego por creación descendente.
- `maxPurityDays` es el máximo efectivo: `max(storedMaxPurityDays, cleanDays del ciclo activo)`.
- `cleanDays` de un ciclo cerrado es `finalCleanDays`.

## Endpoints

| Método | Ruta | Cuerpo / notas |
|---|---|---|
| `POST` | `/api/users` | Crea perfil. No requiere `x-user-id`. |
| `DELETE` | `/api/users/me` | Borra el perfil y sus datos. |
| `GET` | `/api/state` | Estado completo. |
| `POST` | `/api/souls` | `{ name, minCleanDays, goalDays?, startDate? }`. Crea soul + ciclo 1. |
| `GET` | `/api/souls/:id` | Soul propia con ciclos. |
| `POST` | `/api/souls/:id/name` | `{ name }`. Solo soul viva. |
| `POST` | `/api/cycles/:id/goal` | `{ goalDays }`. Fija o amplía meta. |
| `POST` | `/api/cycles/:id/admit-consumption` | `{ eventDate, nextGoalAdditionalDays? }`. Único cierre. |
| `POST` | `/api/coach/reflection` | `{ reflection, cycleId? }`. |
| `POST` | `/api/contacts` | `{ name, email }`. |
| `GET` | `/api/health` | `{ ok: true }`. |

Rutas eliminadas: `POST /api/cycles` y `POST /api/cycles/:id/finish`.

## Reglas puras

`src/domain/cycle.ts`:

- `validateCycleDefinition(minCleanDays, targetGoalDays)`.
- `evaluateConsumption({ minCleanDays, targetGoalDays, cleanDays })`.
- `validateGoal({ minCleanDays, currentGoalDays, cleanDays, newGoalDays })`.

`src/domain/dates.ts`:

- `isValidDateOnly`, `localDate`, `calendarDaysBetween`, `daysSince`, `addCalendarDays`.

Al cambiar una regla, modificar primero estos archivos y sus pruebas. Después actualizar endpoints, UI y documentación.

## Frontend

- `src/client/App.tsx`: estado global, carga, acciones, modales y navegación.
- `src/client/pages/Soul/Soul.tsx`: orbe, panel de estado, personalizador y Memoria.
- `src/client/pages/Onboarding/CycleOnboarding.tsx`: creación de soul con meta opcional.
- `src/client/components/common/EmptySoul.tsx`: home vacío y home de soul muerta.
- `src/client/types.ts`: tipos `Soul`, `Cycle`, `AppState`.
- `src/client/utils/dates.ts`: reexporta las fechas del dominio.

La interfaz está diseñada mobile-first con cinco destinos. `OrbSettings` persiste en `localStorage` el acento global y el estilo, movimiento y tamaño del orbe; el valor inicial es neutro y no modifica las reglas de dominio.

El consumo se registra únicamente desde la pantalla Soul. El modal envía la fecha y la amplitud opcional para la meta del ciclo siguiente.

## Extensión segura

1. Cambiar reglas puras y pruebas.
2. Ajustar el endpoint y la transacción.
3. Ajustar tipos y UI.
4. Actualizar `README.md`, `LOGICA-DE-NEGOCIO.md`, `PANTALLAS-Y-FLUJOS.md` y este documento.
5. Ejecutar `npm test` y `npm run build`.

No incorporar secretos ni versiones numéricas fijas. Cualquier notificación debe ser opcional, explícita e idempotente. El servidor siempre tiene la última palabra.
