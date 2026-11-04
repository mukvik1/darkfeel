import {randomBytes,createHash} from 'node:crypto';
export function validDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value+'T12:00:00Z')) && new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value;
}
export function parseDate(value) {
  const match=/^(\d{2})\.(\d{2})\.(\d{4})$/.exec(value);
  const iso=match?`${match[3]}-${match[2]}-${match[1]}`:value;
  if(!validDate(iso))throw new Error('Дата должна быть в формате ДД.ММ.ГГГГ — например, 24.12.2026');
  return iso;
}
export function parseTime(value) {
  if(['-','—',''].includes(value))return null;
  const normalized=value.replace(/\s*[—–-]\s*/g,'–');
  const valid=t=>/^([01]?\d|2[0-3]):[0-5]\d$/.test(t);
  if(!normalized.split('–').every(valid)||normalized.split('–').length>2)throw new Error('Время: 20:00 или 20:00–23:00. Если неизвестно — отправь —');
  return normalized;
}
export function parseTicket(value) {
  if(['-','—',''].includes(value))return null;
  try{const u=new URL(value);if(!['http:','https:'].includes(u.protocol))throw Error();return u.href;}catch{throw new Error('Ссылка должна начинаться с https://');}
}
const button=(text,callback_data)=>({text,callback_data});
const keyboard=rows=>({inline_keyboard:rows});
export const mainMenu=()=>keyboard([
  [button('➕ Добавить выступление','df_add')],
  [button('📅 Все события','df_list')],
  [button('📊 Статистика','df_stats')],
]);
const backMenu=()=>keyboard([[button('🏠 Меню','df_menu')]]);
const cancelMenu=()=>keyboard([[button('Отмена','df_cancel')]]);
const fields={date:['Дата','Дата ДД.ММ.ГГГГ:'],time:['Время','Время: 20:00 или 20:00–23:00. Если неизвестно — отправь —'],venue:['Venue / event','Venue или название события:'],city:['Город','Город:'],country:['Страна','Страна:'],ticket_url:['Ticket link','Ссылка на билеты или —:']};
const cleanText=value=>{if(!value||value.length>160)throw new Error('Напиши короткое название (до 160 символов).');return value;};
const clean=(field,value)=>field==='date'?parseDate(value):field==='time'?parseTime(value):field==='ticket_url'?parseTicket(value):cleanText(value);
const dateLabel=date=>new Intl.DateTimeFormat('ru-RU',{day:'numeric',month:'long',year:'numeric',weekday:'long',timeZone:'UTC'}).format(new Date(date+'T12:00:00Z'));
const eventText=e=>`${e.visibility==='hidden'?'🙈':'🌐'} ${dateLabel(e.date)}${e.time?' · '+e.time:''}\n${e.venue} · ${e.city}, ${e.country}${e.ticket_url?'\n'+e.ticket_url:''}`;
export const publicEvents=data=>data.events.filter(e=>e.visibility!=='hidden').map(({id,date,time,venue,city,country,ticket_url})=>({id,date,time:time||null,venue,city,country,ticket_url})).sort((a,b)=>a.date.localeCompare(b.date)||(a.time||'').localeCompare(b.time||''));
export function createBot({allowedIds,read,save,reply,edit,answer=async()=>{},botUsername='darkfeelevents_bot',now=()=>Date.now(),today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Kyiv',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())}) {
  const drafts=new Map();
  return async function handle(update) {
    const q=update.callback_query,m=q?.message||update.message,from=q?.from||m?.from;
    if(!from||m?.chat?.type!=='private')return;
    const user=String(from.id),text=(update.message?.text||'').trim(),cb=q?.data;
    const command=text.split(/\s/)[0].split('@')[0];
    const owner=allowedIds.has(user);
    const permitted=owner||(read().editors||[]).some(e=>e.id===user);
    if(command==='/start'&&text.split(/\s+/)[1]?.startsWith('invite_')){
      if(permitted)return reply(m.chat.id,'У тебя уже есть доступ. Ссылку можно переслать Дарине.',mainMenu());
      const secret=text.split(/\s+/)[1].slice(7);
      const hash=createHash('sha256').update(secret).digest('hex');
      const data=read();
      const invitation=(data.invites||[]).find(i=>i.hash===hash&&i.expiresAt>now()&&allowedIds.has(i.createdBy));
      if(!invitation)return reply(m.chat.id,'Приглашение недействительно или срок истёк. Попроси новую ссылку у администратора.');
      const next={...data,invites:(data.invites||[]).filter(i=>i.hash!==hash&&i.expiresAt>now()),editors:[...(data.editors||[]),{id:user,invitedBy:invitation.createdBy,joinedAt:new Date(now()).toISOString()}]};
      save(next);
      return reply(m.chat.id,'✅ Доступ к Dark Feel Events открыт. Теперь ты можешь управлять выступлениями.',mainMenu());
    }
    if(q)await answer(q.id,permitted?undefined:'Этот бот доступен только администратору Dark Feel.');
    if(!permitted){if(!q)await reply(m.chat.id,'Этот бот доступен только администратору Dark Feel.');return;}
    if(command==='/invite'){
      if(!owner)return reply(m.chat.id,'Приглашать участников может только владелец бота.',mainMenu());
      const secret=randomBytes(24).toString('base64url');
      const hash=createHash('sha256').update(secret).digest('hex');
      const data=read();
      save({...data,invites:[...(data.invites||[]).filter(i=>i.createdBy!==user&&i.expiresAt>now()),{hash,createdBy:user,expiresAt:now()+24*60*60*1000}]});
      return reply(m.chat.id,`Перешли эту одноразовую ссылку Дарине:\n\nhttps://t.me/${botUsername.replace(/^@/,'')}?start=invite_${secret}\n\nСсылка действует 24 часа. Доступ получит первый человек, который откроет её и нажмёт Start. Новая команда /invite заменит твою предыдущую ссылку.`,backMenu());
    }
    const say=(message,markup)=>q&&edit?edit(m.chat.id,m.message_id,message,markup):reply(m.chat.id,message,markup);
    const find=id=>read().events.find(e=>e.id===id);
    const mutation=fn=>{const data=read();if(data.lastMutationUpdate===update.update_id)return;fn(data);data.lastMutationUpdate=update.update_id;save(data);};
    const menu=(message='🎛 Dark Feel Events\n\n📅 Управляй выступлениями на сайте.\n\nВыбери раздел ниже:')=>say(message,mainMenu());
    const list=async(page=0)=>{
      const events=read().events.filter(e=>e.date>=today()).sort((a,b)=>a.date.localeCompare(b.date)||(a.time||'').localeCompare(b.time||''));
      if(!events.length)return menu('Будущих выступлений пока нет.');
      const pages=Math.ceil(events.length/10);page=Math.max(0,Math.min(page,pages-1));
      const rows=events.slice(page*10,page*10+10).map(e=>[button(`${new Intl.DateTimeFormat('ru-RU',{day:'numeric',month:'short',timeZone:'UTC'}).format(new Date(e.date+'T12:00:00Z'))} · ${e.venue}`.slice(0,55),'df_show:'+e.id)]);
      if(pages>1)rows.push([...(page>0?[button('Предыдущая','df_page:'+(page-1))]:[]),...(page<pages-1?[button('Следующая','df_page:'+(page+1))]:[])]);
      rows.push([button('🏠 Меню','df_menu')]);return say('Dark Feel · будущие выступления',keyboard(rows));
    };
    const show=async id=>{const e=find(id);if(!e)return say('Событие не найдено.',backMenu());return say(eventText(e),keyboard([
      [button('✏️ Изменить','df_edit:'+id)],
      [button('👁 Public / Hidden','df_toggle:'+id)],
      [button('🗑 Удалить','df_delete:'+id)],
      [button('📅 К списку','df_list')],
    ]));};
    if(cb==='df_menu'||command==='/start'||command==='/help'){drafts.delete(user);return menu();}
    if(cb==='df_cancel'||command==='/cancel'){drafts.delete(user);return menu('Отменено.');}
    if(cb==='df_stats'||command==='/stats')return say('📊 Статистика\n\nДобавим после запуска сайта на основном хостинге.',backMenu());
    if(cb==='df_list'||['/events','/list'].includes(command)){drafts.delete(user);return list();}
    if(cb?.startsWith('df_page:'))return list(Number(cb.split(':')[1])||0);
    if(cb==='df_add'||command==='/add'){drafts.set(user,{step:'date',event:{}});return say('Дата выступления в формате ДД.ММ.ГГГГ:\nНапример: 24.12.2026',cancelMenu());}
    if(cb?.startsWith('df_show:')){drafts.delete(user);return show(cb.slice(8));}
    if(cb?.startsWith('df_edit:')){
      const id=cb.slice(8);if(!find(id))return say('Событие не найдено.',backMenu());
      drafts.set(user,{step:'edit_field',id});return say('Что изменить?',keyboard([...Object.entries(fields).map(([key,[label]])=>[button(label,'df_field:'+key)]),[button('Назад','df_show:'+id)]]));
    }
    if(cb?.startsWith('df_field:')){
      const d=drafts.get(user),field=cb.slice(9);if(d?.step!=='edit_field'||!fields[field])return say('Сессия редактирования закончилась. Открой событие снова.',backMenu());
      d.step='edit_value';d.field=field;return say(fields[field][1],cancelMenu());
    }
    if(cb?.startsWith('df_toggle:')){const id=cb.slice(10);if(!find(id))return say('Событие не найдено.',backMenu());mutation(data=>{const e=data.events.find(e=>e.id===id);e.visibility=e.visibility==='hidden'?'public':'hidden';});return show(id);}
    if(cb?.startsWith('df_delete:')){const id=cb.slice(10);if(!find(id))return say('Событие не найдено.',backMenu());return say('Удалить выступление?',keyboard([[button('Удалить','df_delete_yes:'+id),button('Отмена','df_show:'+id)]]));}
    if(cb?.startsWith('df_delete_yes:')){const id=cb.slice(14);mutation(data=>{data.events=data.events.filter(e=>e.id!==id)});drafts.delete(user);return list();}
    const d=drafts.get(user);
    if(cb?.startsWith('df_vis:')){
      const visibility=cb.slice(7);if(d?.step!=='visibility'||!['public','hidden'].includes(visibility))return say('Добавление уже завершено.',mainMenu());
      const id='df-'+update.update_id;mutation(data=>data.events.push({...d.event,id,visibility}));drafts.delete(user);return menu('✅ Выступление сохранено.');
    }
    if(q)return say('Кнопка устарела. Открой главное меню.',mainMenu());
    if(!text)return;
    if(command.startsWith('/'))return menu('Неизвестная команда. Выбери раздел ниже:');
    if(!d)return menu();
    if(d.step==='edit_value'){
      if(!find(d.id)){drafts.delete(user);return say('Событие не найдено.',backMenu());}
      try{const value=clean(d.field,text);mutation(data=>{data.events.find(e=>e.id===d.id)[d.field]=value});drafts.delete(user);return reply(m.chat.id,'✅ Изменено.',keyboard([[button('Открыть событие','df_show:'+d.id)]]));}catch(error){return reply(m.chat.id,error.message,cancelMenu());}
    }
    if(!fields[d.step])return reply(m.chat.id,'Выбери вариант кнопкой выше или отмени действие.',cancelMenu());
    try{d.event[d.step]=clean(d.step,text);}catch(error){return reply(m.chat.id,error.message,cancelMenu());}
    const next={date:'time',time:'venue',venue:'city',city:'country',country:'ticket_url',ticket_url:'visibility'}[d.step];d.step=next;
    if(next==='visibility')return reply(m.chat.id,'Показывать событие на сайте?',keyboard([[button('🌐 На сайте','df_vis:public'),button('🙈 Скрыто','df_vis:hidden')],[button('Отмена','df_cancel')]]));
    return reply(m.chat.id,fields[next][1],cancelMenu());
  };
}

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const token=process.env.TELEGRAM_BOT_TOKEN;
const ids=new Set((process.env.TELEGRAM_ALLOWED_USER_IDS||'').split(',').map(s=>s.trim()).filter(Boolean));
const dataDir=process.env.DATA_DIR||'/data';fs.mkdirSync(dataDir,{recursive:true});
const file=path.join(dataDir,'events.json');
let data=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):{events:[],offset:0};
if(!Array.isArray(data.events))throw new Error('Invalid persisted event data');
function save(next){const temp=file+'.tmp';fs.writeFileSync(temp,JSON.stringify(next),{mode:0o600});fs.renameSync(temp,file);data=next;}
const allowedOrigin=process.env.SITE_ORIGIN||'https://darkfeel-official.mukvik.chatgpt.site';
http.createServer((req,res)=>{
  res.setHeader('Access-Control-Allow-Origin',allowedOrigin);res.setHeader('Vary','Origin');
  res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method==='GET'&&req.url==='/health'){res.end(JSON.stringify({ok:true,botConfigured:!!token&&ids.size>0}));return;}
  if(req.method==='GET'&&req.url?.split('?')[0]==='/api/dark-feel/events'){
    res.end(JSON.stringify({events:publicEvents(data)}));return;
  }
  res.statusCode=404;res.end('{"error":"Not found"}');
}).listen(Number(process.env.PORT||3000),'0.0.0.0');
async function telegram(method,body){
  const response=await fetch(`https://api.telegram.org/bot${token}/${method}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(45000)});
  const result=await response.json();if(!result.ok){const error=new Error('Telegram request failed');error.code=result.error_code;throw error;}return result.result;
}
const handle=createBot({allowedIds:ids,read:()=>data,save,botUsername:process.env.TELEGRAM_BOT_USERNAME,
  reply:(chat_id,text,reply_markup)=>telegram('sendMessage',{chat_id,text,reply_markup,link_preview_options:{is_disabled:true}}),
  edit:(chat_id,message_id,text,reply_markup)=>telegram('editMessageText',{chat_id,message_id,text,reply_markup,link_preview_options:{is_disabled:true}}).catch(async error=>{if(error.code===400)return telegram('sendMessage',{chat_id,text,reply_markup});throw error;}),
  answer:(callback_query_id,text)=>telegram('answerCallbackQuery',{callback_query_id,text,show_alert:!!text})
});
let running=true;process.on('SIGTERM',()=>{running=false;process.exit(0);});
async function poll(){
  while(running){try{
    const updates=await telegram('getUpdates',{offset:data.offset||0,timeout:25,allowed_updates:['message','callback_query']});
    for(const update of updates){await handle(update);save({...data,offset:update.update_id+1});}
  }catch(error){console.error('Telegram polling paused; retrying.',error.code||'network_error');await new Promise(r=>setTimeout(r,5000));}}
}
async function startBot(){
  try{const me=await telegram('getMe',{});const expected=(process.env.TELEGRAM_BOT_USERNAME||'darkfeelevents_bot').replace(/^@/,'');if(me.username?.toLowerCase()!==expected.toLowerCase())throw new Error('Unexpected bot username');
    await telegram('setMyCommands',{commands:[{command:'start',description:'🎛 Главное меню'},{command:'events',description:'📅 Все события'},{command:'add',description:'➕ Добавить выступление'},{command:'stats',description:'📊 Статистика'},{command:'invite',description:'Пригласить участника'},{command:'cancel',description:'Отменить действие'}]});
    console.info('Dark Feel Events bot started; inline menu enabled.');await poll();
  }catch(error){console.error('Bot startup failed.',error.code||error.message);process.exit(1);}
}
if(token&&ids.size)startBot();else console.info('Events API ready; Telegram is inactive until token and allowed user IDs are configured.');
