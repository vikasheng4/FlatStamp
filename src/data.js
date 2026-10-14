export const DB_NAME='rentproof-db';
export const STORE='properties';
export const DB_VERSION=1;
export const SCHEMA_VERSION=3;
export const DEMO_ID='flatstamp-demo-v2';

export const ROOM_TEMPLATES={
  'Living room':['All walls','Ceiling','Floor','Windows','Doors & locks','Switches & sockets','Lights / fans','Furniture','Existing damage'],
  'Bedroom':['All walls','Ceiling','Floor','Windows','Door & lock','Wardrobe exterior','Wardrobe interior','AC','Switches & sockets','Existing damage'],
  'Kitchen':['Walls / tiles','Floor','Sink & taps','Countertop','Cabinets exterior','Cabinets interior','Stove / hob','Chimney / exhaust','Fridge / appliances','Existing damage'],
  'Bathroom':['Walls / tiles','Floor','Toilet','Sink & taps','Shower','Mirror','Water heater','Drainage','Door & lock','Existing damage'],
  'Balcony':['Floor','Walls','Railing','Drainage','Doors / windows','Existing damage']
};
export const DEFAULT_ROOMS=['Living room','Bedroom','Kitchen','Bathroom'];
export const CONDITIONS=['Good','Fair','Damaged','Needs repair','Not applicable'];
export const CONDITION_SCORE={'':0,'Not applicable':0,'Good':1,'Fair':2,'Damaged':3,'Needs repair':4};

export function uid(){
  return crypto.randomUUID?.()||Date.now().toString(36)+Math.random().toString(36).slice(2);
}
export function today(){return new Date().toISOString().slice(0,10);}
export function fmtDate(d){
  if(!d)return '—';
  try{return new Date(d+'T00:00:00').toLocaleDateString(undefined,{day:'numeric',month:'short',year:'numeric'});}
  catch{return d;}
}
export function newEntry(){return {condition:'',note:'',photos:[]};}
export function makeRoom(name){
  return {
    id:uid(),
    name,
    items:(ROOM_TEMPLATES[name]||['General condition','Existing damage']).map(label=>({
      id:uid(),label,movein:newEntry(),moveout:newEntry()
    }))
  };
}
export function blankMeta(){return {meters:{electricity:'',water:'',gas:''},inventoryNotes:'',keys:''};}
export function newProperty(form={}){
  return {
    id:uid(),
    name:form.name||'My rental',
    address:form.address||'',
    tenant:form.tenant||'',
    landlord:form.landlord||'',
    tenancyType:form.tenancyType||'Rental apartment',
    furnishing:form.furnishing||'Unspecified',
    moveInDate:form.moveInDate||today(),
    moveOutDate:'',
    rooms:DEFAULT_ROOMS.map(makeRoom),
    metaByMode:{movein:blankMeta(),moveout:blankMeta()},
    createdAt:new Date().toISOString(),
    updatedAt:new Date().toISOString(),
    schemaVersion:SCHEMA_VERSION
  };
}
export function normalizeProperty(p){
  p.schemaVersion=p.schemaVersion||1;
  p.rooms=p.rooms||[];
  p.tenancyType=p.tenancyType||'Rental apartment';
  p.furnishing=p.furnishing||'Unspecified';
  p.rooms.forEach(r=>{
    r.id=r.id||uid();r.items=r.items||[];
    r.items.forEach(i=>{
      i.id=i.id||uid();
      i.movein=i.movein||newEntry();i.moveout=i.moveout||newEntry();
      i.movein.photos=i.movein.photos||[];i.moveout.photos=i.moveout.photos||[];
    });
  });
  if(!p.metaByMode){
    p.metaByMode={
      movein:{
        meters:{
          electricity:p.meters?.electricity||'',
          water:p.meters?.water||'',
          gas:p.meters?.gas||''
        },
        inventoryNotes:p.inventoryNotes||'',
        keys:p.keys||''
      },
      moveout:blankMeta()
    };
  }
  ['movein','moveout'].forEach(mode=>{
    p.metaByMode[mode]=p.metaByMode[mode]||blankMeta();
    p.metaByMode[mode].meters=p.metaByMode[mode].meters||{electricity:'',water:'',gas:''};
    ['electricity','water','gas'].forEach(k=>{
      if(p.metaByMode[mode].meters[k]==null)p.metaByMode[mode].meters[k]='';
    });
    if(p.metaByMode[mode].inventoryNotes==null)p.metaByMode[mode].inventoryNotes='';
    if(p.metaByMode[mode].keys==null)p.metaByMode[mode].keys='';
  });
  p.schemaVersion=SCHEMA_VERSION;
  return p;
}
export function hasEntry(e){return !!(e&&(e.condition||e.note||e.photos?.length));}
export function completion(p,mode){
  let total=0,done=0;
  (p.rooms||[]).forEach(r=>(r.items||[]).forEach(i=>{total++;if(hasEntry(i[mode]))done++;}));
  return {total,done,pct:total?Math.round(done/total*100):0};
}
export function roomCompletion(room,mode){
  const total=room.items?.length||0;
  const done=(room.items||[]).filter(i=>hasEntry(i[mode])).length;
  return {total,done,pct:total?Math.round(done/total*100):0};
}
export function comparisonStats(p){
  let changed=0,worse=0,improved=0,unchanged=0;
  for(const r of p.rooms||[])for(const i of r.items||[]){
    if(!hasEntry(i.movein)&&!hasEntry(i.moveout))continue;
    const a=i.movein?.condition||'',b=i.moveout?.condition||'';
    const noteChanged=(i.movein?.note||'').trim()!==(i.moveout?.note||'').trim();
    if(a!==b||noteChanged)changed++;else unchanged++;
    if(CONDITION_SCORE[b]>CONDITION_SCORE[a])worse++;
    if(a&&b&&CONDITION_SCORE[b]<CONDITION_SCORE[a])improved++;
  }
  return {changed,worse,improved,unchanged};
}
export function photoSrc(ph){return typeof ph==='string'?ph:ph?.src||'';}
export function photoTime(ph){return typeof ph==='string'?'':ph?.addedAt||'';}
export function reportId(p,mode){
  const d=(mode==='moveout'?(p.moveOutDate||today()):p.moveInDate||today()).replaceAll('-','');
  const phase=mode==='compare'?'CMP':mode==='moveout'?'OUT':'IN';
  return `FS-${String(p.id).slice(0,8).toUpperCase()}-${phase}-${d}`;
}

function openDB(){
  return new Promise((resolve,reject)=>{
    const r=indexedDB.open(DB_NAME,DB_VERSION);
    r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains(STORE))r.result.createObjectStore(STORE,{keyPath:'id'});};
    r.onsuccess=()=>resolve(r.result);
    r.onerror=()=>reject(r.error);
  });
}
export async function getAllProperties(){
  const db=await openDB();
  return new Promise((resolve,reject)=>{
    const r=db.transaction(STORE).objectStore(STORE).getAll();
    r.onsuccess=()=>resolve((r.result||[]).map(normalizeProperty).sort((a,b)=>(b.updatedAt||'').localeCompare(a.updatedAt||'')));
    r.onerror=()=>reject(r.error);
  });
}
export async function saveProperty(p){
  normalizeProperty(p);p.updatedAt=new Date().toISOString();
  const db=await openDB();
  return new Promise((resolve,reject)=>{
    const r=db.transaction(STORE,'readwrite').objectStore(STORE).put(p);
    r.onsuccess=()=>resolve(p);r.onerror=()=>reject(r.error);
  });
}
export async function deleteProperty(id){
  const db=await openDB();
  return new Promise((resolve,reject)=>{
    const r=db.transaction(STORE,'readwrite').objectStore(STORE).delete(id);
    r.onsuccess=()=>resolve();r.onerror=()=>reject(r.error);
  });
}
export async function compressImage(file){
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onerror=()=>reject(reader.error);
    reader.onload=()=>{
      const img=new Image();
      img.onerror=reject;
      img.onload=()=>{
        const max=1800;
        let w=img.naturalWidth,h=img.naturalHeight;
        if(Math.max(w,h)>max){
          const s=max/Math.max(w,h);w=Math.round(w*s);h=Math.round(h*s);
        }
        const c=document.createElement('canvas');c.width=w;c.height=h;
        c.getContext('2d').drawImage(img,0,0,w,h);
        resolve(c.toDataURL('image/jpeg',0.8));
      };
      img.src=reader.result;
    };
    reader.readAsDataURL(file);
  });
}
function demoPhoto(kind='room'){return {src:kind==='fixture'?'./demo/demo-fixture.jpg':'./demo/demo-room.jpg',addedAt:'2026-01-12T10:15:00.000Z'};}
export function demoProperty(){
  const p=newProperty({
    name:'Demo — Skyline Residency 2BHK',
    address:'Flat 804, C-Wing, Skyline Residency, Wakad Road, Pune, Maharashtra 411057 (fictional demo)',
    tenant:'Arjun Mehta (Demo)',
    landlord:'Neha Kulkarni (Demo)',
    tenancyType:'Rental apartment',
    furnishing:'Semi-furnished',
    moveInDate:'2026-01-12'
  });
  p.id=DEMO_ID;p.demo=true;p.moveOutDate='2026-09-30';
  p.metaByMode.movein={meters:{electricity:'14,102.7 kWh',water:'128.6 kL',gas:'167.4 SCM'},inventoryNotes:'Sofa, coffee table, dining table with 4 chairs, 2 beds with mattresses, 3 split AC units, refrigerator, washing machine, water heater, modular kitchen hob and chimney.',keys:'2 main-door keys, 1 mailbox key, 2 society RFID cards, 1 parking remote.'};
  p.metaByMode.moveout={meters:{electricity:'14,864.2 kWh',water:'146.9 kL',gas:'211.8 SCM'},inventoryNotes:'All listed furniture and appliances returned. Normal upholstery wear on sofa; no missing appliance.',keys:'2 main-door keys, 1 mailbox key, 2 society RFID cards, 1 parking remote returned.'};
  const bed2=makeRoom('Bedroom');bed2.name='Bedroom 2';p.rooms.splice(2,0,bed2);p.rooms.push(makeRoom('Balcony'));
  p.rooms.forEach(r=>r.items.forEach(i=>{
    i.movein={condition:'Good',note:'Checked at move-in; no material defect noted unless stated below.',photos:[]};
    i.moveout={condition:'Good',note:'Condition consistent with normal residential use.',photos:[]};
  }));
  const set=(room,label,miC,miN,moC,moN,kind='room')=>{
    const item=p.rooms.find(r=>r.name===room)?.items.find(i=>i.label===label);if(!item)return;
    item.movein={condition:miC,note:miN,photos:[demoPhoto(kind)]};
    item.moveout={condition:moC,note:moN,photos:[demoPhoto(kind)]};
  };
  set('Living room','All walls','Fair','Two small nail holes on TV wall and faint scuff near balcony door; present before move-in.','Fair','Original nail holes remain. One light furniture scuff near sofa area.');
  set('Living room','Furniture','Good','Sofa and coffee table clean; slight pre-existing wear on left sofa arm.','Fair','Normal upholstery wear; no tear.');
  set('Bedroom','Existing damage','Fair','Small laminate chip on lower-right wardrobe shutter documented at handover.','Fair','Same laminate chip; no additional breakage.','fixture');
  set('Bedroom','AC','Good','Split AC powers on, cools normally, and remote is present.','Good','AC tested; cooling and remote functional.','fixture');
  set('Bedroom 2','Existing damage','Fair','Hairline paint crack above window corner, approximately 12 cm long.','Fair','Hairline crack appears unchanged.');
  set('Kitchen','Countertop','Fair','Small pre-existing granite edge chip beside sink.','Fair','Original edge chip unchanged; no new crack.','fixture');
  set('Kitchen','Stove / hob','Good','Four-burner hob ignites correctly.','Good','All four burners tested and working.','fixture');
  set('Bathroom','Walls / tiles','Good','Tiles intact; grout slightly discoloured near shower floor.','Fair','Mild hard-water staining on lower shower tiles; no cracked tile.','fixture');
  set('Balcony','Railing','Good','Railing secure with no loose sections.','Good','Railing secure.');
  p.createdAt='2026-01-12T09:30:00.000Z';p.updatedAt='2026-09-30T16:45:00.000Z';
  return p;
}
