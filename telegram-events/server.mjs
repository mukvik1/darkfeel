import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {createBot,publicEvents} from './bot.mjs';
import {createAnalytics} from './analytics.mjs';
const token=process.env.TELEGRAM_BOT_TOKEN;
const ids=new Set((process.env.TELEGRAM_ALLOWED_USER_IDS||'').split(',').map(s=>s.trim()).filter(Boolean));
const dataDir=process.env.DATA_DIR||'./data';fs.mkdirSync(dataDir,{recursive:true});
const analytics=createAnalytics(path.join(dataDir,'analytics.sqlite'));
const file=path.join(dataDir,'events.json');
let data=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):{events:[],offset:0};
if(!Array.isArray(data.events))throw new Error('Invalid persisted event data');
function save(next){const temp=file+'.tmp';fs.writeFileSync(temp,JSON.stringify(next),{mode:0o600});fs.renameSync(temp,file);data=next;}
const allowedOrigin=process.env.SITE_ORIGIN||'https://darkfeel-official.mukvik.chatgpt.site';
http.createServer(async(req,res)=>{
  res.setHeader('Access-Control-Allow-Origin',allowedOrigin);res.setHeader('Vary','Origin');
  res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method==='POST'&&req.url==='/api/dark-feel/analytics'){
    let bytes=0,chunks=[];
    try{for await(const chunk of req){bytes+=chunk.length;if(bytes>4096){res.statusCode=413;return res.end();}chunks.push(chunk);}
      const payload=JSON.parse(Buffer.concat(chunks).toString('utf8'));
      analytics.record(payload,req.headers['x-analytics-origin']||req.headers.origin||'',req.headers['user-agent']||'');
      res.statusCode=204;return res.end();
    }catch{res.statusCode=400;return res.end();}
  }
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
const handle=createBot({allowedIds:ids,read:()=>data,save,analyticsReport:days=>analytics.report(days),botUsername:process.env.TELEGRAM_BOT_USERNAME,
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
