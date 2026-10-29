export function buildGraphModel(steps) {
    const nodeMap = new Map();
    const edges = [];
    const producedTargets = new Set();
    const firstConsumedStepOrder = new Map();
    const stepById = new Map();

    steps.forEach(function (step) {
      stepById.set(step.id, step);
      step.sourceTables.forEach(function (tableName) {
        if (!firstConsumedStepOrder.has(tableName)) {
          firstConsumedStepOrder.set(tableName, step.stepOrder);
        }
      });
    });

    steps.forEach(function (step) {
      step.sourceTables.forEach(function (tableName) {
        upsertNode(nodeMap, tableName, {
          nodeType: "table",
          label: tableName
        });
      });

      step.targetTables.forEach(function (tableName) {
        upsertNode(nodeMap, tableName, {
          nodeType: "table",
          label: tableName,
          producedByStepId: step.id
        });
        producedTargets.add(tableName);
      });

      step.externalTargets.forEach(function (target) {
        upsertNode(nodeMap, target, {
          nodeType: "external",
          label: target,
          producedByStepId: step.id
        });
      });

      step.sourceTables.forEach(function (sourceName) {
        step.targetTables.forEach(function (targetName) {
          edges.push(makeEdge(sourceName, targetName, step.id, step.type));
        });

        step.externalTargets.forEach(function (targetName) {
          edges.push(makeEdge(sourceName, targetName, step.id, step.type));
        });
      });
    });

    const dedupedEdges = dedupeEdges(edges);

    const allNodes = Array.from(nodeMap.values()).map(function (node) {
      const hasIncoming = edges.some(function (edge) {
        return edge.target === node.id;
      });
      const outgoingEdges = dedupedEdges.filter(function (edge) {
        return edge.source === node.id;
      });
      const hasOutgoing = outgoingEdges.length > 0;
      const isExternal = node.nodeType === "external";
      const onlyExports = outgoingEdges.length > 0 && outgoingEdges.every(function (edge) {
        const targetNode = nodeMap.get(edge.target);
        return targetNode && targetNode.nodeType === "external";
      });

      let nodeRole = "intermediate";
      if (isExternal) {
        nodeRole = "external";
      } else if (!producedTargets.has(node.id)) {
        nodeRole = "source";
      } else if (!hasOutgoing || onlyExports) {
        nodeRole = "final";
      } else if (!hasIncoming) {
        nodeRole = "source";
      }

      return Object.assign({}, node, {
        nodeRole: nodeRole,
        producedAtStepOrder: node.producedByStepId ? stepById.get(node.producedByStepId).stepOrder : null,
        firstConsumedStepOrder: firstConsumedStepOrder.get(node.id) || null
      });
    });

    return {
      nodes: allNodes,
      edges: dedupedEdges,
      steps: steps
    };
  }

  function upsertNode(nodeMap, name, patch) {
    const id = String(name);
    const current = nodeMap.get(id) || {
      id: id,
      label: id,
      nodeType: "table",
      nodeRole: "intermediate",
      producedByStepId: null
    };

    nodeMap.set(id, Object.assign({}, current, patch, { id: id }));
  }

  function makeEdge(source, target, stepId, type) {
    return {
      id: [source, target, stepId].join("::"),
      source: source,
      target: target,
      stepId: stepId,
      label: edgeLabel(type)
    };
  }

  function edgeLabel(type) {
    if (type === "data_step") {
      return "data step";
    }
    if (type === "proc_s3") {
      return "export";
    }
    return "sql";
  }

  function dedupeEdges(edges) {
    const byId = new Map();
    edges.forEach(function (edge) {
      byId.set(edge.id, edge);
    });
    return Array.from(byId.values());
  }

export function emptyAnalysis() {
    return {
      nodes: [],
      edges: [],
      steps: []
    };
  }
