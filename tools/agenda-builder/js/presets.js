export function presetActivities(key,date){
 const starts={morning:9,afternoon:16,night:19};const h=starts[key];if(h===undefined)return [];
 return ['Bienvenida y algo para compartir','El plan de hoy','Fotos y recuerdos','Conversación libre'].map((description,i)=>({id:crypto.randomUUID(),activityDate:date,start:`${String(h+i).padStart(2,'0')}:00`,end:`${String(h+i).padStart(2,'0')}:45`,description}));
}
