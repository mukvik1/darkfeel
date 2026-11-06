(() => {
  if(window.__darkfeelAnalytics||navigator.webdriver||navigator.doNotTrack==='1'||navigator.globalPrivacyControl===true)return;
  if(!['darkfeel.com.ua','www.darkfeel.com.ua'].includes(location.hostname))return;
  window.__darkfeelAnalytics=true;
  const id=()=>crypto.randomUUID();let visitor,sessionMemory;
  try{visitor=localStorage.getItem('df_visitor')||id();localStorage.setItem('df_visitor',visitor);}catch{visitor=id();}
  let lastPath;
  function visit(){
    if(document.visibilityState==='hidden'||lastPath===location.pathname)return;
    lastPath=location.pathname;
    const now=Date.now();
    try{sessionMemory=JSON.parse(sessionStorage.getItem('df_session')||'null');}catch{}
    if(!sessionMemory||now-sessionMemory.at>1800000)sessionMemory={id:id(),at:now};
    sessionMemory.at=now;
    try{sessionStorage.setItem('df_session',JSON.stringify(sessionMemory));}catch{}
    let source='direct';
    try{const ref=new URL(document.referrer);if(!['darkfeel.com.ua','www.darkfeel.com.ua'].includes(ref.hostname))source=ref.hostname;}catch{}
    const utm=new URLSearchParams(location.search).get('utm_source');if(utm&&/^[a-zA-Z0-9_.-]{1,80}$/.test(utm))source=utm;
    fetch('/api/analytics',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({visitor,session:sessionMemory.id,event:id(),path:location.pathname,source}),keepalive:true}).catch(()=>{});
  }
  for(const method of ['pushState','replaceState']){const original=history[method];history[method]=function(...args){const result=original.apply(this,args);visit();return result;};}
  addEventListener('popstate',visit);document.addEventListener('visibilitychange',visit);visit();
})();
