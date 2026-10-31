# En calma

Aplicación local full-stack para sostener ciclos progresivos de abstinencia alrededor de una **soul**. El servidor es la fuente de verdad: calcula los días de calendario, valida las metas, decide si un consumo cierra el ciclo con éxito o hace morir la soul y conserva la memoria de cada soul.

## Ejecutar

Requiere Node.js y un gestor de paquetes. Las versiones de dependencias no se fijan por decisión del proyecto.

```bash
npm install
copy .env.example .env
npm run dev
```

La API queda en `http://localhost:3000` y el frontend de desarrollo en `http://localhost:5173`. Vite redirige `/api` hacia Express; para usar la aplicación deben estar corriendo ambos procesos con `npm run dev`.

Validación:

```bash
npm test
npm run build
```

## Modelo en una mirada

- Un usuario puede tener varias souls, pero **solo una viva a la vez**.
- Cada soul tiene ciclos continuos. Un ciclo **no se cierra al alcanzar la meta**: solo se cierra cuando se registra un consumo.
- Si el consumo ocurre con `díasLimpios <= mínimo`, la soul muere de forma permanente. Si ocurre con `díasLimpios > mínimo`, el ciclo se cierra con éxito y se crea el siguiente automáticamente.
- La meta es opcional. Puede fijarse al crear la soul o más adelante. Una meta existente solo puede ampliarse cuando ya fue alcanzada.
- Las fechas son días de calendario local (`AAAA-MM-DD`), sin horas ni zonas horarias.
- La memoria de las souls muertas se conserva y se consulta desde la sección **Memoria** de la pantalla Soul.

## API principal

Todas las rutas salvo `POST /api/users` y `GET /api/health` requieren el header `x-user-id`.

| Método | Ruta | Uso |
|---|---|---|
| `POST` | `/api/users` | Crea un perfil local. |
| `DELETE` | `/api/users/me` | Borra el perfil y todos sus datos. |
| `GET` | `/api/state` | Devuelve la soul viva, todas las souls, sus ciclos, metas y contactos. |
| `POST` | `/api/souls` | Crea una soul viva y su primer ciclo de forma atómica. |
| `GET` | `/api/souls/:id` | Consulta una soul propia, viva o muerta. |
| `POST` | `/api/souls/:id/name` | Renombra una soul viva. |
| `POST` | `/api/cycles/:id/goal` | Fija una meta nueva o amplía una meta alcanzada. |
| `POST` | `/api/cycles/:id/admit-consumption` | Registra un consumo, cierra el ciclo y crea el siguiente si corresponde. |
| `POST` | `/api/coach/reflection` | Obtiene feedback opcional de OpenAI y lo audita. |
| `POST` | `/api/contacts` | Registra un contacto de responsabilidad. |
| `GET` | `/api/health` | Comprueba que la API responde. |

Ya no existen `POST /api/cycles` ni `POST /api/cycles/:id/finish`: el primer ciclo nace con la soul y el único cierre posible es admitir un consumo.

## Reglas de progresión

Si el ciclo tiene una meta `G` y se registra un consumo con `C` días limpios:

```text
déficit = G no existe ? 0 : max(0, G - C)
```

Si `C <= mínimo`, el ciclo falla y la soul muere. Si `C > mínimo`, el ciclo se completa y el próximo mínimo es:

```text
próximoMínimo = max(C, G o 0) + 1
```

El mismo cálculo se usa aunque la meta se haya ampliado varias veces: se toma la última meta registrada en `cycle_goals`.

Ejemplos:

| Mínimo | Meta | Días al consumir | Resultado | Próximo mínimo |
|---|---|---|---|---|
| 8 | 12 | 10 | Completa, déficit 2 | 13 |
| 8 | 12 | 14 | Completa, déficit 0 | 15 |
| 8 | 16 (ampliada) | 14 | Completa, déficit 2 | 17 |
| 8 | — | 10 | Completa, déficit 0 | 11 |
| 8 | 12 | 8 | Falla, la soul muere | — |

## Navegación del frontend

- **Hoy**: orbe de la soul viva. Al tocarlo se abre el panel con ciclo, días limpios, mínimo, meta, máximo y fecha de inicio. Si la soul murió, se muestra el orbe muerto, su máxima pureza y la CTA **Nueva soul**.
- **Soul**: identidad, renombre, máximo histórico, historial de ciclos, acciones de meta y consumo. Incluye **Memoria**, donde se consultan las souls muertas y sus ciclos.
- **Coach**: reflexión libre y feedback opcional. El coach no altera estados ni reglas.
- **Red**: contactos de responsabilidad.
- **Yo**: foto local y borrado completo de los datos.

El consumo se registra únicamente desde la pantalla Soul, con el botón de advertencia. El modal permite elegir la fecha y una amplitud opcional para la meta del ciclo siguiente. Si la amplitud queda vacía, el ciclo siguiente nace sin meta.

## Persistencia

SQLite se inicializa en `DATABASE_FILE` o en `./data/abstinencia.sqlite`. Entidades principales:

- `users`, `souls`, `cycles`, `cycle_goals`, `accountability_contacts`, `events_log`, `offline_operations`.

Las operaciones críticas —crear soul, fijar meta, admitir consumo y crear el ciclo siguiente— son transaccionales. Las tablas dependientes usan `ON DELETE CASCADE` para que borrar un usuario elimine su rastro.

### Reinicio de la base local

Esta versión cambia el esquema respecto de la anterior. Para reiniciar los datos locales, con la aplicación detenida:

```powershell
Copy-Item data/abstinencia.sqlite data/abstinencia.sqlite.bak
Remove-Item data/abstinencia.sqlite
```

Al arrancar de nuevo, SQLite recrea las tablas. Si `localStorage.userId` apunta a un usuario que ya no existe, la aplicación descarta ese identificador y vuelve a la bienvenida.

## Reglas de autoridad

El servidor calcula y valida; el cliente solo muestra y solicita. La IA no modifica estados ni cálculos. SMTP y Web Push solo se activan con variables explícitas. Los secretos viven en `.env`.

Cuando no hay conexión, las operaciones mutantes del cliente se guardan en `localStorage` y se reintentan al volver online. Una respuesta HTTP de error nunca se transforma en éxito: el backend sigue siendo la autoridad.

## Documentación

- [`LOGICA-DE-NEGOCIO.md`](./LOGICA-DE-NEGOCIO.md): modelo, reglas y endpoints.
- [`PANTALLAS-Y-FLUJOS.md`](./PANTALLAS-Y-FLUJOS.md): UI y flujos reales.
- [`SISTEMA-PARA-IA.md`](./SISTEMA-PARA-IA.md): invariantes y guía de extensión.
- [`DECISIONES.md`](./DECISIONES.md): decisiones de producto y arquitectura.
