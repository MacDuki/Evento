# Decisiones de producto y arquitectura

Registro de las decisiones acordadas para esta versión. Cada entrada explica qué se decidió, por qué y qué alternativa se descartó.

## 1. Ciclos continuos, sin cierre por meta

**Decisión:** la meta es un hito de progreso, no un cierre. Un ciclo solo termina cuando se registra un consumo.

**Motivo:** el objetivo del producto es sostener la abstinencia, no “ganar” un ciclo. Cerrar al alcanzar la meta permitía reiniciar artificialmente la racha y diluía la consecuencia del consumo.

**Descartado:** cerrar el ciclo al llegar a la meta y abrir otro automáticamente con un mínimo mayor.

## 2. El consumo es el único mecanismo de cierre

**Decisión:** eliminar `POST /api/cycles/:id/finish` y el botón **Evaluar**. El único cierre es `POST /api/cycles/:id/admit-consumption`.

**Motivo:** un cierre sin consumo no representa un evento real y permitía “evaluar” sin consecuencias. La interfaz anterior ya no llamaba a `finish`, así que el endpoint era código muerto.

**Descartado:** mantener un cierre manual para “reiniciar” el ciclo.

## 3. Comparación estricta con el mínimo

**Decisión:** el consumo cierra con éxito solo si `cleanDays > minCleanDays`. Si `cleanDays <= minCleanDays`, la soul muere.

**Motivo:** el mínimo es una barrera, no un empate. La regla estricta evita que llegar justo al límite se perciba como suficiente.

**Descartado:** `cleanDays >= minCleanDays`.

## 4. Próximo mínimo basado en lo logrado y la última meta

**Decisión:** `próximoMínimo = max(cleanDays, metaVigente o 0) + 1`. Sin meta, `cleanDays + 1`.

**Motivo:** el próximo ciclo debe exigir más que lo ya logrado y más que la meta vigente, incluso si la meta fue ampliada. Esto evita retrocesos y conserva la progresión.

**Ejemplos acordados:**

- Mínimo 8, meta 12, consumo a los 10 → próximo mínimo 13.
- Mínimo 8, meta 12, consumo a los 14 → próximo mínimo 15.
- Meta ampliada a 16, consumo a los 14 → próximo mínimo 17.

**Descartado:** usar solo `cleanDays + 1` (permitía que una meta ampliada no dejara huella) y usar `meta + 1` sin considerar los días logrados (permitía retroceder si se superaba la meta).

## 5. Déficit informativo

**Decisión:** `déficit = max(0, metaVigente - cleanDays)` si existe meta; si no, `0`.

**Motivo:** el déficit describe cuánto faltó para la meta, pero no cambia la muerte ni el próximo mínimo. Sin meta, el déficit no tiene sentido.

## 6. Meta opcional desde el primer ciclo

**Decisión:** la meta puede quedar vacía al crear la soul y puede fijarse después.

**Motivo:** una persona puede querer empezar solo con un mínimo y definir un objetivo más adelante. Obligar a una meta agrega fricción y una decisión que todavía no está madura.

**Descartado:** exigir meta en el primer ciclo y en cada ciclo nuevo.

## 7. Metas con historial y ampliación condicionada

**Decisión:**

- Sin meta: se puede fijar una en cualquier momento.
- Con meta: solo se puede ampliar cuando ya fue alcanzada.
- La nueva meta debe superar `max(cleanDays, minCleanDays)`.
- Cada cambio se guarda en `cycle_goals`; la última meta es la vigente.

**Motivo:** permitir bajar o cambiar la meta a mitad de camino vacía el compromiso. El historial permite auditar la progresión y calcular el próximo mínimo con la meta real.

**Descartado:** una meta inmutable por ciclo (no permitía ajustar el objetivo) y una meta editable sin restricciones (permitía autoengaño).

## 8. Ciclo siguiente automático con amplitud opcional

**Decisión:** al cerrar con éxito, el servidor crea el ciclo siguiente en la misma transacción. Empieza en la fecha del consumo. El modal de consumo permite una **amplitud** opcional que se suma al próximo mínimo para definir la meta del ciclo siguiente. Si se deja vacía, el ciclo nace sin meta.

**Motivo:** el ciclo siguiente debe existir sin pasos extra para que la progresión no se interrumpa. La amplitud permite elegir el nuevo objetivo en el mismo momento de la recaída, cuando la decisión está presente.

**Descartado:** pedir todos los datos del ciclo siguiente en una pantalla aparte y crear el ciclo con la meta del anterior (el bug original).

## 9. Muerte permanente y múltiples souls

**Decisión:** al morir, la soul no revive. El usuario puede crear otra soul, pero solo una puede estar viva a la vez. Toda la información de la soul muerta se conserva.

**Motivo:** la muerte debe tener peso. Permitir revivir o borrar la soul diluye la consecuencia. Conservar la memoria permite aprender y consultar el recorrido.

**Descartado:** revivir la soul, borrar automáticamente sus datos o permitir varias souls vivas en paralelo.

## 10. Memoria dentro de la pantalla Soul

**Decisión:** las souls muertas se consultan en una sección **Memoria** dentro de la pantalla Soul. No se crea una pantalla de navegación nueva.

**Motivo:** la navegación ya tiene cinco destinos y la memoria es información de la soul, no una función principal separada.

**Descartado:** una pestaña “Memoria” en la barra principal.

## 11. Fechas de calendario local

**Decisión:** `start_date`, `ended_at`, `died_at` y las fechas de consumo son `AAAA-MM-DD` locales, sin horas. Los cálculos usan días de calendario.

**Motivo:** el producto razona en días, no en instantes. Usar timestamps UTC generaba desfases cerca de la medianoche y hacía que el contador dependiera de la hora.

**Descartado:** timestamps ISO para las fechas de negocio.

## 12. Máxima pureza efectiva

**Decisión:** `souls.max_purity_days` se actualiza al cerrar un ciclo. La API devuelve `maxPurityDays = max(stored, cleanDays del ciclo activo)` para que la interfaz no quede atrasada mientras el ciclo sigue abierto.

**Motivo:** el usuario ve su mejor racha en tiempo real, pero el valor persistido sigue siendo una foto de cierres.

## 13. Home centrado en la soul

**Decisión:** la pantalla Hoy muestra el orbe como protagonista y el acceso al panel de datos. Las demás funciones viven en sus pantallas existentes.

**Motivo:** el producto es la soul, no un dashboard de métricas. El detalle se consulta al tocar el orbe.

**Descartado:** agregar tarjetas, gráficos o formularios de ciclo en el home.

## 14. El servidor es la autoridad

**Decisión:** el servidor valida y decide. El cliente puede calcular datos visuales, pero no cierra ciclos ni cambia estados por su cuenta. La cola offline no convierte errores HTTP en éxitos.

**Motivo:** consistencia y confianza. Un cliente offline o manipulado no debe poder alterar la progresión.

## 15. Reinicio de la base local

**Decisión:** esta versión cambia el esquema. La base local se respalda y se reinicia. Los datos anteriores no se migran.

**Motivo:** el modelo anterior guardaba la soul dentro de `users` y no tenía `souls`, `cycle_goals` ni múltiples souls. Una migración compleja no aportaba valor sobre datos de prueba.

**Operación realizada:** copia de `data/abstinencia.sqlite` y recreación del archivo.

## 16. Documentación y validación

**Decisión:** actualizar `README.md`, `LOGICA-DE-NEGOCIO.md`, `PANTALLAS-Y-FLUJOS.md`, `SISTEMA-PARA-IA.md` y crear este registro. Validar con pruebas unitarias y build.

**Motivo:** los documentos describían la versión anterior (meta obligatoria, cierre por meta, endpoint `finish`, formulario de ciclos en el home) y habrían inducido a error a la próxima persona o IA que trabajara en el proyecto.

**Alcance de pruebas:** pruebas unitarias de reglas y fechas, más `npm run build`. No se agregaron pruebas de endpoints.

## 17. Apertura desde la copia local del shell

**Decisión:** el service worker responde las navegaciones con el HTML guardado y actualiza esa copia, junto con los archivos que referencia, en segundo plano. Una respuesta de error de la red no reemplaza la copia guardada. `index.html` muestra un fondo oscuro y un orbe de carga antes de que cargue el JavaScript.

**Motivo:** cada apertura esperaba a la red antes de dibujar nada. Con señal lenta o inestable la app quedaba en pantalla blanca todo ese tiempo, aunque sus archivos ya estuvieran en el teléfono. El estado vive en IndexedDB, así que abrir la app no necesita la red.

**Descartado:** red primero sin límite de tiempo (comportamiento anterior) y red primero con timeout, que en cada apertura con señal regular sigue dependiendo de la red.

## 18. Pantalla de inicio negra y entrada escalonada del home

**Decisión:** en iPhone, la app instalada usa imágenes de inicio negras (`public/splash/`, `apple-touch-startup-image`) y barra de estado translúcida. El loader y el HTML inicial comparten las mismas clases, para que el orbe no cambie de lugar entre ambos. Al terminar la carga, el orbe del home se desplaza desde la posición del loader y los demás bloques suben en secuencia con la misma curva.

**Motivo:** iOS muestra una pantalla de inicio blanca al abrir una app instalada cuando no hay imagen para ese modelo. Los saltos venían de que el orbe cambiaba de lugar entre loader y home, de que la brújula medía sus marcas después de pintar y de que todo el bloque aparecía de golpe. Las animaciones usan solo `transform` y `opacity`, que el navegador resuelve en el compositor, así que el bucle de la frase en el hilo principal las afecta menos.

**Descartado:** animar la entrada con `motion` en JavaScript (`x`, `y`, `scale`), que compite con el hilo principal, y animar el contenedor completo, que mueve todo como un bloque.
