import { parseSasScript } from "./parsers/sas.js";
import { parseSqlScript } from "./parsers/sql.js";
import { emptyAnalysis } from "./parsers/model.js";

(function () {
  "use strict";

  const EXAMPLE_SAS = [
    "proc sql;",
    "create table tabla_01 as",
    "select *",
    "from transacciones_diarias",
    "where fecha_contable = today() - 1;",
    "",
    "create table tabla_02 as",
    "select a.*,",
    "       case when monto < 0 then 'DEVOLUCION' else 'BOLETA' end as indicador_venta",
    "from tabla_01 a",
    "left join clientes b",
    "  on a.id_cliente = b.id_cliente",
    "where b.activo = 1;",
    "",
    "create table tabla_03 as",
    "select *",
    "from tabla_02",
    "where id_cliente in (",
    "    select id_cliente",
    "    from clientes_preferentes",
    ");",
    "quit;",
    "",
    "data tabla_04;",
    "merge tabla_03 maestros_producto;",
    "by id_producto;",
    "run;",
    "",
    "proc s3;",
    "put tabla_04 s3://mi-bucket/reportes/tabla_04.csv;",
    "run;"
  ].join("\n");

  const EXAMPLE_SQL = "-- Ejemplo sintético. No se ejecuta ni se conecta a una base de datos.\nCREATE TABLE analytics.ventas_base AS\nSELECT cliente_id, producto_id, monto, fecha\nFROM raw.ventas\nWHERE fecha >= DATE '2026-01-01';\n\nCREATE VIEW analytics.resumen_clientes AS\nWITH clientes_activos AS (\n  SELECT cliente_id, segmento\n  FROM raw.clientes\n  WHERE activo = true\n), totales AS (\n  SELECT cliente_id, SUM(monto) AS total\n  FROM analytics.ventas_base\n  GROUP BY cliente_id\n)\nSELECT c.cliente_id, c.segmento, t.total\nFROM clientes_activos c\nJOIN totales t ON c.cliente_id = t.cliente_id;\n\nINSERT INTO reporting.ventas_por_segmento\nSELECT segmento, SUM(total) AS total_segmento\nFROM analytics.resumen_clientes\nGROUP BY segmento;\n\nSELECT *\nFROM reporting.ventas_por_segmento\nORDER BY total_segmento DESC;\n\n-- Se identifica la operación, pero no se desglosan sus dependencias internas.\nDELETE FROM reporting.ventas_por_segmento WHERE total_segmento = 0;\n";

  const CASCADE_LAYOUT = {
    topPadding: 80,
    stepGapY: 190,
    outputOffsetY: 96,
    rowGapX: 210
  };

  const state = {
    editor: null,
    graph: null,
    analysis: emptyAnalysis(),
    selectedStepId: null,
    ignoreCursorSync: false,
    initialViewport: null,
    dirty: false
  };

  const elements = {
    engine: document.getElementById("engine"),
    stepSelect: document.getElementById("stepSelect"),
    analysisStatus: document.getElementById("analysisStatus"),
    warnings: document.getElementById("analysisWarnings"),
    analyzeBtn: document.getElementById("analyzeBtn"),
    loadExampleBtn: document.getElementById("loadExampleBtn"),
    clearBtn: document.getElementById("clearBtn"),
    fileInput: document.getElementById("fileInput"),
    detailsStatus: document.getElementById("detailsStatus"),
    detailsGrid: document.getElementById("detailsGrid"),
    rawCode: document.getElementById("rawCode"),
    stepMeta: document.getElementById("stepMeta"),
    jsonPreview: document.getElementById("jsonPreview"),
    panUpBtn: document.getElementById("panUpBtn"),
    panDownBtn: document.getElementById("panDownBtn"),
    panLeftBtn: document.getElementById("panLeftBtn"),
    panRightBtn: document.getElementById("panRightBtn"),
    zoomInBtn: document.getElementById("zoomInBtn"),
    zoomOutBtn: document.getElementById("zoomOutBtn"),
    resetViewBtn: document.getElementById("resetViewBtn"),
    downloadImageBtn: document.getElementById("downloadImageBtn"),
    toggleDetailsBtn: document.getElementById("toggleDetailsBtn"),
    toggleJsonBtn: document.getElementById("toggleJsonBtn")
  };

  init();

  function init() {
    state.editor = createEditor();
    state.graph = createGraph();
    bindEvents();
    loadExampleIntoEditor();
  }

  function createEditor() {
    return CodeMirror.fromTextArea(document.getElementById("sasEditor"), {
      mode: "text/x-sql",
      theme: "default",
      lineNumbers: true,
      lineWrapping: true,
      tabSize: 2,
      viewportMargin: 10
    });
  }

  function createGraph() {
    const shared = getComputedStyle(document.documentElement);
    const token = name => shared.getPropertyValue(name).trim();
    const ink = token('--text');
    const paper = token('--bg-primary');
    const muted = token('--muted');
    const surface = token('--bg-hover');
    return cytoscape({
      container: document.getElementById("graph"),
      elements: [],
      style: [
        {
          selector: "node",
          style: {
            "background-color": paper,
            color: ink,
            label: "data(label)",
            "font-family": token('--font-mono'),
            "font-size": 11,
            "text-wrap": "wrap",
            "text-max-width": 120,
            "text-valign": "center",
            "text-halign": "center",
            padding: "12px",
            width: "label",
            height: 48,
            shape: "rectangle",
            "border-width": 1.5,
            "border-color": ink
          }
        },
        {
          selector: 'node[nodeRole = "source"]',
          style: { "background-color": surface, "border-style": "dashed" }
        },
        {
          selector: 'node[nodeRole = "intermediate"]',
          style: { "background-color": paper }
        },
        {
          selector: 'node[nodeRole = "final"]',
          style: { "background-color": ink, color: paper }
        },
        {
          selector: 'node[nodeRole = "external"]',
          style: { "background-color": surface, shape: "diamond", padding: "24px" }
        },
        {
          selector: "edge",
          style: {
            width: 1.5,
            "line-color": muted,
            "target-arrow-color": muted,
            "target-arrow-shape": "triangle",
            "curve-style": "bezier",
            label: "data(label)",
            "font-family": token('--font-mono'),
            "font-size": 9,
            "text-background-opacity": 1,
            "text-background-color": paper,
            "text-background-padding": 3,
            color: muted
          }
        },
        {
          selector: ".is-highlighted",
          style: {
            "border-color": ink,
            "border-width": 4,
            "overlay-color": ink,
            "overlay-opacity": 0.08,
            "overlay-padding": 6
          }
        },
        {
          selector: ".is-related",
          style: { width: 3.5, "line-color": ink, "target-arrow-color": ink }
        }
      ],
      layout: { name: "preset", fit: false, padding: 40 }
    });
  }

  function bindEvents() {
    elements.analyzeBtn.addEventListener("click", analyzeCurrentScript);
    elements.engine.addEventListener("change", function () {
      invalidateAnalysis("Motor cambiado. Pulsa Analizar script para revisar el código con el motor elegido.");
      updateEngineLabel();
    });
    elements.stepSelect.addEventListener("change", function () {
      selectStep(elements.stepSelect.value, {focusEditor:true,centerGraph:true});
    });
    state.editor.on("change", function () { invalidateAnalysis("Código editado. Pulsa Analizar script para actualizar el mapa."); });
    elements.loadExampleBtn.addEventListener("click", loadExampleIntoEditor);
    elements.clearBtn.addEventListener("click", clearEditor);
    elements.fileInput.addEventListener("change", handleFileLoad);
    document.getElementById("openFileBtn").addEventListener("click", () => elements.fileInput.click());
    elements.panUpBtn.addEventListener("click", function () {
      panGraph(0, 90);
    });
    elements.panDownBtn.addEventListener("click", function () {
      panGraph(0, -90);
    });
    elements.panLeftBtn.addEventListener("click", function () {
      panGraph(90, 0);
    });
    elements.panRightBtn.addEventListener("click", function () {
      panGraph(-90, 0);
    });
    elements.zoomInBtn.addEventListener("click", function () {
      zoomGraph(1.12);
    });
    elements.zoomOutBtn.addEventListener("click", function () {
      zoomGraph(0.88);
    });
    elements.resetViewBtn.addEventListener("click", resetGraphView);
    elements.downloadImageBtn.addEventListener("click", downloadGraphImage);
    elements.toggleDetailsBtn.addEventListener("click", function () {
      togglePanel(".panel-details", elements.toggleDetailsBtn);
    });
    elements.toggleJsonBtn.addEventListener("click", function () {
      togglePanel(".panel-json", elements.toggleJsonBtn);
    });

    state.editor.on("cursorActivity", function () {
      if (state.ignoreCursorSync || state.dirty) {
        return;
      }

      const line = state.editor.getCursor().line + 1;
      const step = findStepByLine(line, state.editor.indexFromPos(state.editor.getCursor()));
      if (step) {
        selectStep(step.id, { focusEditor: false, centerGraph: true });
      }
    });

    state.graph.on("tap", "node", function (event) {
      const node = event.target.data();
      const stepId = pickStepForNode(node);
      if (stepId) {
        selectStep(stepId, { focusEditor: true, centerGraph: true });
      }
    });
  }

  function updateEngineLabel() {
    document.getElementById('editorTitle').textContent = elements.engine.value === 'sql' ? 'Editor SQL · Trino' : 'Editor SAS';
  }

  function invalidateAnalysis(message) {
    state.dirty = true;
    state.analysis = emptyAnalysis();
    elements.stepSelect.replaceChildren();
    elements.stepSelect.disabled = true;
    elements.analysisStatus.textContent = message;
    document.getElementById('warningsPanel').hidden = true;
    elements.warnings.replaceChildren();
    renderGraph(state.analysis);
    renderEmptyDetails();
    elements.jsonPreview.textContent = JSON.stringify(state.analysis, null, 2);
  }

  function loadExampleIntoEditor() {
    updateEngineLabel();
    state.editor.setValue(elements.engine.value === "sql" ? EXAMPLE_SQL : EXAMPLE_SAS);
    analyzeCurrentScript();
  }

  function clearEditor() {
    state.editor.setValue("");
    analyzeCurrentScript();
  }

  function handleFileLoad(event) {
    const [file] = event.target.files || [];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = function (loadEvent) {
      const extension = file.name.split('.').pop().toLowerCase();
      if (extension === 'sql' || extension === 'sas') elements.engine.value = extension;
      updateEngineLabel();
      state.editor.setValue(String(loadEvent.target.result || ""));
      analyzeCurrentScript();
    };
    reader.readAsText(file, "utf-8");
    event.target.value = "";
  }

  function analyzeCurrentScript() {
    const code = state.editor.getValue();
    state.analysis = elements.engine.value === "sql" ? parseSqlScript(code) : parseSasScript(code);
    state.dirty = false;
    elements.stepSelect.replaceChildren();
    state.analysis.steps.forEach(function (step) {
      const option = document.createElement('option');
      option.value = step.id;
      option.textContent = step.stepOrder + '. ' + step.label + ' · L' + step.codeStart + '–' + step.codeEnd;
      elements.stepSelect.append(option);
    });
    elements.stepSelect.disabled = !state.analysis.steps.length;
    const warnings = state.analysis.warnings || [];
    elements.warnings.replaceChildren();
    warnings.forEach(function (warning) {
      const item = document.createElement('li'); item.textContent = warning; elements.warnings.append(item);
    });
    document.getElementById('warningsPanel').hidden = warnings.length === 0;
    document.getElementById('warningsCount').textContent = 'Avisos del análisis (' + warnings.length + ')';
    const supported = state.analysis.steps.filter(step => step.type !== 'unsupported').length;
    elements.analysisStatus.textContent = code.trim() ? supported + '/' + state.analysis.steps.length + ' pasos reconocidos · ' + state.analysis.nodes.length + ' nodos · ' + warnings.length + ' avisos. ' + (elements.engine.value === 'sas' ? 'SAS heurístico: macros e includes no resueltos.' : 'SQL para Trino: alcance inicial, sin ejecutar consultas.') : 'Carga un archivo o pega código para comenzar.';
    elements.jsonPreview.textContent = JSON.stringify(state.analysis, null, 2);
    renderGraph(state.analysis);

    if (state.analysis.steps.length > 0) {
      selectStep(state.analysis.steps[0].id, { focusEditor: false, centerGraph: false });
    } else {
      renderEmptyDetails();
    }
  }

  function renderGraph(analysis) {
    const positions = computeCascadePositions(analysis);
    const elements = analysis.nodes.map(function (node) {
      return {
        group: "nodes",
        data: node,
        position: positions[node.id] || { x: 0, y: 0 }
      };
    }).concat(analysis.edges.map(function (edge) {
      return {
        group: "edges",
        data: edge
      };
    }));

    state.graph.elements().remove();
    state.graph.add(elements);
    state.graph.layout({
      name: "preset",
      fit: false,
      padding: 70,
      animate: false
    }).run();
    setInitialCascadeViewport(positions);
  }

  function computeCascadePositions(analysis) {
    const nodesById = new Map();
    const rows = new Map();
    const positions = {};

    analysis.nodes.forEach(function (node) {
      nodesById.set(node.id, node);
    });

    analysis.steps
      .slice()
      .sort(function (left, right) {
        return left.stepOrder - right.stepOrder;
      })
      .forEach(function (step) {
        const stepRows = getCascadeStepRows(step.stepOrder);

        step.sourceTables.forEach(function (sourceId) {
          const sourceNode = nodesById.get(sourceId);
          const rowY = sourceNode && sourceNode.producedAtStepOrder
            ? getCascadeStepRows(sourceNode.producedAtStepOrder).outputY
            : stepRows.sourceY;

          placeNodeInRow(rows, rowY, sourceId);
        });

        step.targetTables.concat(step.externalTargets).forEach(function (targetId) {
          placeNodeInRow(rows, stepRows.outputY, targetId);
        });
      });

    analysis.nodes.forEach(function (node) {
      if (hasPlacedNode(rows, node.id)) {
        return;
      }

      const fallbackY = node.producedAtStepOrder
        ? getCascadeStepRows(node.producedAtStepOrder).outputY
        : getCascadeStepRows(node.firstConsumedStepOrder || 1).sourceY;

      placeNodeInRow(rows, fallbackY, node.id);
    });

    Array.from(rows.keys())
      .sort(function (left, right) {
        return left - right;
      })
      .forEach(function (rowY) {
        const rowNodeIds = rows.get(rowY);
        const rowWidth = (rowNodeIds.length - 1) * CASCADE_LAYOUT.rowGapX;

        rowNodeIds.forEach(function (nodeId, index) {
          positions[nodeId] = {
            x: index * CASCADE_LAYOUT.rowGapX - rowWidth / 2,
            y: rowY
          };
        });
      });

    return positions;
  }

  function getCascadeStepRows(stepOrder) {
    const sourceY = CASCADE_LAYOUT.topPadding + (stepOrder - 1) * CASCADE_LAYOUT.stepGapY;
    return {
      sourceY: sourceY,
      outputY: sourceY + CASCADE_LAYOUT.outputOffsetY
    };
  }

  function placeNodeInRow(rows, rowY, nodeId) {
    if (!rows.has(rowY)) {
      rows.set(rowY, []);
    }

    const row = rows.get(rowY);
    if (!row.includes(nodeId)) {
      row.push(nodeId);
    }
  }

  function hasPlacedNode(rows, nodeId) {
    return Array.from(rows.values()).some(function (row) {
      return row.includes(nodeId);
    });
  }

  function setInitialCascadeViewport(positions) {
    const nodePositions = Object.values(positions);
    if (nodePositions.length === 0) {
      return;
    }

    const bounds = nodePositions.reduce(function (acc, position) {
      return {
        minX: Math.min(acc.minX, position.x),
        maxX: Math.max(acc.maxX, position.x),
        minY: Math.min(acc.minY, position.y)
      };
    }, {
      minX: Number.POSITIVE_INFINITY,
      maxX: Number.NEGATIVE_INFINITY,
      minY: Number.POSITIVE_INFINITY
    });

    const zoom = 0.9;
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const pan = {
      x: state.graph.width() / 2 - centerX * zoom,
      y: 40 - bounds.minY * zoom
    };

    state.graph.zoom(zoom);
    state.graph.pan(pan);
    state.initialViewport = {
      zoom: zoom,
      pan: pan
    };
  }

  function panGraph(deltaX, deltaY) {
    const currentPan = state.graph.pan();
    state.graph.animate({
      pan: {
        x: currentPan.x + deltaX,
        y: currentPan.y + deltaY
      }
    }, {
      duration: 180
    });
  }

  function zoomGraph(factor) {
    const currentZoom = state.graph.zoom();
    const nextZoom = clamp(currentZoom * factor, state.graph.minZoom(), state.graph.maxZoom());

    state.graph.animate({
      zoom: {
        level: nextZoom,
        renderedPosition: {
          x: state.graph.width() / 2,
          y: state.graph.height() / 2
        }
      }
    }, {
      duration: 180
    });
  }

  function resetGraphView() {
    if (!state.initialViewport) {
      return;
    }

    state.graph.animate({
      zoom: {
        level: state.initialViewport.zoom,
        renderedPosition: {
          x: state.graph.width() / 2,
          y: state.graph.height() / 2
        }
      },
      pan: {
        x: state.initialViewport.pan.x,
        y: state.initialViewport.pan.y
      }
    }, {
      duration: 220
    });
  }

  function downloadGraphImage() {
    const pngOutput = state.graph.png({
      output: "blob-promise",
      full: false,
      bg: "#fff9f1",
      scale: window.devicePixelRatio > 1 ? 2 : 1
    });

    Promise.resolve(pngOutput).then(function (result) {
      if (typeof result === "string") {
        triggerImageDownload(result);
        return;
      }

      const blobUrl = URL.createObjectURL(result);
      const link = document.createElement("a");

      link.href = blobUrl;
      link.download = "grafo-" + elements.engine.value + ".png";
      document.body.appendChild(link);
      link.click();
      link.remove();

      window.setTimeout(function () {
        URL.revokeObjectURL(blobUrl);
      }, 1000);
    });
  }

  function triggerImageDownload(url) {
    const link = document.createElement("a");
    link.href = url;
    link.download = "grafo-" + elements.engine.value + ".png";
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  function togglePanel(selector, button) {
    const panel = document.querySelector(selector);
    if (!panel) {
      return;
    }

    const isCollapsed = panel.classList.toggle("is-collapsed");
    button.textContent = isCollapsed ? "+" : "−";
    button.setAttribute("aria-expanded", String(!isCollapsed));
  }

  function selectStep(stepId, options) {
    const step = state.analysis.steps.find(function (item) {
      return item.id === stepId;
    });
    if (!step) {
      return;
    }

    state.selectedStepId = stepId;
    elements.stepSelect.value = stepId;
    renderStepDetails(step);
    highlightGraphForStep(step, options.centerGraph);

    if (options.focusEditor) {
      jumpEditorToLine(step.codeStart, step.codeStartOffset);
    }
  }

  function renderStepDetails(step) {
    elements.detailsStatus.textContent = step.label;
    elements.stepMeta.textContent = "Líneas " + step.codeStart + "-" + step.codeEnd;
    elements.rawCode.textContent = step.rawCode;

    const items = [
      makeDetailHTML("Tipo de operación", escapeHtml(step.type)),
      makeDetailHTML("Tablas fuente", makePills(step.sourceTables)),
      makeDetailHTML(step.virtualTarget ? "Resultado de consulta" : "Objeto destino", makePills(step.targetTables)),
      makeDetailHTML("Destinos externos", makePills(step.externalTargets)),
      makeDetailHTML("Joins detectados", makePills(step.joins)),
      makeDetailHTML("Filtros detectados", makePills(step.filters)),
      makeDetailHTML("Columnas derivadas", makePills(step.derivedColumns)),
      makeDetailHTML("CTE de esta sentencia", makePills((step.ctes || []).map(cte => cte.name))),
      makeDetailHTML("Avisos de este paso", makePills(step.warnings || []))
    ];

    elements.detailsGrid.innerHTML = items.join("");
  }

  function renderEmptyDetails() {
    state.selectedStepId = null;
    elements.detailsStatus.textContent = "No se detectaron bloques compatibles en el script actual.";
    elements.detailsGrid.innerHTML = "";
    elements.stepMeta.textContent = "Sin bloque activo";
    elements.rawCode.textContent = elements.engine.value === "sas" ? "El motor SAS reconoce PROC SQL, DATA STEP y PROC S3 de forma heurística." : "El motor SQL reconoce SELECT, CREATE TABLE/VIEW e INSERT; otras operaciones se señalan con avisos.";
    clearGraphHighlight();
  }

  function makeDetailHTML(label, valueHTML) {
    return [
      '<div class="details-item">',
      '<div class="details-label">', label, "</div>",
      '<div class="details-value">', valueHTML, "</div>",
      "</div>"
    ].join("");
  }

  function makePills(items) {
    if (!items || items.length === 0) {
      return '<span class="is-empty">Sin datos</span>';
    }

    return '<div class="pill-list">' + items.map(function (item) {
      return '<span class="pill">' + escapeHtml(item) + "</span>";
    }).join("") + "</div>";
  }

  function highlightGraphForStep(step, centerGraph) {
    clearGraphHighlight();

    const relatedNodeIds = step.sourceTables.concat(step.targetTables, step.externalTargets);
    relatedNodeIds.forEach(function (nodeId) {
      const node = state.graph.getElementById(nodeId);
      if (node && node.length) {
        node.addClass("is-highlighted");
      }
    });

    state.graph.edges().forEach(function (edge) {
      if (edge.data("stepId") === step.id) {
        edge.addClass("is-related");
      }
    });

    if (centerGraph && relatedNodeIds.length > 0) {
      const collection = relatedNodeIds
        .map(function (nodeId) {
          return state.graph.getElementById(nodeId);
        })
        .filter(function (node) {
          return node && node.length;
        });

      if (collection.length > 0) {
        state.graph.animate({
          fit: {
            eles: collection.reduce(function (acc, node) {
              return acc.add(node);
            }, state.graph.collection()),
            padding: 50
          }
        }, {
          duration: 200
        });
      }
    }
  }

  function clearGraphHighlight() {
    state.graph.nodes().removeClass("is-highlighted");
    state.graph.edges().removeClass("is-related");
  }

  function jumpEditorToLine(line, offset) {
    state.ignoreCursorSync = true;
    const target = Math.max(0, line - 1);
    const position = Number.isInteger(offset) ? state.editor.posFromIndex(offset) : {line:target,ch:0};
    state.editor.setCursor(position);
    state.editor.focus();
    state.editor.scrollIntoView(position, 120);
    window.setTimeout(function () {
      state.ignoreCursorSync = false;
    }, 100);
  }

  function findStepByLine(lineNumber, offset) {
    return state.analysis.steps.find(function (step) {
      if (Number.isInteger(step.codeStartOffset)) return offset >= step.codeStartOffset && offset < step.codeEndOffset;
      return lineNumber >= step.codeStart && lineNumber <= step.codeEnd;
    }) || null;
  }

  function pickStepForNode(node) {
    if (node.producedByStepId) {
      return node.producedByStepId;
    }

    const consumingEdge = state.analysis.edges.find(function (edge) {
      return edge.source === node.id;
    });

    return consumingEdge ? consumingEdge.stepId : null;
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }
})();
