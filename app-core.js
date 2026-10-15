/* ============================================================
   Core: storage, state, helpers, charts, insights
   ============================================================ */

/* ---------- storage with graceful fallback ---------- */
const Store = (() => {
  const KEY = 'menocompass.v1';
  let mem = null, usingMemory = false;
  function probe(){
    try{
      const t='__mc_t__'; localStorage.setItem(t,'1'); localStorage.removeItem(t); return true;
    }catch(e){ return false; }
  }
  const ok = probe();
  if(!ok) usingMemory = true;
  return {
    get ephemeral(){ return usingMemory; },
    read(){
      if(usingMemory) return mem;
      try{ const s = localStorage.getItem(KEY); return s ? JSON.parse(s) : null; }
      catch(e){ usingMemory = true; return mem; }
    },
    write(obj){
      if(usingMemory){ mem = obj; return true; }
      try{ localStorage.setItem(KEY, JSON.stringify(obj)); return true; }
      catch(e){ usingMemory = true; mem = obj; return false; }
    },
    clear(){ mem=null; try{ localStorage.removeItem(KEY); }catch(e){} }
  };
})();

/* ---------- defaults & schema ---------- */
const SCHEMA_V = 1;
function blankDB(){
  return {
    v: SCHEMA_V,
    profile:{
      name:'', birthYear:null, region:'us', units:'imperial',
      lastPeriod:'', uterus:'unknown', ovaries:'unknown', surgeryDate:'', bone:'unknown',
      proteinGpk:1.2, weightGoal:null, waistGoal:null,
      theme:'auto', stage:null, stageAnswers:null, onboarded:false
    },
    entries:{}, screening:{}, scores:[], trigger:null,
    meta:{created:todayISO(), lastOpen:todayISO()}
  };
}
let DB = null;

function load(){
  const raw = Store.read();
  try{ DB = raw && typeof raw==='object' ? migrate(raw) : blankDB(); }catch(e){ DB=blankDB(); }
  DB.meta = DB.meta || {}; DB.meta.lastOpen = todayISO();
}
function backupRecord(v){ return v!==null && typeof v==='object' && !Array.isArray(v); }
function backupText(v,n){ return typeof v==='string'?v.slice(0,n):''; }
function backupNumber(v,min,max){ return typeof v==='number' && Number.isFinite(v) && v>=min && v<=max?v:null; }
function backupDate(v){
  if(typeof v!=='string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return '';
  const date=new Date(v+'T00:00:00Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0,10)===v?v:'';
}
function backupEnum(v,values,fallback){ return values.includes(v)?v:fallback; }
function safeStageAnswers(raw){
  if(!backupRecord(raw)) return null;
  const answers={};
  STAGE_Q.forEach(q=>{ if(q.a.some(option=>option.v===raw[q.id])) answers[q.id]=raw[q.id]; });
  return stageQueue(answers).every(q=>Object.hasOwn(answers,q.id))?answers:null;
}
function migrate(d){
  if(!backupRecord(d) || d.v!==SCHEMA_V || !backupRecord(d.entries)) throw new Error('Invalid backup schema');
  const out=blankDB(), raw=backupRecord(d.profile)?d.profile:{}, p=out.profile;
  p.name=backupText(raw.name,160);
  p.birthYear=backupNumber(raw.birthYear,1900,new Date().getFullYear());
  p.region=backupEnum(raw.region,['us','uk','other'],'us');
  p.units=backupEnum(raw.units,['imperial','metric'],'imperial');
  p.lastPeriod=backupDate(raw.lastPeriod); p.surgeryDate=backupDate(raw.surgeryDate);
  p.uterus=backupEnum(raw.uterus,['unknown','intact','hyst','ablation'],'unknown');
  p.ovaries=backupEnum(raw.ovaries,['unknown','kept','one','both'],'unknown');
  const legacy={intact:{uterus:'intact',ovaries:'kept'},hyst:{uterus:'hyst',ovaries:'unknown'},oophor:{uterus:'intact',ovaries:'both'},both:{uterus:'hyst',ovaries:'both'}};
  if(raw.ovaries==null && Object.hasOwn(legacy,raw.uterus)) Object.assign(p,legacy[raw.uterus]);
  p.bone=backupEnum(raw.bone,['unknown','normal','osteopenia','osteoporosis','fracture'],'unknown');
  p.proteinGpk=backupEnum(raw.proteinGpk,[1,1.2,1.4,1.6],1.2);
  p.weightGoal=backupNumber(raw.weightGoal,0,1000); p.waistGoal=backupNumber(raw.waistGoal,0,1000);
  p.theme=backupEnum(raw.theme,['auto','light','dark'],'auto'); p.onboarded=raw.onboarded===true;
  // Never restore executable presentation HTML. Recreate it from validated answers.
  p.stageAnswers=safeStageAnswers(raw.stageAnswers);
  p.stage=p.stageAnswers?stageResult(p.stageAnswers).label:null;
  Object.keys(d.entries).filter(backupDate).sort().slice(-10000).forEach(date=>{
    const rawEntry=d.entries[date]; if(!backupRecord(rawEntry)) return;
    const e={sym:{},act:{},nut:{}};
    ['hf','ns','inBedH','sleepH','wt','waist'].forEach(k=>{ const n=backupNumber(rawEntry[k],0,10000); if(n!==null)e[k]=n; });
    e.bleed=backupEnum(rawEntry.bleed,['none','spotting','light','moderate','heavy'],'');
    e.notes=backupText(rawEntry.notes,10000);
    const sym=backupRecord(rawEntry.sym)?rawEntry.sym:{};
    SYMS.forEach(s=>{const n=backupNumber(sym[s.k],0,4);if(n!==null)e.sym[s.k]=n;});
    const act=backupRecord(rawEntry.act)?rawEntry.act:{},nut=backupRecord(rawEntry.nut)?rawEntry.nut:{};
    ['res','bal','pf'].forEach(k=>{if(typeof act[k]==='boolean')e.act[k]=act[k];});
    const aero=backupNumber(act.aero,0,1440);if(aero!==null)e.act.aero=aero;
    ['prot','cal','fib'].forEach(k=>{if(typeof nut[k]==='boolean')e.nut[k]=nut[k];});
    ['alc','caf'].forEach(k=>{const n=backupNumber(nut[k],0,1000);if(n!==null)e.nut[k]=n;});
    out.entries[date]=e;
  });
  if(backupRecord(d.screening)) SCREENING.forEach(s=>{const raw=d.screening[s.id];if(backupRecord(raw)&&backupDate(raw.last))out.screening[s.id]={last:backupDate(raw.last)};});
  if(Array.isArray(d.scores)) out.scores=d.scores.filter(s=>backupRecord(s)&&backupDate(s.date)&&['phq9','gad7'].includes(s.type)&&backupNumber(s.score,0,27)!==null).slice(-1000).map(s=>({date:s.date,type:s.type,score:s.score,band:backupText(s.band,80)}));
  if(backupRecord(d.trigger)&&backupDate(d.trigger.start))out.trigger={active:d.trigger.active===true,item:backupText(d.trigger.item,160),start:d.trigger.start};
  if(backupRecord(d.meta))out.meta={created:backupDate(d.meta.created)||todayISO(),lastOpen:backupDate(d.meta.lastOpen)||todayISO()};
  return out;
}
let saveTimer=null, dirty=false;
function save(now){
  if(now){ clearTimeout(saveTimer); dirty=false; Store.write(DB); return; }
  dirty = true;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(()=>{ dirty=false; Store.write(DB); }, 250);
}
/* Flush only a pending debounced write. Deliberately does NOT write
   unconditionally on unload — that would let a stale tab overwrite
   changes made in another tab. */
function flush(){
  if(dirty){ clearTimeout(saveTimer); dirty=false; Store.write(DB); }
}

/* ---------- date helpers ---------- */
function todayISO(){ const d=new Date(); return iso(d); }
function iso(d){
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}
function parseISO(s){ const [y,m,d]=s.split('-').map(Number); return new Date(y,m-1,d); }
function addDays(s,n){ const d=parseISO(s); d.setDate(d.getDate()+n); return iso(d); }
function daysBetween(a,b){ return Math.round((parseISO(b)-parseISO(a))/86400000); }
function fmtDay(s){
  const d=parseISO(s), t=todayISO();
  if(s===t) return 'Today';
  if(s===addDays(t,-1)) return 'Yesterday';
  return d.toLocaleDateString(undefined,{weekday:'short', month:'short', day:'numeric'});
}
function fmtLong(s){ return parseISO(s).toLocaleDateString(undefined,{weekday:'long', month:'long', day:'numeric', year:'numeric'}); }
const DOW=['S','M','T','W','T','F','S'];

/* ---------- units ---------- */
const U = {
  get imp(){ return DB.profile.units==='imperial'; },
  wLabel(){ return this.imp?'lb':'kg'; },
  lLabel(){ return this.imp?'in':'cm'; },
  wOut(kg){ if(kg==null) return null; return this.imp ? kg*2.20462 : kg; },
  wIn(v){ if(v==null||v==='') return null; return this.imp ? v/2.20462 : +v; },
  lOut(cm){ if(cm==null) return null; return this.imp ? cm/2.54 : cm; },
  lIn(v){ if(v==null||v==='') return null; return this.imp ? v*2.54 : +v; }
};
const r1 = v => v==null?null:Math.round(v*10)/10;

/* ---------- what the profile implies ----------
   Uterus and ovaries are independent: a hysterectomy can leave both ovaries,
   and both ovaries can be removed with the uterus left in place. */
function hasUterus(){ return DB.profile.uterus!=='hyst'; }
function periodsPossible(){
  return DB.profile.uterus!=='hyst' && DB.profile.uterus!=='ablation'
      && DB.profile.ovaries!=='both';
}
function surgicalMenopause(){ return DB.profile.ovaries==='both'; }
const esc = s => String(s==null?'':s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

/* ---------- entries ---------- */
const SYMS = [
  {k:'sleepq', n:'Sleep quality', inv:true},
  {k:'mood',   n:'Low mood'},
  {k:'anx',    n:'Anxiety / irritability'},
  {k:'fog',    n:'Brain fog'},
  {k:'joint',  n:'Joint or muscle ache'},
  {k:'dry',    n:'Vaginal dryness / discomfort'},
  {k:'uri',    n:'Bladder symptoms'},
  {k:'energy', n:'Fatigue'},
  {k:'head',   n:'Headache'},
  {k:'palp',   n:'Palpitations'},
  {k:'itch',   n:'Skin dryness / itch'},
  {k:'libido', n:'Low libido'}
];
const SCALE4 = ['None','Mild','Moderate','Severe','Very severe'];

function entry(d){
  if(!DB.entries[d]) DB.entries[d] = {sym:{}, act:{}, nut:{}};
  const e = DB.entries[d];
  e.sym = e.sym||{}; e.act = e.act||{}; e.nut = e.nut||{};
  return e;
}
function hasData(d){
  const e = DB.entries[d]; if(!e) return false;
  if(e.hf!=null||e.ns!=null||e.wt!=null||e.waist!=null||e.bleed||e.notes) return true;
  if(Object.keys(e.sym||{}).length) return true;
  if(e.sleepH!=null||e.inBedH!=null) return true;
  if(Object.keys(e.act||{}).length||Object.keys(e.nut||{}).length) return true;
  return false;
}
function entryDates(){ return Object.keys(DB.entries).filter(hasData).sort(); }
function rangeDates(n){
  const out=[]; const t=todayISO();
  for(let i=n-1;i>=0;i--) out.push(addDays(t,-i));
  return out;
}
function series(days, fn){
  return days.map(d=>{ const e=DB.entries[d]; return {d, v: e? fn(e) : null}; });
}
function movingAvg(arr, w){
  return arr.map((p,i)=>{
    const s=arr.slice(Math.max(0,i-w+1), i+1).filter(x=>x.v!=null).map(x=>x.v);
    return {d:p.d, v: s.length? s.reduce((a,b)=>a+b,0)/s.length : null};
  });
}
function avg(nums){ const a=nums.filter(v=>v!=null && !isNaN(v)); return a.length? a.reduce((x,y)=>x+y,0)/a.length : null; }
function sum(nums){ return nums.filter(v=>v!=null).reduce((x,y)=>x+y,0); }

/* ---------- symptom burden score ----------
   11 tracked items on the same 0-4 per-symptom structure the Menopause
   Rating Scale uses, scaled to 0-44. Deliberately NOT banded into
   severity categories: this is not the MRS item set (it excludes hot
   flashes and sleep, and adds brain fog, headache and itch), and no
   validated cut-off exists for it. It is a direction-over-time measure.
   Requires most items answered so a partial day can't read as severe. */
const BURDEN_KEYS = ['mood','anx','fog','joint','dry','uri','energy','head','palp','itch','libido'];
const BURDEN_MIN_ITEMS = 8;
function burden(e){
  if(!e||!e.sym) return null;
  const vals = BURDEN_KEYS.map(k=>e.sym[k]).filter(v=>v!=null);
  if(vals.length < BURDEN_MIN_ITEMS) return null;
  const scaled = sum(vals) / vals.length * BURDEN_KEYS.length;
  return Math.round(scaled*10)/10;
}

/* ---------- SVG charts (no dependencies) ---------- */
function lineChart(points, opt){
  opt = opt||{};
  const W=320, H=opt.h||120, PL=30, PR=6, PT=8, PB=18;
  const vals = points.filter(p=>p.v!=null).map(p=>p.v);
  if(vals.length<1) return emptyChart(opt.empty||'No data yet');
  let min = opt.min!=null?opt.min:Math.min(...vals);
  let max = opt.max!=null?opt.max:Math.max(...vals);
  if(min===max){ min-=1; max+=1; }
  const pad=(max-min)*0.12; min-=pad; max+=pad;
  if(opt.min0 && min>0) min=0;
  const x = i => PL + (W-PL-PR) * (points.length<2?0.5:i/(points.length-1));
  const y = v => PT + (H-PT-PB) * (1-(v-min)/(max-min));
  let path='', area='', started=false, lastX=null;
  points.forEach((p,i)=>{
    if(p.v==null) return;
    const cmd = started?'L':'M';
    path += cmd + x(i).toFixed(1) + ' ' + y(p.v).toFixed(1) + ' ';
    if(!started){ area += 'M' + x(i).toFixed(1) + ' ' + y(p.v).toFixed(1) + ' '; started=true; }
    else area += 'L' + x(i).toFixed(1) + ' ' + y(p.v).toFixed(1) + ' ';
    lastX = x(i);
  });
  if(started && opt.area) area += 'L'+lastX.toFixed(1)+' '+(H-PB)+' L'+x(points.findIndex(p=>p.v!=null)).toFixed(1)+' '+(H-PB)+' Z';
  const ticks = [max, (max+min)/2, min];
  let g='';
  ticks.forEach(t=>{ g += '<line class="grid" x1="'+PL+'" x2="'+(W-PR)+'" y1="'+y(t).toFixed(1)+'" y2="'+y(t).toFixed(1)+'"/>'
    + '<text class="axis" x="'+(PL-4)+'" y="'+(y(t)+3).toFixed(1)+'" text-anchor="end">'+(Math.round(t*10)/10)+'</text>'; });
  let ml='';
  if(opt.ma){
    const ma = movingAvg(points, opt.ma);
    let p2='', st=false;
    ma.forEach((p,i)=>{ if(p.v==null) return; p2 += (st?'L':'M')+x(i).toFixed(1)+' '+y(p.v).toFixed(1)+' '; st=true; });
    if(st) ml = '<path class="ln2" d="'+p2+'"/>';
  }
  const lastIdx = points.map(p=>p.v).reduce((acc,v,i)=>v!=null?i:acc,-1);
  const dot = lastIdx>=0 ? '<circle class="dot" cx="'+x(lastIdx).toFixed(1)+'" cy="'+y(points[lastIdx].v).toFixed(1)+'" r="3.4"/>' : '';
  const labels = '<text class="axis" x="'+PL+'" y="'+(H-4)+'">'+shortD(points[0].d)+'</text>'
    + '<text class="axis" x="'+(W-PR)+'" y="'+(H-4)+'" text-anchor="end">'+shortD(points[points.length-1].d)+'</text>';
  return '<svg class="chart" viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="none" role="img" aria-label="'+esc(opt.label||'trend chart')+'">'
    + g + (opt.area?'<path class="ar" d="'+area+'"/>':'') + '<path class="ln" d="'+path+'"/>' + ml + dot + labels + '</svg>';
}
function barChart(points, opt){
  opt=opt||{};
  const W=320, H=opt.h||110, PL=26, PR=6, PT=8, PB=18;
  const vals = points.filter(p=>p.v!=null).map(p=>p.v);
  if(!vals.length) return emptyChart(opt.empty||'No data yet');
  const max = Math.max(opt.min1?1:0, ...vals) * 1.15 || 1;
  const bw = (W-PL-PR)/points.length;
  const y = v => PT + (H-PT-PB)*(1-v/max);
  let bars='';
  points.forEach((p,i)=>{
    if(p.v==null || p.v===0){ return; }
    const h = (H-PB) - y(p.v);
    bars += '<rect class="bar" x="'+(PL+i*bw+bw*0.15).toFixed(1)+'" y="'+y(p.v).toFixed(1)+'" width="'+(bw*0.7).toFixed(1)+'" height="'+Math.max(1,h).toFixed(1)+'" rx="1.5"/>';
  });
  let g='';
  [max, max/2].forEach(t=>{ g += '<line class="grid" x1="'+PL+'" x2="'+(W-PR)+'" y1="'+y(t).toFixed(1)+'" y2="'+y(t).toFixed(1)+'"/>'
    + '<text class="axis" x="'+(PL-4)+'" y="'+(y(t)+3).toFixed(1)+'" text-anchor="end">'+Math.round(t)+'</text>'; });
  const labels = '<text class="axis" x="'+PL+'" y="'+(H-4)+'">'+shortD(points[0].d)+'</text>'
    + '<text class="axis" x="'+(W-PR)+'" y="'+(H-4)+'" text-anchor="end">'+shortD(points[points.length-1].d)+'</text>';
  return '<svg class="chart" viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="none" role="img" aria-label="'+esc(opt.label||'bar chart')+'">'+g+bars+labels+'</svg>';
}
function emptyChart(msg){
  return '<div class="empty tiny" style="padding:26px 10px">'+esc(msg)+'</div>';
}
function shortD(s){ const d=parseISO(s); return (d.getMonth()+1)+'/'+d.getDate(); }

/* ---------- insights engine ---------- */
function insights(){
  const out = [];
  const d30 = rangeDates(30), d14 = rangeDates(14), d7 = rangeDates(7);
  const dates = entryDates();
  const nLogged = dates.length;

  /* --- red flag: postmenopausal bleeding --- */
  const bleeds = dates.filter(d=>{ const b=DB.entries[d].bleed; return b && b!=='none'; });
  /* Check EVERY logged bleed against the gap before it, not just the most
     recent one — an event that followed 12+ months of amenorrhoea still needs
     evaluation even if there has been bleeding since. */
  if(bleeds.length){
    let flagged = null;
    for(let i=0;i<bleeds.length;i++){
      const prevRef = i>0 ? bleeds[i-1] : (DB.profile.lastPeriod || null);
      if(!prevRef) continue;
      const gap = daysBetween(prevRef, bleeds[i]);
      if(gap>=365) flagged = {d:bleeds[i], gap};
    }
    if(!hasUterus() && bleeds.length){
      const last = bleeds[bleeds.length-1];
      out.push({t:'alert', h:'You logged bleeding, and you have had a hysterectomy',
        b:'Bleeding on '+fmtDay(last)+'. After the uterus has been removed, vaginal bleeding is unexpected — it is usually something minor such as fragile vaginal tissue, which is common after menopause and very treatable, but it should be looked at rather than watched. Please mention it to a clinician.',
        cta:{l:'Red flags', go:'redflags'}});
      flagged = null;
    }
    if(flagged && daysBetween(flagged.d, todayISO()) <= 400){
      const since = daysBetween(flagged.d, todayISO());
      out.push({t:'alert', h:'Bleeding after 12+ months without a period',
        b:'You logged bleeding on '+fmtDay(flagged.d)+' — about '+Math.floor(flagged.gap/30)+' months after the previous one. Any bleeding 12 months or more after your last period needs prompt evaluation: around <b>90% of women with endometrial cancer present with postmenopausal bleeding</b>.'
          + (since>30 ? ' That was '+Math.floor(since/30)+' months ago — if it has not been looked at, please book an appointment.' : ' Please book an appointment.')
          + ' ACOG narrowed its guidance in April 2026: most patients should now have both an ultrasound <i>and</i> endometrial tissue sampling, because thickness alone misses higher-grade cancers.',
        cta:{l:'Read why', go:'redflags'}});
    }
  }
  /* --- amenorrhea counter --- */
  /* Counting months of amenorrhoea only means something if a period was
     possible in the first place. */
  if(surgicalMenopause()){
    out.push({t:'info', h:'You are postmenopausal — the count of months since a period does not apply',
      b:'Both ovaries removed means menopause happened at the operation, so this app will not try to date it from bleeding. What is worth attention instead: hormone therapy at least until around age 52 unless there is a reason not to, bone protection, and cardiovascular risk factors. Vaginal and urinary symptoms are the ones that get worse rather than better if left alone.',
      cta:{l:'Your stage', go:'learn:stage'}});
  } else if(!periodsPossible()){
    out.push({t:'info', h:'Your bleeding pattern cannot stage you — that is expected',
      b:(DB.profile.uterus==='hyst'
          ? 'After a hysterectomy there is no bleeding pattern to read, but if your ovaries were left they carry on working — so this may well not be menopause yet.'
          : 'After an endometrial ablation, periods stop or become very light, so the bleeding criterion is unavailable. Your ovaries are unaffected.')
        + ' Symptom trends are your best evidence, which is what the tracking here is for.',
      cta:{l:'What this means', go:'learn:stage'}});
  }
  const lastBleed = (bleeds.length ? bleeds[bleeds.length-1] : (DB.profile.lastPeriod||null));
  if(lastBleed && periodsPossible()){
    const g = daysBetween(lastBleed, todayISO());
    if(g>=60 && g<365){
      out.push({t:'info', h:Math.floor(g/30)+' months since your last logged period',
        b:'Gaps of 60 days or more put you in the late menopausal transition, which typically runs 1–3 years. This is also when hot flashes are most likely to start or intensify. At 12 months without a period, menopause is confirmed retrospectively — and from that point any bleeding needs checking.'});
    } else if(g>=365){
      out.push({t:'ok', h:'Menopause confirmed: '+Math.floor(g/365)+'+ '+(g>=730?'years':'year')+' since your last period',
        b:'From here, hot flashes tend to ease for most women. Vaginal and urinary symptoms are the ones that get worse if left alone — they are also very treatable.'});
    }
  }

  /* --- mood streak --- */
  const moodVals = d14.map(d=>DB.entries[d]&&DB.entries[d].sym?DB.entries[d].sym.mood:null).filter(v=>v!=null);
  if(moodVals.length>=7){
    const high = moodVals.filter(v=>v>=3).length;
    if(high >= Math.ceil(moodVals.length*0.6)){
      out.push({t:'alert', h:'Low mood on most of the last two weeks',
        b:'You have logged moderate or worse low mood on '+high+' of '+moodVals.length+' recorded days. Perimenopause carries about 40% higher odds of depression than premenopause. This is worth raising with a clinician rather than waiting out — the PHQ-9 in Tools will give you a number to bring.',
        cta:{l:'Take the PHQ-9', go:'tool:phq9'}});
    }
  }

  /* --- VMS trend --- */
  const hf30 = series(d30, e=>e.hf);
  const hfLogged = hf30.filter(p=>p.v!=null);
  if(hfLogged.length>=8){
    const half = Math.floor(hfLogged.length/2);
    const a = avg(hfLogged.slice(0,half).map(p=>p.v)), b = avg(hfLogged.slice(half).map(p=>p.v));
    const delta = b-a;
    if(Math.abs(delta) >= Math.max(1, a*0.2)){
      out.push({t: delta<0?'ok':'info', h:'Hot flashes are '+(delta<0?'down':'up')+' about '+Math.abs(Math.round(delta*10)/10)+' a day',
        b:'Comparing the first and second half of your logged days this month: '+r1(a)+' per day → '+r1(b)+' per day. Day-to-day counts are noisy, so read the direction rather than any single day.'});
    }
  }

  /* --- alcohol association (personal pattern, honestly labelled) --- */
  const pairs = [];
  d30.forEach(d=>{
    const e=DB.entries[d], nx=DB.entries[addDays(d,1)];
    if(e && nx && e.nut && e.nut.alc!=null && nx.hf!=null) pairs.push({alc:e.nut.alc, hf:nx.hf, sq: nx.sym?nx.sym.sleepq:null});
  });
  if(pairs.length>=10){
    const withA = pairs.filter(p=>p.alc>0), without = pairs.filter(p=>p.alc===0);
    if(withA.length>=4 && without.length>=4){
      const a=avg(withA.map(p=>p.hf)), b=avg(without.map(p=>p.hf));
      if(a!=null && b!=null && Math.abs(a-b) >= 1){
        out.push({t:'info', h:'A personal pattern worth testing properly',
          b:'On days after you logged alcohol, you recorded '+r1(a)+' hot flashes on average, versus '+r1(b)+' after alcohol-free days ('+withA.length+' vs '+without.length+' days). <b>This is your own pattern, not proof of cause</b> — trigger-avoidance has never been shown to work as a treatment in trials, and plenty of other things differ between those days. The 2-week trigger test is a fairer way to check it.',
          cta:{l:'Run a trigger test', go:'tool:trigger'}});
      }
    }
  }

  /* --- sleep vs night sweats --- */
  const nsPairs = d30.map(d=>DB.entries[d]).filter(e=>e&&e.ns!=null&&e.sym&&e.sym.sleepq!=null);
  if(nsPairs.length>=10){
    const hi = nsPairs.filter(e=>e.ns>=2), lo = nsPairs.filter(e=>e.ns<=1);
    if(hi.length>=4 && lo.length>=4){
      const a=avg(hi.map(e=>e.sym.sleepq)), b=avg(lo.map(e=>e.sym.sleepq));
      if(a!=null&&b!=null&&(a-b)>=0.7){
        out.push({t:'info', h:'Your worst sleep tracks with night sweats',
          b:'Sleep quality averaged '+r1(a)+'/4 on nights with moderate-or-worse sweats versus '+r1(b)+'/4 without. That pattern points to treating the vasomotor symptoms rather than the insomnia — a different first move than if you were lying awake dry and wired.',
          cta:{l:'Sleep triage', go:'learn:sleep'}});
      }
    }
  }

  /* --- resistance training --- */
  const res7 = d7.filter(d=>DB.entries[d]&&DB.entries[d].act&&DB.entries[d].act.res).length;
  const res28 = rangeDates(28).filter(d=>DB.entries[d]&&DB.entries[d].act&&DB.entries[d].act.res).length;
  if(nLogged>=7){
    if(res28===0){
      out.push({t:'warn', h:'No strength sessions logged in four weeks',
        b:'This is the highest-leverage gap in the whole app. Resistance training is the intervention that most reliably adds lean mass in postmenopausal women (+0.90 kg across 101 trials; combined training +0.68 kg), and lean mass is what holds up your metabolism, your bone and your independence. Two sessions a week is the target; even one is not nothing.',
        cta:{l:'Starter programme', go:'learn:exercise'}});
    } else {
      const perWk = res28/4;
      out.push({t: perWk>=2?'ok':'info', h:'Strength training: '+r1(perWk)+' sessions a week',
        b: perWk>=2 ? 'You are at or above the guideline of two sessions a week covering all major muscle groups. Three beat two for grip strength in trials of older adults with sarcopenia — worth a look if you want more.'
                    : 'The target is two a week, covering all major muscle groups. You are averaging '+r1(perWk)+'. Adding one session is a smaller change than it sounds.'});
    }
  }
  /* --- aerobic minutes --- */
  const aero7 = sum(d7.map(d=>{const e=DB.entries[d]; return e&&e.act?e.act.aero:null;}));
  if(nLogged>=5 && aero7!=null){
    out.push({t: aero7>=150?'ok':'info', h:aero7+' minutes of aerobic activity this week',
      b: aero7>=150 ? 'At or above the 150-minute guideline. Aerobic work is what moved waist circumference most in the trials (−2.30 cm), while resistance work moved lean mass.'
                    : 'The guideline is 150–300 minutes a week of moderate activity. You are at '+aero7+'. Walking counts.'});
  }

  /* --- weight trend --- */
  const wt = series(rangeDates(56), e=>e.wt).filter(p=>p.v!=null);
  if(wt.length>=6){
    const first = avg(wt.slice(0,3).map(p=>p.v)), last = avg(wt.slice(-3).map(p=>p.v));
    const span = daysBetween(wt[0].d, wt[wt.length-1].d) || 1;
    const perWk = (last-first)/span*7;
    const dir = perWk>0.05?'up':(perWk<-0.05?'down':'steady');
    const disp = v => r1(U.wOut(Math.abs(v)))+' '+U.wLabel();
    if(dir==='steady'){
      out.push({t:'info', h:'Weight is steady — check your waist too',
        b:'The scale can stay flat while body composition shifts. MRI studies found significant visceral fat gain <b>despite no change in weight or waist</b>. Waist circumference is the better single number here, and it responds to diet and exercise with or without weight loss.'});
    } else {
      const fast = Math.abs(perWk) > 1;
      out.push({t: dir==='down'&&!fast?'ok':'info', h:'Weight trending '+dir+' about '+disp(perWk)+' a week',
        b: dir==='down'
          ? (fast ? 'That is faster than the 0.5–1 kg (1–2 lb) a week that predicts better maintenance. In midlife the specific risk of fast loss is lean tissue: even protein distribution at 1.2 g/kg or more went with a lower lean share of the loss — about 26% rather than 34%. Keep the protein and the strength sessions.'
                  : 'That sits in the range associated with better long-term maintenance. A 5% total loss already improves blood pressure, lipids and glucose.')
          : 'Midlife weight gain averages about 1.5 lb a year and tracks ageing more than menopause. What tracks menopause is where the fat goes — which is why waist matters.'});
    }
  }
  /* --- waist --- */
  const wa = series(rangeDates(120), e=>e.waist).filter(p=>p.v!=null);
  if(wa.length>=2){
    const d = wa[wa.length-1].v - wa[0].v;
    if(Math.abs(d)>=1.5){
      out.push({t: d<0?'ok':'warn', h:'Waist '+(d<0?'down':'up')+' '+r1(Math.abs(U.lOut(d)))+' '+U.lLabel()+' since you started logging',
        b:'Waist circumference is arguably the single most useful measurement here — when waist and BMI are modelled together, waist stays predictive of mortality while BMI becomes unrelated. Measure at the same landmark each time; self-measurement typically underestimates by 1–3 cm, which is fine when you are tracking change.'});
    }
    const cur = wa[wa.length-1].v;
    if(cur>=90){
      out.push({t:'info', h:'Waist is above the 90 cm mark',
        b:'For women, thresholds are 80 cm at normal weight and 90 cm at overweight (ethnicity-specific cut-points differ — 80 cm for Chinese and Asian Indian women, 90 cm for Japanese women). Above these, waist reduction is worth targeting directly. Aerobic work moved it most in trials.'});
    }
  }

  /* --- protein --- */
  const prot28 = rangeDates(28).map(d=>DB.entries[d]).filter(e=>e&&e.nut&&e.nut.prot!=null);
  if(prot28.length>=7){
    const met = prot28.filter(e=>e.nut.prot).length;
    const pct = Math.round(met/prot28.length*100);
    out.push({t: pct>=70?'ok':'info', h:'Protein target met on '+pct+'% of logged days',
      b: pct>=70 ? 'Good. The per-meal amount matters too after about 60 — roughly 30 g per sitting, spread evenly rather than loaded into dinner.'
                 : 'Spreading protein evenly (roughly 30/30/30 g) produced more muscle protein synthesis over 24 hours than skewing it (10/20/60 g). Breakfast is usually the meal that is short.',
      cta:{l:'Protein calculator', go:'tool:protein'}});
  }
  /* --- alcohol --- */
  const alc28 = rangeDates(28).map(d=>DB.entries[d]).filter(e=>e&&e.nut&&e.nut.alc!=null);
  if(alc28.length>=10){
    const total = sum(alc28.map(e=>e.nut.alc));
    const perDay = total/alc28.length;
    if(perDay>=1){
      out.push({t:'warn', h:'Averaging '+r1(perDay)+' drinks a day on logged days',
        b:'The honest reason to cut back is breast cancer risk, not hot flashes. Pooled relative risk runs 1.10 at one drink a day and 1.18 at two, with no safe threshold. For scale: 4–6 units a day adds about 8 extra breast cancers per 1,000 women aged 50–59 over five years — the same order as combined hormone therapy. US dietary guidance published in January 2026 moved from advising moderation to advising people to drink less.'});
    }
  }
  /* --- pelvic floor --- */
  const dryDays = rangeDates(28).map(d=>DB.entries[d]).filter(e=>e&&e.sym&&(e.sym.dry>=2||e.sym.uri>=2));
  if(dryDays.length>=5){
    out.push({t:'warn', h:'Vaginal or bladder symptoms are showing up regularly',
      b:'Logged at moderate or worse on '+dryDays.length+' days in the last four weeks. Unlike hot flashes, these are <b>progressive</b> — they get worse rather than better if left alone, and they respond well to treatment. Low-dose vaginal oestrogen is a Strong Recommendation in the 2025 guideline, needs no progestogen, and does not raise endometrial cancer risk.',
      cta:{l:'Read the options', go:'learn:sex'}});
  }
  const pf28 = rangeDates(28).filter(d=>DB.entries[d]&&DB.entries[d].act&&DB.entries[d].act.pf).length;
  if(dryDays.length>=3 && pf28<8){
    out.push({t:'info', h:'Pelvic floor training is the best-evidenced thing you can do yourself',
      b:'Cochrane review of 31 trials: stress incontinence cured in 56% versus 6% of controls; cured or improved in 74% versus 11%. The catch is technique — many women contract incorrectly on the first attempt, which is why being taught beats guessing.',
      cta:{l:'How to do it', go:'learn:exercise'}});
  }
  /* --- OSA screen prompt --- */
  const badSleep = rangeDates(21).map(d=>DB.entries[d]).filter(e=>e&&e.sym&&e.sym.sleepq>=3);
  const lowNS = rangeDates(21).map(d=>DB.entries[d]).filter(e=>e&&e.ns!=null&&e.ns<=1);
  if(badSleep.length>=8 && lowNS.length>=badSleep.length*0.6){
    out.push({t:'warn', h:'Bad sleep, but not much night sweating',
      b:'You are logging poor sleep frequently without heavy night sweats. That pattern points away from vasomotor fragmentation and toward insomnia — or sleep apnea, which affects <b>20% of midlife women</b> versus 4% of younger women and is badly underdiagnosed, because women present with insomnia and fatigue rather than loud snoring. CBT-I is first line for insomnia; if it does not work, that is itself a reason to be tested.',
      cta:{l:'Sleep module', go:'learn:sleep'}});
  }
  /* --- burden trend --- */
  const bd = series(d30, burden).filter(p=>p.v!=null);
  if(bd.length>=8){
    const half=Math.floor(bd.length/2);
    const a=avg(bd.slice(0,half).map(p=>p.v)), b=avg(bd.slice(half).map(p=>p.v));
    if(Math.abs(b-a)>=2){
      out.push({t:b<a?'ok':'info', h:'Overall symptom burden is '+(b<a?'easing':'building'),
        b:'Your tracked burden score moved from '+r1(a)+' to '+r1(b)+' out of 44 across this month. It uses the same 0–4 per-symptom structure as the Menopause Rating Scale, but it is a direction-over-time measure for you and your clinician — there is no validated cut-off for this item set, so we do not label it mild or severe.'});
    }
  }
  /* --- screening due --- */
  const age = DB.profile.birthYear ? (new Date().getFullYear() - DB.profile.birthYear) : null;
  if(age){
    const due=[];
    const has = id => DB.screening[id] && DB.screening[id].last;
    if(age>=40 && !has('mammo')) due.push('mammogram');
    if(age>=45 && !has('colon')) due.push('colorectal screening');
    if(age>=65 && !has('dxa')) due.push('bone density scan');
    if(due.length) out.push({t:'info', h:'Worth checking: '+due.join(', '),
      b:'You have not recorded these. At '+age+', US guidance covers '+due.join(' and ')+'. Record the dates in the preventive care checklist so you can see what is coming up.',
      cta:{l:'Preventive care', go:'screening'}});
  }
  /* --- consistency --- */
  if(nLogged>0 && nLogged<5){
    out.push({t:'info', h:'Keep logging — patterns need about two weeks',
      b:'You have '+nLogged+' '+(nLogged===1?'day':'days')+' recorded. Most of the useful comparisons in here need 10–14 days before they mean anything. A 20-second check-in is enough; you do not need to fill in every field.'});
  }
  if(!out.length){
    out.push({t:'info', h:'Nothing to flag yet',
      b:'Once you have a couple of weeks of check-ins, this page will show your trends, personal patterns, and anything worth raising with a clinician.'});
  }
  return out;
}
