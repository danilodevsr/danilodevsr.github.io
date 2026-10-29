import { buildGraphModel, emptyAnalysis } from "./model.js";

export function parseSasScript(script) {
    if (!script.trim()) {
      return emptyAnalysis();
    }

    const lines = script.split(/\r?\n/);
    // First we find only the top-level SAS constructs that the MVP understands.
    const topBlocks = splitTopLevelBlocks(lines);
    const steps = [];
    let stepCounter = 1;

    topBlocks.forEach(function (block) {
      if (block.kind === "proc_sql") {
        parseProcSqlBlock(block).forEach(function (step) {
          step.id = "step-" + stepCounter;
          step.stepOrder = stepCounter;
          stepCounter += 1;
          steps.push(step);
        });
      } else if (block.kind === "data_step") {
        const step = parseDataStepBlock(block);
        if (step) {
          step.id = "step-" + stepCounter;
          step.stepOrder = stepCounter;
          stepCounter += 1;
          steps.push(step);
        }
      } else if (block.kind === "proc_s3") {
        parseProcS3Block(block).forEach(function (step) {
          step.id = "step-" + stepCounter;
          step.stepOrder = stepCounter;
          stepCounter += 1;
          steps.push(step);
        });
      }
    });

    return buildGraphModel(steps);
  }

  function splitTopLevelBlocks(lines) {
    const blocks = [];
    let index = 0;

    while (index < lines.length) {
      const line = lines[index];
      const trimmed = line.trim().toLowerCase();

      if (!trimmed) {
        index += 1;
        continue;
      }

      if (trimmed.startsWith("proc sql")) {
        const endIndex = findEndLine(lines, index + 1, /^quit\s*;?/i);
        blocks.push(makeBlock("proc_sql", lines, index, endIndex));
        index = endIndex + 1;
        continue;
      }

      if (trimmed.startsWith("proc s3")) {
        const endIndex = findEndLine(lines, index + 1, /^run\s*;?/i);
        blocks.push(makeBlock("proc_s3", lines, index, endIndex));
        index = endIndex + 1;
        continue;
      }

      if (trimmed.startsWith("data ")) {
        const endIndex = findEndLine(lines, index + 1, /^run\s*;?/i);
        blocks.push(makeBlock("data_step", lines, index, endIndex));
        index = endIndex + 1;
        continue;
      }

      index += 1;
    }

    return blocks;
  }

  function makeBlock(kind, lines, startIndex, endIndex) {
    return {
      kind: kind,
      codeStart: startIndex + 1,
      codeEnd: endIndex + 1,
      rawCode: lines.slice(startIndex, endIndex + 1).join("\n")
    };
  }

  function findEndLine(lines, startIndex, matcher) {
    for (let index = startIndex; index < lines.length; index += 1) {
      if (matcher.test(lines[index].trim())) {
        return index;
      }
    }
    return lines.length - 1;
  }

  function parseProcSqlBlock(block) {
    const content = block.rawCode;
    const createRegex = /create\s+table\s+([a-z_][\w.]*)\s+as\b/gi;
    const matches = [];
    let match;

    while ((match = createRegex.exec(content)) !== null) {
      matches.push({
        target: normalizeName(match[1]),
        index: match.index
      });
    }

    return matches.map(function (entry, position) {
      const blockStartOffset = entry.index;
      const blockEndOffset = position + 1 < matches.length ? matches[position + 1].index : content.length;
      const rawCode = content.slice(blockStartOffset, blockEndOffset).trim();
      // Code lines are kept so we can sync editor cursor <-> graph selection.
      const startLineOffset = countLines(content.slice(0, blockStartOffset));
      const codeStart = block.codeStart + startLineOffset;
      const codeEnd = codeStart + countLines(rawCode) - 1;

      return {
        id: "",
        type: "proc_sql",
        label: "CREATE TABLE " + entry.target,
        sourceTables: uniqueList(extractSqlSourceTables(rawCode)),
        targetTables: [entry.target],
        externalTargets: [],
        derivedColumns: uniqueList(extractDerivedColumns(rawCode)),
        filters: uniqueList(extractWhereClauses(rawCode)),
        joins: uniqueList(extractJoinClauses(rawCode)),
        codeStart: codeStart,
        codeEnd: codeEnd,
        rawCode: rawCode
      };
    });
  }

  function parseDataStepBlock(block) {
    const targetMatch = block.rawCode.match(/data\s+([a-z_][\w.]*)\s*;/i);
    if (!targetMatch) {
      return null;
    }

    const setTables = collectMatches(block.rawCode, /\bset\s+([^;]+);/gi)
      .flatMap(splitObjectList);
    const mergeTables = collectMatches(block.rawCode, /\bmerge\s+([^;]+);/gi)
      .flatMap(splitObjectList);
    const sourceTables = uniqueList(setTables.concat(mergeTables).map(normalizeName));
    const byClauses = collectMatches(block.rawCode, /\bby\s+([^;]+);/gi);

    return {
      id: "",
      type: "data_step",
      label: "DATA " + normalizeName(targetMatch[1]),
      sourceTables: sourceTables,
      targetTables: [normalizeName(targetMatch[1])],
      externalTargets: [],
      derivedColumns: [],
      filters: byClauses.map(cleanWhitespace),
      joins: mergeTables.length ? ["merge " + mergeTables.map(normalizeName).join(", ")] : [],
      codeStart: block.codeStart,
      codeEnd: block.codeEnd,
      rawCode: block.rawCode.trim()
    };
  }

  function parseProcS3Block(block) {
    const putRegex = /\bput\s+([a-z_][\w.]*)\s+(s3:\/\/[^\s;]+)\s*;/gi;
    const steps = [];
    let match;

    while ((match = putRegex.exec(block.rawCode)) !== null) {
      const rawCode = match[0].trim();
      const startLineOffset = countLines(block.rawCode.slice(0, match.index)) - 1;
      const codeStart = block.codeStart + Math.max(0, startLineOffset);

      steps.push({
        id: "",
        type: "proc_s3",
        label: "EXPORT " + normalizeName(match[1]) + " → S3",
        sourceTables: [normalizeName(match[1])],
        targetTables: [],
        externalTargets: [match[2]],
        derivedColumns: [],
        filters: [],
        joins: [],
        codeStart: codeStart,
        codeEnd: codeStart + countLines(rawCode) - 1,
        rawCode: rawCode
      });
    }

    return steps;
  }

  function extractSqlSourceTables(rawCode) {
    const sources = [];
    const fromMatches = collectMatches(rawCode, /\bfrom\s+([a-z_][\w.]*)/gi);
    const joinMatches = collectMatches(rawCode, /\b(?:left|right|inner|full|cross)?\s*join\s+([a-z_][\w.]*)/gi);
    return sources.concat(fromMatches, joinMatches).map(normalizeName);
  }

  function extractJoinClauses(rawCode) {
    return collectMatches(
      rawCode,
      /\b((?:left|right|inner|full|cross)?\s*join\s+[a-z_][\w.]*[\s\S]*?\bon\s+[\s\S]*?)(?=\b(?:left|right|inner|full|cross)?\s*join\b|\bwhere\b|\bgroup\s+by\b|\border\s+by\b|;)/gi
    ).map(cleanWhitespace);
  }

  function extractWhereClauses(rawCode) {
    return collectMatches(
      rawCode,
      /\bwhere\s+([\s\S]*?)(?=\bgroup\s+by\b|\border\s+by\b|;)/gi
    ).map(cleanWhitespace);
  }

  function extractDerivedColumns(rawCode) {
    const caseColumns = collectMatches(rawCode, /\bcase\b[\s\S]*?\bend\s+as\s+([a-z_][\w]*)/gi);
    const aliasColumns = collectMatches(rawCode, /(?:case\b[\s\S]*?\bend|[^,\n;]+?)\s+as\s+([a-z_][\w]*)/gi);
    return caseColumns.concat(aliasColumns).map(normalizeName);
  }

  function collectMatches(text, regex) {
    const matches = [];
    let match;
    while ((match = regex.exec(text)) !== null) {
      if (match[1]) {
        matches.push(match[1]);
      }
    }
    return matches;
  }

  function splitObjectList(value) {
    return String(value)
      .split(/\s+/)
      .map(function (item) {
        return item.trim();
      })
      .filter(Boolean);
  }

  function normalizeName(value) {
    return cleanWhitespace(String(value || "").replace(/[;,]/g, "")).toUpperCase();
  }

  function cleanWhitespace(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function uniqueList(items) {
    return Array.from(new Set((items || []).filter(Boolean)));
  }

  function countLines(text) {
    if (!text) {
      return 0;
    }
    return text.split(/\r?\n/).length;
  }
