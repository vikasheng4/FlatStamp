(() => {
'use strict';
// Historical DB name retained so existing RentProof users keep local records after the FlatStamp rename.
const DB_NAME='rentproof-db', STORE='properties', DB_VERSION=1;
const APP='FlatStamp', DEMO_ID='flatstamp-demo-v1', SCHEMA_VERSION=2;
const app=document.getElementById('app');
let route={view:'home'};
let properties=[];
let editing=null;

const ROOM_TEMPLATES={
  'Living room':['All walls','Ceiling','Floor','Windows','Doors & locks','Switches & sockets','Lights/fans','Furniture','Existing damage'],
  'Bedroom':['All walls','Ceiling','Floor','Windows','Door & lock','Wardrobe exterior','Wardrobe interior','AC','Switches & sockets','Existing damage'],
  'Kitchen':['Walls/tiles','Floor','Sink & taps','Countertop','Cabinets exterior','Cabinets interior','Stove/hob','Chimney/exhaust','Fridge/appliances','Existing damage'],
  'Bathroom':['Walls/tiles','Floor','Toilet','Sink & taps','Shower','Mirror','Water heater','Drainage','Door & lock','Existing damage'],
  'Balcony':['Floor','Walls','Railing','Drainage','Doors/windows','Existing damage']
};
const DEFAULT_ROOMS=['Living room','Bedroom','Kitchen','Bathroom'];
const CONDITIONS=['Good','Fair','Damaged','Needs repair','Not applicable'];
const CONDITION_SCORE={'Good':0,'Fair':1,'Damaged':3,'Needs repair':4,'Not applicable':0,'':0};

function uid(){return crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+Math.random().toString(36).slice(2);}
function esc(s=''){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function fmt(d){if(!d)return '—';try{return new Date(d+'T00:00:00').toLocaleDateString(undefined,{day:'numeric',month:'short',year:'numeric'});}catch{return d;}}
function modeLabel(m){return m==='moveout'?'Move-out':'Move-in';}
function today(){return new Date().toISOString().slice(0,10);}
function hasEntry(e){return !!(e&&(e.condition||e.note||e.photos?.length));}
function reportId(p,mode){const d=(mode==='moveout'?(p.moveOutDate||today()):p.moveInDate||today()).replaceAll('-','');return `FS-${String(p.id).slice(0,8).toUpperCase()}-${mode==='compare'?'CMP':mode==='moveout'?'OUT':'IN'}-${d}`;}
function photoSrc(ph){return typeof ph==='string'?ph:ph?.src||'';}
function photoTime(ph){return typeof ph==='string'?'':ph?.addedAt||'';}

function openDB(){return new Promise((resolve,reject)=>{const r=indexedDB.open(DB_NAME,DB_VERSION);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains(STORE))r.result.createObjectStore(STORE,{keyPath:'id'});};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
async function allProps(){const db=await openDB();return new Promise((res,rej)=>{const r=db.transaction(STORE).objectStore(STORE).getAll();r.onsuccess=()=>res(r.result||[]);r.onerror=()=>rej(r.error);});}
async function saveProp(p){p.schemaVersion=SCHEMA_VERSION;p.updatedAt=new Date().toISOString();const db=await openDB();return new Promise((res,rej)=>{const r=db.transaction(STORE,'readwrite').objectStore(STORE).put(p);r.onsuccess=()=>res(p);r.onerror=()=>rej(r.error);});}
async function delProp(id){const db=await openDB();return new Promise((res,rej)=>{const r=db.transaction(STORE,'readwrite').objectStore(STORE).delete(id);r.onsuccess=()=>res();r.onerror=()=>rej(r.error);});}

function newEntry(){return {condition:'',note:'',photos:[]};}
function makeRoom(name){return {id:uid(),name,items:(ROOM_TEMPLATES[name]||['General condition','Existing damage']).map(label=>({id:uid(),label,movein:newEntry(),moveout:newEntry()}))};}
function blankMeta(){return {meters:{electricity:'',water:'',gas:''},inventoryNotes:'',keys:''};}
function newProperty(form={}){return {id:uid(),name:form.name||'My rental',address:form.address||'',landlord:form.landlord||'',tenant:form.tenant||'',tenancyType:form.tenancyType||'Rental apartment',furnishing:form.furnishing||'Unspecified',moveInDate:form.moveInDate||today(),moveOutDate:'',rooms:DEFAULT_ROOMS.map(makeRoom),metaByMode:{movein:blankMeta(),moveout:blankMeta()},createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),schemaVersion:SCHEMA_VERSION};}
function normalizeProperty(p){
  p.schemaVersion=p.schemaVersion||1;p.rooms=p.rooms||[];p.tenancyType=p.tenancyType||'Rental apartment';p.furnishing=p.furnishing||'Unspecified';
  p.rooms.forEach(r=>{r.items=r.items||[];r.items.forEach(i=>{i.movein=i.movein||newEntry();i.moveout=i.moveout||newEntry();i.movein.photos=i.movein.photos||[];i.moveout.photos=i.moveout.photos||[];});});
  if(!p.metaByMode){p.metaByMode={movein:{meters:{electricity:p.meters?.electricity||'',water:p.meters?.water||'',gas:p.meters?.gas||''},inventoryNotes:p.inventoryNotes||'',keys:p.keys||''},moveout:blankMeta()};}
  ['movein','moveout'].forEach(m=>{p.metaByMode[m]=p.metaByMode[m]||blankMeta();p.metaByMode[m].meters=p.metaByMode[m].meters||{electricity:'',water:'',gas:''};['electricity','water','gas'].forEach(k=>{if(p.metaByMode[m].meters[k]==null)p.metaByMode[m].meters[k]='';});if(p.metaByMode[m].inventoryNotes==null)p.metaByMode[m].inventoryNotes='';if(p.metaByMode[m].keys==null)p.metaByMode[m].keys='';});
  return p;
}
async function refresh(){properties=(await allProps()).map(normalizeProperty).sort((a,b)=>(b.updatedAt||'').localeCompare(a.updatedAt||''));}

function shell(title,body,back=false){return `<div class="app-shell"><header class="topbar"><div class="row">${back?'<button class="icon-btn" data-action="back" aria-label="Back">‹</button>':''}<div class="brand"><span class="brand-mark">FS</span>${esc(title||APP)}</div></div><button class="icon-btn no-print" data-action="settings" aria-label="Settings">⋯</button></header><main class="page">${body}</main></div>`;}
function toast(msg){const n=document.createElement('div');n.className='toast';n.textContent=msg;document.body.appendChild(n);setTimeout(()=>n.remove(),2600);}
function completion(p,mode){let total=0,done=0;(p.rooms||[]).forEach(r=>(r.items||[]).forEach(i=>{total++;if(hasEntry(i[mode]))done++;}));return {total,done,pct:total?Math.round(done/total*100):0};}
function changedItems(p){let changed=0,worse=0;for(const r of p.rooms){for(const i of r.items){if(!hasEntry(i.movein)&&!hasEntry(i.moveout))continue;const c1=i.movein?.condition||'',c2=i.moveout?.condition||'';const noteChanged=(i.movein?.note||'').trim()!==(i.moveout?.note||'').trim();if(c1!==c2||noteChanged)changed++;if(CONDITION_SCORE[c2]>CONDITION_SCORE[c1])worse++;}}return {changed,worse};}

function demoPhoto(kind='room'){return {src:kind==='fixture'?'demo/demo-fixture.jpg?v=6':'demo/demo-room.jpg?v=6',addedAt:'2026-01-12T10:15:00.000Z'};}
function demoProperty(){
  const p=newProperty({name:'Demo — Skyline Residency 2BHK',address:'Flat 804, C-Wing, Skyline Residency, Wakad Road, Pune, Maharashtra 411057 (fictional demo address)',tenant:'Arjun Mehta (Demo)',landlord:'Neha Kulkarni (Demo)',tenancyType:'Rental apartment',furnishing:'Semi-furnished',moveInDate:'2026-01-12'});
  p.id=DEMO_ID;p.demo=true;p.moveOutDate='2026-09-30';
  p.metaByMode.movein={meters:{electricity:'14,102.7 kWh',water:'128.6 kL',gas:'167.4 SCM'},inventoryNotes:'1 three-seat sofa; 1 coffee table; dining table with 4 chairs; 2 double beds with mattresses; 3 split AC units; refrigerator; washing machine; 15 L water heater; modular kitchen hob and chimney.',keys:'2 main-door keys; 1 mailbox key; 2 society RFID cards; 1 parking remote.'};
  p.metaByMode.moveout={meters:{electricity:'14,864.2 kWh',water:'146.9 kL',gas:'211.8 SCM'},inventoryNotes:'All listed furniture and appliances returned. Normal upholstery wear on sofa; no missing appliance.',keys:'2 main-door keys; 1 mailbox key; 2 society RFID cards; 1 parking remote returned.'};
  const bed2=makeRoom('Bedroom');bed2.name='Bedroom 2';p.rooms.splice(2,0,bed2);p.rooms.push(makeRoom('Balcony'));
  p.rooms.forEach(r=>r.items.forEach(i=>{i.movein={condition:'Good',note:'Checked at move-in; no material defect noted unless stated below.',photos:[]};i.moveout={condition:'Good',note:'Condition consistent with normal residential use.',photos:[]};}));
  const set=(room,label,miC,miN,moC,moN,miPic='',moPic='')=>{const x=p.rooms.find(r=>r.name===room)?.items.find(i=>i.label===label);if(!x)return;x.movein={condition:miC,note:miN,photos:miPic?[demoPhoto(miPic)]:[]};x.moveout={condition:moC,note:moN,photos:moPic?[demoPhoto(moPic)]:[]};};
  set('Living room','All walls','Fair','Two small nail holes on TV wall and faint scuff near balcony door; present before move-in.','Fair','Original nail holes remain. One light furniture scuff near sofa area.','room','room');
  set('Living room','Furniture','Good','Sofa and coffee table clean; slight pre-existing wear on left sofa arm.','Fair','Normal upholstery wear; no tear.','room','room');
  set('Bedroom','Existing damage','Fair','Small laminate chip on lower-right wardrobe shutter documented at handover.','Fair','Same laminate chip; no additional breakage.','fixture','fixture');
  set('Bedroom','AC','Good','Split AC powers on, cools normally, and remote is present.','Good','AC tested; cooling and remote functional.','fixture','fixture');
  set('Bedroom 2','Existing damage','Fair','Hairline paint crack above window corner, approximately 12 cm long.','Fair','Hairline crack appears unchanged.','room','room');
  set('Kitchen','Countertop','Fair','Small pre-existing granite edge chip beside sink.','Fair','Original edge chip unchanged; no new crack.','fixture','fixture');
  set('Kitchen','Stove/hob','Good','Four-burner hob ignites correctly.','Good','All four burners tested and working.','fixture','fixture');
  set('Bathroom','Walls/tiles','Good','Tiles intact; grout slightly discoloured near shower floor.','Fair','Mild hard-water staining on lower shower tiles; no cracked tile.','fixture','fixture');
  set('Bathroom','Water heater','Good','15 L geyser powers on and heats water.','Good','Geyser powers on and heats normally.','fixture','fixture');
  set('Balcony','Railing','Good','Railing secure with no loose sections.','Good','Railing secure.','room','room');
  set('Balcony','Drainage','Good','Drain clear after water test.','Good','Drain clear at move-out.','fixture','fixture');
  p.createdAt='2026-01-12T09:30:00.000Z';p.updatedAt='2026-09-30T16:45:00.000Z';return p;
}

function homeView(){
  const cards=properties.map(p=>{const c=completion(p,'movein');return `<article class="card property-card" data-open="${p.id}"><div class="row between"><div><div class="row wrap" style="gap:7px"><div class="property-title">${esc(p.name)}</div>${p.demo?'<span class="badge demo">DEMO</span>':''}</div><div class="muted tiny">${esc(p.address||'No address')}</div></div><span class="badge ${c.pct===100?'ok':''}">${c.pct}% move-in</span></div><div class="progress" style="margin-top:13px"><span style="width:${c.pct}%"></span></div><div class="row between tiny muted" style="margin-top:10px"><span>${c.done}/${c.total} checks documented</span><span>${fmt(p.moveInDate)}</span></div></article>`;}).join('');
  return shell(APP,`<section class="hero"><div class="eyebrow">Rental condition record</div><h1>Stamp the condition. Protect your deposit.</h1><p>Capture room-by-room evidence at move-in and move-out, compare changes, and save a clean report — without creating an account.</p></section><div class="grid2 no-print"><button class="btn primary block" data-action="new-property">+ New property</button><button class="btn soft block" data-action="open-demo">View demo</button></div><div class="section-title"><h2>Your properties</h2><span class="badge">${properties.length}</span></div>${cards||'<div class="card empty"><div class="big">⌂</div><h3>No property yet</h3><p class="muted">Create a rental inspection or open the demo to see a completed record.</p></div>'}<div class="stamp-callout"><strong>Local-first by design.</strong><div class="muted tiny" style="margin-top:5px">Photos and records stay in this browser. Export a backup after important inspections.</div></div>`);
}
function createView(){return shell('New property',`<form id="property-form" class="stack"><div class="field"><label>Property name</label><input name="name" required placeholder="e.g. Baner 2BHK"></div><div class="field"><label>Full address</label><textarea name="address" required placeholder="Building, flat, street, city"></textarea></div><div class="grid2"><div class="field"><label>Tenancy type</label><select name="tenancyType"><option>Rental apartment</option><option>PG / paying guest</option><option>Shared apartment</option><option>Independent house</option><option>Other</option></select></div><div class="field"><label>Furnishing</label><select name="furnishing"><option>Unspecified</option><option>Unfurnished</option><option>Semi-furnished</option><option>Furnished</option></select></div></div><div class="grid2"><div class="field"><label>Tenant name</label><input name="tenant" placeholder="Tenant name"></div><div class="field"><label>Owner / landlord</label><input name="landlord" placeholder="Owner name"></div></div><div class="field"><label>Move-in date</label><input type="date" name="moveInDate" value="${today()}"></div><button class="btn primary block" type="submit">Create inspection</button></form>`,true);}
function propertyView(p,mode='movein'){
  const c=completion(p,mode),meta=p.metaByMode[mode];
  const rooms=p.rooms.map(r=>{let rd=0;r.items.forEach(i=>{if(hasEntry(i[mode]))rd++;});return `<article class="card property-card" data-room="${r.id}" data-mode="${mode}"><div class="row between"><div><div class="property-title">${esc(r.name)}</div><div class="muted tiny">${rd}/${r.items.length} documented</div></div><span>›</span></div><div class="progress" style="margin-top:12px"><span style="width:${Math.round(rd/r.items.length*100)}%"></span></div></article>`;}).join('');
  return shell(p.name,`<div class="tabs no-print"><button class="tab ${mode==='movein'?'active':''}" data-mode-tab="movein">Move-in</button><button class="tab ${mode==='moveout'?'active':''}" data-mode-tab="moveout">Move-out</button></div><div class="card" style="margin-top:12px"><div class="row between"><div><b>${modeLabel(mode)} inspection</b><div class="muted tiny">${mode==='movein'?fmt(p.moveInDate):(p.moveOutDate?fmt(p.moveOutDate):'Date not set')} · ${esc(p.tenancyType)} · ${esc(p.furnishing)}</div></div><span class="badge ${c.pct===100?'ok':''}">${c.pct}%</span></div><div class="progress" style="margin-top:12px"><span style="width:${c.pct}%"></span></div></div><div class="section-title"><h2>Rooms</h2><button class="btn small" data-action="add-room">+ Add</button></div>${rooms}<div class="section-title"><h2>${modeLabel(mode)} property evidence</h2></div><div class="card stack"><div class="grid3"><div class="field"><label>Electricity meter</label><input data-meta="electricity" value="${esc(meta.meters.electricity)}" placeholder="Reading"></div><div class="field"><label>Water meter</label><input data-meta="water" value="${esc(meta.meters.water)}" placeholder="Reading"></div><div class="field"><label>Gas meter</label><input data-meta="gas" value="${esc(meta.meters.gas)}" placeholder="Reading / N/A"></div></div><div class="field"><label>Furniture / appliance inventory</label><textarea data-meta="inventoryNotes" placeholder="Items present and their condition">${esc(meta.inventoryNotes)}</textarea></div><div class="field"><label>Keys / access cards</label><textarea data-meta="keys" placeholder="Keys, access cards, remotes">${esc(meta.keys)}</textarea></div>${mode==='moveout'?`<div class="field"><label>Move-out date</label><input type="date" data-property-meta="moveOutDate" value="${esc(p.moveOutDate||today())}"></div>`:''}</div><div class="card stack no-print"><button class="btn primary block" data-action="report" data-mode="${mode}">Preview ${modeLabel(mode)} report</button><button class="btn block" data-action="compare">Compare move-in vs move-out</button><button class="btn block" data-action="share-summary" data-mode="${mode}">Share summary</button><button class="btn block" data-action="export-one">Export property backup</button><button class="btn danger block" data-action="delete-property">Delete property</button></div>`,true);
}
function roomView(p,room,mode){
  const items=room.items.map((i,idx)=>{const e=i[mode]||newEntry();return `<article class="card checklist-item" data-item="${i.id}"><div class="check-head"><div><div class="check-title">${idx+1}. ${esc(i.label)}</div><div class="check-meta">${e.photos?.length||0} photo${(e.photos?.length||0)===1?'':'s'}${e.condition?' · '+esc(e.condition):''}</div></div><span class="badge ${hasEntry(e)?'ok':''}">${hasEntry(e)?'Saved':'Empty'}</span></div><div class="photo-grid">${(e.photos||[]).map((ph,n)=>`<div class="photo"><img src="${photoSrc(ph)}" alt="Evidence photo"><button data-remove-photo="${n}" aria-label="Remove photo">×</button></div>`).join('')}<label class="photo-add"><input hidden type="file" accept="image/*" capture="environment" data-photo-input>+ Photo</label></div><div class="field"><label>Condition</label><select data-entry="condition"><option value="">Not set</option>${CONDITIONS.map(v=>`<option value="${v}" ${e.condition===v?'selected':''}>${v}</option>`).join('')}</select></div><div class="field"><label>Note</label><textarea data-entry="note" placeholder="Describe marks, cracks, stains, missing items…">${esc(e.note||'')}</textarea></div></article>`;}).join('');
  return shell(room.name,`<div class="row between" style="margin-bottom:12px"><span class="badge">${modeLabel(mode)}</span><span class="muted tiny">Capture a wide view plus close-ups of defects</span></div>${items}`,true);
}
function reportPhotos(e){return (e.photos||[]).map((ph,n)=>{const ts=photoTime(ph);return `<figure style="margin:0"><div class="photo"><img src="${photoSrc(ph)}" alt="Evidence photo ${n+1}"></div><figcaption class="tiny muted" style="margin-top:4px">Photo ${n+1}${ts?' · '+new Date(ts).toLocaleString():''}</figcaption></figure>`;}).join('');}
function reportView(p,mode){
  const meta=p.metaByMode[mode],c=completion(p,mode);
  const roomBlocks=p.rooms.map(r=>{const rows=r.items.map(i=>{const e=i[mode]||newEntry();if(!hasEntry(e))return '';return `<div class="card"><div class="row between"><h3>${esc(i.label)}</h3><span class="badge ${e.condition==='Good'?'ok':e.condition==='Needs repair'||e.condition==='Damaged'?'warn':''}">${esc(e.condition||'Not recorded')}</span></div>${e.note?`<p>${esc(e.note)}</p>`:''}${e.photos?.length?`<div class="photo-grid">${reportPhotos(e)}</div>`:''}</div>`;}).join('');return rows?`<section><div class="section-title"><h2>${esc(r.name)}</h2></div>${rows}</section>`:'';}).join('');
  return shell('Evidence report',`<section class="report-head"><div class="report-logo">FlatStamp</div><div class="eyebrow">${modeLabel(mode)} condition report</div><h1 style="margin:0 0 6px">${esc(p.name)}</h1><div class="report-id">${reportId(p,mode)}</div></section><div class="card"><div class="kv"><span>Address</span><b>${esc(p.address||'—')}</b></div><div class="kv"><span>Tenant</span><b>${esc(p.tenant||'—')}</b></div><div class="kv"><span>Owner / landlord</span><b>${esc(p.landlord||'—')}</b></div><div class="kv"><span>Tenancy / furnishing</span><b>${esc(p.tenancyType)} · ${esc(p.furnishing)}</b></div><div class="kv"><span>Inspection date</span><b>${mode==='movein'?fmt(p.moveInDate):fmt(p.moveOutDate||today())}</b></div><div class="kv"><span>Documented checks</span><b>${c.done}/${c.total}</b></div></div><div class="card"><h3>Property evidence</h3><div class="kv"><span>Electricity</span><b>${esc(meta.meters.electricity||'—')}</b></div><div class="kv"><span>Water</span><b>${esc(meta.meters.water||'—')}</b></div><div class="kv"><span>Gas</span><b>${esc(meta.meters.gas||'—')}</b></div><div class="kv"><span>Inventory</span><b>${esc(meta.inventoryNotes||'—')}</b></div><div class="kv"><span>Keys / access</span><b>${esc(meta.keys||'—')}</b></div></div>${roomBlocks}<div class="notice">FlatStamp organizes locally stored condition records. It does not independently prove authenticity or provide legal advice. Keep your exported report and share it promptly through an independent channel.</div><div class="bottom-actions no-print"><div class="grid2"><button class="btn primary block" data-action="print">Save / Share PDF</button><button class="btn block" data-action="share-summary" data-mode="${mode}">Share summary</button></div></div>`,true);
}
function compareView(p){
  const stats=changedItems(p),mi=completion(p,'movein'),mo=completion(p,'moveout');
  const blocks=p.rooms.map(r=>{const rows=r.items.filter(i=>hasEntry(i.movein)||hasEntry(i.moveout)).map(i=>`<div class="compare-row"><div><b>${esc(i.label)}</b></div><div class="compare-cell movein"><span class="badge">${esc(i.movein?.condition||'Not recorded')}</span>${i.movein?.note?`<div class="compare-note">${esc(i.movein.note)}</div>`:''}${i.movein?.photos?.length?`<div class="compare-photos">${i.movein.photos.slice(0,2).map(ph=>`<div class="photo"><img src="${photoSrc(ph)}" alt="Move-in evidence"></div>`).join('')}</div>`:''}</div><div class="compare-cell moveout"><span class="badge ${CONDITION_SCORE[i.moveout?.condition||'']>CONDITION_SCORE[i.movein?.condition||'']?'warn':''}">${esc(i.moveout?.condition||'Not recorded')}</span>${i.moveout?.note?`<div class="compare-note">${esc(i.moveout.note)}</div>`:''}${i.moveout?.photos?.length?`<div class="compare-photos">${i.moveout.photos.slice(0,2).map(ph=>`<div class="photo"><img src="${photoSrc(ph)}" alt="Move-out evidence"></div>`).join('')}</div>`:''}</div></div>`).join('');return rows?`<section><div class="section-title"><h2>${esc(r.name)}</h2></div><div class="card"><div class="compare-row compare-head"><div>Checklist item</div><div>Move-in</div><div>Move-out</div></div>${rows}</div></section>`:'';}).join('');
  return shell('Comparison report',`<section class="report-head"><div class="report-logo">FlatStamp</div><div class="eyebrow">Move-in vs move-out</div><h1 style="margin:0 0 6px">${esc(p.name)}</h1><div class="report-id">${reportId(p,'compare')}</div></section><div class="grid3"><div class="summary-stat"><span class="tiny muted">Changed records</span><b>${stats.changed}</b></div><div class="summary-stat"><span class="tiny muted">Potentially worse</span><b>${stats.worse}</b></div><div class="summary-stat"><span class="tiny muted">Move-out complete</span><b>${mo.pct}%</b></div></div><div class="card"><div class="kv"><span>Move-in</span><b>${fmt(p.moveInDate)} · ${mi.done}/${mi.total}</b></div><div class="kv"><span>Move-out</span><b>${fmt(p.moveOutDate||'')} · ${mo.done}/${mo.total}</b></div><div class="kv"><span>Address</span><b>${esc(p.address||'—')}</b></div></div>${blocks}<div class="notice">A condition change is a comparison aid, not a legal conclusion. Review photos and notes alongside the condition labels.</div><div class="bottom-actions no-print"><div class="grid2"><button class="btn primary block" data-action="print">Save / Share comparison PDF</button><button class="btn block" data-action="share-summary" data-mode="compare">Share comparison summary</button></div></div>`,true);
}
function settingsView(){const standalone=window.matchMedia?.('(display-mode: standalone)').matches||navigator.standalone===true;return shell('Settings',`<div class="card stack"><div><h3>Install FlatStamp</h3><p class="muted">${standalone?'FlatStamp is already running as an installed app.':'Keep FlatStamp on your home screen for faster access and offline use.'}</p></div>${standalone?'':`<div><b>iPhone / iPad</b><ol class="install-steps"><li>Open this page in Safari.</li><li>Tap Share.</li><li>Choose “Add to Home Screen”.</li></ol></div><div class="divider"></div><div><b>Android / Chrome</b><ol class="install-steps"><li>Open the browser menu.</li><li>Choose “Install app” or “Add to Home screen”.</li></ol></div>`}</div><div class="card stack"><div><h3>Backup & restore</h3><p class="muted">Records live in this browser. Export backups after important inspections.</p></div><button class="btn block" data-action="export-all">Export all data</button><label class="btn block">Import backup<input hidden type="file" accept="application/json" id="import-file"></label><button class="btn soft block" data-action="open-demo">Open demo property</button></div><div class="card stack"><div><h3>Privacy</h3><p class="muted">No account, analytics, advertising, or FlatStamp backend is used in this MVP.</p></div><a class="btn block" href="privacy.html">Privacy policy</a></div>`,true);}

async function render(){
  if(route.view==='home'){await refresh();app.innerHTML=homeView();return;}
  if(route.view==='create'){app.innerHTML=createView();return;}
  if(route.view==='settings'){app.innerHTML=settingsView();return;}
  const p=properties.find(x=>x.id===route.propertyId)||editing;
  if(!p){route={view:'home'};return render();}
  if(route.view==='property')app.innerHTML=propertyView(p,route.mode||'movein');
  if(route.view==='room'){const room=p.rooms.find(r=>r.id===route.roomId);if(!room)return nav({view:'property',propertyId:p.id,mode:route.mode});app.innerHTML=roomView(p,room,route.mode);}
  if(route.view==='report')app.innerHTML=reportView(p,route.mode);
  if(route.view==='compare')app.innerHTML=compareView(p);
}
function nav(next){route=next;render();window.scrollTo({top:0,behavior:'instant'});}
function back(){if(route.view==='create'||route.view==='settings')return nav({view:'home'});if(route.view==='room'||route.view==='report'||route.view==='compare')return nav({view:'property',propertyId:route.propertyId,mode:route.mode||'movein'});if(route.view==='property')return nav({view:'home'});return nav({view:'home'});}

async function compressImage(file){return new Promise((resolve,reject)=>{const fr=new FileReader();fr.onerror=()=>reject(fr.error);fr.onload=()=>{const img=new Image();img.onload=()=>{const max=1600;let w=img.width,h=img.height;if(Math.max(w,h)>max){const s=max/Math.max(w,h);w=Math.round(w*s);h=Math.round(h*s);}const c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d').drawImage(img,0,0,w,h);resolve(c.toDataURL('image/jpeg',.78));};img.onerror=reject;img.src=fr.result;};fr.readAsDataURL(file);});}
async function currentProp(){if(editing)return normalizeProperty(editing);const p=properties.find(x=>x.id===route.propertyId);editing=p;return p;}
async function persist(p,msg){normalizeProperty(p);await saveProp(p);editing=p;await refresh();editing=properties.find(x=>x.id===p.id)||p;if(msg)toast(msg);}
function download(name,data,type='application/json'){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([data],{type}));a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},1000);}
let pendingPdf=null;
function pdfName(s){return String(s||'report').replace(/[^a-z0-9]+/gi,'-').replace(/^-|-$/g,'').toLowerCase()||'report';}
function pdfText(s){return String(s==null?'':s).replace(/[–—]/g,'-').replace(/·/g,' | ').replace(/[“”]/g,'"').replace(/[’]/g,"'").replace(/[^\x20-\x7E\n]/g,'?');}
async function imageData(src){
  if(!src)return '';
  if(src.startsWith('data:'))return src;
  const res=await fetch(src);if(!res.ok)throw new Error('Image unavailable');
  const blob=await res.blob();
  return await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(blob);});
}
async function createFlatStampPdf(p,mode){
  const JsPDF=window.jspdf?.jsPDF;if(!JsPDF)throw new Error('PDF engine unavailable');
  const doc=new JsPDF({unit:'mm',format:'a4',compress:true});
  const M=15,W=180,BOTTOM=282;let y=15;
  const ensure=h=>{if(y+h>BOTTOM){doc.addPage();y=15;doc.setFont('helvetica','bold');doc.setFontSize(9);doc.setTextColor(15,118,110);doc.text('FlatStamp',M,y);y+=9;}};
  const text=(value,size=10,style='normal',color=[16,32,30],gap=2,maxW=W)=>{
    const v=pdfText(value);if(!v)return;doc.setFont('helvetica',style);doc.setFontSize(size);doc.setTextColor(...color);
    const lines=doc.splitTextToSize(v,maxW);const h=lines.length*(size*.42+1.1);ensure(h+gap);doc.text(lines,M,y);y+=h+gap;
  };
  const section=value=>{ensure(14);y+=3;doc.setDrawColor(220,229,227);doc.line(M,y+6,M+W,y+6);doc.setFont('helvetica','bold');doc.setFontSize(13);doc.setTextColor(15,118,110);doc.text(pdfText(value),M,y+4);y+=12;};
  const kv=(label,value)=>{ensure(14);doc.setFont('helvetica','bold');doc.setFontSize(7);doc.setTextColor(102,117,114);doc.text(pdfText(label).toUpperCase(),M,y);y+=4;text(value||'-',9,'normal',[16,32,30],3);};
  const photos=async(arr,prefix='Photo')=>{
    const list=(arr||[]).filter(Boolean);if(!list.length)return;
    for(let i=0;i<list.length;i+=3){
      ensure(47);const row=list.slice(i,i+3),cw=56,g=6;
      for(let j=0;j<row.length;j++){
        try{
          const data=await imageData(photoSrc(row[j]));const x=M+j*(cw+g);
          doc.setFillColor(244,247,246);doc.rect(x,y,cw,35,'F');
          const fmt=data.startsWith('data:image/png')?'PNG':'JPEG';
          doc.addImage(data,fmt,x,y,cw,35,undefined,'FAST');
          doc.setFont('helvetica','normal');doc.setFontSize(6.5);doc.setTextColor(102,117,114);
          doc.text(pdfText(prefix+' '+(i+j+1)),x,y+39);
        }catch{}
      }
      y+=44;
    }
  };

  doc.setFont('helvetica','bold');doc.setFontSize(18);doc.setTextColor(15,118,110);doc.text('FlatStamp',M,y);y+=8;
  text(mode==='compare'?'MOVE-IN VS MOVE-OUT COMPARISON':modeLabel(mode).toUpperCase()+' CONDITION REPORT',8,'bold',[102,117,114],4);
  text(p.name,20,'bold',[16,32,30],2);
  text(reportId(p,mode),7,'normal',[102,117,114],6);
  section('Property');
  kv('Address',p.address);kv('Tenant',p.tenant);kv('Owner / landlord',p.landlord);kv('Tenancy / furnishing',(p.tenancyType||'-')+' | '+(p.furnishing||'-'));

  if(mode==='compare'){
    const s=changedItems(p),mi=completion(p,'movein'),mo=completion(p,'moveout');
    kv('Move-in',fmt(p.moveInDate)+' | '+mi.done+'/'+mi.total+' checks');
    kv('Move-out',fmt(p.moveOutDate||'')+' | '+mo.done+'/'+mo.total+' checks');
    kv('Summary',s.changed+' changed records | '+s.worse+' potentially worse');
    section('Meter readings');
    const a=p.metaByMode.movein,b=p.metaByMode.moveout;
    kv('Electricity',(a.meters.electricity||'-')+' -> '+(b.meters.electricity||'-'));
    kv('Water',(a.meters.water||'-')+' -> '+(b.meters.water||'-'));
    kv('Gas',(a.meters.gas||'-')+' -> '+(b.meters.gas||'-'));
    for(const room of p.rooms){
      const items=room.items.filter(i=>hasEntry(i.movein)||hasEntry(i.moveout));if(!items.length)continue;
      section(room.name);
      for(const item of items){
        text(item.label,12,'bold',[16,32,30],2);
        text('MOVE-IN | '+(item.movein.condition||'Not recorded'),8,'bold',[15,118,110],1);
        if(item.movein.note)text(item.movein.note,9,'normal',[16,32,30],2);
        await photos(item.movein.photos,'Move-in photo');
        text('MOVE-OUT | '+(item.moveout.condition||'Not recorded'),8,'bold',[161,92,0],1);
        if(item.moveout.note)text(item.moveout.note,9,'normal',[16,32,30],2);
        await photos(item.moveout.photos,'Move-out photo');y+=2;
      }
    }
    section('Important');text('A condition change is a comparison aid, not a legal conclusion. Review photos and notes alongside the condition labels.',8,'normal',[66,81,77],2);
  }else{
    const meta=p.metaByMode[mode],c=completion(p,mode);
    kv('Inspection date',mode==='movein'?fmt(p.moveInDate):fmt(p.moveOutDate||today()));
    kv('Documented checks',c.done+'/'+c.total);
    section('Property evidence');
    kv('Electricity meter',meta.meters.electricity);kv('Water meter',meta.meters.water);kv('Gas meter',meta.meters.gas);
    kv('Furniture / appliance inventory',meta.inventoryNotes);kv('Keys / access cards',meta.keys);
    for(const room of p.rooms){
      const items=room.items.filter(i=>hasEntry(i[mode]));if(!items.length)continue;
      section(room.name);
      for(const item of items){
        const e=item[mode];text(item.label,12,'bold',[16,32,30],1);text(e.condition||'Not recorded',8,'bold',e.condition==='Good'?[21,115,71]:[161,92,0],1);
        if(e.note)text(e.note,9,'normal',[16,32,30],2);await photos(e.photos,'Photo');y+=2;
      }
    }
    section('Important');text('FlatStamp organizes locally stored condition records. It does not independently prove authenticity, provide legal advice, or guarantee the outcome of a deposit or tenancy dispute.',8,'normal',[66,81,77],2);
  }
  const filename='flatstamp-'+pdfName(p.name)+'-'+(mode==='compare'?'comparison':mode)+'.pdf';
  return {blob:doc.output('blob'),filename};
}
function closePdfSheet(){
  document.getElementById('flatstamp-pdf-sheet')?.remove();
  if(pendingPdf?.url)URL.revokeObjectURL(pendingPdf.url);
  pendingPdf=null;
}
function showPdfSheet(blob,filename){
  closePdfSheet();const url=URL.createObjectURL(blob);let file;
  try{file=new File([blob],filename,{type:'application/pdf'});}catch{file=blob;}
  pendingPdf={blob,file,url,filename};
  const box=document.createElement('div');box.id='flatstamp-pdf-sheet';
  box.style.cssText='position:fixed;z-index:300;inset:0;background:rgba(16,32,30,.48);display:flex;align-items:flex-end;justify-content:center;padding:18px;padding-bottom:calc(18px + env(safe-area-inset-bottom));';
  box.innerHTML='<div style="width:min(100%,560px);background:#fff;border-radius:22px;padding:18px;display:grid;gap:10px;box-shadow:0 24px 70px rgba(0,0,0,.28)"><div class="eyebrow">PDF ready</div><h3 style="margin:0;overflow-wrap:anywhere">'+esc(filename)+'</h3><p class="muted" style="margin:0 0 4px;line-height:1.45">Created on this device. On iPhone/iPad, tap Share / Save to Files.</p><button class="btn primary block" id="flatstamp-pdf-share">Share / Save to Files</button><a class="btn block" id="flatstamp-pdf-open" target="_blank" rel="noopener">Open PDF</a><a class="btn block" id="flatstamp-pdf-download" download>Download PDF</a><button class="btn block" id="flatstamp-pdf-close">Close</button></div>';
  document.body.appendChild(box);
  box.querySelector('#flatstamp-pdf-open').href=url;
  const dl=box.querySelector('#flatstamp-pdf-download');dl.href=url;dl.download=filename;
  box.querySelector('#flatstamp-pdf-close').onclick=closePdfSheet;
  box.querySelector('#flatstamp-pdf-share').onclick=async()=>{
    try{
      if(navigator.share&&(!navigator.canShare||navigator.canShare({files:[file]}))){await navigator.share({files:[file],title:'FlatStamp PDF'});return;}
      window.open(url,'_blank','noopener');
    }catch(err){if(err?.name!=='AbortError')toast('Could not open share sheet. Try Open PDF.');}
  };
}
async function savePdfReport(){
  const p=await currentProp();if(!p)return;const mode=route.view==='compare'?'compare':(route.mode||'movein');
  toast('Creating PDF...');
  try{const out=await createFlatStampPdf(p,mode);showPdfSheet(out.blob,out.filename);}catch(err){console.error(err);toast('Could not create PDF');}
}
function summaryText(p,mode){if(mode==='compare'){const s=changedItems(p);return `FlatStamp comparison — ${p.name}\n${p.address||''}\nMove-in: ${fmt(p.moveInDate)} · Move-out: ${fmt(p.moveOutDate||'')}\nChanged records: ${s.changed}; potentially worse: ${s.worse}.\nGenerated with FlatStamp.`;}const c=completion(p,mode);return `FlatStamp ${modeLabel(mode)} report — ${p.name}\n${p.address||''}\nInspection date: ${mode==='movein'?fmt(p.moveInDate):fmt(p.moveOutDate||today())}\nDocumented checks: ${c.done}/${c.total}.\nGenerated with FlatStamp.`;}
async function shareSummary(p,mode){const text=summaryText(p,mode),title=`FlatStamp — ${p.name}`;try{if(navigator.share){await navigator.share({title,text});return;}if(navigator.clipboard){await navigator.clipboard.writeText(text);toast('Summary copied to clipboard');return;}}catch(err){if(err?.name==='AbortError')return;}toast('Sharing is not available in this browser');}
async function openDemo(){let demo=properties.find(p=>p.id===DEMO_ID);if(!demo){demo=demoProperty();await saveProp(demo);await refresh();}editing=properties.find(p=>p.id===DEMO_ID)||demo;nav({view:'property',propertyId:DEMO_ID,mode:'movein'});}

app.addEventListener('submit',async e=>{if(e.target.id==='property-form'){e.preventDefault();const p=newProperty(Object.fromEntries(new FormData(e.target)));await persist(p);nav({view:'property',propertyId:p.id,mode:'movein'});}});
app.addEventListener('click',async e=>{
  const a=e.target.closest('[data-action]');
  if(a){const act=a.dataset.action;if(act==='back')return back();if(act==='settings')return nav({view:'settings'});if(act==='new-property')return nav({view:'create'});if(act==='open-demo')return openDemo();if(act==='print')return savePdfReport();
    const p=await currentProp();if(!p)return;
    if(act==='add-room'){const name=prompt('Room name','Bedroom 2');if(name){p.rooms.push(makeRoom(name.trim()||'Room'));await persist(p,'Room added');render();}return;}
    if(act==='report')return nav({view:'report',propertyId:p.id,mode:a.dataset.mode});
    if(act==='compare')return nav({view:'compare',propertyId:p.id,mode:route.mode||'movein'});
    if(act==='share-summary')return shareSummary(p,a.dataset.mode||route.mode||'movein');
    if(act==='export-one'){download(`flatstamp-${p.name.replace(/[^a-z0-9]+/gi,'-').toLowerCase()}.json`,JSON.stringify({app:'FlatStamp',version:2,exportedAt:new Date().toISOString(),properties:[p]},null,2));return;}
    if(act==='delete-property'){if(confirm(`Delete ${p.demo?'this demo property':'this property'} and all locally stored photos?`)){await delProp(p.id);editing=null;toast('Property deleted');nav({view:'home'});}return;}
    if(act==='export-all'){await refresh();download(`flatstamp-backup-${today()}.json`,JSON.stringify({app:'FlatStamp',version:2,exportedAt:new Date().toISOString(),properties},null,2));return;}
  }
  const open=e.target.closest('[data-open]');if(open){editing=properties.find(p=>p.id===open.dataset.open);return nav({view:'property',propertyId:open.dataset.open,mode:'movein'});}
  const room=e.target.closest('[data-room]');if(room)return nav({view:'room',propertyId:route.propertyId,roomId:room.dataset.room,mode:room.dataset.mode});
  const tab=e.target.closest('[data-mode-tab]');if(tab)return nav({view:'property',propertyId:route.propertyId,mode:tab.dataset.modeTab});
  const remove=e.target.closest('[data-remove-photo]');if(remove){const card=remove.closest('[data-item]'),p=await currentProp(),r=p.rooms.find(x=>x.id===route.roomId),i=r.items.find(x=>x.id===card.dataset.item);i[route.mode].photos.splice(Number(remove.dataset.removePhoto),1);await persist(p,'Photo removed');render();}
});
app.addEventListener('change',async e=>{
  if(e.target.id==='import-file'&&e.target.files[0]){try{const data=JSON.parse(await e.target.files[0].text());if(!Array.isArray(data.properties))throw new Error('Invalid backup');for(const raw of data.properties)await saveProp(normalizeProperty(raw));editing=null;await refresh();toast('Backup imported');nav({view:'home'});}catch{toast('Could not import backup');}return;}
  if(e.target.matches('[data-meta]')){const p=await currentProp(),m=p.metaByMode[route.mode],k=e.target.dataset.meta;if(k==='inventoryNotes'||k==='keys')m[k]=e.target.value;else m.meters[k]=e.target.value;await persist(p);return;}
  if(e.target.matches('[data-property-meta]')){const p=await currentProp();p[e.target.dataset.propertyMeta]=e.target.value;await persist(p);return;}
  if(e.target.matches('[data-entry]')){const card=e.target.closest('[data-item]'),p=await currentProp(),r=p.rooms.find(x=>x.id===route.roomId),i=r.items.find(x=>x.id===card.dataset.item);i[route.mode][e.target.dataset.entry]=e.target.value;await persist(p);return;}
  if(e.target.matches('[data-photo-input]')&&e.target.files?.length){const card=e.target.closest('[data-item]'),p=await currentProp(),r=p.rooms.find(x=>x.id===route.roomId),i=r.items.find(x=>x.id===card.dataset.item);toast('Processing photo…');for(const f of Array.from(e.target.files).slice(0,5))i[route.mode].photos.push({src:await compressImage(f),addedAt:new Date().toISOString()});await persist(p,'Photo saved');render();}
});
app.addEventListener('input',e=>{if(e.target.matches('textarea[data-entry],input[data-meta],textarea[data-meta],input[data-property-meta]')){clearTimeout(e.target._t);e.target._t=setTimeout(()=>e.target.dispatchEvent(new Event('change',{bubbles:true})),500);}});

(async()=>{if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});await refresh();render();})();
})();
