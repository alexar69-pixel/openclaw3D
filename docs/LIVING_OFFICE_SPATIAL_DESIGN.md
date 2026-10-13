# Oficina 3D viva y elástica

## Implementación actual

`/office` abre una escena Three.js/WebGL real, construida con suelo, áreas,
mesas, monitores, sillas y avatares. La imagen conceptual del README no se usa
como fondo ni como mapa. La vista 2D y `/office/legacy` se conservan.

`ElasticSpaceEngine` decide el espacio; `OfficeScene3D` construye geometría;
`OfficeRenderer3D` gestiona cámara, selección y animación. La actividad sigue
procediendo exclusivamente del motor de estados y de delegaciones explícitas.
El render no inventa trabajo, equipos ni colaboraciones.

Cada entidad monitorizada recibe un `workspace:<id>` con propietario estable,
planta de origen y posición de destino. En este repositorio la entidad operativa
es una sesión: sesiones concurrentes del mismo agente siguen siendo distintas,
para no ocultar runs activos. No se afirma haber resuelto todavía la agregación
por identidad de agente con múltiples sesiones simultáneas.

## Espacio personal y equipo

La configuración `src/living-office/space-config.json` contiene plantas,
umbral de expansión, perfiles explícitos y equipos. Un perfil exacto de sesión
prevalece sobre el perfil de identidad `agent:<id>`. Sin configuración la función
es `unassigned`: no se deduce del modelo o de la antigüedad.

Funciones disponibles y elementos visuales:

| Función | Personalización |
| --- | --- |
| engineer | Equipo técnico junto al monitor |
| researcher | Estantería lateral |
| coordinator | Pizarra |
| reviewer | Panel de revisión |
| support | Terminal de soporte |
| unassigned | Puesto neutro |

Cada puesto conserva un acento de color propio. El inspector permite editar
función, equipo, color y planta de origen. Compartir departamento significa
asignación organizativa, no colaboración activa. La configuración y las reservas
se guardan localmente en el navegador; DEMO y LIVE usan claves distintas. También
se puede importar/exportar JSON. Para compartirla entre monitores, guardar el JSON
revisado en el repositorio; no hay sincronización multiusuario de ediciones locales.

## Plantas y elasticidad

El umbral predeterminado es 24 puestos por planta. Llegadas nuevas agotan capacidad
y generan Expansion 02, 03, etc. Con 100 sesiones, el valor predeterminado produce
cinco plantas. Se puede añadir una planta explícita; si ya hay plantas automáticas,
se materializan primero y se añade un piso adicional, sin reutilizarlo silenciosamente.

Una planta explícita puede alojar más puestos que el umbral: este es un criterio de
expansión, no una capacidad rígida. Bajar el umbral afecta nuevas asignaciones y
no expulsa propietarios existentes. Las áreas crecen con los puestos que alojan.
La propiedad y planta de origen permanecen estables ante cambios de orden del
inventario. La posición geométrica puede cambiar al crecer un departamento.
Las plantas automáticas vacías finales desaparecen si ninguna sesión observada
las necesita; las plantas configuradas explícitamente se conservan.

La colaboración confirmada crea un área de proyecto temporal junto a los
departamentos. Los puestos participantes se reorganizan allí, incluso desde
plantas diferentes, manteniendo una marca de reserva en su origen. Al terminar,
el área temporal desaparece y los mismos puestos vuelven a su departamento.
No se duplican escritorios. El trabajo individual ocupa el puesto propio;
idle/offline/error dejan silla vacía, waiting permanece al lado del puesto.

La geometría de las áreas se recalcula de inmediato; los puestos interpolan
su destino horizontal. Un traslado entre plantas cambia de planta sin simular
un ascensor todavía. No hay navegación por paredes ni animación estructural de
muros. La distribución completa responde a datos y configuración, no a ciclos
aleatorios de movimiento.

## Rendimiento y compatibilidad

Muebles y avatares se dibujan con InstancedMesh por pieza, evitando una llamada
por cada escritorio. El frustum descarta puestos fuera de cámara; los batches
solo contienen instancias visibles. Texturas, materiales, geometrías y controles
se liberan al sustituir/desmontar la escena.

La geometría se reutiliza cuando cambian eventos o actividad sin cambios
espaciales. El render se invalida por cámara, selección, estado, reconfiguración
o movimiento; una escena estable no se redibuja continuamente. SSE se agrupa
por frame manteniendo orden e historial acotado. Ningún setState ocurre por
cada fotograma; solo se actualiza el indicador al iniciar/terminar una transición.

WebGL no disponible o contexto perdido muestra una opción explícita de vista 2D.
OrbitControls aporta rotación, pan y zoom; ResizeObserver adapta cámara y viewport.
No se carga contenido externo ni se exponen tokens.

## Verificación y próximos pasos

Pruebas automatizadas de propiedad, 100 sesiones, expansión, reversión de proyectos,
colaboración entre plantas, perfiles, persistencia, validación, instancing, culling,
selección y agrupación SSE. Smoke real de Chromium con SwiftShader: 100 puestos,
cinco plantas, creación de la sexta, personalización, traslado, cierre de proyecto
y persistencia tras recarga. Se ejercitaron también 100 puestos en una sola planta.
La captura `docs/images/living-office-3d-live.png` procede del renderer ejecutado,
con datos DEMO; no es una imagen generada.

Pendiente: medir FPS de movimiento en GPU física, resolver identidad multisesión
si se quiere una sola estación por agente registrado, sincronizar perfiles entre
usuarios, verificar Gateway productivo autorizado y acordar eventos explícitos
de delegación. La calidad visual actual es un prototipo geométrico; la imagen
conceptual muestra una dirección artística de mayor detalle.


## Acabado futurista premium

El usuario eligió esta dirección artística el 2026-10-13. Se sustituyen superficies
facetadas y avatares de bloques por geometrías curvas, figuras humanas, escritorios
con grano de madera, teclados y accesorios, sillas con reposabrazos y base de cinco
ruedas, estanterías, mamparas de vidrio ahumado y vegetación de hojas instanciadas.
Los nombres flotantes solo aparecen para el seleccionado, reduciendo ruido visual.

Las texturas se generan localmente y se comparten entre instancias. No se descargan
activos externos. `Detallados` habilita entorno HDR procedural y sombras PCF;
`Ligeros` usa iluminación sencilla y sombras de contacto. `Automáticos` selecciona
el modo ligero al detectar renderizado por software. Los materiales mantienen
la asignación de color del puesto y el estado real del monitor. Las líneas de las
pantallas son decoración abstracta, no texto de tareas ni métricas inventadas.

`Ver puesto` centra la cámara en el espacio seleccionado; `Encuadrar planta`
restaura la vista general. La escena mantiene reconfiguración, plantas y propiedad.
Esta es una evolución del prototipo: el nivel artístico de la referencia ilustrada
requiere modelos y materiales de producción adicionales; no se presenta como una
reproducción fotorealista equivalente. Las figuras son representaciones simplificadas.
