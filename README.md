# En calma

Aplicación **local-first** para sostener ciclos progresivos de abstinencia alrededor de una **soul**. El progreso se guarda en el navegador y la app funciona sin backend.

- Persistencia principal: **IndexedDB** (base `en-calma`, registro `app`).
- Espejo de recuperación: **localStorage** (`en-calma-state-v1`).
- Ajustes visuales y foto de perfil: `localStorage`.
- Respaldo manual: exportación e importación de un archivo JSON desde **Yo → Respaldo local**.

No requiere cuenta, servidor ni conexión una vez cargada. Los datos pertenecen al navegador y al origen exacto donde se abra la app.

## Ejecutar

Requiere Node.js y un gestor de paquetes.

```bash
npm install
npm run dev
```

La app queda disponible en `http://localhost:5173`. No hace falta crear un `.env`.

Validación:

```bash
npm test
npm run build
```

La build estática se genera en `dist/client`.

## Migrar datos del servidor anterior

La versión anterior guardaba el progreso en Express + SQLite. El cliente nuevo intenta migrarlo automáticamente una sola vez si encuentra un `userId` antiguo en `localStorage` y no hay datos locales.

Para hacer esa migración con la API anterior disponible:

```bash
npm run dev:full
```

Abrí la app, verificá que aparezcan tus souls y después podés volver a `npm run dev`. El servidor queda como legado opcional; la app local no lo usa.

## Modelo en una mirada

- Un usuario puede tener varias souls, pero **solo una viva a la vez**.
- Cada soul tiene ciclos continuos. Un ciclo **no se cierra al alcanzar la meta**: solo se cierra cuando se registra un consumo.
- Si el consumo ocurre con `díasLimpios <= mínimo`, la soul muere de forma permanente. Si ocurre con `díasLimpios > mínimo`, el ciclo se cierra con éxito y se crea el siguiente automáticamente.
- La meta es opcional. Puede fijarse al crear la soul o más adelante. Una meta existente solo puede ampliarse cuando ya fue alcanzada.
- Las fechas son días de calendario local (`AAAA-MM-DD`), sin horas ni zonas horarias.
- La memoria de las souls muertas se conserva y se consulta desde la sección **Memoria** de la pantalla Soul.

## Reglas de progresión

Si el ciclo tiene una meta `G` y se registra un consumo con `C` días limpios:

```text
déficit = G no existe ? 0 : max(0, G - C)
```

Si `C <= mínimo`, el ciclo falla y la soul muere. Si `C > mínimo`, el ciclo se completa y el próximo mínimo es:

```text
próximoMínimo = max(C, G o 0) + 1
```

El mismo cálculo se usa aunque la meta se haya ampliado varias veces.

| Mínimo | Meta | Días al consumir | Resultado | Próximo mínimo |
|---|---|---|---|---|
| 8 | 12 | 10 | Completa, déficit 2 | 13 |
| 8 | 12 | 14 | Completa, déficit 0 | 15 |
| 8 | 16 (ampliada) | 14 | Completa, déficit 2 | 17 |
| 8 | — | 10 | Completa, déficit 0 | 11 |
| 8 | 12 | 8 | Falla, la soul muere | — |

La lógica pura vive en `src/domain/cycle.ts` y `src/domain/dates.ts`; el almacenamiento local la reutiliza sin depender del servidor.

## Navegación

- **Hoy**: home mobile-first con el orbe como protagonista, fecha, frase y brújula de días. Al tocar el orbe se abre el panel con ciclo, días limpios, mínimo, meta, máximo y fecha de inicio.
- **Soul**: identidad, renombre, máximo histórico, historial de ciclos, acciones de meta y consumo. Incluye **Memoria**.
- **Coach**: reflexión libre con respuesta local. No altera estados ni reglas.
- **Red**: contactos de responsabilidad.
- **Yo**: foto local, personalización del orbe y **Respaldo local**.

La apariencia parte de una paleta neutra oscura. Se puede elegir entre seis acentos, cuatro estilos de orbe y tres movimientos; los ajustes se guardan localmente.

## Respaldo y datos

El archivo exportado contiene:

- perfil local,
- souls,
- ciclos,
- metas,
- contactos,
- ajustes visuales.

Para restaurar, usá **Yo → Importar**. El respaldo reemplaza los datos actuales, así que conviene exportar antes de importar otro archivo.

Cosas importantes:

- Los datos se guardan por navegador y por origen. `localhost`, `usuario.github.io/repo` y un dominio propio son almacenamientos distintos.
- Si el usuario borra los datos del sitio, se pierde el progreso guardado.
- No hay sincronización entre dispositivos.
- Para conservar el progreso, exportá un respaldo antes de cambiar de navegador, de URL o de dispositivo.

## Publicar en GitHub Pages

El proyecto ya incluye `.github/workflows/deploy.yml` y usa rutas relativas para funcionar en un subdirectorio (`usuario.github.io/repo`).

1. Subí el repositorio a GitHub.
2. En **Settings → Pages**, elegí **Source: GitHub Actions**.
3. Hacé push a `main` o ejecutá el workflow manualmente.

El workflow instala dependencias, corre `npm run build` y publica `dist/client`.

GitHub Pages solo sirve archivos estáticos; es suficiente porque esta versión no necesita API ni base de datos remota.

## Servidor legado (opcional)

Los archivos `src/server.ts` y `src/server/*` se conservan para migración y para una futura sincronización. La API anterior expone rutas bajo `/api` y usa SQLite en `DATABASE_FILE` o `./data/abstinencia.sqlite`.

```bash
npm run dev:full
# o
npm start
```

Variables opcionales del servidor: `OPENAI_API_KEY`, `OPENAI_MODEL`, SMTP (`SMTP_HOST`, `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM`) y Web Push (`WEB_PUSH_ENABLED`, claves VAPID). Nada de esto es necesario para la app local.

## Documentación

- [`LOGICA-DE-NEGOCIO.md`](./LOGICA-DE-NEGOCIO.md): modelo, reglas y endpoints.
- [`PANTALLAS-Y-FLUJOS.md`](./PANTALLAS-Y-FLUJOS.md): UI y flujos reales.
- [`SISTEMA-PARA-IA.md`](./SISTEMA-PARA-IA.md): invariantes y guía de extensión.
- [`DECISIONES.md`](./DECISIONES.md): decisiones de producto y arquitectura.
