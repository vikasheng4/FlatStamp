import { jsPDF } from 'jspdf';
import { completion, comparisonStats, fmtDate, hasEntry, photoSrc, photoTime, reportId } from './data.js';

function ascii(value){
  return String(value??'')
    .replace(/[–—]/g,'-').replace(/·/g,' | ')
    .replace(/[“”]/g,'"').replace(/’/g,"'")
    .replace(/[^\x20-\x7E\n]/g,'?');
}
function safeName(value){
  return String(value||'report').trim().replace(/[^a-z0-9]+/gi,'-').replace(/^-+|-+$/g,'').toLowerCase()||'report';
}
async function imageData(src){
  if(!src)return '';
  if(src.startsWith('data:'))return src;
  const res=await fetch(src);if(!res.ok)throw new Error('Image unavailable');
  const blob=await res.blob();
  return await new Promise((resolve,reject)=>{
    const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(blob);
  });
}
export async function createFlatStampPdf(p,mode){
  const doc=new jsPDF({unit:'mm',format:'a4',compress:true});
  const M=15,W=180,BOTTOM=282;let y=15;
  const ensure=h=>{
    if(y+h>BOTTOM){
      doc.addPage();y=15;
      doc.setFont('helvetica','bold');doc.setFontSize(9);doc.setTextColor(11,111,103);
      doc.text('FlatStamp',M,y);y+=9;
    }
  };
  const text=(value,size=10,style='normal',color=[16,32,30],gap=2,maxW=W)=>{
    const v=ascii(value);if(!v)return;
    doc.setFont('helvetica',style);doc.setFontSize(size);doc.setTextColor(...color);
    const lines=doc.splitTextToSize(v,maxW);
    const h=lines.length*(size*.42+1.1);ensure(h+gap);
    doc.text(lines,M,y);y+=h+gap;
  };
  const section=value=>{
    ensure(14);y+=3;
    doc.setDrawColor(220,229,227);doc.line(M,y+6,M+W,y+6);
    doc.setFont('helvetica','bold');doc.setFontSize(13);doc.setTextColor(11,111,103);
    doc.text(ascii(value),M,y+4);y+=12;
  };
  const kv=(label,value)=>{
    ensure(14);
    doc.setFont('helvetica','bold');doc.setFontSize(7);doc.setTextColor(102,117,114);
    doc.text(ascii(label).toUpperCase(),M,y);y+=4;
    text(value||'-',9,'normal',[16,32,30],3);
  };
  const photos=async(arr,prefix='Photo')=>{
    const list=(arr||[]).filter(Boolean);if(!list.length)return;
    for(let i=0;i<list.length;i+=3){
      ensure(47);const row=list.slice(i,i+3),cw=56,g=6;
      for(let j=0;j<row.length;j++){
        try{
          const src=photoSrc(row[j]),data=await imageData(src);if(!data)continue;
          const x=M+j*(cw+g);
          doc.setFillColor(244,247,246);doc.rect(x,y,cw,35,'F');
          const format=data.startsWith('data:image/png')?'PNG':'JPEG';
          doc.addImage(data,format,x,y,cw,35,undefined,'FAST');
          doc.setFont('helvetica','normal');doc.setFontSize(6.5);doc.setTextColor(102,117,114);
          const ts=photoTime(row[j]);
          doc.text(ascii(prefix+' '+(i+j+1)+(ts?' | '+new Date(ts).toLocaleDateString():'')),x,y+39);
        }catch{}
      }
      y+=44;
    }
  };

  doc.setFont('helvetica','bold');doc.setFontSize(18);doc.setTextColor(11,111,103);doc.text('FlatStamp',M,y);y+=8;
  text(mode==='compare'?'MOVE-IN VS MOVE-OUT COMPARISON':(mode==='moveout'?'MOVE-OUT':'MOVE-IN')+' CONDITION REPORT',8,'bold',[102,117,114],4);
  text(p.name,20,'bold',[16,32,30],2);
  text(reportId(p,mode),7,'normal',[102,117,114],6);
  section('Property');
  kv('Address',p.address);kv('Tenant',p.tenant);kv('Owner / landlord',p.landlord);
  kv('Tenancy / furnishing',(p.tenancyType||'-')+' | '+(p.furnishing||'-'));

  if(mode==='compare'){
    const stats=comparisonStats(p),mi=completion(p,'movein'),mo=completion(p,'moveout');
    kv('Move-in',fmtDate(p.moveInDate)+' | '+mi.done+'/'+mi.total+' checks');
    kv('Move-out',fmtDate(p.moveOutDate||'')+' | '+mo.done+'/'+mo.total+' checks');
    kv('Comparison summary',stats.changed+' changed | '+stats.worse+' potentially worse | '+stats.improved+' improved');
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
        text('MOVE-IN | '+(item.movein.condition||'Not recorded'),8,'bold',[11,111,103],1);
        if(item.movein.note)text(item.movein.note,9,'normal',[16,32,30],2);
        await photos(item.movein.photos,'Move-in photo');
        text('MOVE-OUT | '+(item.moveout.condition||'Not recorded'),8,'bold',[161,92,0],1);
        if(item.moveout.note)text(item.moveout.note,9,'normal',[16,32,30],2);
        await photos(item.moveout.photos,'Move-out photo');y+=2;
      }
    }
    section('Important');
    text('A condition change is a comparison aid, not a legal conclusion. Review photos and notes alongside condition labels.',8,'normal',[66,81,77],2);
  }else{
    const meta=p.metaByMode[mode],c=completion(p,mode);
    kv('Inspection date',mode==='movein'?fmtDate(p.moveInDate):fmtDate(p.moveOutDate||''));
    kv('Documented checks',c.done+'/'+c.total);
    section('Property evidence');
    kv('Electricity meter',meta.meters.electricity);kv('Water meter',meta.meters.water);kv('Gas meter',meta.meters.gas);
    kv('Furniture / appliance inventory',meta.inventoryNotes);kv('Keys / access cards',meta.keys);
    for(const room of p.rooms){
      const items=room.items.filter(i=>hasEntry(i[mode]));if(!items.length)continue;
      section(room.name);
      for(const item of items){
        const e=item[mode];
        text(item.label,12,'bold',[16,32,30],1);
        text(e.condition||'Not recorded',8,'bold',e.condition==='Good'?[21,115,71]:[161,92,0],1);
        if(e.note)text(e.note,9,'normal',[16,32,30],2);
        await photos(e.photos,'Photo');y+=2;
      }
    }
    section('Important');
    text('FlatStamp organizes locally stored condition records. It does not independently prove authenticity, provide legal advice, or guarantee the outcome of a deposit or tenancy dispute.',8,'normal',[66,81,77],2);
  }
  const filename='flatstamp-'+safeName(p.name)+'-'+(mode==='compare'?'comparison':mode)+'.pdf';
  return {blob:doc.output('blob'),filename};
}
