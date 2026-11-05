const viewport = document.querySelector('#map-viewport');
const stage = document.querySelector('#map-stage');
const image = document.querySelector('#cave-map');
const overlay = document.querySelector('#map-overlay');
const fina = document.querySelector('#fina');
const foxSprite = document.querySelector('#fina-sprite');
const lightHoles = document.querySelector('#light-holes');
const glows = document.querySelector('#glows');
const routeLayer = document.querySelector('#route-layer');
const startLayer = document.querySelector('#start-layer');
const roomLayer = document.querySelector('#room-layer');
const nodeLayer = document.querySelector('#node-layer');
const editorPanel = document.querySelector('#editor-panel');
const setupPrompt = document.querySelector('#setup-prompt');
const exploredToast = document.querySelector('#explored-toast');
const unlockButton = document.querySelector('#unlock-next');
const zoomReadout = document.querySelector('#zoom-readout');
const routeFeedback = document.querySelector('#route-feedback');
const nodeTestFeedback = document.querySelector('#node-test-feedback');
const roomHoldFeedback = document.querySelector('#room-hold-feedback');
const toolHelp = document.querySelector('#tool-help');
const testDebug = document.querySelector('#test-debug');

const mapStorageKey = 'fina-cave-map-v1';
const roomsStorageKey = 'fina-cave-rooms-v1';
const progressStorageKey = 'fina-cave-progress-v1';
const foxStartStorageKey = 'fina-cave-fox-start-v1';
const width = 1000;
const height = 561.5296;
const roomNames = [
  'Die dunkle Höhle', 'Der Lichtgang', 'Die Lichtschlucht', 'Die Schattenkammer',
  'Der Spiegelsee', 'Die gewölbte Grotte', 'Die gewölbte Kammer', 'Die Unterwasserhöhle',
  'Die Regenbogenhöhle', 'Die Linsenkammer'
];
const caveStories = roomNames.map((title, index) => ({
  title,
  paragraphs: [
    `Hier erscheint später Finas Geschichte zur ${index + 1}. Höhle.`,
    'Fina hat einen geheimnisvollen Ort entdeckt. Doch bevor sie ihre Reise fortsetzen kann, muss sie ein Rätsel lösen.',
    '[Platzhalter für die vollständige Geschichte]'
  ]
}));
const initialFox = { x: 123, y: 305, angle: 0 };
const rooms = Array.from({ length: 10 }, (_, index) => ({ id: index + 1, x: null, y: null, area: null }));
const tools = {
  room: 'Klicke auf die Karte, um die ausgewählte Kammerposition festzulegen.',
  area: 'Ziehe vom Kammerpunkt nach außen, um den unsichtbaren Klickbereich festzulegen.',
  draw: 'Klicke entlang des sichtbaren Höhlenwegs. Der erste Wegpunkt wird an Finas Startposition gesetzt.',
  connect: 'Klicke zwei Wegpunkte nacheinander an, um den Pfad zu verbinden.',
  insert: 'Klicke eine Verbindung an, um dort einen neuen Wegpunkt einzufügen.',
  roomLink: 'Wähle eine Kammer in der Liste und klicke dann ihren Wegpunkt an.',
  move: 'Ziehe einen Wegpunkt an seine neue Position.',
  delete: 'Klicke einen Wegpunkt oder eine Verbindung, um sie zu löschen.',
  foxStart: 'Klicke auf die Karte, um Finas Startposition festzulegen.'
};

let zoom = 1;
let offsetX = 0;
let offsetY = 0;
let dragging = null;
let roomGesture = null;
let suppressOverlayClick = false;
let editorOpen = false;
let tool = 'room';
let selectedRoom = 1;
let selectedNode = null;
let roomLinks = {};
let selectedRouteNode = null;
let movingNode = null;
let nextNodeId = 1;
let animationFrame = null;
let routePreview = null;
let cinematicBusy = false;
let storyOpen = false;
let activeStoryRoom = null;
let cameraBeforeStory = null;
let missionViewOpen = false;
const testDebugState = {
  clicked: false,
  spriteLoaded: false,
  startPosition: false,
  startRoom: false,
  targetRoom: false,
  roomOneHoldId: 'nicht zugeordnet',
  roomOneHoldExists: false,
  roomOneHoldConnected: false,
  roomTwoHoldId: 'nicht zugeordnet',
  roomTwoHoldExists: false,
  roomTwoHoldConnected: false,
  roomOneToTwoReachable: false,
  routeComputed: false,
  animationStarted: false,
  error: ''
};

function readJson(key, fallback) {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : fallback;
  } catch {
    return fallback;
  }
}

const savedMap = readJson(mapStorageKey, null);
const savedRooms = readJson(roomsStorageKey, null);
let stateNodes = [];
let stateEdges = [];
if (savedMap && Array.isArray(savedMap.nodes) && Array.isArray(savedMap.edges)) {
  stateNodes = savedMap.nodes.filter((node) => Number.isFinite(node.x) && Number.isFinite(node.y)).map((node) => ({ ...node }));
  stateEdges = savedMap.edges.filter((edge) => Array.isArray(edge) && edge.length === 2).map((edge) => [...edge]);
  roomLinks = savedMap.roomLinks && typeof savedMap.roomLinks === 'object' && !Array.isArray(savedMap.roomLinks)
    ? { ...savedMap.roomLinks }
    : {};
}
const roomConfiguration = Array.isArray(savedRooms) ? savedRooms : savedMap?.rooms;
if (Array.isArray(roomConfiguration)) {
  for (const room of rooms) {
    const savedRoom = roomConfiguration.find((entry) => entry.id === room.id);
    if (savedRoom && Number.isFinite(savedRoom.x) && Number.isFinite(savedRoom.y)) {
      room.x = savedRoom.x;
      room.y = savedRoom.y;
      if (Number.isFinite(savedRoom.area?.rx) && Number.isFinite(savedRoom.area?.ry)) room.area = { rx: savedRoom.area.rx, ry: savedRoom.area.ry };
    }
  }
}

const progress = readJson(progressStorageKey, null);
const savedFoxStart = readJson(foxStartStorageKey, null);
const hasSavedFoxStart = Number.isFinite(savedFoxStart?.x) && Number.isFinite(savedFoxStart?.y)
  && savedFoxStart.x >= 0 && savedFoxStart.x <= width && savedFoxStart.y >= 0 && savedFoxStart.y <= height;
let foxStartPoint = hasSavedFoxStart ? { x: savedFoxStart.x, y: savedFoxStart.y } : { x: initialFox.x, y: initialFox.y };
const state = {
  fox: progress?.fox && Number.isFinite(progress.fox.x) && Number.isFinite(progress.fox.y)
    ? { ...progress.fox }
    : hasSavedFoxStart ? { ...savedFoxStart } : { ...initialFox },
  unlocked: Array.isArray(progress?.unlocked) ? [...new Set(progress.unlocked.filter((id) => Number.isInteger(id) && id >= 1 && id <= 10))] : [1],
  visited: Array.isArray(progress?.visited) ? [...new Set(progress.visited.filter((id) => Number.isInteger(id) && id >= 1 && id <= 10))] : [],
  lit: Array.isArray(progress?.lit) ? [...new Set(progress.lit.filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y)))] : [{ ...initialFox }]
};
if (!state.unlocked.includes(1)) state.unlocked.unshift(1);

function updateTestDebug() {
  if (!testDebug) return;
  testDebugState.spriteLoaded = fina.classList.contains('asset-ready');
  testDebugState.startPosition = Number.isFinite(state.fox.x) && Number.isFinite(state.fox.y);
  const rows = [
    `Testbutton angeklickt: ${testDebugState.clicked ? 'JA' : 'NEIN'}`,
    `Sprite geladen: ${testDebugState.spriteLoaded ? 'JA' : 'NEIN'}`,
    `Startposition vorhanden: ${testDebugState.startPosition ? 'JA' : 'NEIN'}`,
    `Wegpunkte: ${stateNodes.length}`,
    `Verbindungen: ${stateEdges.length}`,
    `Startkammer erkannt: ${testDebugState.startRoom ? 'JA' : 'NEIN'}`,
    `Zielkammer erkannt: ${testDebugState.targetRoom ? 'JA' : 'NEIN'}`,
    `Haltepunkt-ID Kammer 1: ${testDebugState.roomOneHoldId}`,
    `Wegpunkt Kammer 1 existiert: ${testDebugState.roomOneHoldExists ? 'JA' : 'NEIN'}`,
    `Wegpunkt Kammer 1 mit Netz verbunden: ${testDebugState.roomOneHoldConnected ? 'JA' : 'NEIN'}`,
    `Haltepunkt-ID Kammer 2: ${testDebugState.roomTwoHoldId}`,
    `Wegpunkt Kammer 2 existiert: ${testDebugState.roomTwoHoldExists ? 'JA' : 'NEIN'}`,
    `Wegpunkt Kammer 2 mit Netz verbunden: ${testDebugState.roomTwoHoldConnected ? 'JA' : 'NEIN'}`,
    `Kammer 1 → Kammer 2 erreichbar: ${testDebugState.roomOneToTwoReachable ? 'JA' : 'NEIN'}`,
    `Route berechnet: ${testDebugState.routeComputed ? 'JA' : 'NEIN'}`,
    `Animation gestartet: ${testDebugState.animationStarted ? 'JA' : 'NEIN'}`
  ];
  testDebug.replaceChildren(...rows.map((text) => {
    const row = document.createElement('div');
    row.textContent = text;
    return row;
  }));
  if (testDebugState.error) {
    const error = document.createElement('strong');
    error.className = 'debug-error';
    error.textContent = `Fehler: ${testDebugState.error}`;
    testDebug.append(error);
  }
}

foxSprite.addEventListener('load', () => {
  fina.classList.add('asset-ready');
  testDebugState.spriteLoaded = true;
  updateTestDebug();
});
foxSprite.addEventListener('error', () => {
  testDebugState.spriteLoaded = false;
  testDebugState.error = 'assets/images/fina-spritesheet.webp konnte nicht geladen werden.';
  updateTestDebug();
});

function svgElement(name, attributes = {}) {
  const element = document.createElementNS('http://www.w3.org/2000/svg', name);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
  return element;
}

function setTool(nextTool) {
  tool = nextTool;
  movingNode = null;
  document.querySelectorAll('.mode-button').forEach((button) => button.classList.toggle('active', button.dataset.mode === tool));
  toolHelp.textContent = tools[tool];
  selectedNode = null;
  renderMapData();
}

function saveMap() {
  routePreview = null;
  try {
    localStorage.setItem(mapStorageKey, JSON.stringify({ nodes: stateNodes, edges: stateEdges, roomLinks }));
    localStorage.setItem(roomsStorageKey, JSON.stringify(rooms));
    document.querySelector('#storage-note').textContent = 'Kammern und Wegpunkte gespeichert.';
  } catch {
    document.querySelector('#storage-note').textContent = 'Speichern ist in diesem Browser nicht verfügbar.';
  }
}

function saveProgress() {
  try {
    localStorage.setItem(progressStorageKey, JSON.stringify(state));
  } catch {
    document.querySelector('#storage-note').textContent = 'Fortschritt konnte nicht gespeichert werden.';
  }
}

function pointFromEvent(event) {
  const point = overlay.createSVGPoint();
  point.x = event.clientX;
  point.y = event.clientY;
  const local = point.matrixTransform(overlay.getScreenCTM().inverse());
  return { x: Math.max(0, Math.min(width, local.x)), y: Math.max(0, Math.min(height, local.y)) };
}

function saveRoomConfiguration(configuration) {
  if (!configuration || configuration.version !== 1 || !Array.isArray(configuration.rooms)) throw new Error('Ungültiges Kammer-JSON.');
  const importedRooms = rooms.map((room) => {
    const entry = configuration.rooms.find((candidate) => candidate.id === room.id);
    if (!entry) throw new Error(`Kammer ${room.id} fehlt in der Datei.`);
    const hasPosition = Number.isFinite(entry.x) && Number.isFinite(entry.y);
    if ((entry.x !== null || entry.y !== null) && (!hasPosition || entry.x < 0 || entry.x > width || entry.y < 0 || entry.y > height)) {
      throw new Error(`Ungültige Position für ${roomNames[room.id - 1]}.`);
    }
    const hasArea = entry.area && Number.isFinite(entry.area.rx) && Number.isFinite(entry.area.ry);
    if (entry.area && (!hasArea || entry.area.rx < 8 || entry.area.ry < 8)) throw new Error(`Ungültiger Klickbereich für ${roomNames[room.id - 1]}.`);
    return { id: room.id, x: hasPosition ? entry.x : null, y: hasPosition ? entry.y : null, area: hasArea ? { rx: entry.area.rx, ry: entry.area.ry } : null };
  });
  for (const [index, room] of importedRooms.entries()) Object.assign(rooms[index], room);
  saveMap();
  renderMapData();
  document.querySelector('#storage-note').textContent = 'Kammerkonfiguration importiert.';
}

function renderTransform() {
  stage.style.setProperty('--zoom', zoom);
  stage.style.setProperty('--pan-x', `${offsetX}px`);
  stage.style.setProperty('--pan-y', `${offsetY}px`);
  zoomReadout.textContent = `${Math.round(zoom * 100)}%`;
  document.querySelector('#zoom-out').disabled = zoom <= 0.65;
  document.querySelector('#zoom-in').disabled = zoom >= 3;
}

function renderFox() {
  const direction = ((Math.round(((state.fox.angle || 0) + 90) / 45) % 8) + 8) % 8;
  const frame = fina.classList.contains('walking') ? Math.floor(performance.now() / 145) % 4 + 1 : 0;
  foxSprite.setAttribute('x', String(-20 - frame * 40));
  foxSprite.setAttribute('y', String(-40 - direction * 40));
  const nearbyLight = state.lit.some((point) => Math.hypot(point.x - state.fox.x, point.y - state.fox.y) < 120);
  fina.style.setProperty('--fina-brightness', nearbyLight ? '1.06' : '.72');
  fina.setAttribute('transform', `translate(${state.fox.x} ${state.fox.y})`);
}

function renderRooms() {
  roomLayer.replaceChildren();
  for (const room of rooms) {
    if (!Number.isFinite(room.x) || !Number.isFinite(room.y)) continue;
    const rx = room.area?.rx ?? 34;
    const ry = room.area?.ry ?? 25;
    const target = svgElement('g', { class: 'room-target' });
    target.append(svgElement('ellipse', {
      class: `room-hit${selectedRoom === room.id && editorOpen && tool === 'room' ? ' selected' : ''}${editorOpen && tool === 'area' ? ' area-edit' : ''}`,
      cx: room.x, cy: room.y, rx, ry, tabindex: '0', role: 'button',
      'aria-label': `${roomNames[room.id - 1]}, ${room.area ? 'Klickbereich festgelegt' : 'Standard-Klickbereich'}`, 'data-room': room.id
    }));
    const label = svgElement('text', { class: 'room-label', x: room.x, y: room.y - ry - 8 });
    label.textContent = roomNames[room.id - 1];
    target.append(label);
    if (editorOpen) {
      target.append(svgElement('circle', {
        class: `room-anchor${selectedRoom === room.id ? ' selected' : ''}`,
        cx: room.x, cy: room.y, r: 5, 'data-room-anchor': room.id,
        'aria-label': `Position: ${roomNames[room.id - 1]}`
      }));
    }
    roomLayer.append(target);
  }
}

function renderStartMarker() {
  startLayer.replaceChildren();
  if (!editorOpen) return;
  startLayer.append(svgElement('circle', {
    class: 'fox-start-marker', cx: foxStartPoint.x, cy: foxStartPoint.y, r: 8,
    'aria-label': 'Finas Startposition'
  }));
  const label = svgElement('text', { class: 'fox-start-label', x: foxStartPoint.x + 12, y: foxStartPoint.y - 10 });
  label.textContent = 'START';
  startLayer.append(label);
  const warning = document.querySelector('#start-warning');
  const firstNode = stateNodes[0];
  if (!firstNode) {
    warning.textContent = 'Noch keine Wegpunkte. Der erste Wegpunkt wird direkt an Finas Startposition gesetzt.';
  } else {
    const gap = Math.hypot(firstNode.x - foxStartPoint.x, firstNode.y - foxStartPoint.y);
    warning.textContent = gap <= 1
      ? 'Finas Startposition ist mit Wegpunkt 1 verbunden.'
      : `Warnung: Wegpunkt 1 liegt ${Math.round(gap)} Kartenpixel von Finas Startposition entfernt.`;
  }
}

function renderEdges() {
  routeLayer.replaceChildren();
  for (const [roomIdText, nodeId] of Object.entries(roomLinks)) {
    const room = rooms.find((entry) => entry.id === Number(roomIdText));
    const node = findNodeById(nodeId);
    if (!room || !node || !Number.isFinite(room.x) || !Number.isFinite(room.y)) continue;
    routeLayer.append(svgElement('path', {
      class: 'room-edge', d: `M${room.x},${room.y} L${node.x},${node.y}`,
      'aria-label': `Anschluss ${roomNames[room.id - 1]} an Wegpunkt ${nodeId}`
    }));
  }
  for (const [firstId, secondId] of stateEdges) {
    const first = stateNodes.find((node) => node.id === firstId);
    const second = stateNodes.find((node) => node.id === secondId);
    if (!first || !second) continue;
    const path = `M${first.x},${first.y} L${second.x},${second.y}`;
    routeLayer.append(svgElement('path', {
      class: 'edge-hit', d: path, 'data-edge': `${firstId},${secondId}`,
      role: 'button', tabindex: '0', 'aria-label': 'Verbindung zwischen Wegpunkten'
    }));
    routeLayer.append(svgElement('path', {
      class: 'edge', d: path, 'aria-hidden': 'true'
    }));
  }
  if (routePreview?.length) {
    const data = routePreview.map((point, index) => `${index ? 'L' : 'M'}${point.x},${point.y}`).join(' ');
    routeLayer.append(svgElement('path', { class: 'route-preview', d: data }));
  }
}

function renderNodes() {
  nodeLayer.replaceChildren();
  for (const [index, node] of stateNodes.entries()) {
    nodeLayer.append(svgElement('circle', {
      class: `node-hit${selectedNode === node.id || selectedRouteNode === node.id ? ' selected' : ''}`, cx: node.x, cy: node.y, r: 5,
      'data-node': node.id, role: 'button', tabindex: '0', 'aria-label': `Wegpunkt ${index + 1}`
    }));
    const label = svgElement('text', { class: 'node-label', x: node.x, y: node.y - 9 });
    label.textContent = String(index + 1);
    nodeLayer.append(label);
  }
}

function renderLights() {
  lightHoles.replaceChildren();
  glows.replaceChildren();
  const sources = [...state.lit];
  if (!sources.length) sources.push(initialFox);
  sources.forEach((point, index) => {
    const hole = svgElement('circle', {
      class: 'light-hole', cx: point.x, cy: point.y, r: index === 0 ? 105 : 100,
      fill: 'url(#lamp-gradient)', filter: 'url(#soft-light)'
    });
    const glow = svgElement('ellipse', {
      class: 'glow', cx: point.x, cy: point.y, rx: 74, ry: 52,
      fill: index === 0 ? 'url(#warm-glow)' : 'url(#cool-glow)', filter: 'url(#soft-light)'
    });
    lightHoles.append(hole);
    glows.append(glow);
    requestAnimationFrame(() => {
      hole.classList.add('lit');
      glow.classList.add('lit');
    });
  });
}

function renderRoomList() {
  const list = document.querySelector('#room-list');
  list.replaceChildren();
  rooms.forEach((room) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `room-choice${Number.isFinite(room.x) ? ' assigned' : ''}${roomLinks[room.id] !== undefined ? ' linked' : ''}${selectedRoom === room.id ? ' selected' : ''}`;
    button.textContent = `${String(room.id).padStart(2, '0')}  ${roomNames[room.id - 1]}`;
    button.title = `${Number.isFinite(room.x) ? 'Positioniert' : 'Nicht positioniert'}${roomLinks[room.id] !== undefined ? ', mit Wegpunkt verbunden' : ', nicht mit Wegpunkt verbunden'}`;
    button.setAttribute('aria-label', `${room.id}. ${roomNames[room.id - 1]}${Number.isFinite(room.x) ? ', positioniert' : ''}`);
    button.addEventListener('click', () => {
      selectedRoom = room.id;
      if (tool !== 'room' && tool !== 'roomLink') setTool('room');
      else renderMapData();
    });
    list.append(button);
  });
  const from = document.querySelector('#route-from');
  const to = document.querySelector('#route-to');
  const previousFrom = from.value;
  const previousTo = to.value;
  from.replaceChildren();
  to.replaceChildren();
  for (const room of rooms.filter((candidate) => Number.isFinite(candidate.x))) {
    for (const select of [from, to]) {
      const option = document.createElement('option');
      option.value = room.id;
      option.textContent = roomNames[room.id - 1];
      select.append(option);
    }
  }
  if (previousFrom && [...from.options].some((option) => option.value === previousFrom)) from.value = previousFrom;
  if (previousTo && [...to.options].some((option) => option.value === previousTo)) to.value = previousTo;
  document.querySelector('#test-route').disabled = false;

  const holdRoom = document.querySelector('#hold-room');
  const holdNode = document.querySelector('#hold-node');
  const previousHoldRoom = holdRoom.value;
  const previousHoldNode = holdNode.value;
  holdRoom.replaceChildren();
  holdNode.replaceChildren();
  for (const room of rooms) {
    const option = document.createElement('option');
    option.value = room.id;
    option.textContent = `${room.id}. ${roomNames[room.id - 1]}`;
    holdRoom.append(option);
  }
  for (const [index, node] of stateNodes.entries()) {
    const option = document.createElement('option');
    option.value = node.id;
    option.textContent = `Wegpunkt ${index + 1}`;
    holdNode.append(option);
  }
  if (previousHoldRoom && [...holdRoom.options].some((option) => option.value === previousHoldRoom)) holdRoom.value = previousHoldRoom;
  if (previousHoldNode && [...holdNode.options].some((option) => option.value === previousHoldNode)) holdNode.value = previousHoldNode;
  document.querySelector('#assign-hold').disabled = stateNodes.length === 0;
  document.querySelector('#test-room-hold').disabled = stateNodes.length === 0;
  renderHoldList();
}

function renderHoldList() {
  const list = document.querySelector('#hold-list');
  list.replaceChildren();
  const firstNode = stateNodes[0];
  const connectedFromStart = firstNode ? reachableNodeIds(firstNode.id) : new Set();
  for (const room of rooms) {
    const rawNodeId = Object.hasOwn(roomLinks, String(room.id)) ? roomLinks[String(room.id)] : roomLinks[room.id];
    const node = getRoomHoldNode(room.id);
    const nodeIndex = node ? stateNodes.findIndex((entry) => nodeKey(entry.id) === nodeKey(node.id)) : -1;
    const row = document.createElement('p');
    const assigned = rawNodeId !== undefined;
    const exists = nodeIndex >= 0;
    const connected = exists && connectedFromStart.has(nodeKey(node.id));
    row.className = `hold-row${connected ? ' assigned' : ''}${assigned && !exists ? ' invalid' : ''}`;
    if (!assigned) {
      row.textContent = `Kammer ${room.id} – ${roomNames[room.id - 1]} → kein Haltepunkt zugeordnet`;
    } else if (!exists) {
      row.textContent = `Kammer ${room.id} – ${roomNames[room.id - 1]} → gespeicherte Haltepunkt-ID ${String(rawNodeId)} (${typeof rawNodeId}) existiert nicht`;
    } else {
      row.textContent = `Kammer ${room.id} – ${roomNames[room.id - 1]} → Wegpunkt ${nodeIndex + 1} (ID ${String(rawNodeId)}, ${typeof rawNodeId}) · ${connected ? 'mit Startnetz verbunden' : 'nicht mit Wegnetz verbunden'}`;
    }
    list.append(row);
  }
}

function renderMapData() {
  viewport.classList.toggle('editor-open', editorOpen);
  renderRooms();
  renderStartMarker();
  renderEdges();
  renderNodes();
  renderRoomList();
  renderFox();
  updateTestDebug();
  updateSetupPrompt();
}

function updateSetupPrompt() {
  const configured = rooms.some((room) => Number.isFinite(room.x)) && stateNodes.length >= 2 && stateEdges.length > 0;
  setupPrompt.hidden = editorOpen || configured;
}

function nearestNode(point) {
  return stateNodes.reduce((closest, node) => {
    const distance = Math.hypot(node.x - point.x, node.y - point.y);
    return !closest || distance < closest.distance ? { node, distance } : closest;
  }, null);
}

function nodeKey(id) {
  return id === null || id === undefined ? null : String(id);
}

function findNodeById(id) {
  const key = nodeKey(id);
  return key === null ? null : stateNodes.find((node) => nodeKey(node.id) === key) ?? null;
}

function getRoomHoldNode(roomId) {
  const key = String(roomId);
  const linkedId = Object.hasOwn(roomLinks, key) ? roomLinks[key] : roomLinks[roomId];
  return linkedId === undefined || linkedId === null ? null : findNodeById(linkedId);
}

function reachableNodeIds(startId) {
  const startKey = nodeKey(startId);
  if (startKey === null || !findNodeById(startId)) return new Set();
  const reached = new Set([startKey]);
  const pending = [startKey];
  while (pending.length) {
    const currentKey = pending.shift();
    for (const [firstId, secondId] of stateEdges) {
      const firstKey = nodeKey(firstId);
      const secondKey = nodeKey(secondId);
      const neighborKey = firstKey === currentKey ? secondKey : secondKey === currentKey ? firstKey : null;
      if (neighborKey !== null && !reached.has(neighborKey) && findNodeById(neighborKey)) {
        reached.add(neighborKey);
        pending.push(neighborKey);
      }
    }
  }
  return reached;
}

function findPath(startPoint, endPoint) {
  const startMatch = nearestNode(startPoint);
  const endMatch = nearestNode(endPoint);
  if (!startMatch || !endMatch || startMatch.distance > 26 || endMatch.distance > 26) return null;
  const start = startMatch.node;
  const end = endMatch.node;
  if (start.id === end.id) {
      const sameNodePath = [startPoint, { x: start.x, y: start.y }, endPoint];
      return sameNodePath.filter((point, index) => index === 0 || Math.hypot(point.x - sameNodePath[index - 1].x, point.y - sameNodePath[index - 1].y) > 0.1);
  }
  const nodeByKey = new Map(stateNodes.map((node) => [nodeKey(node.id), node]));
  const startKey = nodeKey(start.id);
  const endKey = nodeKey(end.id);
  const distances = new Map(stateNodes.map((node) => [nodeKey(node.id), Infinity]));
  const previous = new Map();
  const remaining = new Set(stateNodes.map((node) => nodeKey(node.id)));
  distances.set(startKey, 0);
  while (remaining.size) {
    let currentId = null;
    for (const id of remaining) if (currentId === null || distances.get(id) < distances.get(currentId)) currentId = id;
    if (currentId === null || !Number.isFinite(distances.get(currentId))) break;
    if (currentId === endKey) break;
    remaining.delete(currentId);
    const current = nodeByKey.get(currentId);
    for (const edge of stateEdges) {
      const firstKey = nodeKey(edge[0]);
      const secondKey = nodeKey(edge[1]);
      const neighborId = firstKey === currentId ? secondKey : secondKey === currentId ? firstKey : null;
      if (neighborId === null || !remaining.has(neighborId)) continue;
      const neighbor = nodeByKey.get(neighborId);
      const distance = distances.get(currentId) + Math.hypot(neighbor.x - current.x, neighbor.y - current.y);
      if (distance < distances.get(neighborId)) {
        distances.set(neighborId, distance);
        previous.set(neighborId, currentId);
      }
    }
  }
  if (!Number.isFinite(distances.get(endKey))) return null;
  const path = [];
  let cursor = endKey;
  while (cursor !== undefined) {
    const node = nodeByKey.get(cursor);
    if (!node) return null;
    path.unshift(node);
    if (cursor === startKey) break;
    cursor = previous.get(cursor);
  }
  if (nodeKey(path[0]?.id) !== startKey) return null;
  return [{ x: startPoint.x, y: startPoint.y }, ...path.map(({ x, y }) => ({ x, y })), { x: endPoint.x, y: endPoint.y }];
}

function connectNodes(firstId, secondId) {
  if (nodeKey(firstId) === nodeKey(secondId)) return;
  const exists = stateEdges.some(([a, b]) => (nodeKey(a) === nodeKey(firstId) && nodeKey(b) === nodeKey(secondId)) || (nodeKey(a) === nodeKey(secondId) && nodeKey(b) === nodeKey(firstId)));
  if (exists) {
    routeFeedback.textContent = 'Diese Wegpunkte sind bereits verbunden.';
    return;
  }
  stateEdges.push([firstId, secondId]);
  saveMap();
  renderMapData();
  routeFeedback.textContent = 'Wegpunkte verbunden.';
}

function handleNodeClick(nodeId) {
  const node = findNodeById(nodeId);
  if (!node) return;
  if (tool === 'roomLink') {
    const room = rooms.find((entry) => entry.id === selectedRoom);
    if (!room) {
      routeFeedback.textContent = 'Die ausgewählte Kammer wurde nicht gefunden.';
      return;
    }
    roomLinks[room.id] = node.id;
    selectedRouteNode = node.id;
    saveMap();
    routeFeedback.textContent = `${roomNames[room.id - 1]} ist jetzt mit Wegpunkt ${stateNodes.indexOf(node) + 1} verbunden.`;
  } else if (tool === 'connect') {
    if (selectedNode === null) {
      selectedNode = nodeId;
      toolHelp.textContent = 'Ersten Wegpunkt gewählt. Wähle jetzt den zweiten.';
    } else {
      connectNodes(selectedNode, nodeId);
      selectedNode = null;
    }
  } else if (tool === 'move') {
    movingNode = nodeId;
    selectedNode = nodeId;
    toolHelp.textContent = 'Ziehe den Wegpunkt an seine neue Position.';
  } else if (tool === 'delete') {
    const neighbors = stateEdges
      .filter(([first, second]) => nodeKey(first) === nodeKey(nodeId) || nodeKey(second) === nodeKey(nodeId))
      .map(([first, second]) => nodeKey(first) === nodeKey(nodeId) ? second : first);
    stateNodes = stateNodes.filter((entry) => nodeKey(entry.id) !== nodeKey(nodeId));
    stateEdges = stateEdges.filter(([first, second]) => nodeKey(first) !== nodeKey(nodeId) && nodeKey(second) !== nodeKey(nodeId));
    if (selectedRouteNode !== null && nodeKey(selectedRouteNode) === nodeKey(nodeId)) selectedRouteNode = null;
    if (neighbors.length === 2 && !stateEdges.some(([first, second]) => (nodeKey(first) === nodeKey(neighbors[0]) && nodeKey(second) === nodeKey(neighbors[1])) || (nodeKey(first) === nodeKey(neighbors[1]) && nodeKey(second) === nodeKey(neighbors[0])))) {
      stateEdges.push(neighbors);
    }
    for (const [roomId, linkedNodeId] of Object.entries(roomLinks)) {
      if (Number(linkedNodeId) === nodeId) delete roomLinks[roomId];
    }
    saveMap();
  } else {
    selectedNode = nodeId;
    selectedRouteNode = nodeId;
    routeFeedback.textContent = `Wegpunkt ${stateNodes.indexOf(node) + 1} ausgewählt.`;
  }
  renderMapData();
}

function handleRoomClick(roomId) {
  if (cinematicBusy || animationFrame) return;
  if (editorOpen) {
    selectedRoom = roomId;
    renderMapData();
    return;
  }
  if (!state.unlocked.includes(roomId) && !state.visited.includes(roomId)) return;
  moveToRoom(roomId);
}

function handleEditorBlankClick(point) {
  if (tool === 'foxStart') {
    state.fox = { ...point, angle: 0 };
    foxStartPoint = { x: point.x, y: point.y };
    try {
      localStorage.setItem(foxStartStorageKey, JSON.stringify(state.fox));
      document.querySelector('#storage-note').textContent = 'Finas Startposition gespeichert.';
      routeFeedback.textContent = `Finas Startposition gespeichert (${Math.round(point.x)}, ${Math.round(point.y)}).`;
    } catch {
      routeFeedback.textContent = 'Finas Startposition konnte nicht gespeichert werden.';
    }
    renderFox();
    renderStartMarker();
    return;
  }
  if (tool === 'room') {
    const room = rooms.find((entry) => entry.id === selectedRoom);
    if (room) Object.assign(room, point);
    saveMap();
  } else if (tool === 'draw') {
    const previous = stateNodes.at(-1) ?? null;
    const nodePosition = previous ? point : foxStartPoint;
    const node = { id: nextNodeId++, ...nodePosition };
    stateNodes.push(node);
    if (previous) stateEdges.push([previous.id, node.id]);
    selectedNode = node.id;
    selectedRouteNode = node.id;
    routeFeedback.textContent = previous
      ? `Wegpunkt ${stateNodes.length} gesetzt und mit Wegpunkt ${stateNodes.length - 1} verbunden.`
      : 'Wegpunkt 1 exakt an Finas Startposition gesetzt.';
    saveMap();
  } else if (tool === 'move' && movingNode !== null) {
    const node = stateNodes.find((entry) => entry.id === movingNode);
    if (node) Object.assign(node, point);
    movingNode = null;
    selectedNode = null;
    toolHelp.textContent = tools[tool];
    saveMap();
  }
  renderMapData();
}

function finishRoomGesture() {
  if (!roomGesture) return;
  roomGesture = null;
  saveMap();
  renderMapData();
}

function smoothFollow() {
  const mapRect = stage.getBoundingClientRect();
  const viewportRect = viewport.getBoundingClientRect();
  const foxScreenX = mapRect.left + (state.fox.x / width) * mapRect.width;
  const foxScreenY = mapRect.top + (state.fox.y / height) * mapRect.height;
  offsetX += (viewportRect.width * 0.5 - foxScreenX) * 0.16 / zoom;
  offsetY += (viewportRect.height * 0.53 - foxScreenY) * 0.16 / zoom;
  renderTransform();
}

function moveAlongPath(path, roomId = null, durationOverride = null, testKind = 'route', persistTestPosition = false, destinationRoomId = null) {
  if (!path || path.length < 2) return false;
  if (animationFrame) cancelAnimationFrame(animationFrame);
  const isTestRun = roomId === null;
  if (isTestRun && testKind === 'route') {
    testDebugState.animationStarted = true;
    updateTestDebug();
  }
  routePreview = path;
  renderEdges();
  fina.classList.add('walking');
  const lengths = path.slice(1).map((point, index) => Math.hypot(point.x - path[index].x, point.y - path[index].y));
  const totalLength = lengths.reduce((sum, length) => sum + length, 0);
  const duration = Number.isFinite(durationOverride) ? durationOverride : Math.max(1200, totalLength * 13);
  console.debug('[Fina-Test] Animation gestartet', { pointCount: path.length, distance: totalLength, duration });
  let startTime = null;
  const animate = (time) => {
    if (startTime === null) startTime = time;
    const progressRatio = Math.min(1, (time - startTime) / duration);
    let distance = totalLength * progressRatio;
    let segment = 0;
    while (segment < lengths.length - 1 && distance > lengths[segment]) {
      distance -= lengths[segment];
      segment += 1;
    }
    const portion = Math.min(1, distance / (lengths[segment] || 1));
    const from = path[segment];
    const to = path[segment + 1];
    state.fox.x = from.x + (to.x - from.x) * portion;
    state.fox.y = from.y + (to.y - from.y) * portion;
    const angle = Math.atan2(to.y - from.y, to.x - from.x) * 180 / Math.PI;
    if (segment < lengths.length - 1 && portion > 0.72) {
      const next = path[segment + 2];
      const nextAngle = Math.atan2(next.y - to.y, next.x - to.x) * 180 / Math.PI;
      const turn = ((nextAngle - angle + 540) % 360) - 180;
      state.fox.angle = angle + turn * Math.min(1, (portion - 0.72) / 0.28);
    } else {
      state.fox.angle = angle;
    }
    state.fox.facing = 1;
    renderFox();
    smoothFollow();
    if (progressRatio < 1) animationFrame = requestAnimationFrame(animate);
    else {
      animationFrame = null;
      state.fox = { ...path[path.length - 1], angle: state.fox.angle, facing: 1 };
      fina.classList.remove('walking');
      routePreview = null;
      if (roomId !== null) arriveAtRoom(roomId);
      if (!isTestRun || persistTestPosition) saveProgress();
      if (isTestRun) {
        const spriteMissing = !fina.classList.contains('asset-ready');
        if (testKind === 'pixel-test') {
          routeFeedback.textContent = '100-Pixel-Test erfolgreich';
        } else if (testKind === 'waypoint-test') {
          const endpointNode = nearestNode(path[path.length - 1])?.node;
          nodeTestFeedback.textContent = `Wegtest bis Wegpunkt ${waypointNumber(endpointNode?.id)} erfolgreich.`;
        } else if (testKind === 'room-hold') {
          roomHoldFeedback.textContent = `Fina hat den Haltepunkt für ${roomNames[destinationRoomId - 1]} erreicht.`;
        } else {
          routeFeedback.textContent = spriteMissing ? 'Test erfolgreich. Finas Sprite ist nicht geladen.' : 'Test erfolgreich';
        }
        console.debug('[Fina-Test] Animation beendet', { finalPosition: { x: state.fox.x, y: state.fox.y } });
        if (spriteMissing) console.warn('[Fina-Test] assets/images/fina-spritesheet.webp fehlt; Fina kann nicht sichtbar gerendert werden.');
        updateTestDebug();
      }
      renderMapData();
    }
  };
  animationFrame = requestAnimationFrame(animate);
  return true;
}

function moveToRoom(roomId) {
  const room = rooms.find((entry) => entry.id === roomId);
  if (!room) return;
  const holdNode = getRoomHoldNode(roomId);
  const hasRoomPosition = Number.isFinite(room.x) && Number.isFinite(room.y);
  if (!holdNode && !hasRoomPosition) {
    routeFeedback.textContent = 'Für diese Höhle ist noch keine Position oder kein Haltepunkt eingerichtet.';
    return;
  }
  const destination = holdNode ?? room;
  const path = findPath(state.fox, destination);
  if (!path) {
    routeFeedback.textContent = 'Kein verbundener Laufweg. Ergänze im Editor Wegpunkte und Verbindungen.';
    setupPrompt.hidden = false;
    return;
  }
  cinematicBusy = true;
  moveAlongPath(path, roomId);
}

function arriveAtRoom(roomId) {
  if (!state.visited.includes(roomId)) state.visited.push(roomId);
  const room = rooms.find((entry) => entry.id === roomId);
  const holdNode = getRoomHoldNode(roomId);
  const focus = room && Number.isFinite(room.x) && Number.isFinite(room.y)
    ? { x: room.x, y: room.y }
    : holdNode ? { x: holdNode.x, y: holdNode.y } : { x: state.fox.x, y: state.fox.y };
  if (!state.lit.some((point) => Math.hypot(point.x - focus.x, point.y - focus.y) < 1)) state.lit.push(focus);
  saveProgress();
  renderLights();
  const nextId = Math.max(...state.unlocked) + 1;
  const hasNext = nextId <= 10 && !state.unlocked.includes(nextId);
  exploredToast.hidden = false;
  document.querySelector('#toast-text').textContent = `Kammer ${roomId} erkundet`;
  unlockButton.hidden = !hasNext;
  unlockButton.dataset.next = hasNext ? String(nextId) : '';
  beginCaveStory(roomId, focus);
}

function boundedCameraOffset(axis, focusValue, scale) {
  const viewportSize = axis === 'x' ? viewport.clientWidth : viewport.clientHeight;
  const stageSize = axis === 'x' ? stage.offsetWidth : stage.offsetHeight;
  const mapSize = axis === 'x' ? width : height;
  const center = viewportSize / 2;
  const desired = (0.5 - focusValue / mapSize) * stageSize * scale;
  const scaledSize = stageSize * scale;
  const min = center - scaledSize / 2;
  const max = scaledSize / 2 - center;
  return scaledSize >= viewportSize ? Math.max(min, Math.min(max, desired)) : 0;
}

function setCameraOnPoint(point, scale) {
  zoom = scale;
  offsetX = boundedCameraOffset('x', point.x, scale);
  offsetY = boundedCameraOffset('y', point.y, scale);
  renderTransform();
}

function beginCaveStory(roomId, focusPoint) {
  if (cinematicBusy && activeStoryRoom !== null) return;
  cinematicBusy = true;
  activeStoryRoom = roomId;
  cameraBeforeStory = { zoom, offsetX, offsetY };
  viewport.classList.add('cinematic-active', 'cinematic-camera', 'cave-entry-light');
  const focus = {
    x: Math.max(0, Math.min(width, focusPoint.x)),
    y: Math.max(0, Math.min(height, focusPoint.y))
  };
  const targetZoom = 1.65;
  setCameraOnPoint(focus, targetZoom);
  const story = caveStories[roomId - 1];
  document.querySelector('#story-eyebrow').textContent = `FINAS HÖHLENCHRONIK · KAMMER ${String(roomId).padStart(2, '0')}`;
  document.querySelector('#story-title').textContent = story.title;
  const copy = document.querySelector('#story-copy');
  copy.replaceChildren(...story.paragraphs.map((paragraph) => {
    const element = document.createElement('p');
    element.textContent = paragraph;
    return element;
  }));
  document.querySelector('#story-copy').hidden = false;
  document.querySelector('#mission-copy').hidden = true;
  document.querySelector('#story-mission').textContent = 'Weiter zur Forschungsmission';
  document.querySelector('#story-return').textContent = 'Zur Höhlenkarte';
  missionViewOpen = false;
  window.setTimeout(() => {
    if (activeStoryRoom !== roomId) return;
    storyOpen = true;
    const screen = document.querySelector('#story-screen');
    screen.hidden = false;
    viewport.classList.add('story-reading');
    screen.offsetWidth;
    screen.classList.add('visible');
  }, 2000);
}

function showMissionPlaceholder() {
  if (missionViewOpen) {
    const story = caveStories[activeStoryRoom - 1];
    document.querySelector('#story-eyebrow').textContent = `FINAS HÖHLENCHRONIK · KAMMER ${String(activeStoryRoom).padStart(2, '0')}`;
    document.querySelector('#story-title').textContent = story.title;
    document.querySelector('#story-copy').hidden = false;
    document.querySelector('#mission-copy').hidden = true;
    document.querySelector('#story-mission').textContent = 'Weiter zur Forschungsmission';
    missionViewOpen = false;
    return;
  }
  missionViewOpen = true;
  document.querySelector('#story-eyebrow').textContent = 'FINAS FORSCHUNGSMISSION';
  document.querySelector('#story-title').textContent = 'Die Spur ruft';
  document.querySelector('#story-copy').hidden = true;
  document.querySelector('#mission-copy').hidden = false;
  document.querySelector('#story-mission').textContent = 'Zur Geschichte';
}

function closeCaveStory() {
  if (!storyOpen || !cameraBeforeStory) return;
  storyOpen = false;
  const screen = document.querySelector('#story-screen');
  screen.classList.remove('visible');
  viewport.classList.remove('story-reading');
  zoom = cameraBeforeStory.zoom;
  offsetX = cameraBeforeStory.offsetX;
  offsetY = cameraBeforeStory.offsetY;
  renderTransform();
  window.setTimeout(() => {
    screen.hidden = true;
    viewport.classList.remove('cinematic-active', 'cinematic-camera', 'cave-entry-light');
    activeStoryRoom = null;
    cameraBeforeStory = null;
    cinematicBusy = false;
  }, 2000);
}

function drawTestRoute() {
  console.debug('[Fina-Test] Klick auf Laufweg testen', { nodeCount: stateNodes.length, edgeCount: stateEdges.length });
  routePreview = null;
  const roomOneRawHold = Object.hasOwn(roomLinks, '1') ? roomLinks['1'] : roomLinks[1];
  const roomTwoRawHold = Object.hasOwn(roomLinks, '2') ? roomLinks['2'] : roomLinks[2];
  const roomOneHold = getRoomHoldNode(1);
  const roomTwoHold = getRoomHoldNode(2);
  const roomOneReachable = roomOneHold ? reachableNodeIds(roomOneHold.id) : new Set();
  const roomTwoReachable = roomTwoHold ? reachableNodeIds(roomTwoHold.id) : new Set();
  Object.assign(testDebugState, {
    clicked: true,
    spriteLoaded: fina.classList.contains('asset-ready'),
    startPosition: Number.isFinite(state.fox.x) && Number.isFinite(state.fox.y),
    startRoom: Boolean(roomOneHold),
    targetRoom: Boolean(roomTwoHold),
    roomOneHoldId: roomOneRawHold === undefined ? 'nicht zugeordnet' : `${String(roomOneRawHold)} (${typeof roomOneRawHold})`,
    roomOneHoldExists: Boolean(roomOneHold),
    roomOneHoldConnected: Boolean(roomOneHold && roomOneReachable.size > 1),
    roomTwoHoldId: roomTwoRawHold === undefined ? 'nicht zugeordnet' : `${String(roomTwoRawHold)} (${typeof roomTwoRawHold})`,
    roomTwoHoldExists: Boolean(roomTwoHold),
    roomTwoHoldConnected: Boolean(roomTwoHold && roomTwoReachable.size > 1),
    roomOneToTwoReachable: Boolean(roomOneHold && roomTwoHold && roomOneReachable.has(nodeKey(roomTwoHold.id))),
    routeComputed: false,
    animationStarted: false,
    error: ''
  });
  routeFeedback.textContent = 'Laufweg-Test gestartet. Prüfe Kammern und Wegnetz ...';
  const fromId = Number(document.querySelector('#route-from').value);
  const toId = Number(document.querySelector('#route-to').value);
  const from = rooms.find((room) => room.id === fromId);
  const to = rooms.find((room) => room.id === toId);
  const fromRawHold = Object.hasOwn(roomLinks, String(fromId)) ? roomLinks[String(fromId)] : roomLinks[fromId];
  const toRawHold = Object.hasOwn(roomLinks, String(toId)) ? roomLinks[String(toId)] : roomLinks[toId];
  const fromHold = getRoomHoldNode(fromId);
  const toHold = getRoomHoldNode(toId);
  testDebugState.startRoom = Boolean(fromHold);
  testDebugState.targetRoom = Boolean(toHold);
  testDebugState.roomOneHoldId = roomLinks[1] === undefined ? 'nicht zugeordnet' : `${String(roomLinks[1])} (${typeof roomLinks[1]})`;
  testDebugState.roomOneHoldExists = Boolean(roomOneHold);
  testDebugState.roomOneHoldConnected = Boolean(roomOneHold && roomOneReachable.size > 1);
  testDebugState.roomTwoHoldId = roomLinks[2] === undefined ? 'nicht zugeordnet' : `${String(roomLinks[2])} (${typeof roomLinks[2]})`;
  testDebugState.roomTwoHoldExists = Boolean(roomTwoHold);
  testDebugState.roomTwoHoldConnected = Boolean(roomTwoHold && reachableNodeIds(roomTwoHold.id).size > 1);
  testDebugState.roomOneToTwoReachable = Boolean(roomOneHold && roomTwoHold && roomOneReachable.has(nodeKey(roomTwoHold.id)));
  console.debug('[Fina-Test] Kammern ausgewählt', { startRoom: fromId || null, targetRoom: toId || null });
  console.debug('[Fina-Test] Wegpunkte vorhanden', stateNodes.length);

  try {
    if (!stateNodes.length) throw new Error('Es wurden noch keine Wegpunkte angelegt.');
    if (!testDebugState.startPosition) throw new Error('Die Position von Fina konnte nicht ermittelt werden.');
    if (fromId === toId) throw new Error('Bitte wähle unterschiedliche Start- und Zielkammern.');
    if (fromRawHold !== undefined && !fromHold) throw new Error(`Haltepunkt-ID ${String(fromRawHold)} für Kammer ${fromId} existiert nicht mehr. Bitte weise einen vorhandenen Wegpunkt neu zu.`);
    if (!fromHold) throw new Error(`Bitte zuerst einen Haltepunkt für ${roomNames[fromId - 1] ?? `Kammer ${fromId}`} festlegen.`);
    if (toRawHold !== undefined && !toHold) throw new Error(`Haltepunkt-ID ${String(toRawHold)} für Kammer ${toId} existiert nicht mehr. Bitte weise einen vorhandenen Wegpunkt neu zu.`);
    if (!toHold) throw new Error(`Bitte zuerst einen Haltepunkt für ${roomNames[toId - 1] ?? `Kammer ${toId}`} festlegen.`);

    const approach = findPath(state.fox, fromHold);
    if (!approach) throw new Error(`Finas Position ist nicht mit dem Haltepunkt der ${roomNames[fromId - 1]} verbunden.`);
    const roomPath = findPath(fromHold, toHold);
    if (!roomPath) {
      const startMatch = findNodeById(fromHold.id);
      const targetMatch = findNodeById(toHold.id);
      throw new Error(startMatch && targetMatch
        ? `Keine durchgehende Verbindung zwischen Haltepunkt-ID ${String(fromHold?.id ?? startMatch.id)} und Haltepunkt-ID ${String(toHold?.id ?? targetMatch.id)}. Prüfe die gespeicherten Kanten.`
        : 'Zwischen den Kammern existiert keine durchgehende Verbindung.');
    }
    const candidatePath = [...approach, ...roomPath.slice(1)];
    const path = candidatePath.filter((point, index) => index === 0 || Math.hypot(point.x - candidatePath[index - 1].x, point.y - candidatePath[index - 1].y) > 0.1);
    routePreview = path;
    testDebugState.routeComputed = true;
    routeFeedback.textContent = `Route gefunden: ${roomNames[from.id - 1]} bis ${roomNames[to.id - 1]} (${path.length} Punkte). Fina läuft jetzt.`;
    console.debug('[Fina-Test] Berechnete Route', path);
    updateTestDebug();
    if (!moveAlongPath(path)) throw new Error('Die berechnete Route konnte nicht gestartet werden.');
  } catch (error) {
    routeFeedback.textContent = error.message || 'Der Laufweg konnte nicht berechnet werden.';
    testDebugState.routeComputed = false;
    testDebugState.animationStarted = false;
    testDebugState.error = routeFeedback.textContent;
    updateTestDebug();
    console.error('[Fina-Test] Routentest fehlgeschlagen', error);
  }
  renderEdges();
}

function waypointNumber(nodeId) {
  const index = stateNodes.findIndex((node) => node.id === nodeId);
  return index < 0 ? '?' : index + 1;
}

function testSelectedWaypoint() {
  const targetNode = stateNodes.find((node) => node.id === selectedRouteNode);
  if (!targetNode) {
    nodeTestFeedback.textContent = 'Wähle zuerst einen Wegpunkt auf der Karte aus.';
    return;
  }
  const firstNode = stateNodes[0];
  if (!firstNode) {
    nodeTestFeedback.textContent = 'Es wurden noch keine Wegpunkte angelegt.';
    return;
  }
  const startGap = Math.hypot(firstNode.x - foxStartPoint.x, firstNode.y - foxStartPoint.y);
  if (startGap > 1) {
    nodeTestFeedback.textContent = `Warnung: Wegpunkt 1 ist ${Math.round(startGap)} Kartenpixel von Finas Startposition entfernt.`;
    return;
  }
  const path = findPath(foxStartPoint, targetNode);
  if (!path) {
    const reached = reachableNodeIds(firstNode.id);
    const lastReachable = [...reached]
      .map((id) => stateNodes.find((node) => node.id === id))
      .filter(Boolean)
      .sort((a, b) => Math.hypot(a.x - targetNode.x, a.y - targetNode.y) - Math.hypot(b.x - targetNode.x, b.y - targetNode.y))[0];
    nodeTestFeedback.textContent = lastReachable
      ? `Keine durchgehende Verbindung: Zwischen Wegpunkt ${waypointNumber(lastReachable.id)} und Wegpunkt ${waypointNumber(targetNode.id)} fehlt ein Wegabschnitt.`
      : 'Vom Startwegpunkt ist keine Route zum ausgewählten Wegpunkt erreichbar.';
    return;
  }
  if (path.length < 2) {
    nodeTestFeedback.textContent = 'Fina befindet sich bereits am ausgewählten Wegpunkt.';
    return;
  }
  state.fox = { ...foxStartPoint, angle: state.fox.angle || 0 };
  nodeTestFeedback.textContent = `Test läuft bis Wegpunkt ${waypointNumber(targetNode.id)} ...`;
  routePreview = path;
  renderEdges();
  moveAlongPath(path, null, null, 'waypoint-test');
}

function testRoomHold() {
  const roomId = Number(document.querySelector('#hold-room').value);
  const room = rooms.find((entry) => entry.id === roomId);
  const targetNode = getRoomHoldNode(roomId);
  if (!room || !targetNode) {
    roomHoldFeedback.textContent = 'Bitte zuerst einen Haltepunkt für diese Kammer festlegen.';
    return;
  }
  if (!Number.isFinite(state.fox.x) || !Number.isFinite(state.fox.y)) {
    roomHoldFeedback.textContent = 'Finas aktuelle Position konnte nicht ermittelt werden.';
    return;
  }
  const startMatch = nearestNode(state.fox);
  const targetMatch = nearestNode(targetNode);
  const reachable = startMatch && startMatch.distance <= 26
    ? reachableNodeIds(startMatch.node.id)
    : new Set();
  if (!startMatch || startMatch.distance > 26 || !reachable.has(nodeKey(targetMatch.node.id))) {
    roomHoldFeedback.textContent = 'Zum ausgewählten Haltepunkt existiert kein durchgehender Laufweg.';
    return;
  }
  const path = findPath(state.fox, targetNode);
  if (!path) {
    roomHoldFeedback.textContent = 'Zum ausgewählten Haltepunkt existiert kein durchgehender Laufweg.';
    return;
  }
  if (path.length < 2) {
    roomHoldFeedback.textContent = `Fina steht bereits am Haltepunkt für ${roomNames[roomId - 1]}.`;
    return;
  }
  roomHoldFeedback.textContent = `Fina läuft von ihrer aktuellen Position zum Haltepunkt der ${roomNames[roomId - 1]} ...`;
  routePreview = path;
  renderEdges();
  try {
    if (!moveAlongPath(path, null, null, 'room-hold', true, roomId)) {
      throw new Error('Der Laufweg zum Haltepunkt konnte nicht gestartet werden.');
    }
  } catch (error) {
    roomHoldFeedback.textContent = error.message || 'Der Laufweg konnte nicht gestartet werden.';
  }
}

function beginFreeMoveTest() {
  const start = { ...state.fox };
  const target = { x: start.x + 100, y: start.y };
  if (target.x > width) {
    routeFeedback.textContent = 'Fina kann sich von dieser Startposition nicht 100 Pixel nach rechts bewegen, ohne die Karte zu verlassen.';
    return;
  }
  const path = [start, target];
  routeFeedback.textContent = 'Fina bewegt sich 100 Kartenpixel nach rechts ...';
  console.debug('[Fina-Bewegungstest] 100-Pixel-Test gestartet', { start, target, duration: 2000 });
  try {
    moveAlongPath(path, null, 2000, 'pixel-test');
  } catch (error) {
    routeFeedback.textContent = error.message || 'Die Bewegung konnte nicht gestartet werden.';
    console.error('[Fina-Bewegungstest] Animation fehlgeschlagen', error);
  }
}

function openEditor(open) {
  editorOpen = open;
  editorPanel.hidden = !open;
  document.querySelector('#editor-toggle').setAttribute('aria-pressed', String(open));
  renderMapData();
}

image.addEventListener('load', () => {
  viewport.classList.add('has-map');
  renderMapData();
});
image.addEventListener('error', () => {
  document.querySelector('#image-notice').hidden = false;
  viewport.classList.remove('has-map');
});
if (image.complete && image.naturalWidth > 0) viewport.classList.add('has-map');

for (const [id, delta] of [['zoom-in', 0.2], ['zoom-out', -0.2]]) {
  document.querySelector(`#${id}`).addEventListener('click', () => {
    zoom = Math.max(0.65, Math.min(3, zoom + delta));
    renderTransform();
  });
}
document.querySelector('#fit-map').addEventListener('click', () => {
  zoom = 1;
  offsetX = 0;
  offsetY = 0;
  renderTransform();
});
viewport.addEventListener('wheel', (event) => {
  if (!viewport.classList.contains('has-map') || event.target.closest('.editor-panel')) return;
  event.preventDefault();
  zoom = Math.max(0.65, Math.min(3, zoom + (event.deltaY < 0 ? 0.1 : -0.1)));
  renderTransform();
}, { passive: false });

viewport.addEventListener('pointerdown', (event) => {
  if (editorOpen || event.button !== 0 || event.target.closest('.topbar, .editor-panel, .setup-prompt, .explored-toast, .room-hit, .node-hit')) return;
  dragging = { x: event.clientX, y: event.clientY, offsetX, offsetY };
  viewport.classList.add('is-dragging');
  viewport.setPointerCapture(event.pointerId);
});
viewport.addEventListener('pointermove', (event) => {
  if (!dragging) return;
  offsetX = dragging.offsetX + event.clientX - dragging.x;
  offsetY = dragging.offsetY + event.clientY - dragging.y;
  renderTransform();
});
function stopDragging() { dragging = null; viewport.classList.remove('is-dragging'); }
viewport.addEventListener('pointerup', stopDragging);
viewport.addEventListener('pointercancel', stopDragging);

overlay.addEventListener('pointerdown', (event) => {
  if (!editorOpen || event.button !== 0) return;
  const nodeHit = event.target.closest('[data-node]');
  if (nodeHit && tool === 'move') {
    movingNode = Number(nodeHit.dataset.node);
    selectedNode = movingNode;
    suppressOverlayClick = true;
    overlay.setPointerCapture(event.pointerId);
    event.preventDefault();
    return;
  }
  const anchor = event.target.closest('[data-room-anchor]');
  const hit = event.target.closest('[data-room]');
  const roomId = Number(anchor?.dataset.roomAnchor ?? hit?.dataset.room);
  if (!roomId || (tool !== 'room' && tool !== 'area') || (tool === 'area' && !anchor)) return;
  const room = rooms.find((entry) => entry.id === roomId);
  if (!room) return;
  selectedRoom = roomId;
  if (tool === 'room' && Number.isFinite(room.x)) {
    roomGesture = { kind: 'position', roomId, start: pointFromEvent(event) };
  } else if (tool === 'area' && Number.isFinite(room.x)) {
    roomGesture = { kind: 'area', roomId, start: { x: room.x, y: room.y } };
  } else {
    renderMapData();
    return;
  }
  suppressOverlayClick = true;
  overlay.setPointerCapture(event.pointerId);
  event.preventDefault();
  renderRooms();
});
overlay.addEventListener('pointermove', (event) => {
  if (movingNode !== null) {
    const node = findNodeById(movingNode);
    if (node) Object.assign(node, pointFromEvent(event));
    renderEdges();
    renderNodes();
    return;
  }
  if (!roomGesture) return;
  const point = pointFromEvent(event);
  const room = rooms.find((entry) => entry.id === roomGesture.roomId);
  if (!room) return;
  if (roomGesture.kind === 'position') {
    room.x = point.x;
    room.y = point.y;
  } else {
    room.area = { rx: Math.max(8, Math.abs(point.x - roomGesture.start.x)), ry: Math.max(8, Math.abs(point.y - roomGesture.start.y)) };
  }
  renderRooms();
});
overlay.addEventListener('pointerup', () => {
  if (movingNode !== null) {
    movingNode = null;
    selectedNode = null;
    saveMap();
    renderMapData();
  }
  finishRoomGesture();
  if (suppressOverlayClick) window.setTimeout(() => { suppressOverlayClick = false; }, 0);
});
overlay.addEventListener('pointercancel', () => {
  movingNode = null;
  finishRoomGesture();
  suppressOverlayClick = false;
});

overlay.addEventListener('click', (event) => {
  if (suppressOverlayClick) {
    suppressOverlayClick = false;
    return;
  }
  if (editorOpen && tool === 'foxStart') {
    handleEditorBlankClick(pointFromEvent(event));
    return;
  }
  const edgeHit = event.target.closest('[data-edge]');
  if (edgeHit && editorOpen && (tool === 'insert' || tool === 'delete')) {
    const [firstText, secondText] = edgeHit.dataset.edge.split(',');
    const firstId = findNodeById(firstText)?.id ?? firstText;
    const secondId = findNodeById(secondText)?.id ?? secondText;
    stateEdges = stateEdges.filter(([first, second]) => !((nodeKey(first) === nodeKey(firstId) && nodeKey(second) === nodeKey(secondId)) || (nodeKey(first) === nodeKey(secondId) && nodeKey(second) === nodeKey(firstId))));
    if (tool === 'insert') {
      const node = { id: nextNodeId++, ...pointFromEvent(event) };
      const firstIndex = stateNodes.findIndex((entry) => entry.id === firstId);
      const secondIndex = stateNodes.findIndex((entry) => entry.id === secondId);
      const insertIndex = firstIndex >= 0 && secondIndex === firstIndex + 1 ? secondIndex : stateNodes.length;
      stateNodes.splice(insertIndex, 0, node);
      stateEdges.push([firstId, node.id], [node.id, secondId]);
      selectedRouteNode = node.id;
      routeFeedback.textContent = 'Wegpunkt eingefügt und verbunden.';
    } else {
      routeFeedback.textContent = 'Verbindung entfernt.';
    }
    saveMap();
    renderMapData();
    return;
  }
  const roomHit = event.target.closest('[data-room]');
  if (roomHit) {
    if (editorOpen && (tool === 'draw' || (tool === 'move' && movingNode !== null))) {
      handleEditorBlankClick(pointFromEvent(event));
      return;
    }
    handleRoomClick(Number(roomHit.dataset.room));
    return;
  }
  const nodeHit = event.target.closest('[data-node]');
  if (nodeHit && editorOpen) { handleNodeClick(Number(nodeHit.dataset.node)); return; }
  if (editorOpen) handleEditorBlankClick(pointFromEvent(event));
});

document.querySelectorAll('.mode-button').forEach((button) => button.addEventListener('click', () => setTool(button.dataset.mode)));
document.querySelector('#free-move-test').addEventListener('click', beginFreeMoveTest);
document.querySelector('#editor-toggle').addEventListener('click', () => openEditor(!editorOpen));
document.querySelector('#close-editor').addEventListener('click', () => openEditor(false));
document.querySelector('#open-editor').addEventListener('click', () => openEditor(true));
document.querySelector('#save-map').addEventListener('click', saveMap);
document.querySelector('#assign-hold').addEventListener('click', () => {
  const roomId = Number(document.querySelector('#hold-room').value);
  const nodeId = Number(document.querySelector('#hold-node').value);
  if (!rooms.some((room) => room.id === roomId) || !stateNodes.some((node) => node.id === nodeId)) {
    roomHoldFeedback.textContent = 'Wähle eine Kammer und einen vorhandenen Wegpunkt aus.';
    return;
  }
  roomLinks[roomId] = nodeId;
  saveMap();
  renderMapData();
  roomHoldFeedback.textContent = `Haltepunkt für Kammer ${roomId} gespeichert.`;
});
document.querySelector('#test-room-hold').addEventListener('click', testRoomHold);
document.querySelector('#story-mission').addEventListener('click', showMissionPlaceholder);
document.querySelector('#story-return').addEventListener('click', closeCaveStory);
document.querySelector('#export-rooms').addEventListener('click', () => {
  const configuration = { version: 1, rooms: rooms.map((room) => ({ ...room, name: roomNames[room.id - 1] })) };
  const blob = new Blob([`${JSON.stringify(configuration, null, 2)}\n`], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'hoehlenkammern.json';
  link.click();
  URL.revokeObjectURL(link.href);
});
document.querySelector('#export-routes').addEventListener('click', () => {
  const configuration = { version: 1, nodes: stateNodes, edges: stateEdges };
  configuration.roomLinks = roomLinks;
  const blob = new Blob([`${JSON.stringify(configuration, null, 2)}\n`], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'finas-wege.json';
  link.click();
  URL.revokeObjectURL(link.href);
});
const importRoomsInput = document.querySelector('#import-rooms');
document.querySelector('#import-rooms-button').addEventListener('click', () => importRoomsInput.click());
importRoomsInput.addEventListener('change', async () => {
  const [file] = importRoomsInput.files;
  if (!file) return;
  try {
    saveRoomConfiguration(JSON.parse(await file.text()));
  } catch (error) {
    document.querySelector('#storage-note').textContent = error instanceof SyntaxError ? 'Die JSON-Datei ist nicht lesbar.' : error.message;
  }
  importRoomsInput.value = '';
});
const importRoutesInput = document.querySelector('#import-routes');
document.querySelector('#import-routes-button').addEventListener('click', () => importRoutesInput.click());
importRoutesInput.addEventListener('change', async () => {
  const [file] = importRoutesInput.files;
  if (!file) return;
  try {
    const configuration = JSON.parse(await file.text());
    if (!configuration || configuration.version !== 1 || !Array.isArray(configuration.nodes) || !Array.isArray(configuration.edges)) {
      throw new Error('Ungültige Wege-JSON-Datei.');
    }
    const importedNodes = configuration.nodes.map((node) => ({ id: node.id, x: node.x, y: node.y }));
    const validNodeId = (id) => (Number.isInteger(id) && id >= 1) || (typeof id === 'string' && /^[1-9]\d*$/.test(id));
    if (importedNodes.some((node) => !validNodeId(node.id) || !Number.isFinite(node.x) || !Number.isFinite(node.y) || node.x < 0 || node.x > width || node.y < 0 || node.y > height)
      || new Set(importedNodes.map((node) => nodeKey(node.id))).size !== importedNodes.length) throw new Error('Ungültige oder doppelte Wegpunkte.');
    const nodeIdByKey = new Map(importedNodes.map((node) => [nodeKey(node.id), node.id]));
    const importedEdges = configuration.edges.map((edge) => Array.isArray(edge) && edge.length === 2
      ? [nodeIdByKey.get(nodeKey(edge[0])), nodeIdByKey.get(nodeKey(edge[1]))]
      : edge);
    const edgeKeys = new Set();
    if (importedEdges.some((edge) => {
      if (!Array.isArray(edge) || edge.length !== 2 || edge[0] === undefined || edge[1] === undefined || nodeKey(edge[0]) === nodeKey(edge[1])) return true;
      const key = [nodeKey(edge[0]), nodeKey(edge[1])].sort().join(':');
      if (edgeKeys.has(key)) return true;
      edgeKeys.add(key);
      return false;
    })) throw new Error('Ungültige oder doppelte Wegverbindungen.');
    const importedRoomLinks = configuration.roomLinks ?? {};
    if (!importedRoomLinks || typeof importedRoomLinks !== 'object' || Array.isArray(importedRoomLinks)) {
      throw new Error('Ungültige Kammeranschlüsse.');
    }
    for (const [roomIdText, rawNodeId] of Object.entries(importedRoomLinks)) {
      const roomId = Number(roomIdText);
      const nodeId = nodeIdByKey.get(nodeKey(rawNodeId));
      if (!Number.isInteger(roomId) || roomId < 1 || roomId > rooms.length || nodeId === undefined) {
        throw new Error(`Ungültiger Kammeranschluss für Kammer ${roomIdText}.`);
      }
      importedRoomLinks[roomId] = nodeId;
    }
    stateNodes = importedNodes;
    stateEdges = importedEdges;
    roomLinks = importedRoomLinks;
    nextNodeId = stateNodes.reduce((maximum, node) => Math.max(maximum, node.id), 0) + 1;
    saveMap();
    renderMapData();
    document.querySelector('#storage-note').textContent = 'Wegnetz importiert.';
  } catch (error) {
    document.querySelector('#storage-note').textContent = error instanceof SyntaxError ? 'Die JSON-Datei ist nicht lesbar.' : error.message;
  }
  importRoutesInput.value = '';
});
document.querySelector('#clear-map').addEventListener('click', () => {
  if (!window.confirm('Alle Kammerpositionen, Wegpunkte und Verbindungen löschen?')) return;
  for (const room of rooms) { room.x = null; room.y = null; room.area = null; }
  stateNodes = [];
  stateEdges = [];
  roomLinks = {};
  selectedRouteNode = null;
  nextNodeId = 1;
  saveMap();
  renderMapData();
  routeFeedback.textContent = 'Kartendaten gelöscht.';
});
document.querySelector('#test-route').addEventListener('click', drawTestRoute);
document.querySelector('#test-to-node').addEventListener('click', testSelectedWaypoint);
unlockButton.addEventListener('click', () => {
  const nextId = Number(unlockButton.dataset.next);
  if (!nextId || state.unlocked.includes(nextId)) return;
  state.unlocked.push(nextId);
  saveProgress();
  exploredToast.hidden = true;
});

const fullscreenButton = document.querySelector('#fullscreen');
fullscreenButton.addEventListener('click', async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await viewport.requestFullscreen();
  } catch {
    fullscreenButton.title = 'Vollbildmodus ist in diesem Browser nicht verfügbar';
  }
});
document.addEventListener('fullscreenchange', () => {
  viewport.classList.toggle('is-fullscreen', Boolean(document.fullscreenElement));
  fullscreenButton.setAttribute('aria-label', document.fullscreenElement ? 'Vollbildmodus beenden' : 'Vollbildmodus');
});

nextNodeId = stateNodes.reduce((maximum, node) => Math.max(maximum, node.id), 0) + 1;
renderTransform();
renderLights();
renderMapData();
