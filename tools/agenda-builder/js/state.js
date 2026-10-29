export const DRAFT_KEY = 'danilodevsr-agenda-v2';
export const todayISO = () => {const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
export const emptyAgenda = () => ({version:2,eventName:'',eventDate:todayISO(),place:'',intro:'',columns:'auto',orientation:'portrait',activities:[]});
export const minutes = t => Number(t.slice(0,2))*60+Number(t.slice(3));
export const timeString = m => `${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;
export const newActivity = (agenda) => {
 const last=agenda.activities.at(-1);const start=last && /^([01]\d|2[0-3]):[0-5]\d$/.test(last.end) ? Math.min(1438,minutes(last.end)+15):16*60;
 return {id:crypto.randomUUID(),activityDate:last?.activityDate||agenda.eventDate||todayISO(),start:timeString(start),end:timeString(Math.min(1439,start+30)),description:''};
};
const dateValid = v => typeof v==='string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v+'T12:00:00')) && new Date(v+'T12:00:00').getDate()===Number(v.slice(8));
const timeValid = v => typeof v==='string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
function text(value,max,label){if(typeof value!=='string'||value.length>max)throw new Error(`${label}: texto inválido o demasiado largo.`);return value;}
export function parseAgenda(raw,{draft=false}={}){
 if(!raw||typeof raw!=='object'||!Array.isArray(raw.activities)||raw.activities.length>120)throw new Error('La agenda debe contener hasta 120 actividades.');
 const result=emptyAgenda();result.eventName=text(raw.eventName??'',140,'Nombre');result.eventDate=raw.eventDate??todayISO();if(!(draft&&result.eventDate==='')&&!dateValid(result.eventDate))throw new Error('Fecha del evento inválida.');
 result.place=text(raw.place??'',180,'Lugar');result.intro=text(raw.intro??'',400,'Frase');result.columns=['auto','1','2','3'].includes(raw.columns)?raw.columns:'auto';result.orientation=['portrait','landscape'].includes(raw.orientation)?raw.orientation:'portrait';
 result.activities=raw.activities.map((a,i)=>{if(!a||typeof a!=='object'||!(timeValid(a.start)||(draft&&a.start===''))||!(timeValid(a.end)||(draft&&a.end==='')))throw new Error(`Actividad ${i+1}: horario inválido.`);
 let date=a.activityDate??result.eventDate;if(!a.activityDate&&a.dayOffset!==undefined){if(!Number.isInteger(a.dayOffset)||Math.abs(a.dayOffset)>366)throw new Error('Desplazamiento de día inválido.');const d=new Date(result.eventDate+'T12:00:00');d.setDate(d.getDate()+a.dayOffset);date=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
 if(!(draft&&date==='')&&!dateValid(date))throw new Error(`Actividad ${i+1}: fecha inválida.`);return {id:crypto.randomUUID(),activityDate:date,start:a.start,end:a.end,description:text(a.description??'',600,'Actividad')};});return result;
}
export const sortedActivities = a => [...a].sort((x,y)=>(x.activityDate+x.start).localeCompare(y.activityDate+y.start));
export const prettyDate = value => value ? new Date(value+'T12:00:00').toLocaleDateString('es-PE',{day:'numeric',month:'long',year:'numeric'}):'Fecha por definir';
