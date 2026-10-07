(() => {
'use strict';
const DB_NAME='rentproof-db', STORE='properties', DB_VERSION=1;
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

function uid(){return (crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+Math.random().toString(36).slice(2));}
function esc(s=''){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function fmt(d){ if(!d)return '—'; try{return new Date(d+'T00:00:00').toLocaleDateString(undefined,{day:'numeric',month:'short',year:'numeric'});}catch{return d;} }
function modeLabel(m){return m==='moveout'?'Move-out':'Move-in';}
function today(){return new Date().toISOString().slice(0,10);}

function openDB(){return new Promise((resolve,reject)=>{const r=indexedDB.open(DB_NAME,DB_VERSION);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains(STORE))r.result.createObjectStore(STORE,{keyPath:'id'});};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
async function allProps(){const db=await openDB();return new Promise((res,rej)=>{const r=db.transaction(STORE).objectStore(STORE).getAll();r.onsuccess=()=>res(r.result||[]);r.onerror=()=>rej(r.error);});}
async function saveProp(p){p.updatedAt=new Date().toISOString();const db=await openDB();return new Promise((res,rej)=>{const r=db.transaction(STORE,'readwrite').objectStore(STORE).put(p);r.onsuccess=()=>res(p);r.onerror=()=>rej(r.error);});}
async function delProp(id){const db=await openDB();return new Promise((res,rej)=>{const r=db.transaction(STORE,'readwrite').objectStore(STORE).delete(id);r.onsuccess=()=>res();r.onerror=()=>rej(r.error);});}
async function refresh(){properties=(await allProps()).sort((a,b)=>(b.updatedAt||'').localeCompare(a.updatedAt||''));}

function shell(title,body,back=false){return `<div class="app-shell"><header class="topbar"><div class="row">${back?'<button class="icon-btn" data-action="back" aria-label="Back">‹</button>':''}<div class="brand">${esc(title||'RentProof')}</div></div><button class="icon-btn no-print" data-action="settings" aria-label="Settings">⋯</button></header><main class="page">${body}</main></div>`;}
function toast(msg){const n=document.createElement('div');n.className='toast';n.textContent=msg;document.body.appendChild(n);setTimeout(()=>n.remove(),2400);}

function completion(p,mode){let total=0,done=0;(p.rooms||[]).forEach(r=>(r.items||[]).forEach(i=>{total++; const e=i[mode]; if(e && (e.photos?.length||e.note||e.condition))done++;}));return {total,done,pct:total?Math.round(done/total*100):0};}
function newEntry(){return {condition:'',note:'',photos:[]};}
function makeRoom(name){return {id:uid(),name,items:(ROOM_TEMPLATES[name]||['General condition','Existing damage']).map(x=>({id:uid(),label:x,movein:newEntry(),moveout:newEntry()}))};}
function newProperty(form){return {id:uid(),name:form.name||'My rental',address:form.address||'',landlord:form.landlord||'',tenant:form.tenant||'',moveInDate:form.moveInDate||today(),moveOutDate:'',rooms:DEFAULT_ROOMS.map(makeRoom),meters:{electricity:'',water:'',gas:''},inventoryNotes:'',keys:'',signatures:{tenant:'',owner:''},createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};}

function demoProperty(){
 const p=newProperty({
   name:'Demo — Skyline Residency 2BHK',
   address:'Flat 804, C-Wing, Skyline Residency, Wakad Road, Pune, Maharashtra 411057 (fictional demo address)',
   tenant:'Arjun Mehta (Demo)',
   landlord:'Neha Kulkarni (Demo)',
   moveInDate:'2026-01-12'
 });
 p.id='demo-property-v1';
 p.demo=true;
 p.moveOutDate='2026-09-30';
 p.meters={electricity:'14,102.7 kWh',water:'128.6 kL',gas:'167.4 SCM'};
 p.inventoryNotes='1 three-seat sofa; 1 coffee table; dining table with 4 chairs; 2 double beds with mattresses; 3 split AC units; LG 260 L refrigerator; IFB 7 kg washing machine; 15 L water heater; 4 ceiling fans; modular kitchen hob and chimney.';
 p.keys='2 main-door keys; 1 mailbox key; 2 society RFID cards; 1 parking remote.';
 const bed2=makeRoom('Bedroom'); bed2.name='Bedroom 2';
 p.rooms.splice(2,0,bed2);
 p.rooms.push(makeRoom('Balcony'));

 p.rooms.forEach(r=>r.items.forEach(i=>{
   i.movein={condition:'Good',note:'Checked during move-in handover; no material defect noted unless stated below.',photos:[]};
   i.moveout={condition:'Good',note:'Condition broadly consistent with move-in record and normal residential use.',photos:[]};
 }));

 const set=(roomName,label,miCondition,miNote,moCondition,moNote)=>{
   const room=p.rooms.find(r=>r.name===roomName);
   const item=room?.items.find(i=>i.label===label);
   if(!item)return;
   item.movein={condition:miCondition,note:miNote,photos:[]};
   item.moveout={condition:moCondition,note:moNote,photos:[]};
 };
 set('Living room','All walls','Fair','Two small nail holes on the TV wall and a faint scuff near the balcony door, present before move-in.','Fair','Same nail holes visible. One additional light furniture scuff near the sofa area; no deep damage.');
 set('Living room','Floor','Good','Vitrified tiles intact. Minor hairline surface scratch near the main entrance.','Good','Tiles intact; original entrance scratch unchanged.');
 set('Living room','Windows','Good','Sliding windows open and lock correctly. Mosquito mesh intact.','Good','Windows and mesh functional; no cracked glass.');
 set('Living room','Furniture','Good','Sofa and coffee table clean; minor wear on left sofa arm noted at handover.','Fair','Normal upholstery wear. Existing mark on left arm remains; no tear.');
 set('Living room','Existing damage','Fair','Pre-existing paint chip approximately 2 cm wide behind the TV unit.','Fair','Original paint chip still present and unchanged.');

 set('Bedroom','All walls','Good','Walls freshly painted; no dampness seen.','Good','Light normal-use marks near switchboard; no dampness or major stains.');
 set('Bedroom','Wardrobe interior','Good','Shelves, hanging rod and drawer runners functional.','Good','Interior clean; drawer runners functional.');
 set('Bedroom','AC','Good','Daikin split AC powers on and cools normally; remote supplied.','Good','AC tested at handover; cooling and remote functional.');
 set('Bedroom','Existing damage','Fair','Small laminate chip on lower-right wardrobe shutter, documented at move-in.','Fair','Same laminate chip visible; no additional damage.');

 set('Bedroom 2','Windows','Good','Window latch and mesh functional.','Good','Latch functional; mesh has one small 1 cm snag near lower corner.');
 set('Bedroom 2','Switches & sockets','Good','All tested sockets operational.','Good','All tested sockets operational.');
 set('Bedroom 2','Existing damage','Fair','Hairline paint crack above window corner, approximately 12 cm long.','Fair','Hairline crack still visible and appears unchanged.');

 set('Kitchen','Sink & taps','Good','No visible leak during test; water pressure normal.','Good','No leak during handover test; drain clears normally.');
 set('Kitchen','Countertop','Fair','Granite has a small pre-existing edge chip beside the sink.','Fair','Original edge chip unchanged; no new cracks.');
 set('Kitchen','Cabinets interior','Good','Cabinet interiors clean and dry; hinges functional.','Good','Clean and dry; hinges functional.');
 set('Kitchen','Stove/hob','Good','Four-burner hob ignites correctly.','Good','All four burners tested and working.');
 set('Kitchen','Chimney/exhaust','Good','Chimney fan and light operational.','Good','Operational; filters show normal cooking residue.');
 set('Kitchen','Fridge/appliances','Good','LG refrigerator cools normally; trays and shelves present.','Good','Refrigerator cooling normally; trays and shelves returned.');
 set('Kitchen','Existing damage','Fair','One pre-existing chipped corner on lower cabinet laminate near sink.','Fair','Same cabinet chip visible; no additional breakage.');

 set('Bathroom','Walls/tiles','Good','Tiles intact; grout slightly discoloured near shower floor.','Fair','Tiles intact. Mild hard-water staining on lower shower tiles; no cracked tile.');
 set('Bathroom','Toilet','Good','Flush and inlet tested; no visible leak.','Good','Flush works and no visible leak during handover.');
 set('Bathroom','Water heater','Good','15 L geyser powers on and heats water.','Good','Geyser powers on and heats normally.');
 set('Bathroom','Drainage','Good','Floor drain clears after running shower for two minutes.','Good','Drain clears normally.');
 set('Bathroom','Existing damage','Fair','Small rust spot on bathroom door lower hinge, present at move-in.','Fair','Original hinge rust spot unchanged.');

 set('Balcony','Floor','Good','Anti-skid tiles intact and drain area clean.','Good','Tiles intact; minor dust only.');
 set('Balcony','Railing','Good','Railing secure with no visible loose sections.','Good','Railing secure.');
 set('Balcony','Drainage','Good','Drain clear after water test.','Good','Drain clear.');
 set('Balcony','Existing damage','Fair','Small paint flake on outer wall beside AC drain pipe.','Fair','Original paint flake still visible.');

 p.createdAt='2026-01-12T09:30:00.000Z';
 p.updatedAt='2026-09-30T16:45:00.000Z';
 return p;
}

async function ensureDemoProperty(){
 const existing=await allProps();
 if(existing.length===0 && !localStorage.getItem('rentproof-demo-seeded-v1')){
   await saveProp(demoProperty());
   localStorage.setItem('rentproof-demo-seeded-v1','1');
 }
}

function homeView(){
  const cards=properties.map(p=>{const c=completion(p,'movein');return `<article class="card property-card" data-open="${p.id}"><div class="row between"><div><div class="row" style="gap:7px"><div class="property-title">${esc(p.name)}</div>${p.demo?'<span class="badge">DEMO</span>':''}</div><div class="muted tiny">${esc(p.address||'No address')}</div></div><span class="badge ${c.pct===100?'ok':''}">${c.pct}% move-in</span></div><div class="progress" style="margin-top:13px"><span style="width:${c.pct}%"></span></div><div class="row between tiny muted" style="margin-top:10px"><span>${c.done}/${c.total} checks documented</span><span>${fmt(p.moveInDate)}</span></div></article>`;}).join('');
  return shell('RentProof',`<section class="hero"><h1>Rental evidence that stays with you.</h1><p>Document every room before and after your tenancy. Private, offline, and built for evidence—not property management.</p></section><button class="btn primary block" data-action="new-property">+ New property</button><div class="section-title"><h2>Your properties</h2><span class="badge">${properties.length}</span></div>${cards||'<div class="card empty"><div class="big">⌂</div><h3>No property yet</h3><p class="muted">Create your first rental and follow the guided inspection checklist.</p></div>'}<div class="notice" style="margin-top:20px">Photos and records stay in this browser. Export a backup after important inspections.</div>`);
}
function createView(){return shell('New property',`<form id="property-form" class="stack"><div class="field"><label>Property name</label><input name="name" required placeholder="e.g. Baner 2BHK"></div><div class="field"><label>Full address</label><textarea name="address" required placeholder="Building, flat, street, city"></textarea></div><div class="grid2"><div class="field"><label>Tenant name</label><input name="tenant" placeholder="Your name"></div><div class="field"><label>Owner / landlord</label><input name="landlord" placeholder="Owner name"></div></div><div class="field"><label>Move-in date</label><input type="date" name="moveInDate" value="${today()}"></div><button class="btn primary block" type="submit">Create inspection</button></form>`,true);}
function propertyView(p,mode='movein'){
  const c=completion(p,mode);
  const rooms=p.rooms.map(r=>{let rd=0;r.items.forEach(i=>{const e=i[mode];if(e&&(e.photos?.length||e.note||e.condition))rd++;});return `<article class="card property-card" data-room="${r.id}" data-mode="${mode}"><div class="row between"><div><div class="property-title">${esc(r.name)}</div><div class="muted tiny">${rd}/${r.items.length} documented</div></div><span>›</span></div><div class="progress" style="margin-top:12px"><span style="width:${Math.round(rd/r.items.length*100)}%"></span></div></article>`;}).join('');
  return shell(p.name,`<div class="tabs no-print"><button class="tab ${mode==='movein'?'active':''}" data-mode-tab="movein">Move-in</button><button class="tab ${mode==='moveout'?'active':''}" data-mode-tab="moveout">Move-out</button></div><div class="card" style="margin-top:12px"><div class="row between"><div><b>${modeLabel(mode)} inspection</b><div class="muted tiny">${mode==='movein'?fmt(p.moveInDate):(p.moveOutDate?fmt(p.moveOutDate):'Date not set')}</div></div><span class="badge ${c.pct===100?'ok':''}">${c.pct}%</span></div><div class="progress" style="margin-top:12px"><span style="width:${c.pct}%"></span></div></div><div class="section-title"><h2>Rooms</h2><button class="btn small" data-action="add-room" data-mode="${mode}">+ Add</button></div>${rooms}<div class="section-title"><h2>Property evidence</h2></div><div class="card stack"><div class="grid2"><div class="field"><label>Electricity meter</label><input data-meta="electricity" value="${esc(p.meters.electricity||'')}" placeholder="Reading"></div><div class="field"><label>Water meter</label><input data-meta="water" value="${esc(p.meters.water||'')}" placeholder="Reading"></div></div><div class="field"><label>Gas meter</label><input data-meta="gas" value="${esc(p.meters.gas||'')}" placeholder="Reading / N/A"></div><div class="field"><label>Furniture / appliance inventory</label><textarea data-meta="inventoryNotes" placeholder="e.g. 1 sofa, 2 beds, 3 ACs, fridge, washing machine">${esc(p.inventoryNotes||'')}</textarea></div><div class="field"><label>Keys / access cards</label><textarea data-meta="keys" placeholder="e.g. 2 main-door keys, 1 mailbox key, 2 society cards">${esc(p.keys||'')}</textarea></div>${mode==='moveout'?`<div class="field"><label>Move-out date</label><input type="date" data-meta="moveOutDate" value="${esc(p.moveOutDate||today())}"></div>`:''}</div><div class="card stack no-print"><button class="btn block" data-action="report" data-mode="${mode}">Preview / Save PDF report</button><button class="btn block" data-action="export-one">Export property backup</button><button class="btn danger block" data-action="delete-property">Delete property</button></div>`,true);
}
function roomView(p,room,mode){
 const items=room.items.map((i,idx)=>{const e=i[mode]||newEntry();return `<article class="card checklist-item" data-item="${i.id}"><div class="check-head"><div><div class="check-title">${idx+1}. ${esc(i.label)}</div><div class="check-meta">${e.photos?.length||0} photo${(e.photos?.length||0)===1?'':'s'}${e.condition?' · '+esc(e.condition):''}</div></div><span class="badge ${(e.photos?.length||e.note||e.condition)?'ok':''}">${(e.photos?.length||e.note||e.condition)?'Saved':'Empty'}</span></div><div class="photo-grid">${(e.photos||[]).map((ph,n)=>{const src=typeof ph==='string'?ph:ph.src;return `<div class="photo"><img src="${src}" alt="Evidence photo"><button data-remove-photo="${n}" aria-label="Remove photo">×</button></div>`;}).join('')}<label class="photo-add"><input hidden type="file" accept="image/*" capture="environment" data-photo-input>+ Photo</label></div><div class="field"><label>Condition</label><select data-entry="condition"><option value="">Not set</option>${['Good','Fair','Damaged','Needs repair','Not applicable'].map(v=>`<option ${e.condition===v?'selected':''}>${v}</option>`).join('')}</select></div><div class="field"><label>Note</label><textarea data-entry="note" placeholder="Describe marks, cracks, stains, missing items…">${esc(e.note||'')}</textarea></div></article>`;}).join('');
 return shell(room.name,`<div class="row between" style="margin-bottom:12px"><span class="badge">${modeLabel(mode)}</span><span class="muted tiny">Photograph wide + close-up views</span></div>${items}`,true);
}
function reportView(p,mode){
 const roomBlocks=p.rooms.map(r=>`<section><div class="section-title"><h2>${esc(r.name)}</h2></div>${r.items.map(i=>{const e=i[mode]||newEntry(); if(!(e.photos?.length||e.note||e.condition))return ''; return `<div class="card"><h3>${esc(i.label)}</h3><div class="muted tiny" style="margin-bottom:9px">Condition: ${esc(e.condition||'Not recorded')}</div>${e.note?`<p>${esc(e.note)}</p>`:''}<div class="photo-grid">${(e.photos||[]).map(ph=>{const src=typeof ph==='string'?ph:ph.src;const ts=typeof ph==='string'?'':ph.addedAt;return `<figure style="margin:0"><div class="photo"><img src="${src}" alt="Evidence photo"></div>${ts?`<figcaption class="tiny muted" style="margin-top:4px">Added ${new Date(ts).toLocaleString()}</figcaption>`:''}</figure>`;}).join('')}</div></div>`;}).join('')}</section>`).join('');
 const c=completion(p,mode);
 return shell('Evidence report',`<section class="hero"><h1>${esc(p.name)}</h1><p>${esc(modeLabel(mode))} evidence report · ${mode==='movein'?fmt(p.moveInDate):fmt(p.moveOutDate||today())}</p></section><div class="card"><div class="kv"><span>Address</span><b>${esc(p.address||'—')}</b></div><div class="kv"><span>Tenant</span><b>${esc(p.tenant||'—')}</b></div><div class="kv"><span>Owner</span><b>${esc(p.landlord||'—')}</b></div><div class="kv"><span>Documented checks</span><b>${c.done}/${c.total}</b></div><div class="kv"><span>Electricity meter</span><b>${esc(p.meters.electricity||'—')}</b></div><div class="kv"><span>Water meter</span><b>${esc(p.meters.water||'—')}</b></div><div class="kv"><span>Gas meter</span><b>${esc(p.meters.gas||'—')}</b></div><div class="kv"><span>Furniture / appliances</span><b>${esc(p.inventoryNotes||'—')}</b></div><div class="kv"><span>Keys / access</span><b>${esc(p.keys||'—')}</b></div></div>${roomBlocks}<div class="notice">Generated from locally stored RentProof records. Keep the exported PDF and send it to the other party promptly so the inspection date and contents are independently documented.</div><div class="bottom-actions no-print"><button class="btn primary block" data-action="print">Print / Save as PDF</button></div>`,true);
}
function settingsView(){return shell('Settings',`<div class="card stack"><div><h3>Local-first storage</h3><p class="muted">RentProof stores property records in this browser. No account or backend is used.</p></div><button class="btn block" data-action="export-all">Export all data</button><label class="btn block">Import backup<input hidden type="file" accept="application/json" id="import-file"></label><a class="btn block" href="privacy.html">Privacy policy</a></div><div class="notice">Backups contain inspection details and embedded photos. Store them somewhere you trust.</div>`,true);}

async function render(){
 if(route.view==='home'){await refresh();app.innerHTML=homeView();return;}
 if(route.view==='create'){app.innerHTML=createView();return;}
 if(route.view==='settings'){app.innerHTML=settingsView();return;}
 const p=properties.find(x=>x.id===route.propertyId)||editing;
 if(!p){route={view:'home'};return render();}
 if(route.view==='property')app.innerHTML=propertyView(p,route.mode||'movein');
 if(route.view==='room'){const room=p.rooms.find(r=>r.id===route.roomId);app.innerHTML=roomView(p,room,route.mode);}
 if(route.view==='report')app.innerHTML=reportView(p,route.mode);
}
function nav(next){route=next;render();window.scrollTo({top:0,behavior:'instant'});}
function back(){if(route.view==='create'||route.view==='settings')return nav({view:'home'});if(route.view==='room'||route.view==='report')return nav({view:'property',propertyId:route.propertyId,mode:route.mode});if(route.view==='property')return nav({view:'home'});nav({view:'home'});}

async function compressImage(file){return new Promise((resolve,reject)=>{const fr=new FileReader();fr.onerror=()=>reject(fr.error);fr.onload=()=>{const img=new Image();img.onload=()=>{const max=1600;let w=img.width,h=img.height;if(Math.max(w,h)>max){const s=max/Math.max(w,h);w=Math.round(w*s);h=Math.round(h*s);}const c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d').drawImage(img,0,0,w,h);resolve(c.toDataURL('image/jpeg',.78));};img.onerror=reject;img.src=fr.result;};fr.readAsDataURL(file);});}
async function currentProp(){if(editing)return editing;const p=properties.find(x=>x.id===route.propertyId);editing=p;return p;}
async function persist(p,msg){await saveProp(p);editing=p;await refresh();editing=properties.find(x=>x.id===p.id)||p;if(msg)toast(msg);}
function download(name,data,type='application/json'){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([data],{type}));a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},1000);}
function cleanBackup(p){return p;}

app.addEventListener('submit',async e=>{if(e.target.id==='property-form'){e.preventDefault();const f=Object.fromEntries(new FormData(e.target));const p=newProperty(f);await persist(p);nav({view:'property',propertyId:p.id,mode:'movein'});}});
app.addEventListener('click',async e=>{
 const a=e.target.closest('[data-action]');
 if(a){const act=a.dataset.action;if(act==='back')return back();if(act==='settings')return nav({view:'settings'});if(act==='new-property')return nav({view:'create'});if(act==='print')return window.print();
 const p=await currentProp();
 if(act==='add-room'){const name=prompt('Room name','Bedroom 2');if(name){p.rooms.push(makeRoom(name.trim()||'Room'));await persist(p,'Room added');render();}return;}
 if(act==='report')return nav({view:'report',propertyId:p.id,mode:a.dataset.mode});
 if(act==='export-one'){download(`rentproof-${p.name.replace(/[^a-z0-9]+/gi,'-').toLowerCase()}.json`,JSON.stringify({version:1,exportedAt:new Date().toISOString(),properties:[cleanBackup(p)]}));return;}
 if(act==='delete-property'){if(confirm('Delete this property and all locally stored photos?')){await delProp(p.id);editing=null;toast('Property deleted');nav({view:'home'});}return;}
 if(act==='export-all'){await refresh();download(`rentproof-backup-${today()}.json`,JSON.stringify({version:1,exportedAt:new Date().toISOString(),properties},null,2));return;}
 }
 const open=e.target.closest('[data-open]');if(open){editing=properties.find(p=>p.id===open.dataset.open);return nav({view:'property',propertyId:open.dataset.open,mode:'movein'});}
 const room=e.target.closest('[data-room]');if(room)return nav({view:'room',propertyId:route.propertyId,roomId:room.dataset.room,mode:room.dataset.mode});
 const tab=e.target.closest('[data-mode-tab]');if(tab)return nav({view:'property',propertyId:route.propertyId,mode:tab.dataset.modeTab});
 const remove=e.target.closest('[data-remove-photo]');if(remove){const card=remove.closest('[data-item]');const p=await currentProp();const r=p.rooms.find(x=>x.id===route.roomId);const i=r.items.find(x=>x.id===card.dataset.item);i[route.mode].photos.splice(Number(remove.dataset.removePhoto),1);await persist(p,'Photo removed');render();}
});
app.addEventListener('change',async e=>{
 if(e.target.id==='import-file'&&e.target.files[0]){try{const data=JSON.parse(await e.target.files[0].text());if(!Array.isArray(data.properties))throw new Error('Invalid backup');for(const p of data.properties)await saveProp(p);editing=null;await refresh();toast('Backup imported');nav({view:'home'});}catch(err){toast('Could not import backup');}return;}
 if(e.target.matches('[data-meta]')){const p=await currentProp();const k=e.target.dataset.meta;if(k==='keys'||k==='inventoryNotes'||k==='moveOutDate')p[k]=e.target.value;else p.meters[k]=e.target.value;await persist(p);return;}
 if(e.target.matches('[data-entry]')){const card=e.target.closest('[data-item]');const p=await currentProp();const r=p.rooms.find(x=>x.id===route.roomId);const i=r.items.find(x=>x.id===card.dataset.item);i[route.mode][e.target.dataset.entry]=e.target.value;await persist(p);return;}
 if(e.target.matches('[data-photo-input]')&&e.target.files?.length){const card=e.target.closest('[data-item]');const p=await currentProp();const r=p.rooms.find(x=>x.id===route.roomId);const i=r.items.find(x=>x.id===card.dataset.item);toast('Processing photo…');for(const f of Array.from(e.target.files).slice(0,5))i[route.mode].photos.push({src:await compressImage(f),addedAt:new Date().toISOString()});await persist(p,'Photo saved');render();}
});
app.addEventListener('input',e=>{if(e.target.matches('textarea[data-entry], input[data-meta], textarea[data-meta]')){clearTimeout(e.target._t);e.target._t=setTimeout(()=>e.target.dispatchEvent(new Event('change',{bubbles:true})),500);}});

(async()=>{if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});await ensureDemoProperty();await refresh();render();})();
})();
