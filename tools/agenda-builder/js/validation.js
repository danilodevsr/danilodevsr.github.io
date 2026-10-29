import {minutes, sortedActivities} from './state.js';
export function validateAgenda(agenda){
 const errors=[];const list=sortedActivities(agenda.activities);
 if(!agenda.eventDate)errors.push('Elige una fecha para la reunión.');
 for(let i=0;i<list.length;i++){const a=list[i];
 if(!a.activityDate||!a.start||!a.end||minutes(a.start)>=minutes(a.end))errors.push(`Actividad ${i+1}: revisa la fecha y las horas de inicio y fin.`);
 if(!a.description.trim())errors.push(`Actividad ${i+1}: escribe qué van a hacer.`);
 for(let j=0;j<i;j++){const b=list[j];if(a.activityDate===b.activityDate&&a.start<b.end&&b.start<a.end){errors.push(`Se cruzan los horarios de «${b.description||'Actividad'}» y «${a.description||'Actividad'}».`);break;}}
 }
 return errors;
}
