import {test} from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import vm from 'node:vm';
import {createAnalytics,validVisit,reportStart} from './analytics.mjs';import {createBot} from './bot.mjs';
const visit=(extra={})=>({event:randomUUID(),visitor:randomUUID(),session:randomUUID(),path:'/',source:'direct',...extra});
test('counters deduplicate events, count unique visitors/sessions and survive restarts',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'df-analytics-')),filename=path.join(dir,'analytics.sqlite');let now=Date.parse('2026-11-06T12:00:00Z');let store=createAnalytics(filename,{now:()=>now});
 try{const first=visit({source:'instagram.com'});assert.equal(store.record(first,'https://darkfeel.com.ua','Mozilla/5.0'),true);assert.equal(store.record(first,'https://darkfeel.com.ua','Mozilla/5.0'),false);
 store.record({...first,event:randomUUID()},'https://darkfeel.com.ua','Mozilla/5.0');store.record(visit(),'https://www.darkfeel.com.ua','Mozilla/5.0');
 let report=store.report(1);assert.match(report,/Посетители: 2/);assert.match(report,/Визиты: 2/);assert.match(report,/Просмотры: 3/);assert.match(report,/instagram.com — 1/);
 store.close();store=createAnalytics(filename,{now:()=>now});assert.match(store.report(0),/Просмотры: 3/);now+=8*86400000;assert.match(store.report(7),/Просмотры: 0/);assert.match(store.report(30),/Просмотры: 3/);
 }finally{store.close();fs.rmSync(dir,{recursive:true});}
});
test('analytics rejects foreign origins, bots, query strings and invalid identifiers',()=>{
 const data=visit();assert.equal(validVisit(data,'https://darkfeel.com.ua','Mozilla'),true);
 assert.equal(validVisit(data,'https://darkfeel.com.ua.attacker.test','Mozilla'),false);assert.equal(validVisit(data,'https://darkfeel.com.ua','Googlebot'),false);assert.equal(validVisit({...data,path:'/?token=secret'},'https://darkfeel.com.ua','Mozilla'),false);assert.equal(validVisit({...data,visitor:'invalid'},'https://darkfeel.com.ua','Mozilla'),false);
});
test('Today uses Kyiv midnight across daylight-saving transitions',()=>{
 assert.equal(reportStart(1,Date.parse('2026-11-06T12:00:00Z')),'2026-11-05T22:00:00.000Z');
 assert.equal(reportStart(1,Date.parse('2026-07-06T12:00:00Z')),'2026-07-05T21:00:00.000Z');
 assert.equal(reportStart(1,Date.parse('2026-10-25T12:00:00Z')),'2026-10-24T21:00:00.000Z');assert.throws(()=>reportStart(2,Date.now()));
});
test('bot reports selected periods to approved users only',async()=>{
 const messages=[],periods=[];const handle=createBot({allowedIds:new Set(['42']),read:()=>({events:[]}),save:()=>{},reply:async(_,text,markup)=>messages.push({text,markup}),answer:async()=>{},analyticsReport:days=>{periods.push(days);return 'REPORT '+days;}});
 await handle({update_id:1,message:{from:{id:42},chat:{id:42,type:'private'},text:'/stats'}});assert.equal(messages.at(-1).text,'REPORT 0');
 await handle({update_id:2,callback_query:{id:'q',from:{id:42},message:{message_id:1,chat:{id:42,type:'private'}},data:'df_stats:7'}});assert.equal(messages.at(-1).text,'REPORT 7');
 await handle({update_id:3,message:{from:{id:99},chat:{id:99,type:'private'},text:'/stats'}});assert.deepEqual(periods,[0,7]);assert.match(messages.at(-1).text,/только администратору/);
});
test('tracker sends anonymous first-party data once and respects privacy signals',()=>{
 const source=fs.readFileSync(new URL('../railway-site/public/analytics.js',import.meta.url),'utf8');
 function run({hostname='darkfeel.com.ua',privacy=false,webdriver=false}={}){
  const requests=[],handlers={};const storage=()=>{const m=new Map();return {getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,v)}};
  const ctx={window:{},navigator:{globalPrivacyControl:privacy,webdriver},crypto:{randomUUID},location:{hostname,pathname:'/',search:'?utm_source=instagram&private=secret'},document:{referrer:'',visibilityState:'visible',addEventListener:(k,f)=>handlers[k]=f},localStorage:storage(),sessionStorage:storage(),fetch:async(url,options)=>{requests.push({url,data:JSON.parse(options.body)});},history:{pushState:()=>{},replaceState:()=>{}},addEventListener:(k,f)=>handlers[k]=f,URL,URLSearchParams,Date};vm.runInNewContext(source,ctx);return {requests,handlers};
 }
 const normal=run();normal.handlers.visibilitychange();assert.equal(normal.requests.length,1);assert.equal(normal.requests[0].data.source,'instagram');assert.equal(normal.requests[0].data.path,'/');assert.equal(JSON.stringify(normal.requests).includes('secret'),false);assert.equal(run({privacy:true}).requests.length,0);assert.equal(run({webdriver:true}).requests.length,0);assert.equal(run({hostname:'old.chatgpt.site'}).requests.length,0);
});
