/**
 * Species Atlas - Grafo Filogenético Interactivo con D3.js v7
 * Autor: danilodevsr
 */

(function () {
  'use strict';

  // --- Elementos del DOM ---
  const svg = d3.select('#graphSvg');
  const viewport = document.getElementById('graphViewport');
  const searchInput = document.getElementById('searchInput');
  const searchResults = document.getElementById('searchResults');
  let searchMatches = [];
  let fittedIds = null;
  let overview = true;
  let lastSelectedElement = null;
  const mobileLayout = () => window.matchMedia('(max-width: 768px)').matches;
  const clearSearchBtn = document.getElementById('clearSearch');
  const groupFilter = document.getElementById('groupFilter');
  const btnResetZoom = document.getElementById('btnResetZoom');

  // Drawer elements
  const detailDrawer = document.getElementById('detailDrawer');
  const btnCloseDrawer = document.getElementById('btnCloseDrawer');
  const drawerImageCredit = document.getElementById('drawerImageCredit');
  const drawerImage = document.getElementById('drawerImage');
  const drawerBadge = document.getElementById('drawerBadge');
  const drawerTitle = document.getElementById('drawerTitle');
  const drawerScientific = document.getElementById('drawerScientific');
  const drawerRank = document.getElementById('drawerRank');
  const drawerParent = document.getElementById('drawerParent');
  const drawerOrigin = document.getElementById('drawerOrigin');
  const drawerDescription = document.getElementById('drawerDescription');
  const drawerWikiLink = document.getElementById('drawerWikiLink');
  const drawerFocusBtn = document.getElementById('drawerFocusBtn');

  // --- Estado global ---
  let graphData = { nodes: [], links: [] };
  let zoomBehavior;
  let gMain, gLinks, gNodes;
  let activeNode = null;

  // --- Colores y Estilos ---
  const BRANCH_COLORS = {
    carnivora: '#f43f5e',
    pinnipedia: '#0ea5e9',
    feliformia: '#f59e0b',
    caniformia: '#10b981',
    otariidae: '#38bdf8',
    phocidae: '#0284c7',
    odobenidae: '#0369a1',
    felidae: '#d97706',
    canidae: '#059669',
    ursidae: '#16a34a'
  };

  function getNodeColor(node) {
    if (node.color) return node.color;
    const parentColor = graphData.nodes.find(n => n.id === node.parent)?.color;
    if (parentColor) return parentColor;
    if (node.parent && BRANCH_COLORS[node.parent]) {
      return BRANCH_COLORS[node.parent];
    }
    // Buscar ancestro
    if (node.type === 'species') {
      const parentNode = graphData.nodes.find(n => n.id === node.parent);
      if (parentNode && parentNode.parent && BRANCH_COLORS[parentNode.parent]) {
        return BRANCH_COLORS[parentNode.parent];
      }
    }
    return '#94a3b8';
  }

  function getNodeRadius(node) {
    switch (node.type) {
      case 'root': return 32;
      case 'suborder': return 24;
      case 'order': return 26;
      case 'family': return 18;
      case 'species': return 20;
      default: return 16;
    }
  }

  function getRankName(type) {
    switch (type) {
      case 'root': return 'Reino';
      case 'suborder': return 'Grupo';
      case 'order': return 'Orden';
      case 'family': return 'Familia';
      case 'species': return 'Especie';
      default: return 'Taxón';
    }
  }

  // --- Carga de Datos e Inicialización ---
  async function init() {
    try {
      const response = await fetch('./data/animals.json?v=4');
      if (!response.ok) throw new Error('No se pudo cargar animals.json');
      graphData = await response.json();
      setupGraph();
      setupEventListeners();
      const legend = document.querySelector('.floating-legend');
      legend.open = !mobileLayout();
      window.matchMedia('(max-width: 768px)').addEventListener('change', event => {
        legend.open = !event.matches;
      });
    } catch (err) {
      console.error('Error al inicializar grafo:', err);
      viewport.innerHTML = `<div style="padding:40px;text-align:center;color:#f87171;">
        <h3>Error al cargar los datos del árbol</h3>
        <p>${err.message}</p>
      </div>`;
    }
  }

  function setupGraph() {
    const width = viewport.clientWidth || window.innerWidth;
    const height = viewport.clientHeight || window.innerHeight;

    svg.attr('viewBox', [0, 0, width, height]);

    // Contenedor principal con zoom
    gMain = svg.append('g').attr('class', 'g-main');

    // Patrones SVG para imágenes circulares de especies
    const defs = svg.append('defs');

    // Filtro de resplandor (Glow)
    const filter = defs.append('filter')
      .attr('id', 'glow')
      .attr('x', '-50%').attr('y', '-50%')
      .attr('width', '200%').attr('height', '200%');
    filter.append('feGaussianBlur')
      .attr('stdDeviation', '4')
      .attr('result', 'coloredBlur');
    const feMerge = filter.append('feMerge');
    feMerge.append('feMergeNode').attr('in', 'coloredBlur');
    feMerge.append('feMergeNode').attr('in', 'SourceGraphic');

    // Crear clipPaths e imágenes dentro de patrones para cada nodo con foto
    graphData.nodes.forEach(node => {
      if (node.image) {
        const radius = getNodeRadius(node);
        const pattern = defs.append('pattern')
          .attr('id', `pat-${node.id}`)
          .attr('width', 1)
          .attr('height', 1)
          .attr('patternContentUnits', 'objectBoundingBox');

        pattern.append('image')
          .attr('href', node.image)
          .attr('preserveAspectRatio', 'xMidYMid slice')
          .attr('width', 1)
          .attr('height', 1);
      }
    });

    // Grupos para enlaces y nodos
    gLinks = gMain.append('g').attr('class', 'g-links');
    gNodes = gMain.append('g').attr('class', 'g-nodes');

    // El árbol reserva una fila por profundidad y alinea las especies al final.
    const hierarchy = d3.stratify().id(d => d.id).parentId(d => d.parent || null)(graphData.nodes);
    d3.tree().nodeSize([190, 145])(hierarchy);
    const finalDepth = d3.max(hierarchy.descendants(), d => d.depth);
    const leaves = hierarchy.leaves();
    hierarchy.x = (d3.min(leaves, d => d.x) + d3.max(leaves, d => d.x)) / 2;
    hierarchy.each(item => {
      item.data.x = item.x;
      item.data.y = (item.data.type === 'species' ? finalDepth : item.depth) * 145;
    });
    const nodeById = new Map(graphData.nodes.map(node => [node.id, node]));
    graphData.links.forEach(link => {
      link.source = nodeById.get(link.source);
      link.target = nodeById.get(link.target);
    });

    // Renderizar Enlaces
    const links = gLinks.selectAll('line')
      .data(graphData.links)
      .join('line')
      .attr('class', 'graph-link')
      .attr('stroke', d => {
        const targetNode = typeof d.target === 'object' ? d.target : graphData.nodes.find(n => n.id === d.target);
        return getNodeColor(targetNode);
      });

    // Renderizar Nodos
    const nodes = gNodes.selectAll('.graph-node')
      .data(graphData.nodes)
      .join('g')
      .attr('class', 'graph-node')
      .attr('id', d => `node-${d.id}`)
      .attr('tabindex', 0)
      .attr('role', 'button')
      .attr('aria-label', d => `Ver ficha: ${d.label || d.common_name}`);

    // Círculo base de cada nodo
    nodes.append('circle')
      .attr('class', 'node-circle')
      .attr('r', d => getNodeRadius(d))
      .attr('fill', d => {
        if (d.type === 'species' && d.image) return `url(#pat-${d.id})`;
        return getNodeColor(d);
      })
      .attr('stroke', d => getNodeColor(d));

    // Emoji o ícono para nodos de categoría (root, suborder, family) o especies sin imagen
    nodes.each(function (d) {
      if (d.type !== 'species' || (!d.image && d.emoji)) {
        d3.select(this).append('text')
          .attr('text-anchor', 'middle')
          .attr('dy', '0.35em')
          .attr('font-size', d.type === 'root' ? '22px' : d.type === 'suborder' ? '17px' : '13px')
          .attr('pointer-events', 'none')
          .text(d.emoji || '🐾');
      }
    });

    // Etiquetas de texto debajo de los nodos
    nodes.append('text')
      .attr('class', d => `node-label label-${d.type}`)
      .attr('dy', d => getNodeRadius(d) + 14)
      .text(d => d.label || d.common_name);

    // Eventos de mouse en los nodos
    nodes
      .on('mouseenter', (event, d) => highlightNodeBranch(d))
      .on('mouseleave', () => resetHighlights())
      .on('keydown', (event, d) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          selectNode(d);
        }
      })
      .on('click', (event, d) => {
        event.stopPropagation();
        selectNode(d);
      });

    // Zoom y Pan
    zoomBehavior = d3.zoom()
      .scaleExtent([0.05, 4])
      .on('start', event => { if (event.sourceEvent) overview = false; })
      .on('zoom', (event) => {
        gMain.attr('transform', event.transform);
      });

    svg.call(zoomBehavior)
      .on('click', () => {
        // Clic en el fondo deselecciona
        closeDrawer();
        resetHighlights();
      });

    // Actualización en cada tick de la física
    function renderGraph() {
      links
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y);

      nodes.attr('transform', d => `translate(${d.x},${d.y})`);
    }
    renderGraph();
    fitGraph(false);

    // Header wrapping and device rotation both change the actual drawable area.
    let previousWidth = width, previousHeight = height;
    new ResizeObserver(() => {
      const w = viewport.clientWidth;
      const h = viewport.clientHeight;
      if (!w || !h || (w === previousWidth && h === previousHeight)) return;
      previousWidth = w;
      previousHeight = h;
      svg.attr('viewBox', [0, 0, w, h]);
      if (overview) fitGraph(false);
      else if (activeNode) focusOnNode(activeNode);
    }).observe(viewport);
  }

  // --- Funciones de Interacción y Resaltado ---
  function highlightNodeBranch(node) {
    const connectedNodeIds = new Set([node.id]);

    // Recorrer enlaces para encontrar vecinos directos
    graphData.links.forEach(l => {
      const sId = typeof l.source === 'object' ? l.source.id : l.source;
      const tId = typeof l.target === 'object' ? l.target.id : l.target;
      if (sId === node.id) connectedNodeIds.add(tId);
      if (tId === node.id) connectedNodeIds.add(sId);
    });

    // Resaltar u opacar nodos
    gNodes.selectAll('.graph-node').classed('dimmed', d => !connectedNodeIds.has(d.id));
    
    // Resaltar u opacar enlaces
    gLinks.selectAll('.graph-link')
      .classed('highlighted', l => {
        const sId = typeof l.source === 'object' ? l.source.id : l.source;
        const tId = typeof l.target === 'object' ? l.target.id : l.target;
        return sId === node.id || tId === node.id;
      })
      .classed('dimmed', l => {
        const sId = typeof l.source === 'object' ? l.source.id : l.source;
        const tId = typeof l.target === 'object' ? l.target.id : l.target;
        return sId !== node.id && tId !== node.id;
      });
  }

  function resetHighlights() {
    if (activeNode) {
      highlightNodeBranch(activeNode);
      return;
    }
    gNodes.selectAll('.graph-node').classed('dimmed', d => Boolean(fittedIds && !fittedIds.has(d.id)));
    gLinks.selectAll('.graph-link').classed('highlighted', false).classed('dimmed', link =>
      Boolean(fittedIds && (!fittedIds.has(link.source.id) || !fittedIds.has(link.target.id))));
  }

  function selectNode(node) {
    activeNode = node;
    gNodes.selectAll('.graph-node').classed('active', d => d.id === node.id);
    highlightNodeBranch(node);
    openDrawer(node);
  }

  function fitGraph(animate = true) {
    overview = true;
    const width = viewport.clientWidth;
    const height = viewport.clientHeight;
    const elements = gNodes.selectAll('.graph-node').nodes().filter(element =>
      !fittedIds || fittedIds.has(element.id.replace('node-', '')));
    if (!elements.length || !width || !height) return;
    const boxes = elements.map(element => {
      const box = element.getBBox();
      const node = graphData.nodes.find(n => `node-${n.id}` === element.id);
      return { x: node.x + box.x, y: node.y + box.y, width: box.width, height: box.height };
    });
    const x0 = Math.min(...boxes.map(b => b.x));
    const y0 = Math.min(...boxes.map(b => b.y));
    const x1 = Math.max(...boxes.map(b => b.x + b.width));
    const y1 = Math.max(...boxes.map(b => b.y + b.height));
    const bottom = mobileLayout() ? 64 : 44;
    const scale = Math.min(1, (width - 32) / Math.max(1, x1 - x0),
      (height - bottom - 24) / Math.max(1, y1 - y0));
    const transform = d3.zoomIdentity.translate(width / 2, (height - bottom) / 2)
      .scale(Math.max(0.05, scale)).translate(-(x0 + x1) / 2, -(y0 + y1) / 2);
    svg.interrupt();
    const target = animate ? svg.transition().duration(450) : svg;
    target.call(zoomBehavior.transform, transform);
  }

  function focusOnNode(node) {
    if (!node || node.x === undefined || node.y === undefined) return;
    overview = false;
    const width = viewport.clientWidth;
    const height = viewport.clientHeight;
    const scale = node.type === 'species' ? 1.8 : 1.3;
    const drawerWidth = !mobileLayout() && detailDrawer.classList.contains('open')
      ? detailDrawer.clientWidth : 0;
    svg.interrupt().transition().duration(450).call(zoomBehavior.transform,
      d3.zoomIdentity.translate(Math.max(0, width - drawerWidth) / 2, height / 2)
        .scale(scale).translate(-node.x, -node.y));
  }

  // --- Drawer / Panel de Información ---
  function openDrawer(node) {
    drawerTitle.textContent = node.label || node.common_name || node.id;
    drawerScientific.textContent = node.scientific_name ? `(${node.scientific_name})` : '';
    drawerRank.textContent = node.rank || getRankName(node.type);
    
    // Encontrar padre
    const parentNode = graphData.nodes.find(n => n.id === node.parent);
    drawerParent.textContent = parentNode ? (parentNode.label || parentNode.common_name) : 'Raíz';

    drawerOrigin.textContent = node.origin ? `En el Perú: ${node.origin}.` : '';
    drawerDescription.textContent = node.description || 'No hay descripción disponible para esta especie.';

    drawerImage.parentElement.style.display = (node.original_image || node.image) ? 'block' : 'none';
    if (node.original_image || node.image) {
      drawerImage.src = node.original_image || node.image;
      drawerImage.alt = node.label || node.scientific_name;
      drawerImage.style.display = 'block';
    } else {
      drawerImage.style.display = 'none';
    }

    drawerImageCredit.hidden = !node.image_credit;
    if (node.image_credit) drawerImageCredit.href = node.image_credit;
    drawerBadge.textContent = node.rank || getRankName(node.type);
    drawerBadge.style.color = getNodeColor(node);

    if (node.source_url || node.wiki_url) {
      drawerWikiLink.href = node.source_url || node.wiki_url;
      drawerWikiLink.style.display = 'flex';
    } else {
      drawerWikiLink.style.display = 'none';
    }

    drawerFocusBtn.onclick = () => {
      if (mobileLayout()) closeDrawer();
      focusOnNode(node);
    };

    lastSelectedElement = document.activeElement;
    detailDrawer.inert = false;
    detailDrawer.classList.add('open');
    detailDrawer.setAttribute('aria-hidden', 'false');
    btnCloseDrawer.focus({ preventScroll: true });
  }

  function closeDrawer() {
    const wasOpen = detailDrawer.classList.contains('open');
    if (wasOpen && detailDrawer.contains(document.activeElement)) {
      if (lastSelectedElement?.getClientRects().length) lastSelectedElement.focus({ preventScroll: true });
      else searchInput.focus({ preventScroll: true });
    }
    detailDrawer.inert = true;
    detailDrawer.classList.remove('open');
    detailDrawer.setAttribute('aria-hidden', 'true');
    activeNode = null;
    gNodes.selectAll('.graph-node').classed('active', false);
    resetHighlights();
  }

  // --- Filtros y Buscador ---
  function setupEventListeners() {
    // Cerrar drawer
    btnCloseDrawer.addEventListener('click', closeDrawer);

    // Fit the selected branch, or the whole atlas, to the available viewport.
    btnResetZoom.addEventListener('click', () => {
      closeDrawer();
      fitGraph();
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        closeDrawer();
        searchResults.hidden = true;
        searchInput.setAttribute('aria-expanded', 'false');
      }
    });

    // Searching presents explicit choices instead of covering the field with a drawer.
    const normalize = value => (value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    function chooseSearchResult(node) {
      searchResults.hidden = true;
      searchInput.setAttribute('aria-expanded', 'false');
      searchInput.blur();
      selectNode(node);
      focusOnNode(node);
    }
    searchInput.addEventListener('input', () => {
      const query = normalize(searchInput.value.trim());
      clearSearchBtn.style.display = query ? 'block' : 'none';
      searchResults.replaceChildren();
      searchResults.hidden = !query;
      searchInput.setAttribute('aria-expanded', String(Boolean(query)));
      if (!query) { searchMatches = []; return; }
      searchMatches = graphData.nodes.filter(n =>
        [n.label, n.common_name, n.scientific_name, ...(n.aliases || [])].some(value => normalize(value).includes(query)))
        .sort((a, b) => Number(normalize(b.label || b.common_name) === query) -
          Number(normalize(a.label || a.common_name) === query));
      if (!searchMatches.length) {
        const message = document.createElement('p');
        message.textContent = 'Sin resultados. Prueba otra especie o familia.';
        searchResults.append(message);
      }
      searchMatches.slice(0, 8).forEach(node => {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = node.label || node.common_name;
        button.addEventListener('click', () => chooseSearchResult(node));
        searchResults.append(button);
      });
    });
    searchInput.addEventListener('keydown', event => {
      if (event.key === 'Enter' && searchMatches.length) {
        event.preventDefault();
        chooseSearchResult(searchMatches[0]);
      } else if (event.key === 'ArrowDown' && !searchResults.hidden) {
        event.preventDefault();
        searchResults.querySelector('button')?.focus({ preventScroll: true });
      }
    });
    clearSearchBtn.addEventListener('click', () => {
      searchInput.value = '';
      searchMatches = [];
      clearSearchBtn.style.display = 'none';
      searchResults.hidden = true;
      searchInput.setAttribute('aria-expanded', 'false');
      closeDrawer();
      applyBranchFilter();
      searchInput.focus({ preventScroll: true });
    });
    document.addEventListener('click', event => {
      if (!event.target.closest('.search-box')) {
        searchResults.hidden = true;
        searchInput.setAttribute('aria-expanded', 'false');
      }
    });

    // Filtro por suborden / rama
    function applyBranchFilter() {
      closeDrawer();
      const selected = groupFilter.value;
      if (selected === 'all') {
        fittedIds = null;
        gNodes.selectAll('.graph-node').classed('dimmed', false);
        gLinks.selectAll('.graph-link').classed('dimmed', false).classed('highlighted', false);
        fitGraph();
        return;
      }

      // Categorías cotidianas y ramas taxonómicas comparten el mismo grafo.
      const visibleIds = new Set();
      if (selected.startsWith('uso:')) {
        graphData.nodes.filter(n => selected === 'uso:mercado' ? Boolean(n.category) : n.category === selected.slice(4)).forEach(n => visibleIds.add(n.id));
      } else {
        visibleIds.add(selected);
        let changed = true;
        while (changed) {
          changed = false;
          graphData.nodes.forEach(n => {
            if (n.parent && visibleIds.has(n.parent) && !visibleIds.has(n.id)) {
              visibleIds.add(n.id); changed = true;
            }
          });
        }
      }
      // Mostrar los caminos hasta la raíz también para selecciones de uso.
      [...visibleIds].forEach(id => {
        let node = graphData.nodes.find(n => n.id === id);
        while (node?.parent) {
          visibleIds.add(node.parent);
          node = graphData.nodes.find(n => n.id === node.parent);
        }
      });

      gNodes.selectAll('.graph-node').classed('dimmed', d => !visibleIds.has(d.id));
      gLinks.selectAll('.graph-link').classed('dimmed', l => {
        const sId = typeof l.source === 'object' ? l.source.id : l.source;
        const tId = typeof l.target === 'object' ? l.target.id : l.target;
        return !visibleIds.has(sId) || !visibleIds.has(tId);
      });

      fittedIds = visibleIds;
      fitGraph();
    }
    groupFilter.addEventListener('change', applyBranchFilter);
  }

  // Iniciar al cargar el DOM
  document.addEventListener('DOMContentLoaded', init);
})();
