import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft, ArrowRight, Camera, Check, ChevronRight, CircleAlert, ClipboardCheck,
  Download, FileDown, FileText, Gauge, Home, ImagePlus, Info, KeyRound, Layers3,
  Menu, PackageCheck, Plus, RotateCcw, Share2, ShieldCheck, Sparkles, Trash2,
  Upload, X, Zap
} from 'lucide-react';
import {
  CONDITIONS, CONDITION_SCORE, DEMO_ID, blankMeta, comparisonStats, completion,
  compressImage, deleteProperty, demoProperty, fmtDate, getAllProperties, hasEntry,
  makeRoom, newProperty, photoSrc, reportId, roomCompletion, saveProperty, today
} from './data.js';
import { createFlatStampPdf } from './pdf.js';

const PAGE={
  initial:{opacity:0,y:10},
  animate:{opacity:1,y:0},
  exit:{opacity:0,y:-8},
  transition:{duration:.2,ease:'easeOut'}
};

function modeLabel(mode){return mode==='moveout'?'Move-out':'Move-in';}
function modeIcon(mode){return mode==='moveout'?RotateCcw:ClipboardCheck;}
function clone(v){return structuredClone(v);}
function percentColor(p){return p===100?'complete':p>=45?'active':'muted';}
function conditionTone(c){
  if(c==='Good')return 'good';
  if(c==='Fair')return 'fair';
  if(c==='Damaged'||c==='Needs repair')return 'bad';
  return 'neutral';
}
function downloadBlob(blob,filename){
  const url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1500);
}
function exportJson(data,filename){
  downloadBlob(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),filename);
}
function safeFileName(v){return String(v||'property').replace(/[^a-z0-9]+/gi,'-').replace(/^-|-$/g,'').toLowerCase();}

function Brand({compact=false}){
  return <div className="brand-lockup">
    <div className="brand-mark"><span>FS</span></div>
    {!compact&&<div><div className="brand-name">FlatStamp</div><div className="brand-sub">Rental condition record</div></div>}
  </div>;
}
function IconButton({children,label,onClick,className=''}) {
  return <button className={'icon-button '+className} onClick={onClick} aria-label={label}>{children}</button>;
}
function Progress({value,size='md'}){
  return <div className={'progress '+size}><span style={{width:`${Math.max(0,Math.min(100,value))}%`}} /></div>;
}
function Pill({children,tone='default'}){return <span className={'pill '+tone}>{children}</span>;}
function Empty({icon:Icon=Home,title,body,action}){
  return <div className="empty-state">
    <div className="empty-icon"><Icon size={28}/></div>
    <h3>{title}</h3><p>{body}</p>{action}
  </div>;
}
function AppHeader({title,onBack,onSettings=true}){
  return <header className="app-header">
    <div className="header-left">
      {onBack?<IconButton label="Back" onClick={onBack}><ArrowLeft size={20}/></IconButton>:<Brand compact/>}
      <div className="header-title">{title||(!onBack?'FlatStamp':'')}</div>
    </div>
    {onSettings&&<IconButton label="Settings" onClick={()=>window.dispatchEvent(new CustomEvent('flatstamp-settings'))}><Menu size={20}/></IconButton>}
  </header>;
}
function Stat({label,value,sub,icon:Icon}){
  return <div className="stat-card">{Icon&&<div className="stat-icon"><Icon size={18}/></div>}<div><div className="stat-value">{value}</div><div className="stat-label">{label}</div>{sub&&<div className="stat-sub">{sub}</div>}</div></div>;
}

function HeroEvidenceScene(){
  return <div className="evidence-scene" aria-hidden="true">
    <div className="scene-halo"/>
    <motion.div className="scene-card scene-main"
      initial={{opacity:0,y:18,rotate:-3}} animate={{opacity:1,y:0,rotate:-2}}
      transition={{delay:.1,type:'spring',stiffness:110,damping:15}}>
      <div className="scene-card-head"><span>Living room</span><Pill tone="good"><Check size={11}/> Complete</Pill></div>
      <div className="scene-photo">
        <div className="scene-window"/><div className="scene-sofa"/><div className="scene-table"/>
        <div className="scan-line"/>
      </div>
      <div className="scene-meta"><span><Camera size={13}/> 12 photos</span><span>9/9 checks</span></div>
    </motion.div>
    <motion.div className="scene-card scene-float top"
      initial={{opacity:0,x:20,y:6}} animate={{opacity:1,x:0,y:0}}
      transition={{delay:.28,type:'spring',stiffness:130,damping:16}}>
      <div className="mini-orb"><ShieldCheck size={16}/></div>
      <div><b>Stored locally</b><span>Private by default</span></div>
    </motion.div>
    <motion.div className="scene-card scene-float bottom"
      initial={{opacity:0,x:-14,y:12}} animate={{opacity:1,x:0,y:0}}
      transition={{delay:.4,type:'spring',stiffness:130,damping:16}}>
      <div className="mini-orb violet"><FileDown size={16}/></div>
      <div><b>Report ready</b><span>Save · share · compare</span></div>
    </motion.div>
    <motion.div className="stamp-seal"
      initial={{scale:.7,opacity:0,rotate:-18}} animate={{scale:1,opacity:1,rotate:-8}}
      transition={{delay:.58,type:'spring',stiffness:180,damping:12}}>
      <Sparkles size={15}/><span>STAMPED</span>
    </motion.div>
  </div>;
}

function HomeView({properties,onCreate,onOpen,onDemo,onSettings}){
  const total=properties.filter(p=>!p.demo).length;
  const completed=properties.filter(p=>completion(p,'movein').pct===100&&!p.demo).length;
  return <motion.div {...PAGE}>
    <AppHeader onSettings={false}/>
    <main className="screen home-screen">
      <section className="hero-card">
        <div className="hero-glow one"/><div className="hero-glow two"/><div className="hero-sheen"/>
        <div className="hero-copy">
          <div className="hero-kicker"><Sparkles size={15}/> Deposit-ready documentation</div>
          <h1>Stamp the condition.<br/><span>Keep the record.</span></h1>
          <p>Guided move-in and move-out evidence, built to be simple enough to actually finish.</p>
          <div className="hero-actions">
            <button className="btn primary xl magic-cta" onClick={onCreate}><Plus size={20}/> New inspection</button>
            <button className="btn glass xl" onClick={onDemo}><Layers3 size={19}/> Try demo</button>
          </div>
          <div className="privacy-chip"><ShieldCheck size={16}/> Local-first · no account · works offline</div>
        </div>
        <HeroEvidenceScene/>
      </section>

      <section className="stats-grid">
        <Stat icon={Home} label="Properties" value={total}/>
        <Stat icon={Check} label="Move-ins complete" value={completed}/>
        <Stat icon={ShieldCheck} label="Cloud uploads" value="0"/>
      </section>

      <div className="section-row"><div><div className="eyebrow">Your records</div><h2>Properties</h2></div><button className="text-button" onClick={onSettings}>Manage <ChevronRight size={16}/></button></div>
      <div className="property-list">
        {properties.length?properties.map((p,index)=>{
          const mi=completion(p,'movein'),mo=completion(p,'moveout');
          return <motion.button
            key={p.id} className={'property-card '+(p.demo?'demo-card':'')}
            initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} whileTap={{scale:.992}}
            transition={{delay:index*.035}}
            onClick={()=>onOpen(p.id)}
          >
            <div className="property-card-top">
              <div className="property-avatar">{p.demo?'D':(p.name?.trim()?.[0]||'P').toUpperCase()}</div>
              <div className="property-copy"><div className="property-name-row"><h3>{p.name}</h3>{p.demo&&<Pill tone="demo">DEMO</Pill>}</div><p>{p.address||'No address added'}</p></div>
              <ChevronRight size={19} className="muted-icon"/>
            </div>
            <div className="property-progress">
              <div><span>Move-in</span><b>{mi.pct}%</b></div><Progress value={mi.pct}/>
              {(mo.done>0||p.moveOutDate)&&<><div className="mini-spacer"/><div><span>Move-out</span><b>{mo.pct}%</b></div><Progress value={mo.pct}/></>}
            </div>
            <div className="property-footer"><span>{mi.done+mo.done} documented checks</span><span>{fmtDate(p.moveInDate)}</span></div>
          </motion.button>;
        }):<Empty
          icon={ClipboardCheck}
          title="Your first record starts here"
          body="Create a property and FlatStamp will guide you room by room."
          action={<button className="btn primary" onClick={onCreate}><Plus size={18}/> Create property</button>}
        />}
      </div>
      <button className="settings-link" onClick={onSettings}><Menu size={18}/> Settings, backups & install</button>
    </main>
  </motion.div>;
}

function CreateView({onBack,onCreate}){
  const [form,setForm]=useState({name:'',address:'',tenant:'',landlord:'',tenancyType:'Rental apartment',furnishing:'Unspecified',moveInDate:today()});
  const set=(k,v)=>setForm(x=>({...x,[k]:v}));
  const submit=e=>{e.preventDefault();if(!form.name.trim()||!form.address.trim())return;onCreate(form);};
  return <motion.div {...PAGE}><AppHeader title="New property" onBack={onBack}/><main className="screen narrow">
    <div className="page-intro"><div className="eyebrow">Step 1 of 2</div><h1>Set up the rental</h1><p>FlatStamp will create a guided room checklist next.</p></div>
    <form className="form-card" onSubmit={submit}>
      <Field label="Property name" hint="Use a name you’ll recognise later."><input autoFocus value={form.name} onChange={e=>set('name',e.target.value)} placeholder="e.g. Baner 2BHK" required/></Field>
      <Field label="Full address"><textarea value={form.address} onChange={e=>set('address',e.target.value)} placeholder="Building, flat, street, city" required/></Field>
      <div className="two-col">
        <Field label="Tenancy type"><select value={form.tenancyType} onChange={e=>set('tenancyType',e.target.value)}><option>Rental apartment</option><option>PG / paying guest</option><option>Shared apartment</option><option>Independent house</option><option>Other</option></select></Field>
        <Field label="Furnishing"><select value={form.furnishing} onChange={e=>set('furnishing',e.target.value)}><option>Unspecified</option><option>Unfurnished</option><option>Semi-furnished</option><option>Furnished</option></select></Field>
      </div>
      <div className="two-col">
        <Field label="Tenant"><input value={form.tenant} onChange={e=>set('tenant',e.target.value)} placeholder="Tenant name"/></Field>
        <Field label="Owner / landlord"><input value={form.landlord} onChange={e=>set('landlord',e.target.value)} placeholder="Owner name"/></Field>
      </div>
      <Field label="Move-in date"><input type="date" value={form.moveInDate} onChange={e=>set('moveInDate',e.target.value)}/></Field>
      <button className="btn primary xl full" type="submit">Create guided inspection <ArrowRight size={19}/></button>
    </form>
  </main></motion.div>;
}
function Field({label,hint,children}){return <label className="field"><span>{label}</span>{hint&&<small>{hint}</small>}{children}</label>;}

function PropertyView({property,mode,setMode,onBack,onRoom,onSave,onCompare,onReport,onPdf,onShare,onDelete,onAddRoom}){
  const c=completion(property,mode),Icon=modeIcon(mode),meta=property.metaByMode[mode];
  const updateMeta=(k,v)=>{
    const p=clone(property);
    if(['electricity','water','gas'].includes(k))p.metaByMode[mode].meters[k]=v;
    else p.metaByMode[mode][k]=v;
    onSave(p);
  };
  const updateDate=v=>{const p=clone(property);p.moveOutDate=v;onSave(p);};
  return <motion.div {...PAGE}><AppHeader title={property.name} onBack={onBack}/><main className="screen">
    <section className="property-hero">
      <div className="property-hero-title"><div><div className="eyebrow">{property.demo?'Demo property':'Active record'}</div><h1>{property.name}</h1><p>{property.address}</p></div><Pill tone={c.pct===100?'good':'default'}>{c.pct}% complete</Pill></div>
      <div className="mode-switch">
        {['movein','moveout'].map(m=>{const M=modeIcon(m);return <button key={m} className={mode===m?'active':''} onClick={()=>setMode(m)}><M size={17}/>{modeLabel(m)}</button>;})}
      </div>
      <div className="overall-progress"><div><span>{modeLabel(mode)} progress</span><b>{c.done} of {c.total} checks</b></div><Progress value={c.pct} size="lg"/></div>
    </section>

    <div className="section-row"><div><div className="eyebrow">Step 2 of 2</div><h2>Walk the rooms</h2></div><button className="icon-text-button" onClick={onAddRoom}><Plus size={17}/> Room</button></div>
    <div className="room-grid">
      {property.rooms.map((room,index)=>{
        const r=roomCompletion(room,mode);
        return <motion.button key={room.id} className="room-card" onClick={()=>onRoom(room.id)}
          initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} whileTap={{scale:.992}} transition={{delay:index*.025}}>
          <div className={'room-ring '+percentColor(r.pct)} style={{'--room-progress':r.pct}}><div className="room-ring-inner"><span>{r.pct}</span><small>%</small></div></div>
          <div className="room-card-copy"><h3>{room.name}</h3><p>{r.done}/{r.total} checks documented</p><Progress value={r.pct}/></div>
          <ChevronRight size={19} className="muted-icon"/>
        </motion.button>;
      })}
    </div>

    <div className="section-row"><div><div className="eyebrow">Whole property</div><h2>Handover details</h2></div><Icon size={21} className="section-icon"/></div>
    <section className="surface details-card">
      <div className="meter-grid">
        <Field label="Electricity meter"><input value={meta.meters.electricity} onChange={e=>updateMeta('electricity',e.target.value)} placeholder="Reading"/></Field>
        <Field label="Water meter"><input value={meta.meters.water} onChange={e=>updateMeta('water',e.target.value)} placeholder="Reading"/></Field>
        <Field label="Gas meter"><input value={meta.meters.gas} onChange={e=>updateMeta('gas',e.target.value)} placeholder="Reading / N/A"/></Field>
      </div>
      <Field label="Furniture & appliance inventory"><textarea value={meta.inventoryNotes} onChange={e=>updateMeta('inventoryNotes',e.target.value)} placeholder="Items present, quantity and condition"/></Field>
      <Field label="Keys, cards & remotes"><textarea value={meta.keys} onChange={e=>updateMeta('keys',e.target.value)} placeholder="What was handed over?"/></Field>
      {mode==='moveout'&&<Field label="Move-out date"><input type="date" value={property.moveOutDate||today()} onChange={e=>updateDate(e.target.value)}/></Field>}
    </section>

    <div className="section-row"><div><div className="eyebrow">Ready to use</div><h2>Reports</h2></div></div>
    <div className="action-grid">
      <button className="action-card primary-action" onClick={onReport}><div className="action-icon"><FileText size={22}/></div><div><b>Preview {modeLabel(mode)} report</b><span>Review exactly what will be exported</span></div><ChevronRight size={18}/></button>
      <button className="action-card" onClick={onPdf}><div className="action-icon"><FileDown size={22}/></div><div><b>Save / share PDF</b><span>Generates locally on this device</span></div><ChevronRight size={18}/></button>
      <button className="action-card" onClick={onCompare}><div className="action-icon"><Layers3 size={22}/></div><div><b>Compare move-in vs move-out</b><span>See recorded changes side by side</span></div><ChevronRight size={18}/></button>
      <button className="action-card" onClick={onShare}><div className="action-icon"><Share2 size={22}/></div><div><b>Share summary</b><span>WhatsApp, Messages, Mail and more</span></div><ChevronRight size={18}/></button>
    </div>
    <div className="danger-zone"><button onClick={onDelete}><Trash2 size={17}/> Delete property</button></div>
  </main></motion.div>;
}

function RoomView({property,roomId,mode,onBack,onSave,toast}){
  const room=property.rooms.find(r=>r.id===roomId),c=roomCompletion(room,mode);
  const [openId,setOpenId]=useState(()=>room.items.find(i=>!hasEntry(i[mode]))?.id||room.items[0]?.id);
  const update=(itemId,patch)=>{
    const p=clone(property),r=p.rooms.find(x=>x.id===roomId),i=r.items.find(x=>x.id===itemId);
    Object.assign(i[mode],patch);onSave(p);
  };
  const addPhotos=async(itemId,files)=>{
    const list=Array.from(files||[]).slice(0,5);if(!list.length)return;
    toast('Optimising photos…');
    const additions=[];
    for(const f of list)additions.push({src:await compressImage(f),addedAt:new Date().toISOString()});
    const p=clone(property),r=p.rooms.find(x=>x.id===roomId),i=r.items.find(x=>x.id===itemId);
    i[mode].photos.push(...additions);await onSave(p);toast('Photos saved');
  };
  const removePhoto=(itemId,index)=>{
    const p=clone(property),r=p.rooms.find(x=>x.id===roomId),i=r.items.find(x=>x.id===itemId);
    i[mode].photos.splice(index,1);onSave(p);
  };
  return <motion.div {...PAGE}><AppHeader title={room.name} onBack={onBack}/><main className="screen room-screen">
    <section className="room-hero">
      <div><div className="eyebrow">{modeLabel(mode)} room check</div><h1>{room.name}</h1><p>Start wide, then capture close-ups of anything worth noting.</p></div>
      <div className="room-hero-progress"><strong>{c.pct}%</strong><span>{c.done}/{c.total}</span></div>
    </section>
    <Progress value={c.pct} size="lg"/>
    <div className="capture-tip"><Camera size={18}/><div><b>Photo habit</b><span>Take one wide shot plus a close-up for marks, cracks, stains or missing items.</span></div></div>
    <div className="check-list">
      {room.items.map((item,index)=>{
        const entry=item[mode],done=hasEntry(entry),open=openId===item.id;
        return <motion.article layout key={item.id} className={'check-card '+(open?'open':'')+(done?' done':'')}>
          <button className="check-summary" onClick={()=>setOpenId(open?null:item.id)}>
            <div className={'check-number '+(done?'done':'')}>{done?<Check size={16}/>:index+1}</div>
            <div><h3>{item.label}</h3><p>{entry.condition||'Not documented'}{entry.photos.length?` · ${entry.photos.length} photo${entry.photos.length===1?'':'s'}`:''}</p></div>
            <ChevronRight size={18} className={open?'rotate':''}/>
          </button>
          <AnimatePresence initial={false}>
            {open&&<motion.div className="check-body" initial={{height:0,opacity:0}} animate={{height:'auto',opacity:1}} exit={{height:0,opacity:0}} transition={{duration:.2}}>
              <div className="condition-row">
                {CONDITIONS.map(condition=><button key={condition} className={'condition-chip '+conditionTone(condition)+(entry.condition===condition?' selected':'')} onClick={()=>update(item.id,{condition})}>{condition}</button>)}
              </div>
              <Field label="Note"><textarea value={entry.note} onChange={e=>update(item.id,{note:e.target.value})} placeholder="Describe what you can see. Keep it factual."/></Field>
              <div className="photo-section">
                <div className="field-label">Photos <span>{entry.photos.length}/5 added</span></div>
                <div className="photo-grid">
                  {entry.photos.map((ph,i)=><div className="photo-tile" key={i}><img src={photoSrc(ph)} alt={`${item.label} evidence ${i+1}`}/><button onClick={()=>removePhoto(item.id,i)} aria-label="Remove photo"><X size={15}/></button></div>)}
                  {entry.photos.length<5&&<label className="add-photo"><ImagePlus size={22}/><span>Add photo</span><input hidden type="file" accept="image/*" capture="environment" multiple onChange={e=>addPhotos(item.id,e.target.files)}/></label>}
                </div>
              </div>
            </motion.div>}
          </AnimatePresence>
        </motion.article>;
      })}
    </div>
  </main></motion.div>;
}

function ReportView({property,mode,onBack,onPdf,onShare}){
  const meta=property.metaByMode[mode],c=completion(property,mode);
  return <motion.div {...PAGE}><AppHeader title="Report preview" onBack={onBack}/><main className="screen report-screen">
    <section className="report-cover">
      <div className="report-brand"><Brand/><Pill>{modeLabel(mode)} report</Pill></div>
      <h1>{property.name}</h1><p>{property.address}</p>
      <code>{reportId(property,mode)}</code>
      <div className="report-stats"><div><span>Inspection</span><b>{mode==='movein'?fmtDate(property.moveInDate):fmtDate(property.moveOutDate)}</b></div><div><span>Documented</span><b>{c.done}/{c.total}</b></div><div><span>Completion</span><b>{c.pct}%</b></div></div>
    </section>
    <section className="surface report-meta">
      <Row label="Tenant" value={property.tenant||'—'}/><Row label="Owner / landlord" value={property.landlord||'—'}/><Row label="Tenancy" value={`${property.tenancyType} · ${property.furnishing}`}/>
      <Row label="Electricity" value={meta.meters.electricity||'—'}/><Row label="Water" value={meta.meters.water||'—'}/><Row label="Gas" value={meta.meters.gas||'—'}/>
      <Row label="Inventory" value={meta.inventoryNotes||'—'}/><Row label="Keys / access" value={meta.keys||'—'}/>
    </section>
    {property.rooms.map(room=>{
      const items=room.items.filter(i=>hasEntry(i[mode]));if(!items.length)return null;
      return <section className="report-room" key={room.id}><div className="section-row compact"><h2>{room.name}</h2></div>{items.map(item=>{
        const e=item[mode];return <div className="report-item" key={item.id}><div className="report-item-head"><h3>{item.label}</h3><Pill tone={conditionTone(e.condition)}>{e.condition||'Not recorded'}</Pill></div>{e.note&&<p>{e.note}</p>}{e.photos.length>0&&<div className="report-photo-grid">{e.photos.map((ph,i)=><figure key={i}><img src={photoSrc(ph)} alt="Evidence"/><figcaption>Photo {i+1}</figcaption></figure>)}</div>}</div>;
      })}</section>;
    })}
    <div className="disclaimer"><Info size={18}/><span>FlatStamp organises locally stored condition records. It does not independently prove authenticity or provide legal advice.</span></div>
    <div className="sticky-actions"><button className="btn primary full" onClick={onPdf}><FileDown size={19}/> Save / share PDF</button><button className="btn full" onClick={onShare}><Share2 size={19}/> Share summary</button></div>
  </main></motion.div>;
}
function Row({label,value}){return <div className="report-row"><span>{label}</span><b>{value}</b></div>;}

function CompareView({property,onBack,onPdf,onShare}){
  const stats=comparisonStats(property),mi=completion(property,'movein'),mo=completion(property,'moveout');
  return <motion.div {...PAGE}><AppHeader title="Move comparison" onBack={onBack}/><main className="screen compare-screen">
    <section className="compare-hero"><div className="eyebrow">Move-in → move-out</div><h1>{property.name}</h1><p>Compare what was recorded at each handover. Condition changes are indicators, not conclusions about cause or responsibility.</p></section>
    <div className="compare-stats"><Stat label="Changed records" value={stats.changed} icon={Layers3}/><Stat label="Potentially worse" value={stats.worse} icon={CircleAlert}/><Stat label="Improved" value={stats.improved} icon={Check}/></div>
    <section className="surface compare-summary">
      <div><span>Move-in</span><b>{fmtDate(property.moveInDate)}</b><em>{mi.done}/{mi.total} checks</em></div><ArrowRight size={20}/><div><span>Move-out</span><b>{fmtDate(property.moveOutDate)}</b><em>{mo.done}/{mo.total} checks</em></div>
    </section>
    {property.rooms.map(room=>{
      const items=room.items.filter(i=>hasEntry(i.movein)||hasEntry(i.moveout));if(!items.length)return null;
      return <section className="compare-room" key={room.id}><div className="section-row compact"><h2>{room.name}</h2></div>{items.map(item=>{
        const a=item.movein,b=item.moveout;
        const worse=CONDITION_SCORE[b.condition]>CONDITION_SCORE[a.condition];
        return <div className="compare-item" key={item.id}><div className="compare-item-title"><h3>{item.label}</h3>{worse&&<Pill tone="bad">Condition worsened</Pill>}</div><div className="compare-columns">
          <CompareCell title="Move-in" entry={a}/><CompareCell title="Move-out" entry={b}/>
        </div></div>;
      })}</section>;
    })}
    <div className="disclaimer"><Info size={18}/><span>This comparison does not determine cause, responsibility or legal liability.</span></div>
    <div className="sticky-actions"><button className="btn primary full" onClick={onPdf}><FileDown size={19}/> Save comparison PDF</button><button className="btn full" onClick={onShare}><Share2 size={19}/> Share summary</button></div>
  </main></motion.div>;
}
function CompareCell({title,entry}){
  return <div className="compare-cell"><div className="compare-cell-head"><span>{title}</span><Pill tone={conditionTone(entry.condition)}>{entry.condition||'Not recorded'}</Pill></div>{entry.note&&<p>{entry.note}</p>}{entry.photos?.length>0&&<div className="compare-images">{entry.photos.slice(0,2).map((ph,i)=><img key={i} src={photoSrc(ph)} alt={title+' evidence'}/>)}</div>}</div>;
}

function SettingsView({properties,onBack,onDemo,onImport,installPrompt,installApp,standalone}){
  const fileRef=useRef();
  return <motion.div {...PAGE}><AppHeader title="Settings" onBack={onBack} onSettings={false}/><main className="screen narrow">
    <div className="page-intro"><div className="eyebrow">FlatStamp</div><h1>Private by design</h1><p>Your property records and photos stay in this browser unless you explicitly export or share them.</p></div>
    <section className="surface settings-card">
      <div className="settings-icon"><Zap size={21}/></div><div><h3>Install FlatStamp</h3><p>{standalone?'You’re already using the installed app.':installPrompt?'Install it like a native app for quick access and offline use.':'On iPhone/iPad: open in Safari → Share → Add to Home Screen.'}</p></div>
      {!standalone&&installPrompt&&<button className="btn primary full" onClick={installApp}>Install app</button>}
    </section>
    <section className="surface settings-card">
      <div className="settings-icon"><PackageCheck size={21}/></div><div><h3>Backup & restore</h3><p>Export after important inspections. Clearing browser/site data can remove local records.</p></div>
      <button className="btn full" onClick={()=>exportJson({app:'FlatStamp',version:3,exportedAt:new Date().toISOString(),properties},`flatstamp-backup-${today()}.json`)}><Download size={18}/> Export all data</button>
      <button className="btn full" onClick={()=>fileRef.current?.click()}><Upload size={18}/> Import backup</button>
      <input ref={fileRef} hidden type="file" accept="application/json" onChange={e=>onImport(e.target.files?.[0])}/>
    </section>
    <section className="surface settings-card">
      <div className="settings-icon"><Layers3 size={21}/></div><div><h3>Explore the demo</h3><p>Open a fictional completed property with move-in and move-out evidence.</p></div>
      <button className="btn full" onClick={onDemo}>Open demo property</button>
    </section>
    <a className="settings-link-card" href="./privacy.html"><ShieldCheck size={19}/><div><b>Privacy policy</b><span>Local storage, sharing and limitations</span></div><ChevronRight size={18}/></a>
    <div className="version-note">FlatStamp MVP · React PWA · local-first storage</div>
  </main></motion.div>;
}

function PdfSheet({data,onClose}){
  const [url,setUrl]=useState('');
  useEffect(()=>{
    if(!data)return;
    const u=URL.createObjectURL(data.blob);setUrl(u);
    return()=>URL.revokeObjectURL(u);
  },[data]);
  if(!data)return null;
  const share=async()=>{
    try{
      const file=new File([data.blob],data.filename,{type:'application/pdf'});
      if(navigator.share&&(!navigator.canShare||navigator.canShare({files:[file]}))){
        await navigator.share({files:[file],title:'FlatStamp PDF'});return;
      }
      window.open(url,'_blank','noopener');
    }catch(err){if(err?.name!=='AbortError')window.open(url,'_blank','noopener');}
  };
  return <motion.div className="sheet-backdrop" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}>
    <motion.div className="bottom-sheet" initial={{y:'100%'}} animate={{y:0}} exit={{y:'100%'}} transition={{type:'spring',damping:26,stiffness:300}}>
      <div className="sheet-handle"/><div className="pdf-ready-icon"><FileDown size={26}/></div><div className="eyebrow">PDF ready</div><h2>{data.filename}</h2><p>Created locally on this device. On iPhone/iPad, use the share sheet and choose “Save to Files”.</p>
      <button className="btn primary xl full" onClick={share}><Share2 size={19}/> Share / Save to Files</button>
      <a className="btn full" href={url} target="_blank" rel="noreferrer"><FileText size={18}/> Open PDF</a>
      <button className="btn full" onClick={()=>downloadBlob(data.blob,data.filename)}><Download size={18}/> Download PDF</button>
      <button className="sheet-close" onClick={onClose}>Close</button>
    </motion.div>
  </motion.div>;
}
function AddRoomSheet({onClose,onAdd}){
  const [name,setName]=useState('Bedroom 2');
  return <motion.div className="sheet-backdrop" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}>
    <motion.div className="bottom-sheet" initial={{y:'100%'}} animate={{y:0}} exit={{y:'100%'}}><div className="sheet-handle"/><div className="eyebrow">Custom room</div><h2>Add another space</h2><Field label="Room name"><input autoFocus value={name} onChange={e=>setName(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&name.trim())onAdd(name.trim());}}/></Field><button className="btn primary xl full" onClick={()=>name.trim()&&onAdd(name.trim())}><Plus size={18}/> Add room</button><button className="sheet-close" onClick={onClose}>Cancel</button></motion.div>
  </motion.div>;
}
function Toast({message}){return <AnimatePresence>{message&&<motion.div className="toast" initial={{opacity:0,y:16}} animate={{opacity:1,y:0}} exit={{opacity:0,y:12}}>{message}</motion.div>}</AnimatePresence>;}

export default function App(){
  const [properties,setProperties]=useState([]);
  const [route,setRoute]=useState({view:'home'});
  const [mode,setModeState]=useState('movein');
  const [loading,setLoading]=useState(true);
  const [toastMessage,setToastMessage]=useState('');
  const [pdfReady,setPdfReady]=useState(null);
  const [addRoomOpen,setAddRoomOpen]=useState(false);
  const [installPrompt,setInstallPrompt]=useState(null);
  const standalone=window.matchMedia?.('(display-mode: standalone)').matches||window.navigator.standalone===true;

  const refresh=async()=>setProperties(await getAllProperties());
  useEffect(()=>{refresh().finally(()=>setLoading(false));},[]);
  useEffect(()=>{
    const onSettings=()=>setRoute({view:'settings'});
    const onInstall=e=>{e.preventDefault();setInstallPrompt(e);};
    window.addEventListener('flatstamp-settings',onSettings);
    window.addEventListener('beforeinstallprompt',onInstall);
    return()=>{window.removeEventListener('flatstamp-settings',onSettings);window.removeEventListener('beforeinstallprompt',onInstall);};
  },[]);
  const notify=msg=>{setToastMessage(msg);setTimeout(()=>setToastMessage(''),2300);};
  const selected=useMemo(()=>properties.find(p=>p.id===route.propertyId),[properties,route.propertyId]);
  const persist=async p=>{const next=clone(p);setProperties(prev=>prev.map(x=>x.id===next.id?next:x));await saveProperty(next);setProperties(prev=>prev.map(x=>x.id===next.id?next:x));};

  const create=async form=>{
    const p=newProperty(form);await saveProperty(p);await refresh();setModeState('movein');setRoute({view:'property',propertyId:p.id});
  };
  const openProperty=id=>{setModeState('movein');setRoute({view:'property',propertyId:id});};
  const openDemo=async()=>{
    let p=properties.find(x=>x.id===DEMO_ID);
    if(!p){p=demoProperty();await saveProperty(p);await refresh();}
    setModeState('movein');setRoute({view:'property',propertyId:DEMO_ID});
  };
  const remove=async()=>{
    if(!selected)return;
    if(!confirm(`Delete ${selected.name} and all of its locally stored photos?`))return;
    await deleteProperty(selected.id);await refresh();setRoute({view:'home'});notify('Property deleted');
  };
  const addRoom=async name=>{
    const p=clone(selected);p.rooms.push(makeRoom(name));await persist(p);setAddRoomOpen(false);notify('Room added');
  };
  const summaryText=(p,reportMode)=>{
    if(reportMode==='compare'){
      const s=comparisonStats(p);
      return `FlatStamp comparison — ${p.name}\n${p.address||''}\nMove-in: ${fmtDate(p.moveInDate)} · Move-out: ${fmtDate(p.moveOutDate)}\nChanged records: ${s.changed}; potentially worse: ${s.worse}; improved: ${s.improved}.\nGenerated with FlatStamp.`;
    }
    const c=completion(p,reportMode);
    return `FlatStamp ${modeLabel(reportMode)} report — ${p.name}\n${p.address||''}\nInspection date: ${reportMode==='movein'?fmtDate(p.moveInDate):fmtDate(p.moveOutDate)}\nDocumented checks: ${c.done}/${c.total}.\nGenerated with FlatStamp.`;
  };
  const shareSummary=async reportMode=>{
    if(!selected)return;
    const text=summaryText(selected,reportMode);
    try{
      if(navigator.share){await navigator.share({title:`FlatStamp — ${selected.name}`,text});return;}
      await navigator.clipboard.writeText(text);notify('Summary copied');
    }catch(err){if(err?.name!=='AbortError')notify('Sharing isn’t available here');}
  };
  const makePdf=async reportMode=>{
    if(!selected)return;
    notify('Creating PDF…');
    try{setPdfReady(await createFlatStampPdf(selected,reportMode));setToastMessage('');}
    catch(err){console.error(err);notify('Could not create PDF');}
  };
  const importBackup=async file=>{
    if(!file)return;
    try{
      const data=JSON.parse(await file.text());
      if(!Array.isArray(data.properties))throw new Error('Invalid backup');
      for(const p of data.properties)await saveProperty(p);
      await refresh();notify('Backup imported');setRoute({view:'home'});
    }catch{notify('Could not import backup');}
  };
  const installApp=async()=>{
    if(!installPrompt)return;
    await installPrompt.prompt();setInstallPrompt(null);
  };
  const back=()=>{
    if(route.view==='home')return;
    if(route.view==='property'||route.view==='create'||route.view==='settings')setRoute({view:'home'});
    else if(route.view==='room'||route.view==='report'||route.view==='compare')setRoute({view:'property',propertyId:route.propertyId});
  };

  if(loading)return <div className="app-loading"><Brand/><div className="loading-line"><span/></div></div>;

  let page;
  if(route.view==='home')page=<HomeView properties={properties} onCreate={()=>setRoute({view:'create'})} onOpen={openProperty} onDemo={openDemo} onSettings={()=>setRoute({view:'settings'})}/>;
  else if(route.view==='create')page=<CreateView onBack={back} onCreate={create}/>;
  else if(route.view==='settings')page=<SettingsView properties={properties} onBack={back} onDemo={openDemo} onImport={importBackup} installPrompt={installPrompt} installApp={installApp} standalone={standalone}/>;
  else if(!selected)page=<HomeView properties={properties} onCreate={()=>setRoute({view:'create'})} onOpen={openProperty} onDemo={openDemo} onSettings={()=>setRoute({view:'settings'})}/>;
  else if(route.view==='property')page=<PropertyView property={selected} mode={mode} setMode={setModeState} onBack={back} onRoom={roomId=>setRoute({view:'room',propertyId:selected.id,roomId})} onSave={persist} onCompare={()=>setRoute({view:'compare',propertyId:selected.id})} onReport={()=>setRoute({view:'report',propertyId:selected.id})} onPdf={()=>makePdf(mode)} onShare={()=>shareSummary(mode)} onDelete={remove} onAddRoom={()=>setAddRoomOpen(true)}/>;
  else if(route.view==='room')page=<RoomView property={selected} roomId={route.roomId} mode={mode} onBack={back} onSave={persist} toast={notify}/>;
  else if(route.view==='report')page=<ReportView property={selected} mode={mode} onBack={back} onPdf={()=>makePdf(mode)} onShare={()=>shareSummary(mode)}/>;
  else if(route.view==='compare')page=<CompareView property={selected} onBack={back} onPdf={()=>makePdf('compare')} onShare={()=>shareSummary('compare')}/>;

  return <div className="app-frame">
    <div className="ambient-stage" aria-hidden="true"><span className="ambient-orb a"/><span className="ambient-orb b"/><span className="ambient-grid"/></div>
    <AnimatePresence mode="wait">{React.cloneElement(page,{key:route.view+(route.propertyId||'')+(route.roomId||'')})}</AnimatePresence>
    <AnimatePresence>{pdfReady&&<PdfSheet data={pdfReady} onClose={()=>setPdfReady(null)}/>}</AnimatePresence>
    <AnimatePresence>{addRoomOpen&&<AddRoomSheet onClose={()=>setAddRoomOpen(false)} onAdd={addRoom}/>}</AnimatePresence>
    <Toast message={toastMessage}/>
  </div>;
}
