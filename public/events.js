(async () => {
  const list = document.getElementById('event-list');
  const empty = (text) => { list.replaceChildren(); const p=document.createElement('p');p.className='events-empty';p.textContent=text;list.append(p);list.setAttribute('aria-busy','false'); };
  try {
    const configResponse = await fetch('events-config.json', {cache:'no-store'});
    if (!configResponse.ok) throw new Error('Configuration unavailable');
    const config = await configResponse.json();
    const response = await fetch(config.endpoint || 'events.json', {cache:'no-store',headers:{Accept:'application/json'},signal:AbortSignal.timeout(12000)});
    if (!response.ok) throw new Error('Events unavailable');
    const payload=await response.json();
    if(!Array.isArray(payload.events))throw new Error('Invalid events');
    const today=new Date().toISOString().slice(0,10);
    const events=payload.events.filter(e=>/^\d{4}-\d{2}-\d{2}$/.test(e.date)&&e.date>=today).sort((a,b)=>a.date.localeCompare(b.date));
    if (!events.length) return empty('Dates to be announced.');
    list.replaceChildren();
    for (const event of events) {
      const row=document.createElement('article');row.className='event-row';
      const date=document.createElement('time');date.className='event-date';date.dateTime=event.date;date.textContent=new Intl.DateTimeFormat('en',{day:'2-digit',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(event.date+'T12:00:00Z'));
      const info=document.createElement('div');info.className='event-info';
      const title=document.createElement('h3');title.textContent=event.venue;
      const place=document.createElement('p');place.textContent=[event.city,event.country].filter(Boolean).join(', ');info.append(title,place);row.append(date,info);
      if(event.ticket_url){try{const url=new URL(event.ticket_url);if(url.protocol==='https:'){const a=document.createElement('a');a.className='event-ticket';a.href=url.href;a.target='_blank';a.rel='noopener';a.textContent='Tickets';row.append(a)}}catch{}}
      list.append(row);
    }
    list.setAttribute('aria-busy','false');
  } catch { empty('Dates are temporarily unavailable.'); }
})();
