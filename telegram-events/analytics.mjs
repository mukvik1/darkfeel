import {DatabaseSync} from 'node:sqlite';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const siteHosts=new Set(['darkfeel.com.ua','www.darkfeel.com.ua']);
export function validVisit(data,origin,agent='') {
  try{if(!siteHosts.has(new URL(origin).hostname))return false;}catch{return false;}
  return !!data && ['event','visitor','session'].every(k=>typeof data[k]==='string'&&uuid.test(data[k])) && typeof data.path==='string'&&/^\/[a-zA-Z0-9_./%\-]{0,250}$/.test(data.path) && typeof data.source==='string'&&/^[a-zA-Z0-9_.\-]{1,100}$/.test(data.source) && !/bot|crawler|spider|headless/i.test(agent);
}
function kyivParts(now){return Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Kyiv',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date(now)).filter(p=>p.type!=='literal').map(p=>[p.type,Number(p.value)]));}
export function reportStart(days,now) {
  if(![0,1,7,30].includes(days))throw new Error('Invalid report period');
  if(!days)return '';
  if(days!==1)return new Date(now-days*86400000).toISOString();
  const p=kyivParts(now),target=Date.UTC(p.year,p.month-1,p.day);let guess=target;
  for(let i=0;i<3;i++){const q=kyivParts(guess);const offset=Date.UTC(q.year,q.month-1,q.day,q.hour,q.minute,q.second)-guess;guess=target-offset;}
  return new Date(guess).toISOString();
}
export function createAnalytics(filename,{now=()=>Date.now()}={}) {
  const db=new DatabaseSync(filename);db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=3000;
    CREATE TABLE IF NOT EXISTS website_visits(event_id TEXT PRIMARY KEY,visitor_id TEXT NOT NULL,session_id TEXT NOT NULL,page TEXT NOT NULL,source TEXT NOT NULL,created_at TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS website_visits_created ON website_visits(created_at);
    CREATE INDEX IF NOT EXISTS website_visits_visitor_created ON website_visits(visitor_id,created_at);`);
  return {
    record(data,origin,agent=''){
      if(!validVisit(data,origin,agent))return false;
      const cutoff=new Date(now()-86400000).toISOString();
      const count=db.prepare('SELECT count(*) n FROM website_visits WHERE visitor_id=? AND created_at>?').get(data.visitor,cutoff).n;
      if(count>=500)return false;
      const result=db.prepare('INSERT OR IGNORE INTO website_visits VALUES(?,?,?,?,?,?)').run(data.event,data.visitor,data.session,data.path,data.source,new Date(now()).toISOString());
      return Number(result.changes)>0;
    },
    report(days=0){
      const start=reportStart(days,now());
      const total=db.prepare('SELECT count(*) views,count(DISTINCT visitor_id) visitors,count(DISTINCT session_id) sessions FROM website_visits WHERE created_at>=?').get(start);
      const first=db.prepare('SELECT min(created_at) first FROM website_visits').get().first;
      const pages=db.prepare('SELECT page,count(*) n FROM website_visits WHERE created_at>=? GROUP BY page ORDER BY n DESC,page LIMIT 5').all(start);
      const sources=db.prepare('SELECT source,count(DISTINCT session_id) n FROM website_visits WHERE created_at>=? GROUP BY source ORDER BY n DESC,source LIMIT 5').all(start);
      return ['📊 darkfeel.com.ua',days===0?'📅 За всё время':days===1?'📅 Сегодня · Киев':`📅 Последние ${days} дней`,'',`👥 Посетители: ${total.visitors}`,`🚪 Визиты: ${total.sessions}`,`👁 Просмотры: ${total.views}`,'','📄 Популярные страницы',...pages.map(r=>`${r.page} — ${r.n}`),'','🔗 Источники визитов',...sources.map(r=>`${r.source==='direct'?'Прямые переходы':r.source} — ${r.n}`),'',first?'📍 Первое посещение: '+new Intl.DateTimeFormat('ru-RU',{timeZone:'Europe/Kyiv',day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(first)):'⏳ Данных пока нет. Сбор начинается после установки счётчика.','Посетители считаются по анонимному ID браузера.'].join('\n');
    },close(){db.close();}
  };
}
