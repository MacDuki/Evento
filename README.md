# Abstinencia Progresiva

Aplicación local full-stack para probar un sistema de ciclos progresivos. El servidor es la fuente de verdad: calcula días desde timestamps, aplica el incremento estricto, penaliza el déficit y permite admitir la derrota para destruir la progresión.

## Ejecutar

Requiere Node.js y un gestor de paquetes. No se fijan versiones de dependencias por decisión del proyecto.

```bash
npm install
copy .env.example .env
npm run dev
```

La API queda en `http://localhost:3000` y el frontend de desarrollo en `http://localhost:5173`. Para validar:

El frontend de Vite tiene configurado un proxy `/api` hacia Express en el puerto `3000`; debes iniciar ambos procesos con `npm run dev`. Si ejecutas solamente Vite, las llamadas `/api/*` no podrán responder.

```bash
npm test
npm run build
```

## API principal

- `POST /api/users`: crea un perfil local.
- `GET /api/state`: requiere `x-user-id`.
- `POST /api/cycles`: crea un ciclo; `minCleanDays` debe superar el mínimo anterior y `targetGoalDays` el mínimo.
- `POST /api/cycles/:id/finish`: calcula días limpios y cierra el ciclo con éxito, déficit o fallo.
- `POST /api/cycles/:id/admit-defeat`: destruye la progresión y registra la derrota.
- `POST /api/coach/reflection`: obtiene feedback opcional de OpenAI y lo audita.
- `POST /api/contacts`: registra un contacto de responsabilidad.

## Navegación del frontend

Después de crear el perfil local, la barra de navegación expone todas las capacidades del backend:

- **Ciclos**: crear, consultar, cerrar/evaluar y admitir derrota.
- **Coach Reflexivo**: enviar una reflexión a `POST /api/coach/reflection`.
- **Contactos**: añadir y consultar contactos de responsabilidad mediante `POST /api/contacts` y `GET /api/state`.

El estado de la API se muestra junto al perfil como “API conectada” o “API desconectada”, usando `GET /api/health`.

## Reglas

Si se alcanza la meta, el siguiente mínimo es `cleanDays + 1`. Si se supera el mínimo pero no la meta, `deficit = target - cleanDays` y el siguiente mínimo es mayor que `cleanDays + deficit`. Si no se alcanza el mínimo o se admite la derrota, el ciclo falla y la siguiente secuencia puede comenzar desde un mínimo base de 1.

La IA no modifica estados ni cálculos. SMTP y Web Push solo se activan con sus variables explícitas. Los secretos deben vivir en `.env`.

Cuando no hay conexión, las operaciones mutantes del cliente se guardan en `localStorage` y se reintentan al volver online. El backend sigue siendo la autoridad: una operación rechazada por una regla no se transforma en éxito.
