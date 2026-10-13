# OpenClaw Living Office

Actualización: el visor ya incluye una escena Three.js 3D y un motor espacial
elástico. Véase [Diseño espacial actual](LIVING_OFFICE_SPATIAL_DESIGN.md).
Las secciones que siguen documentan la auditoría y el MVP cenital original.

## Auditoría (base bec78ad8)

Next.js 16.1.6, React 19.2.3, TypeScript estricto, Canvas 2D, Tailwind 4,
Vitest/jsdom y ESLint. Se revisaron el árbol completo, manifiesto/lockfile,
rutas API, hooks, motores, sprites, plugin, scripts y pruebas existentes.

Reutilizar: transporte WebSocket, autenticación backend, reconexión y RPC de
`gateway-connection.ts`; sprites y dashboard originales se conservan.
`state-mapper.ts` y `useAgents.ts` siguen atendiendo la interfaz anterior.
La oficina anterior queda en `/office/legacy`; `/office` aloja el nuevo visor.

Modificar mediante módulos independientes: estado de ejecución, layout,
movimiento, renderizado y selección. El plano original tiene seis puestos,
resolución fija y comportamiento visual mezclado con actividad. El mapper
original conserva estados de chat anteriores al siguiente run y trata lifecycle
end/tool end como actividad. `useAgents` representa sesiones como agentes,
deduplica por tokens y fabrica títulos de tarea a partir de resúmenes.
La ruta GET `/api/gateway` inicia autowork: el nuevo visor NO la usa.

Falta: contratos explícitos de delegación/proyecto, inventario fiable de tareas,
replay/cursor del Gateway, presencia por agente y pruebas de interfaz específicas.
El SDK OpenClaw es una dependencia de desarrollo, no una instalación productiva.
No ejecutar los scripts install/start-all ni instalar el plugin durante validación.

## Flujo y contratos

Gateway backend → adaptador permitido → AgentStateEngine → CollaborationEngine
→ OfficeLayoutEngine → MovementEngine → OfficeRenderer. Inspector consume los
mismos snapshots. El renderer nunca decide actividad ni inventa colaboraciones.

Eventos observados en el código: `chat` con delta/final/aborted/error; `agent`
con lifecycle(start/end/error), tool(name/phase/status), assistant y error.
Session metadata: key, sessionId, model, label y updatedAt. No hay taskId,
projectId o parentRunId garantizados. Un nombre `subagent` NO demuestra quién
lo delegó. No se agrupan agentes por modelo, canal, antigüedad o prefijo.

Contrato interno: evento con id, sessionKey, runId opcional, timestamp y tipo
start/end/working/researching/waiting/error/delegation. Delegación necesita
parentSessionKey y childSessionKey explícitos, con runId y cierre para su ciclo.
El adaptador actual no inventa campos ausentes; por eso los grupos reales pueden
estar vacíos. El motor admite esas evidencias para futuras versiones del Gateway.

Estado inicial conectado: idle con evidencia desconocida; desconectado: offline
(presencia del transporte, no prueba de que el agente productivo esté apagado).
Inicio/delta/assistant: working. Herramienta read/search/fetch: researching.
Fase waiting: waiting; tool end: working hasta terminar run. End/final/aborted:
idle. Error: error hasta un nuevo inicio. No se utiliza updatedAt para actividad.
Se ignoran eventos fuera de orden y terminales de un run anterior. Historial
acotado a 80 eventos por sesión; herramientas únicas acotadas. Sin replay no se
puede conocer trabajo iniciado antes de conectar; se informa esta limitación.

## Seguridad y compatibilidad

Nuevo transporte aislado reutiliza GatewayConnection con scopes operator.read,
lista blanca agents.list/sessions.list, identidad de monitor separada de la
identidad productiva y errores genéricos. Tokens solo en backend, nunca en DTO,
localStorage o parámetros URL del nuevo visor. No hay acciones RPC desde la
oficina nueva. El dashboard antiguo conserva sus controles autorizables, pero no
se ejecutan durante esta tarea. El visor no cambia modelos/configuración.

Se transmite únicamente estado normalizado, nombres/modelos de inventario y
herramientas conocidas. No se publican argumentos, resultados, texto de chats,
mensajes arbitrarios de error ni objetos raw. Tarea desconocida se muestra como
no disponible; no se inventa un título. Un Gateway real requiere conectividad y
credenciales ya configuradas en servidor; no se prueba contra producción aquí.

## Plano, escala y movimiento

JSON versionado: plantas, salas, departamentos, tamaño de sala y capacidad.
Validación de IDs únicos, números finitos positivos, salas por planta y capacidad.
Layout cenital dinámico de 5–100 agentes, puestos vacíos para idle/offline/error,
salas research y collaboration; lounge para espera/inactividad. Si no hay
capacidad se informa overflow, sin superponer agentes silenciosamente.
Canvas con ResizeObserver, DPR, zoom/pan, selección, filtros y descarte fuera
del viewport. Animación interpolada en requestAnimationFrame, sin setState por
frame; no simula actividad. Las posiciones son derivadas determinísticamente.

## Plan por tareas

1. [x] Auditar arquitectura, transporte, efectos secundarios y pruebas.
2. [x] Documentar contratos, migración, limitaciones y seguridad.
3. [x] Implementar y probar máquina de estados y delegaciones explícitas.
4. [x] Adaptador read-only, snapshot y SSE; desconexión sin datos simulados.
5. [x] Plano JSON, distribución, capacidad y movimiento independiente.
6. [x] Renderer responsive, zoom/pan/filtros y AgentInspector accesible.
7. [x] Demostración explícita y separada del transporte real.
8. [x] Pruebas, lint, typecheck, build y smoke HTTP; registrar fallos heredados.

Migración incremental: mantener rutas originales, añadir visor, verificar contratos
con fixtures, conectar solo lectura, sustituir oficina principal. Integración
productiva y eventos de delegación nuevos se verifican en una tarea autorizada.

## Detalles del MVP y límites explícitos

El inventario visual representa sesiones operativas, conservando sesiones
concurrentes del mismo agente. La capacidad inicial es 100 sesiones; el API
informa truncamiento. Identidades sin sesión se muestran sin actividad conocida.
La pérdida de conexión invalida ejecución y run activo; al reconectar se necesita
un nuevo evento para ocupar un puesto. `activityKnown` distingue idle observado
por final de idle sin evidencia. Los cambios de run retiran el run anterior y
rechazan sus eventos tardíos. Se utiliza tiempo de recepción backend para evitar
comparar relojes distintos; `lastEventKind` resuelve empates de milisegundos.

La colaboración básica está probada con delegaciones explícitas y fixtures DEMO.
No se afirma que OpenClaw emita hoy ese contrato: la normalización actual solo
consume los streams realmente manejados por el repositorio. El despliegue futuro
debe acordar y verificar un evento de delegación y su cierre antes de habilitar
agrupamiento real. No se usa la inferencia padre/hijo heredada.

El movimiento MVP interpola destinos por estado, sin navegación por obstáculos
ni simulación de pasos. Las salas son áreas abiertas; el motor de pathfinding
original se conserva para una evolución futura. Layout cargado por el usuario
es local a la sesión del visor; el JSON del repositorio es la configuración
reutilizable. El render acota DPR a 2 y descarta agentes y escritorios fuera de
vista, pero no se ha medido GPU/FPS en navegador real. La interfaz accesible
permite selección y filtros sin depender de hit-testing del Canvas.

## Ejecución de desarrollo

Desde `/workspace/agent-monitor`, Node 24 disponible (Next requiere Node >=20.9):

```sh
npm ci --ignore-scripts --cache /tmp/living-npm-cache --no-audit --no-fund
npm test
npm run lint
npx tsc --noEmit
npm run build
npm run dev -- --hostname 127.0.0.1 --port 3000
```

Abrir la ruta `/office` en el entorno de desarrollo; DEMO es una elección
explícita. No ejecutar scripts de instalación de plugins o restart de OpenClaw.
Para comprobar desconexión sin acceso productivo, arrancar con
`OPENCLAW_CONFIG_PATH=/tmp/living-office-no-config.json` y sin variables
OPENCLAW_GATEWAY_PORT/TOKEN/PASSWORD inyectadas en ese proceso. No cambiar
credenciales persistentes. No publicar tokens ni usar parámetros `token`.
