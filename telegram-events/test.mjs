import {test} from 'node:test';import assert from 'node:assert/strict';import {createBot,validDate,parseDate,parseTime,publicEvents} from './bot.mjs';
function setup(initial=[]) {
 let state={events:initial};const messages=[],answers=[];let n=1;
 const handle=createBot({allowedIds:new Set(['42']),read:()=>state,save:d=>{state=d},reply:async(chat,text,markup)=>messages.push({text,markup}),edit:async(chat,id,text,markup)=>messages.push({text,markup}),answer:async(id,text)=>answers.push({id,text}),today:()=> '2026-11-04'});
 return {get state(){return state},messages,answers,async text(text,id=42,type='private'){await handle({update_id:n++,message:{from:{id},chat:{id:10,type},text}})},async cb(data,id=42){await handle({update_id:n++,callback_query:{id:'q'+n,from:{id},message:{message_id:50,chat:{id:10,type:'private'}},data}})},last(){return messages.at(-1)}};
}
test('date and time validation',()=>{assert.equal(validDate('2027-02-29'),false);assert.equal(parseDate('28.02.2027'),'2027-02-28');assert.equal(parseTime('20:00 - 23:00'),'20:00–23:00');assert.throws(()=>parseTime('25:00'));});
test('main menu matches requested inline buttons and statistics has periods',async()=>{const h=setup();await h.text('/start');assert.deepEqual(h.last().markup.inline_keyboard.map(r=>r[0].text),['➕ Добавить выступление','📅 Все события','📊 Статистика']);await h.cb('df_stats');assert.ok(h.last().markup.inline_keyboard.flat().some(b=>b.callback_data==='df_stats:7'));assert.ok(h.last().markup.inline_keyboard.flat().some(b=>b.callback_data==='df_stats:30'));});
test('unauthorized user cannot add or click controls',async()=>{const h=setup();await h.text('/add',99);assert.match(h.last().text,/только администратору/);await h.cb('df_add',99);assert.match(h.answers.at(-1).text,/только администратору/);assert.equal(h.state.events.length,0);});
test('add wizard, hidden filtering, edit, visibility and confirmed deletion',async()=>{
 const h=setup();await h.cb('df_add');
 for(const value of ['30.02.2027','28.02.2027','20:00–23:00','Surf Club','Dubai','United Arab Emirates','javascript:alert(1)','https://tickets.example/event'])await h.text(value);
 assert.equal(h.state.events.length,0);assert.match(h.last().text,/Показывать/);
 await h.cb('df_vis:hidden');assert.equal(h.state.events.length,1);assert.equal(publicEvents(h.state).length,0);
 const id=h.state.events[0].id;await h.cb('df_list');assert.equal(h.last().markup.inline_keyboard[0][0].callback_data,'df_show:'+id);
 await h.cb('df_edit:'+id);await h.cb('df_field:venue');await h.text('Ling Ling');assert.equal(h.state.events[0].venue,'Ling Ling');
 await h.cb('df_toggle:'+id);assert.equal(publicEvents(h.state).length,1);assert.equal(publicEvents(h.state)[0].time,'20:00–23:00');
 await h.cb('df_delete:'+id);assert.equal(h.state.events.length,1);await h.cb('df_show:'+id);assert.equal(h.state.events.length,1);
 await h.cb('df_delete:'+id);await h.cb('df_delete_yes:'+id);assert.equal(h.state.events.length,0);
});
test('cancel and expired buttons do not publish drafts',async()=>{const h=setup();await h.cb('df_add');await h.text('01.12.2026');await h.cb('df_cancel');await h.cb('df_vis:public');assert.equal(h.state.events.length,0);});
test('legacy events remain visible and lists paginate',async()=>{const events=Array.from({length:12},(_,i)=>({id:'df-'+i,date:'2027-01-01',venue:'Venue '+i,city:'Dubai',country:'UAE'}));const h=setup(events);assert.equal(publicEvents(h.state).length,12);await h.cb('df_list');assert.ok(h.last().markup.inline_keyboard.some(r=>r.some(b=>b.callback_data==='df_page:1')));await h.cb('df_page:1');assert.equal(h.last().markup.inline_keyboard.length,4);});

test('invite grants persistent editor access once and only owners create invites',async()=>{
 let state={events:[]};let clock=Date.parse('2026-11-04T12:00:00Z');let n=100;
 const output=[];const make=()=>createBot({allowedIds:new Set(['42']),read:()=>state,save:d=>{state=d},reply:async(chat,text,markup)=>output.push({chat,text,markup}),now:()=>clock});
 let handle=make();const send=(id,text)=>handle({update_id:n++,message:{from:{id},chat:{id,type:'private'},text}});
 await send(42,'/invite');const link=output.at(-1).text.match(/start=(invite_[A-Za-z0-9_-]+)/)[1];
 assert.ok(state.invites[0].hash);assert.equal(JSON.stringify(state).includes(link.slice(7)),false);
 await send(42,'/start '+link);assert.equal(state.invites.length,1);
 await send(99,'/start '+link);assert.equal(state.editors[0].id,'99');assert.equal(state.invites.length,0);
 await send(100,'/start '+link);assert.match(output.at(-1).text,/недействительно/);
 handle=make();await send(99,'/start');assert.ok(output.at(-1).markup.inline_keyboard);
 await send(99,'/invite');assert.match(output.at(-1).text,/только владелец/);
 await send(42,'/invite');const expired=output.at(-1).text.match(/start=(invite_[A-Za-z0-9_-]+)/)[1];clock+=25*60*60*1000;
 await send(101,'/start '+expired);assert.match(output.at(-1).text,/срок истёк/);
});
test('replacement invites revoke the previous link and groups cannot redeem',async()=>{
 let state={events:[]},n=500;const out=[];
 const handle=createBot({allowedIds:new Set(['42']),read:()=>state,save:d=>{state=d},reply:async(_,text)=>out.push(text)});
 const send=(id,text,type='private')=>handle({update_id:n++,message:{from:{id},chat:{id,type},text}});
 await send(42,'/invite');const old=out.at(-1).match(/start=(invite_[A-Za-z0-9_-]+)/)[1];await send(42,'/invite');const current=out.at(-1).match(/start=(invite_[A-Za-z0-9_-]+)/)[1];
 await send(77,'/start '+old);assert.match(out.at(-1),/недействительно/);await send(77,'/start '+current,'group');assert.equal(state.editors,undefined);await send(77,'/start '+current);assert.equal(state.editors[0].id,'77');
});
