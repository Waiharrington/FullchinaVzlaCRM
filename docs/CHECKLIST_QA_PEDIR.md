# Tablero vivo de QA — `/pedir`

**Referencia de diseño:** [fullchinavzla.vercel.app/pedir](https://fullchinavzla.vercel.app/pedir)  
**Entorno de escritura:** local con `?modoPrueba=1`; sin staging Supabase.  
**Última actualización:** 2026-11-14  
**Regla de trabajo:** mantener un solo punto en `EN CURSO`. Para avanzar, cerrar el punto con evidencia reproducible o anotar el bloqueo concreto y su dependencia. No se registran pedidos reales ni se modifica producción.

## Estado actual

| # | Estado | Punto de control | Evidencia / criterio de cierre |
|---:|---|---|---|
| 0 | **RESUELTO** | Hacer visible el orden de trabajo y el avance | Este tablero creado; lista priorizada, un solo punto activo y registro de cambios. |
| 1 | **RESUELTO** | Cerrar la confusión entre la vista previa antigua y el flujo actual de prueba | Confirmación local observada como “Prueba local completada” con el panel de éxito actual; indica que no se registró en Full China ni se envió por WhatsApp. Código local toma una ruta de guardado sintético; el modo solo existe en desarrollo. |
| 2 | **RESUELTO** | Comparar la carta publicada con la copia local usando la URL correcta | Inspección de `https://fullchinavzla.vercel.app/pedir`; carta publicada y local muestran la navegación, categorías, tarjetas y carrito actuales al mismo tamaño de escritorio. En móvil 390×844 también se había comparado la misma variante responsive en la revisión previa. |
| 3 | **RESUELTO** | Mostrar con veracidad si la confirmación se asoció a un perfil local | Probadas ambas ramas: como invitado, la confirmación indica que no guardó; con el perfil local `V-8675309`, el pedido `PRUEBA-76CDF8` aparece en pedidos recientes e historial, con artículo `Pa’ Mí` y un sello. Pruebas enfocadas, lint y build pasan. |
| 4 | **EN CURSO** | Probar variantes del catálogo, una por una y con carrito limpio | Cerradas las variantes de arroz, `Dúo` y las dos opciones de `Trío` a USD 5,99. La revisión conserva acentos en “Clásico” y “Con Camarón”. `PRUEBA-0B45ED` asociado al perfil; segundo pedido `PRUEBA-DD0D8A` se hizo tras recarga con sesión local cerrada intencionalmente y quedó como invitado. Siguiente caso activo: Promo Imperdible. |
| 5 | **PENDIENTE** | Completar checkout en escritorio y móvil | Retiro y Delivery por separado; datos y notas; edición desde resumen; total, dirección/cobertura y errores de validación; confirmar solo en modo local. |
| 6 | **PENDIENTE** | Completar cuenta de cliente e historial | Crear cuenta sintética, entrar/salir, autorrelleno, asociar pedido, recargar, abrir historial, revisar artículos/notas y repetir pedido. En una prueba inicial, el checkout mostró campos vacíos. En la siguiente vuelta conservó los datos escritos previamente. La prueba local cierra la sesión sintética después de recargar; al intentar asociar `PRUEBA-DD0D8A`, el sistema informó correctamente que era invitado. Verificar reingreso y una compra asociada al historial local. |
| 7 | **PENDIENTE** | Revisar errores y casos límite | Catálogo vacío/no disponible, modificador que deja de estar disponible, datos incompletos, evitar duplicados y limpiar el ensayo sin afectar otros datos. |
| 8 | **PENDIENTE** | Cierre técnico y de cobertura | Build, lint y suite; capturas a 390×844 y 1280 px; anotar lo que requiere staging o teléfono físico antes de declarar entrega. |

## Punto activo: #4 — variantes del catálogo

**Caso anterior cerrado: arroz individual `Trío` — primer agregado con opción obligatoria**  
Se reprodujo el fallo: el detalle nuevo heredaba el estado de edición anterior. Se corrigió limpiando `editingCartLineKey` al cerrar el detalle. Repetición: `Trío` abrió como agregado nuevo, exigió una opción, aceptó “Clásico”, entró al carrito por USD 5,99 y pasó al resumen. Pedido local `PRUEBA-0B45ED` se confirmó sin enviarse; perfil/historial muestra 1 × Trío, USD 5,99, opción “Clasico” y +1 sello. Nota de seguimiento para #6: el historial omite el acento en “Clásico”.

**Caso anterior cerrado #4k: Trío — opción obligatoria “Con Camarón”**. Con carrito vacío, la segunda opción quedó seleccionada sola y conservó USD 5,99. El resumen inicialmente perdió la tilde (“Con Camaron”); se corrigió el armado de la nota con `formatSpanishText()` y la revisión actual muestra “Extras: Con Camarón”. `PRUEBA-DD0D8A` fue un pedido de invitado: la prueba local cierra sesión sintética tras recargar la página, y el resultado indicó correctamente que no se asoció. La rama asociada a perfil e historial queda cubierta en #6 tras iniciar sesión nuevamente. Build, lint y prueba focalizada `textFormat` pasan.

**Matriz por completar**

Registrar cada caso con: producto y opciones, carrito limpio, esperado, observado, resultado y referencia al defecto si aparece. Cubrir presentaciones/modificadores y exclusión de proteína cuando el producto los permita, más cantidad, editar, eliminar y volver a agregar.

| Caso | Carrito limpio | Esperado | Observado | Estado |
|---|---|---|---|---|
| Clásico — Medio Kilo | Sí | 1/2 kg; USD 5,50 en selector, carrito y resumen; persistencia en perfil/historial local | 1/2 kg con pollo, jamón y huevo; USD 5,50 consistente; pedido `PRUEBA-0AC8D7` aparece en recientes e historial con el artículo correcto. El producto no ofrece retiro de proteína en este selector. | **RESUELTO** |
| Clásico — Full Kilo | Sí | 1 kg + refresco de 1 litro gratis; USD 9,90 consistente; persistencia en perfil/historial local | Selector y confirmación muestran el refresco gratis; carrito lateral muestra “Incluye 1 refresco de 1 litro gratis”; USD 9,90 consistente; `PRUEBA-14DFC8` aparece en pedidos recientes e historial como Clásico — Full Kilo. Historial identifica variante, sin repetir el texto del regalo. | **RESUELTO** |
| Arroz Cantonés — Medio Kilo | Sí | Precio y selección coinciden en selector, carrito y resumen; pedido/historial local conserva la variante | Selector/carrito/resumen: USD 9,00; confirmación `PRUEBA-3C90BD`; pedido reciente e historial listan 1 × Arroz Cantonés — Medio Kilo; sello aumentó a 4/10. | **RESUELTO** |
| Arroz Cantonés — Full Kilo | Sí | Precio USD 14,90 consistente; pedido/historial local conserva la variante | Selector/carrito/resumen: USD 14,90; confirmación `PRUEBA-EA4C04`; reciente e historial muestran 1 × Arroz Cantonés — Full Kilo. | **RESUELTO** |
| Arroz Camarón y Pollo — Medio Kilo | Sí | Revisar modificadores/opciones visibles y precio; guardar la variante correcta en historial local | USD 6,00 en selector/carrito/resumen; `PRUEBA-8CC3C4` en recientes e historial como 1 × Arroz Camarón y Pollo — Medio Kilo. Editor ofrece seis extras opcionales, pero no quitar pollo/camarón incluidos. | **RESUELTO** |
| Arroz Camarón y Pollo — Kilo | Sí | Precio USD 9,90 consistente; pedido/historial local conserva la variante | Selector/carrito/resumen: USD 9,90; `PRUEBA-0B363E` aparece en recientes e historial como 1 × Arroz Camarón y Pollo — Kilo. Editor solo permite añadir extras, no retirar pollo/camarón incluidos. | **RESUELTO** |
| Arroz Frito Especial — Medio Kilo | Sí | Revisar precio y persistencia de la variante en historial local | USD 7,00 en selector/carrito/resumen; `PRUEBA-35D0C9` aparece en recientes e historial como 1 × Arroz Frito Especial — Medio Kilo. | **RESUELTO** |
| Arroz Frito Especial — Full Kilo | Sí | USD 11,80 consistente; pedido/historial local conserva la variante | USD 11,80 en selector/carrito/resumen; `PRUEBA-2EC11F` aparece en pedidos recientes e historial como 1 × Arroz Frito Especial — Full Kilo. | **RESUELTO** |
| Dúo | Sí | Total USD 8,50; pedido/historial local conserva el producto | USD 8,50 en carrito/resumen; `PRUEBA-536DB7` aparece en recientes e historial como 1 × Dúo. | **RESUELTO** |
| Trío — opción obligatoria Clásico | Sí | Selección obligatoria agrega 1 Trío por USD 5,99 al carrito y se conserva en historial local | Tras cerrar detalle y abrir Trío de nuevo, muestra Agregar; selección obligatoria aceptada. USD 5,99 coincide en carrito/resumen. Pedido `PRUEBA-0B45ED` figura en perfil/historial como 1 × Trío, Extras: Clasico, +1 sello. | **RESUELTO** |
| Trío — opción obligatoria Con Camarón | Sí | Segunda opción seleccionable, USD 5,99 y etiqueta fiel en resumen | Selección “Con Camarón” aceptada; primer resumen mostró “Con Camaron”. Corregido el guardado de notas con `formatSpanishText()`; resumen verificado con “Extras: Con Camarón”. Confirmación `PRUEBA-DD0D8A` fue como invitado porque la sesión local se cierra tras recargar; no se espera que aparezca en historial del perfil. | **RESUELTO** |
| Promo Trío | Sí | Revisar selección, total y flujo de carrito/resumen/confirmación local; anotar opciones disponibles | USD 13,00 coincide en carrito y revisión; retiro en local visible. Confirmación `PRUEBA-AF75FD` indicó ensayo invitado, sin registro real ni envío WhatsApp; sesión local cerrada tras recarga. | **RESUELTO** |
| De Panas | Sí | Revisar opciones, precio y flujo de carrito/revisión en modo local | USD 24,90 coincide en tarjeta, carrito, subtotal y revisión; retiro seleccionado. Confirmación `PRUEBA-761ECF` quedó como ensayo invitado: sin asociación a perfil, comanda real ni envío WhatsApp, por cierre local de sesión tras recargar. | **RESUELTO** |
| Promo Imperdible | Sí | Revisar selección, precio, carrito y revisión; comprobar beneficio mostrado si aparece | Aún no probado. | **EN CURSO** |

## Registro de actualizaciones

| Fecha | Cambio de estado | Nota |
|---|---|---|
| 2026-11-14 | #0 RESUELTO; #1 EN CURSO | Se creó el tablero a petición de la usuaria. Se fijó como primer punto cerrar la diferencia de la pantalla final de ensayo; no se avanzará a otro problema hasta verificarla. |
| 2026-11-14 | #1 RESUELTO; #3 EN CURSO | Se observó el resultado de `PRUEBA-481614`: usa el diseño actual de éxito local, no la pantalla previa antigua, y no abre WhatsApp. En esa misma verificación se detectó la afirmación falsa de asociación cuando no hay sesión. |
| 2026-11-14 | Caso #4a RESUELTO; #4b EN CURSO | Con carrito vacío se eligió y pidió `Clásico — Medio Kilo`. USD 5,50 coincide en selector/carrito/resumen; pedido `PRUEBA-0AC8D7` se asoció al perfil y aparece en recientes e historial como 1 × Clásico — Medio Kilo. No hay opción de quitar proteínas para este producto. Se continúa con Full Kilo y su bebida gratis. |
| 2026-11-14 | Caso #4b RESUELTO; #4c EN CURSO | Se encontró y corrigió que el beneficio del Full Kilo desaparecía al agregarlo: ahora se muestra en carrito lateral y resumen, además del selector. Confirmación local `PRUEBA-14DFC8` por USD 9,90, con refresco gratis visible, quedó en recientes e historial como Clásico — Full Kilo. Pruebas enfocadas 5/5, lint y build pasan. El historial lista la variante, no la nota del regalo; queda registrada para revisar en el punto de historial. Se inicia Arroz Cantonés. |
| 2026-11-14 | Caso #4c RESUELTO; #4d EN CURSO | `Arroz Cantonés — Medio Kilo`, con carrito limpio: USD 9,00 en selector, carrito y resumen. La confirmación local `PRUEBA-3C90BD` se vinculó al perfil; recientes e historial muestran 1 × Arroz Cantonés — Medio Kilo y el sello sube a 4/10. Se continúa con Full Kilo de Cantonés. |
| 2026-11-14 | Caso #4d RESUELTO; #4e EN CURSO | `Arroz Cantonés — Full Kilo`, con carrito limpio: USD 14,90 en selector, carrito y resumen. La confirmación local `PRUEBA-EA4C04` quedó asociada; perfil e historial listan 1 × Arroz Cantonés — Full Kilo. Se inicia el primer caso de Arroz Camarón y Pollo. |
| 2026-11-14 | Caso #4e RESUELTO; #4f EN CURSO | `Arroz Camarón y Pollo — Medio Kilo`, carrito limpio y USD 6,00 coincidente en selector, carrito y resumen. En edición aparecen extras opcionales, sin controles para quitar las proteínas incluidas. Pedido `PRUEBA-8CC3C4` asociado al perfil; recientes e historial muestran la variante exacta. Se continúa con Kilo a USD 9,90. |
| 2026-11-14 | Caso #4f RESUELTO; #4g EN CURSO | `Arroz Camarón y Pollo — Kilo` se añadió con carrito limpio y USD 9,90 coincidente en selector, carrito y resumen. `PRUEBA-0B363E` aparece en recientes e historial como 1 × la variante. No existe retiro de proteínas incluidas, solo extras de pago. Se inicia Arroz Frito Especial. |
| 2026-11-14 | Caso #4g RESUELTO; #4h EN CURSO | `Arroz Frito Especial — Medio Kilo`, carrito limpio y USD 7,00 coincidente en selector, carrito y resumen. Confirmación local `PRUEBA-35D0C9` asociada al perfil; recientes e historial conservan la variante exacta. Se continúa con Full Kilo a USD 11,80. |
| 2026-11-14 | Caso #4h RESUELTO; #4i EN CURSO | `Arroz Frito Especial — Full Kilo`, carrito limpio y USD 11,80 coincidente en selector, carrito y resumen. Confirmación local `PRUEBA-2EC11F` aparece en recientes e historial con variante correcta. Se empieza por `Dúo`. |
| 2026-11-14 | Caso #4i RESUELTO; #4j EN CURSO | `Dúo`, carrito vacío y USD 8,50; confirmación local `PRUEBA-536DB7` aparece en pedidos recientes e historial como 1 × Dúo. Se continúa con `Trío`. |
| 2026-11-14 | #4j RESUELTO; siguiente caso de #4 EN CURSO | Se corrigió la fuga del estado `editingCartLineKey` al cerrar el detalle. Repetición completa: `Trío` abrió como nuevo, selección obligatoria `Clásico`, USD 5,99 en carrito y revisión, confirmación sintética `PRUEBA-0B45ED` asociada y visible en historial con opción y +1 sello. Build, lint y pruebas focalizadas aprobados. Seguimiento: la etiqueta del historial se muestra “Clasico” sin tilde. |
| 2026-11-14 | #3 RESUELTO; #4 EN CURSO | Corregida la confirmación para reflejar si el adaptador realmente asoció el pedido. Invitado: informa que no se guardó. Perfil local: `PRUEBA-76CDF8` figura en recientes e historial de `V-8675309`, con `Pa’ Mí` y 1 sello. Pruebas focalizadas 4/4, lint y build pasan; revisión de suite completa tuvo 13 fallos por timeouts ajenos al caso, así que queda pendiente repetir esa verificación global. Entorno de UI: Vite está sirviendo una copia temporal; se sincronizaron los archivos modificados y se verificaron sus hashes antes de la prueba visual. |

## Convenciones

- **PENDIENTE:** todavía no iniciado.
- **EN CURSO:** único problema que se está trabajando ahora.
- **RESUELTO:** se reprodujo y se volvió a verificar el criterio de cierre.
- **BLOQUEADO:** depende de staging, acceso externo o dispositivo físico; indicar qué falta. No equivale a resuelto.

El informe de pruebas y sus detalles históricos están en [QA_PEDIR_2026-11-14.md](./QA_PEDIR_2026-11-14.md).



### Continuación de verificación — 2026-11-14
`#4j` quedó RESUELTO después de corregir `closeProductDetail()` para limpiar `editingCartLineKey`. Se validó a 1280px en el diseño actual servido desde la copia aislada `?modoPrueba=1`: nueva selección obligatoria, agregado, retiro, formulario, revisión y confirmación local. `PRUEBA-0B45ED` no se envió a producción ni WhatsApp; el perfil muestra el pedido en historial y el sello sube. El build que terminó en esta continuación pasó; lint pasó; pruebas focalizadas `publicMenuLabels` + `localOrderTestMode`: 9/9. La suite completa no se volvió a ejecutar en esta continuación; el intento anterior tuvo timeouts y queda pendiente de una corrida global estable. Hallazgo menor para el punto #6: historial pierde la tilde en “Clásico” y muestra “Clasico”. Se mantiene #4 como único punto activo, con siguiente combinación pendiente de probar.

| 2026-11-14 | #4j RESUELTO; #4k EN CURSO | El flujo de Trío Clásico quedó cerrado y se inicia la segunda opción obligatoria: Con Camarón. El perfil local continúa abierto y el carrito aparece vacío. |




| 2026-11-14 | #4k RESUELTO; #4l EN CURSO | Trío Con Camarón se agregó a USD 5,99. Se corrigió el resumen para conservar la tilde; `PRUEBA-DD0D8A` fue ensayo invitado tras recarga local, con cierre de sesión intencional. La autenticación e historial tras nuevo inicio se revisan en #6. Se inicia Promo Trío. Build y lint pasan; prueba textFormat 2/2. |


| 2026-11-14 | Promo Trío RESUELTO; De Panas EN CURSO | USD 13,00 coincide en carrito y revisión para Promo Trío; confirmación local PRUEBA-AF75FD como invitado, sin envío a WhatsApp ni registro real. El punto siguiente del catálogo es De Panas. |




| 2026-11-14 | De Panas RESUELTO; Promo Imperdible EN CURSO | De Panas a USD 24,90 coincide en carrito y revisión con retiro en local. Confirmación PRUEBA-761ECF fue invitado y no generó pedido real ni mensaje. Se continúa con Promo Imperdible. |
