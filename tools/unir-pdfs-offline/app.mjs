import * as pdfjs from './lib/pdf.min.mjs';
pdfjs.GlobalWorkerOptions.workerSrc = new URL('./lib/pdf.worker.min.mjs', import.meta.url).href;
const $ = id => document.getElementById(id);
const size = n => `${(n / 1e6).toFixed(2)} MB`;
let files = [], source = null, merged = null, reduced = null, previewURL = null, busy = false, cancelled = false;
function mode(which) {
 for (const key of ['merge','reduce']) { $(key+'-panel').hidden = key !== which; $('tab-'+key).setAttribute('aria-pressed', String(key === which)); $('tab-'+key).className = 'btn '+(key === which ? 'primary':'btn-outline'); }
}
$('tab-merge').onclick=()=>mode('merge'); $('tab-reduce').onclick=()=>mode('reduce');
function dropResult(key) { $(key+'-result').hidden = true; if(key==='merge') merged=null; else { reduced=null; if(previewURL) URL.revokeObjectURL(previewURL); previewURL=null; $('preview').removeAttribute('href'); } }
function sync() { $('merge').disabled=busy||files.length<2; $('reduce').disabled=busy||!source||!$('consent').checked; }
function lock(value) { busy=value; document.querySelectorAll('input,select,button').forEach(el=>{el.disabled=value;}); $('cancel').hidden=!value; $('cancel').disabled=false; sync(); }
function renderFiles() {
 $('file-list').replaceChildren();
 files.forEach((f,i)=>{const li=document.createElement('li');const name=document.createElement('div');name.textContent=`${f.name} · ${size(f.size)}`;li.append(name);
 for(const [label,action,disabled] of [['↑',()=>swap(i,i-1),i===0],['↓',()=>swap(i,i+1),i===files.length-1],['Quitar',()=>{files.splice(i,1);changed();},false]]){const b=document.createElement('button');b.textContent=label;b.disabled=disabled;b.setAttribute('aria-label',`${label} ${f.name}`);b.onclick=action;li.append(b);} $('file-list').append(li);});sync();
}
function changed(){dropResult('merge');$('merge-status').textContent='';renderFiles();}
function swap(a,b){[files[a],files[b]]=[files[b],files[a]];changed();}
function valid(f){return f.name.toLowerCase().endsWith('.pdf')||f.type==='application/pdf';}
$('merge-files').onchange=e=>{const incoming=[...e.target.files];if(incoming.some(f=>!valid(f))){$('merge-status').textContent='Selecciona archivos PDF.';}else{files.push(...incoming);changed();}e.target.value='';};
$('clear-merge').onclick=()=>{files=[];changed();};
function loadSource(f){source=f;dropResult('reduce');$('consent').checked=false;$('source-info').textContent=f?`${f.name} · ${size(f.size)}`:'Todavía no has seleccionado un PDF.';$('reduce-status').textContent='';sync();}
$('reduce-file').onchange=e=>{const f=e.target.files[0];if(f&&valid(f))loadSource(f);else if(f)$('reduce-status').textContent='Selecciona un archivo PDF.';e.target.value='';};
$('clear-reduce').onclick=()=>loadSource(null);$('consent').onchange=sync;
for(const id of ['dpi','quality','gray','target'])$(id).onchange=()=>dropResult('reduce');
$('cancel').onclick=()=>{cancelled=true;$('cancel').disabled=true;};
function checkCancel(){if(cancelled)throw new Error('Proceso cancelado. Puedes volver a intentarlo.');}
function message(e){if(/invalid pdf|no pdf header|failed to parse/i.test(e.message||''))return 'El archivo no es un PDF válido o está dañado. Prueba con otra copia.';return /password|encrypted/i.test(e.message||'')?'El PDF está protegido con contraseña. Guarda una copia sin protección para procesarlo.':e.message||'No se pudo procesar el PDF.';}
$('merge').onclick=async()=>{lock(true);cancelled=false;dropResult('merge');try{const doc=await PDFLib.PDFDocument.create();for(let i=0;i<files.length;i++){checkCancel();$('merge-status').textContent=`Uniendo documento ${i+1} de ${files.length}…`;const part=await PDFLib.PDFDocument.load(await files[i].arrayBuffer());const pages=await doc.copyPages(part,part.getPageIndices());pages.forEach(p=>doc.addPage(p));}checkCancel();merged=new Blob([await doc.save()],{type:'application/pdf'});$('merge-info').textContent=`${doc.getPageCount()} páginas · ${size(merged.size)}`;$('merge-result').hidden=false;$('merge-status').textContent='PDF unido listo.';}catch(e){$('merge-status').textContent=message(e);}finally{lock(false);renderFiles();}};
$('send-reduce').onclick=()=>{loadSource(new File([merged],$('out-name').value||'pdf_unido.pdf',{type:'application/pdf'}));mode('reduce');};
function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name.toLowerCase().endsWith('.pdf')?name:name+'.pdf';a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}
$('download-merge').onclick=()=>download(merged,$('out-name').value||'pdf_unido.pdf');
$('download-reduce').onclick=()=>download(reduced,source.name.replace(/\.pdf$/i,'')+'_reducido.pdf');
$('reduce').onclick=async()=>{
 const target=Number($('target').value)*1e6;if(!Number.isFinite(target)||target<100000){$('reduce-status').textContent='Indica un límite válido de al menos 0.1 MB.';return;}
 const dpi=Number($('dpi').value),quality=Number($('quality').value),gray=$('gray').checked;
 lock(true);cancelled=false;dropResult('reduce');$('progress').hidden=false;$('progress').value=0;let task=null,doc=null;
 try{
 task=pdfjs.getDocument({data:new Uint8Array(await source.arrayBuffer()),isEvalSupported:false,enableXfa:false,useSystemFonts:true,disableFontFace:true,verbosity:0});
 task.onPassword=()=>{task.destroy();};
 doc=await task.promise;const output=await PDFLib.PDFDocument.create();$('progress').max=doc.numPages;
 for(let i=1;i<=doc.numPages;i++){
 checkCancel();$('reduce-status').textContent=`Procesando página ${i} de ${doc.numPages}…`;
 const page=await doc.getPage(i),base=page.getViewport({scale:1});let scale=dpi/72;scale=Math.min(scale,Math.sqrt(16000000/(base.width*base.height)),8192/Math.max(base.width,base.height));const view=page.getViewport({scale});
 const canvas=document.createElement('canvas');canvas.width=Math.ceil(view.width);canvas.height=Math.ceil(view.height);
 try{const ctx=canvas.getContext('2d',{willReadFrequently:gray});await page.render({canvasContext:ctx,viewport:view,background:'rgb(255,255,255)'}).promise;
 if(gray){const image=ctx.getImageData(0,0,canvas.width,canvas.height);for(let k=0;k<image.data.length;k+=4){const v=Math.round(.299*image.data[k]+.587*image.data[k+1]+.114*image.data[k+2]);image.data[k]=image.data[k+1]=image.data[k+2]=v;}ctx.putImageData(image,0,0);}
 const jpeg=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',quality));if(!jpeg)throw new Error('No se pudo convertir esta página.');const embedded=await output.embedJpg(await jpeg.arrayBuffer());output.addPage([base.width,base.height]).drawImage(embedded,{x:0,y:0,width:base.width,height:base.height});
 }finally{canvas.width=canvas.height=0;page.cleanup();}
 $('progress').value=i;await new Promise(resolve=>setTimeout(resolve,0));}
 checkCancel();reduced=new Blob([await output.save()],{type:'application/pdf'});previewURL=URL.createObjectURL(reduced);$('preview').href=previewURL;
 const saving=(1-reduced.size/source.size)*100;
 $('reduce-info').textContent=`Original: ${size(source.size)} → Copia: ${size(reduced.size)} · ${saving>=0?saving.toFixed(1)+'% menos':'El tamaño aumentó; conserva el original.'} · ${reduced.size<=target?'Cumple':'Supera'} el límite de ${size(target)}.`;
 $('reduce-result').hidden=false;$('reduce-status').textContent='Copia lista. Revisa la legibilidad antes de descargar.';
 }catch(e){$('reduce-status').textContent=/destroy/i.test(e.message||'')?'PDF protegido o proceso interrumpido. Usa una copia sin contraseña.':message(e);}finally{try{if(task)await task.destroy();}finally{$('progress').hidden=true;lock(false);}}
};
window.addEventListener('pagehide',()=>{if(previewURL)URL.revokeObjectURL(previewURL);});
sync();
