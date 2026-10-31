# Pantallas y flujos actuales

## Alcance

Este documento describe la interfaz implementada en `src/client/App.tsx`. La aplicación es una SPA local-first mobile-first: no hay rutas URL ni router; la pantalla visible se determina por el estado local `view`, por la existencia de un perfil en IndexedDB y por el estado de las souls. En móvil, las cinco secciones viven en una barra inferior de vidrio; en pantallas grandes se usa navegación lateral.

> Las menciones a `userId`, `/api` y SQLite corresponden al modo legado. El flujo actual guarda todo en el navegador y permite exportar/importar un respaldo JSON.

## Mapa general

```text
Sin userId
└── Bienvenida
    └── Entrar
        └── Se crea el perfil local

Con userId
├── Cargando
├── Onboarding de soul (si no hay souls y no se salió)
└── App shell
    ├── Hoy
    ├── Soul
    ├── Coach
    ├── Red
    └── Yo
```

## Pantallas

### 1. Bienvenida

- **Cuándo aparece:** no existe un perfil local en IndexedDB.
- **Contenido:** orbe vacío y CTA **Entrar**.
- **Flujo:**
  1. La persona pulsa **Entrar**.
  2. El cliente crea el perfil local y su snapshot vacío.
  3. Recarga el estado. Si no hay souls, aparece el onboarding.

Si existe un `userId` antiguo de la versión con servidor y todavía no hay datos locales, el cliente intenta migrar el estado una vez. Si no hay API disponible, la bienvenida sigue funcionando sin bloquearse.

### 2. Onboarding de soul

Aparece cuando el usuario no tiene ninguna soul y no eligió salir del onboarding. También se abre manualmente al pulsar **Nueva soul** después de una muerte.

Tiene cuatro pasos:

1. **Nombra a tu soul**: nombre obligatorio, máximo 40 caracteres.
2. **Mínimo de días**: entero positivo obligatorio.
3. **Tu meta**: opcional; si se completa, debe superar el mínimo.
4. **Inicio**: **Hoy** o una **Fecha** pasada hasta hoy.

Acciones:

- **Salir** en el primer paso: cierra el onboarding y deja la pantalla Hoy con el orbe vacío.
- **Anterior**: vuelve un paso.
- **Crear**: ejecuta `POST /api/souls` y crea la soul y su primer ciclo en una sola operación.

Ya no se pide una fecha final ni se crea el ciclo con un endpoint separado. La meta puede fijarse después.

**Archivos principales:**

- `src/client/pages/Onboarding/CycleOnboarding.tsx`
- `src/client/App.tsx`
- `src/client/styles/layout.css`
- `src/client/styles/soul.css`

### 3. Hoy

Es la pantalla inicial. El protagonista es el orbe de la soul.

#### 3.1 Soul viva

- Orbe animado con los días limpios.
- Si hay meta, el orbe muestra `díasLimpios / meta` y un anillo de progreso.
- Al tocar el orbe se abre el **panel de estado** desde abajo con:
  - nombre de la soul;
  - número de ciclo;
  - días limpios;
  - mínimo;
  - meta vigente o “—”;
  - máxima pureza;
  - fecha de inicio;
  - historial de metas si hubo más de una.
- El panel se cierra con la X, tocando el fondo o con `Escape`.

#### 3.2 Soul muerta

- Orbe muerto, en gris y con animación reducida.
- Nombre de la última soul muerta.
- Máxima pureza alcanzada.
- CTA **Nueva soul**.
- Enlace **Ver memoria**, que abre la pantalla Soul.

#### 3.3 Sin souls

- Orbe vacío y CTA **Crear**.
- Abre el onboarding.

#### 3.4 Personalización

El panel **Apariencia**, disponible desde Hoy, Soul y Yo, permite cambiar:

- tono de la interfaz: Niebla, Hielo, Lavanda, Cobalto, Ámbar o Rosa;
- estilo del orbe: Líquido (forma original), Prisma, Rombo o Triángulo;
- movimiento: Fluido, Calmo o Pulso;
- tamaño.

La paleta Niebla y el estilo Líquido son los valores iniciales. El tono modifica los acentos de toda la interfaz sin cambiar sus superficies oscuras neutras. Se guarda en `localStorage` bajo `soul-orb-settings`.

### 4. Soul

Es la pantalla de gestión y memoria.

#### 4.1 Soul viva

- Encabezado con nombre, indicador de estado y máxima pureza.
- Botón **Apariencia**.
- Botón de advertencia **Admitir consumo**.
- Botón **Renombrar**.
- Fila de meta:
  - si no hay meta, **Fijar meta**;
  - si la meta ya fue alcanzada, **Ampliar meta**;
  - si todavía no fue alcanzada, un texto con la meta actual y la aclaración de que se puede ampliar al alcanzarla.
- Historial de ciclos de esa soul:
  - número;
  - mínimo → meta (o “—”);
  - días logrados y fecha de inicio;
  - estado: En curso, Completado o Fallido.
- Sección **Memoria** con las souls muertas.

#### 4.2 Soul muerta

- Encabezado con nombre, indicador apagado y máxima pureza.
- Aviso de que la soul ya no puede continuar.
- CTA **Nueva soul**.
- Historial completo de sus ciclos.
- Sección **Memoria**.

#### 4.3 Modal de consumo

Se abre solo desde el botón de advertencia de la pantalla Soul.

Contiene:

- **Fecha del consumo**: entre el inicio del ciclo y hoy.
- **Amplitud de la próxima meta (opcional)**: entero no negativo que se suma al próximo mínimo.
- Texto de ayuda: si se deja vacío, el próximo ciclo empieza sin meta.
- Acciones **Volver** y **Registrar**.

Al confirmar:

- Éxito: se muestra el próximo mínimo y, si corresponde, la próxima meta.
- Muerte: se informa que la soul murió y su memoria queda guardada. La pantalla Hoy pasa a mostrar el estado de muerte.

No existe un botón **Evaluar** ni un cierre sin consumo.

#### 4.4 Modal de meta

Se abre desde **Fijar meta** o **Ampliar meta**.

- Muestra el número que la nueva meta debe superar.
- Campo numérico con sugerencia inicial.
- **Guardar** ejecuta `POST /api/cycles/:id/goal`.
- El servidor puede rechazar la meta si no cumple las reglas; el error se muestra en el aviso global.

#### 4.5 Memoria

Lista las souls muertas, de la más reciente a la más antigua.

- Cada fila muestra nombre, máxima pureza y fecha de muerte.
- Al expandir se ven sus ciclos: número, mínimo → meta, estado, días y fecha de inicio.
- Si no hay souls muertas, se muestra un texto explicativo.

**Archivos principales:**

- `src/client/App.tsx`
- `src/client/pages/Soul/Soul.tsx`
- `src/client/components/common/EmptySoul.tsx`
- `src/client/styles/soul.css`
- `src/server/app.ts`
- `src/domain/cycle.ts`
- `src/domain/dates.ts`

### 5. Coach

Permite escribir una reflexión y pedir una perspectiva.

- Contador de caracteres hasta 10.000.
- Botón **Enviar** deshabilitado si el texto está vacío o hay una consulta en curso.
- La reflexión se envía con el ciclo activo, si existe.
- La respuesta se muestra en un bloque expandible.
- El coach no modifica estados ni reglas.

### 6. Red

Permite agregar contactos de responsabilidad y consultarlos.

- Botón **+** para abrir el formulario.
- Campos nombre y correo.
- La lista muestra avatar con la inicial; al tocar una fila se expande el correo.
- No hay edición ni eliminación de contactos en esta versión.

### 7. Yo

- Foto de perfil local, guardada en `localStorage` como data URL.
- Validación de tipo de imagen y tamaño máximo de 2,5 MB.
- Acceso a la personalización global de la interfaz y del orbe.
- **Respaldo local**: exporta e importa todo el progreso y los ajustes como JSON.
- Botón **Borrar mis datos** con confirmación. Elimina IndexedDB, el espejo en `localStorage` y vuelve a la bienvenida.

## Flujos funcionales

### Flujo A: crear el perfil local

```text
Bienvenida
└── Entrar
    ├── Éxito: crear perfil local en IndexedDB → cargar estado
    └── Error: aviso y permanecer en bienvenida
```

### Flujo B: crear la primera soul y su ciclo

```text
Onboarding
└── Nombre → Mínimo → Meta opcional → Inicio
    └── Crear
        ├── Éxito: guardar soul y primer ciclo en IndexedDB → orbe vivo
        └── Error: aviso con el mensaje de validación
```

### Flujo C: consultar el progreso

```text
Entrada al shell o después de una operación
└── GET /api/state
    ├── soul viva o null
    ├── todas las souls con sus ciclos y metas
    ├── contactos
    └── fecha local del servidor
```

Los días limpios se calculan desde `start_date`, no con check-ins.

### Flujo D: registrar un consumo

```text
Soul
└── Admitir consumo
    └── Elegir fecha y amplitud opcional
        └── Registrar
            ├── cleanDays > mínimo
            │   ├── ciclo completado
            │   ├── próximo ciclo activo desde la fecha del consumo
            │   └── próximo mínimo y meta opcional visibles
            └── cleanDays <= mínimo
                ├── ciclo fallido
                ├── soul muerta
                └── memoria conservada
```

### Flujo E: fijar o ampliar una meta

```text
Soul
├── Sin meta → Fijar meta
└── Meta alcanzada → Ampliar meta
    └── POST /api/cycles/:id/goal
        ├── Éxito: la última meta pasa a ser la vigente
        └── Error: aviso con la regla incumplida
```

### Flujo F: muerte, memoria y nueva soul

```text
Consumo con cleanDays <= mínimo
└── Soul muerta
    ├── Hoy muestra orbe muerto + máxima pureza + Nueva soul
    └── Soul muestra historial + Memoria
        └── Nueva soul
            └── Onboarding → nueva soul viva
```

### Flujo G: consultar al Coach

```text
Coach
└── Escribir reflexión
    └── Enviar
        ├── POST /api/coach/reflection
        ├── Mostrar respuesta
        └── Mostrar error si falla
```

### Flujo H: administrar la red de apoyo

```text
Red
├── + → Nombre y correo → Añadir
│   └── POST /api/contacts → recargar lista
└── Tocar una fila → mostrar correo
```

### Flujo I: borrar todos los datos

```text
Yo
└── Borrar → confirmación
    └── eliminar IndexedDB y el espejo local
        ├── localStorage.clear()
        └── volver a bienvenida
```

## Estado local y respaldo

- IndexedDB alimenta toda la interfaz; el espejo en `localStorage` permite recuperar el último snapshot si IndexedDB no está disponible.
- Si la lectura falla, se muestra un bloque de error con opción **Reintentar**.
- **Yo → Respaldo local** exporta o restaura un JSON con souls, ciclos, metas, contactos y ajustes.
- Los datos no se sincronizan entre dispositivos ni entre orígenes distintos.
- Avisos globales temporales para éxito, error e información.
- Pantalla de carga con orbe mientras se resuelve el estado inicial.
- Overlays: panel de estado, hoja de apariencia, modal de consumo, modal de meta, renombre y confirmación de borrado.

## Capacidades no implementadas

- No hay rutas URL profundas ni navegación por historial del navegador.
- No hay login, logout ni cambio de perfil.
- No hay edición ni eliminación de ciclos.
- No hay edición ni eliminación de contactos.
- No hay pantalla de configuración de SMTP, Web Push u OpenAI.
- No hay envío de notificaciones Push conectado a los ciclos.
