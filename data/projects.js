// Fuente única de verdad para tus proyectos
export const PROJECTS = [
  // --- ATLAS VIRTUALES (/atlas/) ---
  {
    id: 'A01',
    title: 'World Atlas',
    desc: 'Atlas cartográfico global con visualización D3, proyección interactiva y subdivisiones distritales.',
    path: '/atlas/world-atlas/',
    emoji: '🗺️',
    tags: ['Cartografía', 'D3.js', 'GeoJSON', 'Atlas'],
    category: 'atlas'
  },
  {
    id: 'A02',
    title: 'Human Atlas 3D',
    desc: 'Explorador anatómico tridimensional del cuerpo humano por sistemas y capas biológicas.',
    path: '/atlas/human-atlas/',
    emoji: '🧬',
    tags: ['3D', 'WebGL', 'Anatomía', 'Atlas'],
    category: 'atlas'
  },
  {
    id: 'A03',
    title: 'Species Atlas',
    desc: 'Explorador interactivo de especies biológicas con grafos y relaciones taxonómicas.',
    path: '/atlas/visor-animales/',
    emoji: '🦁',
    tags: ['Atlas', 'Biología', 'Grafos'],
    category: 'atlas'
  },

  // --- HERRAMIENTAS (/tools/) ---
  {
    id: 'T01',
    title: 'FavicoGen',
    desc: 'Genera favicons multiformato a partir de imágenes o emojis en segundos.',
    path: '/tools/favicongen/',
    emoji: '🧩',
    tags: ['Frontend', 'Assets'],
    category: 'tools'
  },
  {
    id: 'T02',
    title: 'ImgTransform',
    desc: 'Redimensiona y convierte imágenes localmente sin subir nada a ningún servidor.',
    path: '/tools/imgtransform/',
    emoji: '🖼️',
    tags: ['Imágenes', 'PWA', 'Client-side'],
    category: 'tools'
  },
  {
    id: 'T03',
    title: 'PDFunify',
    desc: 'Fusiona y combina múltiples archivos PDF en uno solo de forma 100% offline.',
    path: '/tools/unir-pdfs-offline/',
    emoji: '📄',
    tags: ['PDF', 'PWA', 'Offline'],
    category: 'tools'
  },
  {
    id: 'T04',
    title: 'Agenda Builder',
    desc: 'Constructor interactivo de itinerarios y agendas diarias con exportación limpia.',
    path: '/tools/agenda-builder/',
    emoji: '📖',
    tags: ['Productividad', 'PWA'],
    category: 'tools'
  },
  {
    id: 'T05',
    title: 'HTML to Markdown',
    desc: 'Convierte código HTML o contenido web a formato Markdown limpio y estructurado.',
    path: '/tools/html-to-md/',
    emoji: '📝',
    tags: ['Docs', 'Markdown', 'Converter'],
    category: 'tools'
  },
  {
    id: 'T06',
    title: 'Visualizador de Código SAS',
    desc: 'Analizador estático de scripts SAS con grafo de dependencias y flujo de datos.',
    path: '/tools/visualizador-sas/',
    emoji: '📊',
    tags: ['SAS', 'Parser', 'Data Flow'],
    category: 'tools'
  },

  // --- EXPERIMENTAL (/experimental/) ---
  {
    id: 'E01',
    title: 'Precios de Combustible (Lima)',
    desc: 'Visualiza estaciones de servicio y precios en Lima con mapa interactivo Leaflet.',
    path: '/experimental/precios-combustible/',
    emoji: '⛽',
    tags: ['Datos', 'Leaflet', 'Lima'],
    category: 'experimental'
  },
  {
    id: 'E02',
    title: 'Webcam PiP & Mirror',
    desc: 'Previsualizador flotante para cámara con Picture-in-Picture y modo espejo instantáneo.',
    path: '/experimental/webcam-pip/',
    emoji: '📹',
    tags: ['Video', 'WebRTC', 'PiP'],
    category: 'experimental'
  },
  {
    id: 'E03',
    title: 'ExactHour',
    desc: 'Reloj de alta precisión temporal con sincronización visual libre de anuncios.',
    path: '/experimental/hora-exacta/',
    emoji: '⏱️',
    tags: ['Tiempo', 'Reloj', 'Minimal'],
    category: 'experimental'
  },

  // --- JUEGOS (/games/) ---
  {
    id: 'G01',
    title: 'Bingo 75 & 90',
    desc: 'Generador de cartones y bolillero con voz automatizada para reuniones.',
    path: '/games/bingo/',
    emoji: '🎱',
    tags: ['Juegos', 'Canvas', 'Audio'],
    category: 'games'
  },
  {
    id: 'G02',
    title: 'Línea de Tiempo Histórica',
    desc: 'Juego de trivia histórica ordenando eventos cronológicamente en el tiempo.',
    path: '/games/historic-game/',
    emoji: '⏳',
    tags: ['Historia', 'Trivia', 'Cronología'],
    category: 'games'
  }
];
