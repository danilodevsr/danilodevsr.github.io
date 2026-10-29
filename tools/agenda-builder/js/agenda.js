import {prettyDate,sortedActivities} from './state.js';
const palette={paper:'#fbf7ef',ink:'#273d36',muted:'#63736c',accent:'#ad7358',line:'#d8d6c7'};
function font(ctx,size,serif=false){ctx.font=`${serif?'':'500 '}${size}px ${serif?'Georgia, serif':'Arial, sans-serif'}`;}
function wrap(ctx,text,width){
 const lines=[];for(const paragraph of String(text).split('\n')){let line='';for(const word of paragraph.split(/\s+/).filter(Boolean)){if(ctx.measureText(word).width>width){if(line){lines.push(line);line='';}for(const ch of word){if(ctx.measureText(line+ch).width>width){lines.push(line);line='';}line+=ch;}}else if(line&&ctx.measureText(line+' '+word).width>width){lines.push(line);line=word;}else line+=(line?' ':'')+word;}lines.push(line);}return lines;
}
function textBlock(ctx,text,x,y,width,size,leading,serif=false,draw=true){font(ctx,size,serif);const lines=wrap(ctx,text,width);if(draw)lines.forEach((line,i)=>ctx.fillText(line,x,y+i*leading));return lines.length*leading;}
export function drawInvitation(canvas,agenda){
 const landscape=agenda.orientation==='landscape';canvas.width=landscape?1754:1240;canvas.height=landscape?1240:1754;
 const ctx=canvas.getContext('2d');ctx.textBaseline='top';const W=canvas.width,H=canvas.height,M=76;
 ctx.fillStyle=palette.paper;ctx.fillRect(0,0,W,H);ctx.strokeStyle=palette.line;ctx.lineWidth=2;ctx.strokeRect(30,30,W-60,H-60);
 ctx.fillStyle=palette.accent;font(ctx,16);ctx.textAlign='center';ctx.fillText('UN MOMENTO PARA COMPARTIR',W/2,76);ctx.textAlign='left';
 let y=123;ctx.fillStyle=palette.ink;y+=textBlock(ctx,agenda.eventName.trim()||'Nos encontramos',M,y,W-2*M,landscape?62:68,landscape?72:78,true)+22;
 ctx.fillStyle=palette.muted;y+=textBlock(ctx,prettyDate(agenda.eventDate)+(agenda.place.trim()?'  ·  '+agenda.place.trim():''),M,y,W-2*M,24,34)+14;
 if(agenda.intro.trim()){ctx.fillStyle=palette.muted;y+=textBlock(ctx,agenda.intro.trim(),M,y,W-2*M,25,36)+22;}
 ctx.strokeStyle=palette.line;ctx.beginPath();ctx.moveTo(M,y);ctx.lineTo(W-M,y);ctx.stroke();y+=30;ctx.fillStyle=palette.accent;font(ctx,17);ctx.fillText('EL ITINERARIO',M,y);y+=47;
 const items=sortedActivities(agenda.activities);const columns=agenda.columns==='auto'?(items.length>14?3:items.length>6?2:1):Number(agenda.columns);const gap=42,cw=(W-2*M-(columns-1)*gap)/columns;
 const groups=Array.from({length:columns},(_,i)=>items.slice(i*Math.ceil(items.length/columns),(i+1)*Math.ceil(items.length/columns)));
 function height(a,size){font(ctx,size);return wrap(ctx,a.description||'Tu próxima actividad',cw-30).length*size*1.38+size*2.7+(a.activityDate!==agenda.eventDate?size*1.35:0);}
 let size=columns===1?40:29;const available=H-y-118;
 while(size>18&&groups.some(group=>group.reduce((h,a)=>h+height(a,size),0)>available))size--;
 const fits=groups.every(group=>group.reduce((h,a)=>h+height(a,size),0)<=available)&&available>0;
 groups.forEach((group,col)=>{let cy=y;const x=M+col*(cw+gap);
 if(col){ctx.strokeStyle=palette.line;ctx.beginPath();ctx.moveTo(x-gap/2,y);ctx.lineTo(x-gap/2,H-110);ctx.stroke();}
 const total=group.reduce((h,a)=>h+height(a,size),0);const spacing=group.length>1?Math.min(90,Math.max(0,(available-total)/(group.length-1))):0;
 for(const a of group){const blockHeight=height(a,size);if(cy+blockHeight>H-105)break;
 ctx.fillStyle=palette.accent;ctx.beginPath();ctx.arc(x+4,cy+size*.45,4,0,Math.PI*2);ctx.fill();font(ctx,size*.75);ctx.fillText(`${a.start} — ${a.end}`,x+25,cy);cy+=size*1.2;
 if(a.activityDate!==agenda.eventDate){ctx.fillStyle=palette.muted;font(ctx,size*.65);ctx.fillText(prettyDate(a.activityDate),x+25,cy);cy+=size*1.35;}
 ctx.fillStyle=palette.ink;cy+=textBlock(ctx,a.description||'Tu próxima actividad',x+25,cy,cw-30,size,size*1.38)+size*1.5+spacing;
 }});
 if(!items.length){ctx.fillStyle=palette.muted;textBlock(ctx,'Aquí comienza un buen plan. Añade los momentos de tu reunión.',M,y,W-2*M,32,46,true);}
 ctx.textAlign='center';ctx.fillStyle=palette.accent;font(ctx,22,true);ctx.fillText('Lo mejor del plan es estar juntos.',W/2,H-77);ctx.textAlign='left';
 return {fits,columns,fontSize:size};
}
