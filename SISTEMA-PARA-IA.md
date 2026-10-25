# Contexto del sistema para otra IA

## Objetivo

Mantener una PWA local para control de ciclos progresivos. El backend Node/Express/TypeScript con SQLite es la autoridad.

## Invariantes

1. Cada ciclo activo pertenece a un usuario.
2. El mínimo de un ciclo nuevo debe ser estrictamente mayor que el mínimo anterior.
3. La meta siempre supera el mínimo.
4. Los días limpios se calculan desde `start_date`, no mediante check-ins.
5. La IA solo genera orientación; nunca decide consecuencias.
6. “Admitir derrota” marca `failed`, registra auditoría y destruye la progresión.
7. Operaciones críticas deben mantenerse transaccionales e idempotentes.

## Mapa

- `src/domain/cycle.ts`: reglas puras y testeables.
- `src/server/db.ts`: esquema SQLite local.
- `src/server/app.ts`: endpoints y transacciones.
- `src/server/services.ts`: adaptadores OpenAI, correo y Web Push.
- `src/client`: frontend mínimo y service worker.

## Extensión segura

Al cambiar reglas, modificar primero `src/domain/cycle.ts` y sus pruebas. Después actualizar el endpoint, README y este documento. No incorporar secretos ni versiones numéricas fijas en manifests. Cualquier notificación debe ser opcional, explícita e idempotente.
