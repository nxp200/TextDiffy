/* TextDiffy Application - ES Module */
'use strict';

// ---------- State ----------
export const AppState = {
  whitespaceSensitive: true,
  caseSensitive: true,
  granularity: 'line', // 'line' | 'word' | 'char'
};

// ---------- Utilities ----------
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

function normalizeLine(line, opts){
  let out = line;
  if(!opts.whitespaceSensitive){
    out = out.replace(/\s+/g, ' ').trim();
  }
  if(!opts.caseSensitive){
    out = out.toLowerCase();
  }
  return out;
}

function splitLines(text){
  // Normalize CRLF and keep empty lines
  return text.replace(/\r\n?/g, '\n').split('\n');
}

function yieldToUI(){
  return new Promise(r => setTimeout(r, 0));
}

// ---------- Tokenization for granular diffs ----------
function tokenizeWords(str){
  try{
    // Unicode-aware: words or single non-space chars
    const tokens = str.match(/[\p{L}\p{N}_]+|\s+|[^\s\p{L}\p{N}_]/gu);
    return tokens ?? [str];
  }catch(e){
    // Fallback without Unicode property escapes
    const tokens = str.match(/[A-Za-z0-9_]+|\s+|[^\sA-Za-z0-9_]/g);
    return tokens ?? [str];
  }
}

function tokenizeChars(str){
  return Array.from(str); // code points
}

// ---------- Patience Diff (array of strings) ----------
function patienceDiff(a, b, equal=(x,y)=>x===y){
  const result = [];
  function diffRange(aStart, aEnd, bStart, bEnd){
    // Trim equal prefix
    while(aStart < aEnd && bStart < bEnd && equal(a[aStart], b[bStart])){
      result.push({op:'equal', a:a[aStart], b:b[bStart]});
      aStart++; bStart++;
    }
    // Trim equal suffix
    while(aStart < aEnd && bStart < bEnd && equal(a[aEnd-1], b[bEnd-1])){
      aEnd--; bEnd--;
      result.push({op:'equal-suf', a:a[aEnd], b:b[bEnd]});
    }
    if(aStart===aEnd){
      for(let j=bStart;j<bEnd;j++) result.push({op:'insert', b:b[j]});
      return;
    }
    if(bStart===bEnd){
      for(let i=aStart;i<aEnd;i++) result.push({op:'delete', a:a[i]});
      return;
    }
    // Build maps of unique items
    const aCount = new Map();
    const bCount = new Map();
    for(let i=aStart;i<aEnd;i++) aCount.set(a[i], (aCount.get(a[i])||0)+1);
    for(let j=bStart;j<bEnd;j++) bCount.set(b[j], (bCount.get(b[j])||0)+1);
    const bIndex = new Map();
    for(let j=bStart;j<bEnd;j++){
      const v=b[j]; if(bCount.get(v)===1) bIndex.set(v,j);
    }
    const candidates = [];
    for(let i=aStart;i<aEnd;i++){
      const v=a[i]; if(aCount.get(v)===1 && bIndex.has(v)) candidates.push([i,bIndex.get(v)]);
    }
    // Find LIS over b-indexes
    const pileTops = []; // stores [i,bIndex]
    const predecessors = new Array(candidates.length).fill(-1);
    const pileIdxForCandidate = new Array(candidates.length).fill(-1);
    for(let cIdx=0;cIdx<candidates.length;cIdx++){
      const bIdx = candidates[cIdx][1];
      // binary search on pileTops by second element
      let lo=0, hi=pileTops.length;
      while(lo<hi){
        const mid=(lo+hi)>>1;
        if(pileTops[mid][1] < bIdx) lo=mid+1; else hi=mid;
      }
      if(lo>0) predecessors[cIdx] = pileIdxForCandidate[lo-1];
      pileTops[lo] = candidates[cIdx];
      pileIdxForCandidate[lo] = cIdx;
    }
    // Reconstruct LIS
    const lis = [];
    let k = pileIdxForCandidate[pileTops.length-1];
    while(k>=0){ lis.push(candidates[k]); k = predecessors[k]; }
    lis.reverse();

    if(lis.length===0){
      // No anchors, fall back: delete all A middle, insert all B middle
      for(let i=aStart;i<aEnd;i++) result.push({op:'delete', a:a[i]});
      for(let j=bStart;j<bEnd;j++) result.push({op:'insert', b:b[j]});
      return;
    }
    // Recurse between anchors
    let ai=aStart, bi=bStart;
    for(const [i,j] of lis){
      if(ai<i || bi<j) diffRange(ai, i, bi, j);
      result.push({op:'equal', a:a[i], b:b[j]});
      ai=i+1; bi=j+1;
    }
    if(ai<aEnd || bi<bEnd) diffRange(ai, aEnd, bi, bEnd);
  }
  diffRange(0, a.length, 0, b.length);
  // Move collected suffix equals to end order
  const out=[]; const suf=[];
  for(const r of result){ if(r.op==='equal-suf') suf.push({op:'equal', a:r.a, b:r.b}); else out.push(r); }
  return out.concat(suf);
}

// Collapse deletes+inserts into modifies when 1:1
function collapseToModify(ops){
  const out=[];
  for(let i=0;i<ops.length;i++){
    const cur = ops[i];
    if(cur.op==='delete' && i+1<ops.length && ops[i+1].op==='insert'){
      out.push({op:'modify', old:cur.a, new:ops[i+1].b});
      i++; continue;
    }
    if(cur.op==='equal') out.push(cur);
    else if(cur.op==='insert') out.push({op:'insert', b:cur.b});
    else if(cur.op==='delete') out.push({op:'delete', a:cur.a});
  }
  return out;
}

// Granular diff for a single line pair
function granularLineDiff(oldStr, newStr, mode){
  if(mode==='line') return null;
  const tokensOld = mode==='word' ? tokenizeWords(oldStr) : tokenizeChars(oldStr);
  const tokensNew = mode==='word' ? tokenizeWords(newStr) : tokenizeChars(newStr);
  const ops = patienceDiff(tokensOld, tokensNew, (x,y)=>x===y);
  const parts=[];
  for(const op of ops){
    if(op.op==='equal') parts.push({type:'same', text:op.a});
    else if(op.op==='insert') parts.push({type:'add', text:op.b});
    else if(op.op==='delete') parts.push({type:'remove', text:op.a});
  }
  return parts;
}

// Build structured diff matching the spec
export async function buildStructuredDiff(textA, textB, opts=AppState){
  const linesAOrig = splitLines(textA);
  const linesBOrig = splitLines(textB);
  // Normalized versions (per line) for diff logic
  const normA = linesAOrig.map(l=>normalizeLine(l,opts));
  const normB = linesBOrig.map(l=>normalizeLine(l,opts));

  // Diff by normalized content
  const ops = patienceDiff(normA, normB, (x,y)=>x===y);
  const combined = collapseToModify(ops);

  // Map to required JSON-like structure
  const structured = [];
  let indexA=0, indexB=0;
  for(const op of combined){
    if(op.op==='equal'){
      structured.push({type:'same', line: linesAOrig[indexA]});
      indexA++; indexB++;
    }else if(op.op==='insert'){
      structured.push({type:'add', line: linesBOrig[indexB]});
      indexB++;
    }else if(op.op==='delete'){
      structured.push({type:'remove', line: linesAOrig[indexA]});
      indexA++;
    }else if(op.op==='modify'){
      const oldLine = linesAOrig[indexA];
      const newLine = linesBOrig[indexB];
      const parts = granularLineDiff(oldLine, newLine, opts.granularity);
      structured.push({type:'modify', old: oldLine, new: newLine, parts});
      indexA++; indexB++;
    }
    if((indexA+indexB) % 2000 === 0) await yieldToUI();
  }
  return structured;
}

// ---------- Rendering ----------
function clearNode(node){ while(node.firstChild) node.removeChild(node.firstChild); }

function renderTokenSpan(token){
  const span = document.createElement('span');
  span.className = token.type === 'add' ? 'token-add' : token.type === 'remove' ? 'token-remove' : 'token-same';
  span.textContent = token.text;
  return span;
}

export function renderDiff(structured){
  const container = $('#diffOutput');
  clearNode(container);
  const frag = document.createDocumentFragment();
  for(const item of structured){
    const line = document.createElement('div');
    line.className = `diff-line ${item.type}`;
    const prefix = document.createElement('span');
    prefix.className = 'prefix';
    const content = document.createElement('div');
    content.className = item.type==='modify' ? 'inline-lines' : 'inline-line';

    if(item.type==='same'){
      prefix.textContent = ' ';
      const text = document.createElement('div');
      text.className = 'inline-line';
      text.textContent = item.line;
      content.appendChild(text);
    } else if(item.type==='add'){
      prefix.textContent = '+';
      const text = document.createElement('div');
      text.className = 'inline-line';
      text.textContent = item.line;
      content.appendChild(text);
    } else if(item.type==='remove'){
      prefix.textContent = '−';
      const text = document.createElement('div');
      text.className = 'inline-line';
      text.textContent = item.line;
      content.appendChild(text);
    } else if(item.type==='modify'){
      prefix.textContent = '~';
      // Render two lines: old (removed parts marked), new (added parts marked)
      const oldDiv = document.createElement('div');
      oldDiv.className = 'inline-line';
      oldDiv.setAttribute('aria-label','Modified old line');
      const newDiv = document.createElement('div');
      newDiv.className = 'inline-line';
      newDiv.setAttribute('aria-label','Modified new line');

      if(item.parts && Array.isArray(item.parts)){
        // Build from tokens
        for(const p of item.parts){
          // Old line: render removes and sames
          if(p.type==='same' || p.type==='remove') oldDiv.appendChild(renderTokenSpan({type:p.type==='same'?'same':'remove', text:p.type==='add'?'':p.text}));
          // New line: render adds and sames
          if(p.type==='same' || p.type==='add') newDiv.appendChild(renderTokenSpan({type:p.type==='same'?'same':'add', text:p.type==='remove'?'':p.text}));
        }
      } else {
        oldDiv.textContent = item.old;
        newDiv.textContent = item.new;
      }
      content.appendChild(oldDiv);
      content.appendChild(newDiv);
    }

    line.appendChild(prefix);
    line.appendChild(content);
    frag.appendChild(line);
  }
  container.appendChild(frag);
}

// ---------- Metrics ----------
export function updateMetrics(structured){
  let add=0, rem=0, mod=0;
  for(const item of structured){
    if(item.type==='add') add++;
    else if(item.type==='remove') rem++;
    else if(item.type==='modify') mod++;
  }
  $('#total-added').textContent = String(add);
  $('#total-removed').textContent = String(rem);
  $('#total-modified').textContent = String(mod);
}

// ---------- Serialization ----------
export function serializePlain(structured){
  const lines=[];
  for(const item of structured){
    if(item.type==='same') lines.push('  ' + item.line);
    else if(item.type==='add') lines.push('+ ' + item.line);
    else if(item.type==='remove') lines.push('- ' + item.line);
    else if(item.type==='modify'){
      lines.push('- ' + item.old);
      lines.push('+ ' + item.new);
      if(item.parts){
        const parts = item.parts.map(p=>{
          if(p.type==='add') return '{+'+p.text+'+}';
          if(p.type==='remove') return '{-'+p.text+'-}';
          return p.text;
        }).join('');
        lines.push('~ ' + parts);
      }
    }
  }
  return lines.join('\n');
}

async function copyToClipboard(text){
  try{
    if(navigator.clipboard && navigator.clipboard.writeText){
      await navigator.clipboard.writeText(text);
      return true;
    }
  }catch(e){ /* ignore and try fallback */ }
  // Fallback
  const ta = document.createElement('textarea');
  ta.value = text; document.body.appendChild(ta); ta.select();
  try{ document.execCommand('copy'); return true; }catch(e){ return false; }
  finally{ document.body.removeChild(ta); }
}

function downloadText(filename, text){
  const blob = new Blob([text], {type:'text/plain;charset=utf-8'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; document.body.appendChild(a); a.click();
  setTimeout(()=>{ URL.revokeObjectURL(url); document.body.removeChild(a); }, 0);
}

// ---------- Compare Flow ----------
export async function runCompare(){
  const textA = $('#inputA').value;
  const textB = $('#inputB').value;
  const opts = {...AppState};
  const t0 = performance.now();
  const structured = await buildStructuredDiff(textA, textB, opts);
  renderDiff(structured);
  updateMetrics(structured);
  const t1 = performance.now();
  // If slow, yield after render to keep UI responsive in future runs
  if(t1 - t0 > 200) await yieldToUI();
  return structured;
}

// ---------- Setup ----------
function bindUI(){
  const ws = $('#whitespaceSensitive');
  const cs = $('#caseSensitive');
  const gran = $('#granularity');
  ws.addEventListener('change', ()=>{ AppState.whitespaceSensitive = ws.checked; });
  cs.addEventListener('change', ()=>{ AppState.caseSensitive = cs.checked; });
  gran.addEventListener('change', ()=>{ AppState.granularity = gran.value; });
  $('#compareBtn').addEventListener('click', async ()=>{ await runCompare(); });
  $('#copyBtn').addEventListener('click', async ()=>{
    const structured = await runCompare();
    const txt = serializePlain(structured);
    const ok = await copyToClipboard(txt);
    if(!ok) alert('Copy failed: your browser may not support clipboard APIs.');
  });
  $('#exportBtn').addEventListener('click', async ()=>{
    const structured = await runCompare();
    const txt = serializePlain(structured);
    downloadText('textdiffy-diff.txt', txt);
  });
}

document.addEventListener('DOMContentLoaded', bindUI);

// ---------- Minimal Exports for Tests ----------
export const __internals = {
  splitLines,
  normalizeLine,
  tokenizeWords,
  tokenizeChars,
  patienceDiff,
  granularLineDiff,
};
