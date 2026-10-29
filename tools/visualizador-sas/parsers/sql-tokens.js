// Lexical scanner only: no SQL execution, evaluation or network access.
export function tokenizeSql(text) {
  const tokens = [], warnings = [];
  let i = 0, line = 1;
  const advance = () => { if (text[i] === '\n') line++; i++; };
  while (i < text.length) {
    if (/\s/.test(text[i])) { advance(); continue; }
    if (text.startsWith('--', i)) { while (i < text.length && text[i] !== '\n') advance(); continue; }
    if (text.startsWith('/*', i)) {
      const startLine = line; advance(); advance(); let depth = 1;
      while (i < text.length && depth) {
        if (text.startsWith('/*', i)) { depth++; advance(); advance(); }
        else if (text.startsWith('*/', i)) { depth--; advance(); advance(); }
        else advance();
      }
      if (depth) warnings.push(`Línea ${startLine}: comentario sin cerrar.`);
      continue;
    }
    const start = i, startLine = line;
    let kind = 'symbol';
    if (text[i] === "'" || text[i] === '"' || text[i] === '`') {
      const quote = text[i]; kind = quote === "'" ? 'string' : 'identifier'; advance();
      let closed = false;
      while (i < text.length) {
        if (text[i] === quote) {
          advance();
          if (text[i] === quote) { advance(); continue; }
          closed = true; break;
        }
        advance();
      }
      if (!closed) warnings.push(`Línea ${startLine}: literal o identificador sin cerrar.`);
      if (quote === '`') warnings.push(`Línea ${startLine}: identificador con backticks; verifica el dialecto (Trino usa comillas dobles).`);
    } else if (/[a-zA-Z_\p{L}]/u.test(text[i])) {
      kind = 'word';
      while (i < text.length && /[\w$\p{L}\p{N}]/u.test(text[i])) advance();
    } else if (/\d/.test(text[i])) {
      kind = 'number'; while (i < text.length && /[\d.]/.test(text[i])) advance();
    } else advance();
    tokens.push({kind, value:text.slice(start,i), upper:text.slice(start,i).toUpperCase(), start, end:i, line:startLine, endLine:line});
  }
  return {tokens, warnings};
}
export const keyword = (token, value) => token?.kind === 'word' && token.upper === value;
export const identifier = token => token && ['word','identifier'].includes(token.kind);
export function readName(tokens, index, end = tokens.length) {
  if (!identifier(tokens[index])) return null;
  const parts = [tokens[index].kind === 'identifier' ? tokens[index].value : tokens[index].upper];
  let next = index + 1;
  while (next + 1 < end && tokens[next].value === '.' && identifier(tokens[next + 1])) {
    parts.push(tokens[next + 1].kind === 'identifier' ? tokens[next + 1].value : tokens[next + 1].upper); next += 2;
  }
  return {name:parts.join('.'), next};
}
export function statementRanges(tokens) {
  const statements = []; let start = 0, depth = 0;
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].value === '(') depth++;
    if (tokens[i].value === ')') depth--;
    if (tokens[i].value === ';' && depth <= 0) {
      if (i > start) statements.push(tokens.slice(start,i+1));
      start = i + 1; depth = 0;
    }
  }
  if (start < tokens.length) statements.push(tokens.slice(start));
  return statements;
}
