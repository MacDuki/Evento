# Pantallas y flujos actuales

## Alcance

Este documento describe la interfaz implementada actualmente en `src/client/main.tsx`.
La aplicación es una SPA: no hay rutas URL ni un router; la pantalla visible se
determina por el estado local `view` y por la existencia de `userId` en
`localStorage`.

## Mapa general

```text
Sin userId
└── Onboarding / bienvenida
    └── Entrar a mi espacio
        └── Se crea el perfil local

Con userId
└── App shell
    ├── Mi camino (dashboard)
    ├── Coach reflexivo
    └── Red de apoyo
```

## Pantallas

### 1. Onboarding / bienvenida

- **Cuándo aparece:** cuando no existe `localStorage.userId`.
- **Contenido:**
  - Nombre accesible “En calma”.
  - Mensaje de bienvenida: “La disciplina en calma”.
  - Indicación de espacio privado y local.
  - CTA **Entrar a mi espacio**.
- **Flujo de entrada:**
  1. La persona pulsa **Entrar a mi espacio**.
  2. El cliente ejecuta `POST /api/users`.
  3. Guarda el `id` recibido en `localStorage.userId`.
  4. Pasa al shell principal y muestra el dashboard.
  5. Muestra un aviso de confirmación o error.

**Archivos principales:**

- `src/client/main.tsx`: punto de entrada del cliente.
- `src/client/App.tsx`: creación del perfil y shell de aplicación.
- `src/client/pages/Onboarding/CycleOnboarding.tsx`: flujo de onboarding.
- `src/client/styles/layout.css`: estilos de onboarding y layout.
- `src/components/ui/shimmer-button.tsx`: CTA de entrada.
- `src/server/app.ts`: endpoint `POST /api/users`.
- `src/server/db.ts`: persistencia del usuario.

### 2. App shell / navegación principal

Es el contenedor común de las vistas autenticadas localmente.

- Sidebar con:
  - Marca.
  - Indicador de “Espacio local”.
  - Navegación principal.
  - Estado de conexión: **Sincronizado** o **Sin conexión**.
  - Texto de acompañamiento.
- Barra superior con:
  - Saludo y título de la vista actual.
  - Estado **Conectado** o **Modo local**.
- Avisos globales temporales para éxitos y errores.
- Transición animada entre vistas.

#### Navegación disponible

| Identificador interno | Etiqueta | Destino |
|---|---|---|
| `dashboard` | Mi camino | Dashboard de ciclos |
| `coach` | Coach reflexivo | Reflexión y feedback |
| `contacts` | Red de apoyo | Contactos de responsabilidad |

> En móvil se renderiza también la navegación compacta. El botón visual
> **Abrir navegación** existe, pero actualmente no tiene una acción conectada.

**Archivos principales:**

- `src/client/App.tsx`: shell, estados y avisos.
- `src/client/components/layout/Navigation.tsx`: navegación compartida.
- `src/client/styles/layout.css`: layout responsive y estilos compartidos.
- `src/client/offline.ts`: cola de mutaciones offline.
- `public/sw.js`: service worker registrado por la aplicación.
- `public/manifest.json`: metadatos PWA.

### 3. Mi camino / dashboard

Es la vista inicial después del onboarding. Carga `GET /api/state` y muestra
ciclos y contactos del perfil local.

#### 3.1 Dashboard sin ciclos o sin ciclo activo

- Hero vacío con el mensaje “Empieza aquí”.
- Formulario **Nuevo ciclo**:
  - **Mínimo** en días.
  - **Meta** en días.
  - Botón **Iniciar**.
- Archivo **Tu recorrido**:
  - Estado vacío: “Sin ciclos todavía”.

#### 3.2 Dashboard con ciclo activo

- Hero del ciclo activo con:
  - Número de ciclo.
  - Días limpios calculados desde `start_date`.
  - Porcentaje de avance hacia la meta.
  - Fecha de inicio.
  - Meta.
  - Días restantes.
- Acciones:
  - **Evaluar**: cierra y clasifica el ciclo.
  - **Coach**: cambia a la vista Coach reflexivo.
  - **Detalles**: abre un drawer con días limpios, meta y porcentaje.
- Formulario para iniciar otro ciclo.
- Historial de ciclos con estado:
  - **En curso**.
  - **Completado**.
  - **Fallido**.

#### 3.3 Historial de ciclos

Cada fila muestra:

- Número del ciclo.
- Rango mínimo-meta.
- Estado.
- Para el ciclo activo:
  - **Evaluar**.
  - **Admitir**.

Los ciclos cerrados no muestran acciones de modificación.

**Archivos principales:**

- `src/client/App.tsx`: composición del dashboard, formularios, historial y acciones.
- `src/client/pages/Soul/Soul.tsx`: visualización y personalización de la soul.
- `src/client/styles/layout.css`: hero, progreso, formularios e historial.
- `src/components/ui/drawer.tsx`: panel de detalles del ciclo.
- `src/server/app.ts`: endpoints de estado y ciclos.
- `src/domain/cycle.ts`: validación y evaluación de reglas.
- `src/server/db.ts`: lectura y escritura de ciclos.

### 4. Coach reflexivo

La pantalla permite escribir una reflexión y solicitar una perspectiva. Muestra
el contador, el botón de consulta y el feedback recibido.

**Archivos principales:**

- `src/client/App.tsx`: estado, consulta y feedback.
- `src/client/styles/layout.css`: estilos del panel de reflexión.
- `src/server/app.ts`: endpoint `POST /api/coach/reflection`.
- `src/server/services.ts`: integración con OpenAI y fallback local.
- `src/server/db.ts`: auditoría de la reflexión y respuesta.

### 5. Red de apoyo

La pantalla permite añadir contactos de responsabilidad y consultar la lista
existente.

**Archivos principales:**

- `src/client/App.tsx`: composición del formulario y listado de contactos.
- `src/client/styles/layout.css`: estilos del panel y filas de contactos.
- `src/server/app.ts`: endpoints de contactos y estado.
- `src/server/db.ts`: persistencia de contactos.
- `src/server/services.ts`: notificaciones por correo cuando están habilitadas.

## Flujos funcionales

### Flujo A: crear el primer perfil local

```text
Onboarding
└── Entrar a mi espacio
    ├── Éxito: POST /api/users → guardar userId → dashboard
    └── Error: mostrar aviso y permanecer en onboarding
```

### Flujo B: iniciar un ciclo

```text
Mi camino
└── Completar Mínimo y Meta
    └── Iniciar
        ├── Éxito: POST /api/cycles → recargar estado → ciclo activo visible
        └── Error: mostrar validación/error y conservar formulario
```

El onboarding ofrece dos caminos:

- **Comenzar hoy**: opción principal; el contador empieza con la hora actual del servidor.
- **Comenzar desde una fecha anterior**: opción secundaria; permite elegir una fecha pasada hasta hoy y calcula el ciclo desde ese día.

Reglas aplicadas por el backend:

- El mínimo debe ser un entero positivo.
- La meta debe ser un entero positivo mayor que el mínimo y queda fija después de crear el ciclo.
- El mínimo debe superar estrictamente el mínimo del ciclo anterior.
- El inicio no puede ser futuro y no puede existir otro ciclo activo.

### Flujo C: consultar el progreso

```text
Entrada al shell o creación/cierre de ciclo
└── GET /api/state
    ├── Actualizar ciclos
    ├── Actualizar contactos
    └── Recalcular visualmente días, porcentaje y días restantes
```

Los días limpios no se registran mediante check-ins: se calculan con la
diferencia entre la fecha actual y `start_date`.

### Flujo D: evaluar un ciclo

Disponible desde el hero y desde la fila del ciclo activo.

```text
Evaluar
└── POST /api/cycles/:id/finish
    ├── Meta alcanzada → completado
    ├── Mínimo alcanzado pero meta no alcanzada → resultado con déficit
    ├── Mínimo no alcanzado → fallido
    └── Error → mostrar aviso sin actualizar la interfaz como éxito
```

Después de una respuesta correcta:

1. Se muestra el resultado y los días logrados.
2. Se informa el próximo mínimo o el reinicio base.
3. Se vuelve a consultar el estado.
4. Si corresponde, el servidor puede notificar a los contactos configurados.

### Flujo E: consultar al Coach reflexivo

```text
Coach reflexivo
└── Escribir reflexión
    └── Consultar
        ├── Botón deshabilitado si el texto está vacío
        ├── POST /api/coach/reflection
        ├── Mostrar perspectiva recibida
        └── Mostrar error si la consulta falla
```

- Se muestra contador de caracteres hasta `10000`.
- El Coach solo devuelve orientación; no cambia el estado ni las reglas de
  los ciclos.
- Si OpenAI no está configurado, el servidor devuelve una orientación
  predeterminada.

### Flujo G: administrar la red de apoyo

```text
Red de apoyo
├── Completar Nombre y Correo
│   └── Añadir
│       ├── POST /api/contacts
│       ├── Limpiar formulario
│       └── Recargar lista
└── Consultar contactos existentes
    └── Mostrar avatar inicial, nombre y correo
```

- **Añadir** permanece deshabilitado mientras falte nombre o correo.
- El correo debe ser válido según la validación del backend.
- Si no existen contactos, se muestra “Aún no hay contactos”.
- No existe actualmente una acción de edición o eliminación de contactos.

## Flujos de conectividad

### Estado de conexión

- Al cargar la aplicación se consulta `GET /api/health`.
- Si responde correctamente:
  - Sidebar: **Sincronizado**.
  - Barra superior: **Conectado**.
- Si falla:
  - Sidebar: **Sin conexión**.
  - Barra superior: **Modo local**.

### Operaciones offline

Cuando una operación mutante no puede ejecutarse por falta de conexión:

1. Se guarda la solicitud en `localStorage` bajo
   `abstinencia-offline-queue`.
2. La interfaz no inventa una respuesta de éxito del backend.
3. Al dispararse el evento `online`, se intenta vaciar la cola.
4. Las solicitudes que siguen fallando permanecen en la cola.

Las consultas `GET` no se encolan: si fallan, se muestra el error.

## Estados y overlays transitorios

- **Drawer de detalles del ciclo:** progreso actual, meta y porcentaje.
- **Aviso global:** resultado o error de la última operación; se puede cerrar.
- **Confirmación nativa:** protección antes de admitir un consumo.
- **Feedback del Coach:** aparece debajo del formulario después de una respuesta.
- **Estados vacíos:** sin ciclos y sin contactos.
- **Animaciones:** entrada/salida de vistas, hero, filas del historial y avisos.

## Capacidades no implementadas en la UI actual

- No hay rutas URL profundas ni navegación del navegador por historial.
- No hay login, logout ni cambio de perfil.
- No hay edición/eliminación de ciclos.
- No hay edición/eliminación de contactos.
- No hay pantalla propia de error o de carga.
- No hay configuración visible para SMTP, Web Push u OpenAI.
- El botón de menú móvil no abre/cierra actualmente un panel.
