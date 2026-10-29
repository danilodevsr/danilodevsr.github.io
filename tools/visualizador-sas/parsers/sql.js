import { buildGraphModel } from './model.js';
import { tokenizeSql, statementRanges, keyword, identifier, readName } from './sql-tokens.js';
const unique = values => [...new Set(values)];
const CLAUSES = new Set(['WHERE','GROUP','HAVING','ORDER','LIMIT','OFFSET','FETCH','UNION','EXCEPT','INTERSECT','WINDOW','QUALIFY','RETURNING']);
const RESERVED_RELATIONS = new Set([...CLAUSES,'SELECT','WITH','ON','USING','AS','JOIN','LEFT','RIGHT','INNER','FULL','CROSS','OUTER','TABLE','VALUES']);
const words = (token, set) => token?.kind === 'word' && set.has(token.upper);

function queryInfo(tokens, text) {
  const pairs = new Map(), stack = [], warnings = [], ctes = [], joins = [], filters = [], derivedColumns = [];
  for (let i=0;i<tokens.length;i++) {
    if (tokens[i].value === '(') stack.push(i);
    if (tokens[i].value === ')') {
      const open = stack.pop();
      if (open === undefined) warnings.push('Paréntesis de cierre sin apertura.');
      else pairs.set(open,i);
    }
  }
  if (stack.length) warnings.push('Paréntesis sin cerrar: dependencias incompletas.');
  const sliceText = (a,b) => a<b ? text.slice(tokens[a].start,tokens[b-1].end).trim() : '';
  function walk(start,end,inherited = new Map(), query = true) {
    const scope = new Map(inherited), sources = [];
    let i = start;
    // WITH belongs to this query scope; CTE names never become physical sources.
    if (keyword(tokens[i],'WITH')) {
      i++;
      if (keyword(tokens[i],'RECURSIVE')) { warnings.push('WITH RECURSIVE: relación recursiva no representada; se muestran fuentes externas detectadas.'); i++; }
      while (i<end) {
        const name = readName(tokens,i,end);
        if (!name) { warnings.push('No se pudo interpretar el nombre de una CTE.'); break; }
        i=name.next;
        if (tokens[i]?.value === '(') i=(pairs.get(i) ?? (end-1))+1; // optional column aliases
        if (!keyword(tokens[i],'AS') || tokens[i+1]?.value !== '(' || !pairs.has(i+1)) {
          warnings.push('Cláusula WITH no soportada completamente.'); break;
        }
        scope.set(name.name,[]);
        const close=pairs.get(i+1);
        const inputs=walk(i+2,close,scope,true);
        scope.set(name.name,inputs);
        ctes.push({name:name.name,sourceTables:inputs});
        i=close+1;
        if (tokens[i]?.value !== ',') break;
        i++;
      }
    }
    let fromList=false, selectList=false;
    function relation(index) {
      if (keyword(tokens[index],'LATERAL')) index++;
      if (tokens[index]?.value === '(') {
        const close=pairs.get(index);
        if (close === undefined) return end;
        sources.push(...walk(index+1,close,scope,keyword(tokens[index+1],'SELECT')||keyword(tokens[index+1],'WITH')));
        return close+1;
      }
      const name=readName(tokens,index,end);
      if (!name || words(tokens[index],RESERVED_RELATIONS)) {
        warnings.push(`No se pudo resolver una fuente cerca de la línea ${tokens[index]?.line || tokens[start]?.line}.`);
        return index+1;
      }
      if (tokens[name.next]?.value === '(') {
        warnings.push(`Fuente calculada ${name.name}: no se resuelve como tabla física.`);
        const close=pairs.get(name.next);
        if (close === undefined) return end;
        sources.push(...walk(name.next+1,close,scope,false));
        return close+1;
      }
      if (scope.has(name.name)) sources.push(...scope.get(name.name));
      else sources.push(name.name);
      return name.next;
    }
    function clauseEnd(index) {
      while (index<end) {
        if (tokens[index].value === '(' && pairs.has(index)) { index=pairs.get(index)+1; continue; }
        const joinPrefix = ['LEFT','RIGHT','FULL','INNER','CROSS'].includes(tokens[index].upper) && (keyword(tokens[index+1],'JOIN') || (keyword(tokens[index+1],'OUTER') && keyword(tokens[index+2],'JOIN')));
        if (joinPrefix || words(tokens[index],CLAUSES) || keyword(tokens[index],'JOIN') || tokens[index].value===';') break;
        index++;
      }
      return index;
    }
    while (i<end) {
      const token=tokens[i];
      if (token.value === '(' && pairs.has(i)) {
        const close=pairs.get(i);
        sources.push(...walk(i+1,close,scope,keyword(tokens[i+1],'SELECT')||keyword(tokens[i+1],'WITH')));
        i=close+1; continue;
      }
      if (query && keyword(token,'SELECT')) { selectList=true; fromList=false; }
      if (query && words(token,CLAUSES)) { fromList=false; selectList=false; }
      if (query && keyword(token,'FROM')) {
        selectList=false; fromList=true; i=relation(i+1); continue;
      }
      if (query && keyword(token,'JOIN')) {
        const stop=clauseEnd(i+1);
        let begin=i;
        if (['LEFT','RIGHT','FULL','INNER','CROSS'].includes(tokens[i-1]?.upper)) begin=i-1;
        else if (keyword(tokens[i-1],'OUTER') && ['LEFT','RIGHT','FULL'].includes(tokens[i-2]?.upper)) begin=i-2;
        joins.push(sliceText(begin,stop));
        i=relation(i+1); continue;
      }
      if (query && fromList && token.value===',') { i=relation(i+1); continue; }
      if (query && (keyword(token,'WHERE')||keyword(token,'HAVING'))) filters.push(sliceText(i,clauseEnd(i+1)));
      if (query && selectList && keyword(token,'AS') && identifier(tokens[i+1])) derivedColumns.push(readName(tokens,i+1,end).name);
      i++;
    }
    return unique(sources);
  }
  let start=tokens.findIndex(token=>keyword(token,'SELECT')||keyword(token,'WITH'));
  const sources=start<0?[]:walk(start,tokens.length);
  return {sources,ctes,joins:unique(joins),filters:unique(filters),derivedColumns:unique(derivedColumns),warnings:unique(warnings)};
}

function parseStatement(tokens, text, order) {
  const first=tokens[0], last=tokens.at(-1);
  const step={id:`step-${order}`,stepOrder:order,type:'unsupported',label:first.upper,sourceTables:[],targetTables:[],externalTargets:[],derivedColumns:[],filters:[],joins:[],ctes:[],warnings:[],codeStart:first.line,codeEnd:last.endLine,codeStartOffset:first.start,codeEndOffset:last.end,rawCode:text.slice(first.start,last.end),effect:'unknown'};
  let queryTokens=tokens, target=null;
  if (keyword(first,'CREATE')) {
    let i=1;
    if (keyword(tokens[i],'OR') && keyword(tokens[i+1],'REPLACE')) i+=2;
    if (keyword(tokens[i],'TEMP') || keyword(tokens[i],'TEMPORARY')) { step.warnings.push('CREATE TEMP: variante fuera del alcance inicial de Trino.'); i++; }
    const object=tokens[i]?.upper;
    if (['TABLE','VIEW'].includes(object)) {
      i++;
      if (keyword(tokens[i],'IF') && keyword(tokens[i+1],'NOT') && keyword(tokens[i+2],'EXISTS')) i+=3;
      target=readName(tokens,i);
      if (target) {
        let depth=0, asIndex=-1;
        for (let j=target.next;j<tokens.length;j++) {
          if (tokens[j].value==='(') depth++;
          if (tokens[j].value===')') depth--;
          if (!depth && keyword(tokens[j],'AS')) { asIndex=j; break; }
        }
        step.type=`create_${object.toLowerCase()}`; step.effect='create'; step.label=`CREATE ${object} ${target.name}`;
        if (asIndex<0) { queryTokens=[]; if (object==='VIEW') step.warnings.push('CREATE VIEW sin consulta reconocida.'); }
        else queryTokens=tokens.slice(asIndex+1);
      }
    }
  } else if (keyword(first,'INSERT') && keyword(tokens[1],'INTO')) {
    target=readName(tokens,2); step.type='insert'; step.effect='insert';
    if (target) { step.label=`INSERT INTO ${target.name}`; queryTokens=tokens.slice(target.next); }
  } else if (keyword(first,'SELECT') || keyword(first,'WITH') || keyword(first,'VALUES')) {
    step.type='select'; step.effect='read'; step.virtualTarget=true;
    target={name:`RESULTADO SELECT · L${first.line} · ${order}`}; step.label=`SELECT · resultado ${order}`;
  } else if (['UPDATE','DELETE','DROP','TRUNCATE','MERGE','ALTER'].some(word=>keyword(first,word))) {
    let i=1;
    if (['FROM','TABLE','VIEW','INTO'].some(word=>keyword(tokens[i],word))) i++;
    if (keyword(tokens[i],'IF') && keyword(tokens[i+1],'EXISTS')) i+=2;
    target=readName(tokens,i);
    step.type=first.upper.toLowerCase(); step.effect=step.type;
    step.label=`${first.upper}${target?' '+target.name:''}`; queryTokens=[];
    step.warnings.push('Operación identificada; sus dependencias internas no se analizan en esta versión.');
  }
  if (step.type==='unsupported' || !target) {
    step.type='unsupported'; step.effect='unknown'; step.label=`SIN SOPORTE · ${first.upper}`;
    step.warnings.push('Sentencia fuera del alcance inicial; revisa el código original.');
    return step;
  }
  step.targetTables=[target.name];
  const info=queryInfo(queryTokens,text);
  Object.assign(step,{sourceTables:info.sources,ctes:info.ctes,joins:info.joins,filters:info.filters,derivedColumns:info.derivedColumns});
  step.warnings.push(...info.warnings);
  if (queryTokens.length && !queryTokens.some(token=>['SELECT','WITH','VALUES',';'].some(word=>keyword(token,word))) && step.type.startsWith('create_')) step.warnings.push('La consulta de creación no se interpretó completamente.');
  if (tokens.some(token=>token.value==='&'||token.value==='${')) step.warnings.push('Posibles variables o plantillas: nombres sin resolver.');
  return step;
}

export function parseSqlScript(text) {
  const lexed=tokenizeSql(text);
  const steps=statementRanges(lexed.tokens).map((tokens,index)=>parseStatement(tokens,text,index+1));
  const model=buildGraphModel(steps);
  const warnings=[...lexed.warnings];
  steps.forEach(step=>step.warnings.forEach(message=>warnings.push(`Paso ${step.stepOrder} · líneas ${step.codeStart}-${step.codeEnd}: ${message}`)));
  const writes=new Map();
  steps.filter(step=>!step.virtualTarget).forEach(step=>step.targetTables.forEach(name=>writes.set(name,(writes.get(name)||0)+1)));
  writes.forEach((count,name)=>{if(count>1) warnings.push(`${name} aparece como destino en ${count} pasos. El grafo agrupa por nombre; usa la lista de pasos para revisar cada operación.`);});
  return {...model,warnings:unique(warnings),engine:'sql',dialect:'Trino (alcance inicial)'};
}
