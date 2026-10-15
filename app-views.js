/* ============================================================
   Views, tools, router
   ============================================================ */

const IC = {
  today:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="4.5" width="18" height="16" rx="3"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/><circle cx="12" cy="15" r="2.2" fill="currentColor" stroke="none"/></svg>',
  trends:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M3 20V4M3 20h18"/><path d="M6.5 15.5l3.5-4.5 3.5 2.5L20 6.5"/></svg>',
  learn:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M4 5.5A2 2 0 0 1 6 3.5h5v17H6a2 2 0 0 0-2 2z"/><path d="M20 5.5a2 2 0 0 0-2-2h-5v17h5a2 2 0 0 1 2 2z"/></svg>',
  you:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="8" r="3.6"/><path d="M4.5 20.5c0-3.9 3.4-6.5 7.5-6.5s7.5 2.6 7.5 6.5"/></svg>',
  chev:'<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 6l6 6-6 6"/></svg>'
};

let curDate = todayISO();
let curTab = 'today';
let sheetStack = [];

/* ---------- tiny helpers ---------- */
const $ = s => document.querySelector(s);
function h(tag, attrs, inner){
  const a = Object.entries(attrs||{}).map(([k,v])=>v==null?'':' '+k+'="'+String(v).replace(/"/g,'&quot;')+'"').join('');
  return '<'+tag+a+'>'+(inner==null?'':inner)+'</'+tag+'>';
}
function toast(msg){
  const old=$('.fab-note'); if(old) old.remove();
  const el=document.createElement('div'); el.className='fab-note'; el.textContent=msg;
  document.body.appendChild(el); setTimeout(()=>el.remove(), 2600);
}
function setPath(obj, path, val){
  const parts=path.split('.');
  let o=obj;
  for(let i=0;i<parts.length-1;i++){ o[parts[i]] = o[parts[i]]||{}; o=o[parts[i]]; }
  if(val===null || val===undefined || val==='') delete o[parts[parts.length-1]];
  else o[parts[parts.length-1]] = val;
}
function getPath(obj, path){
  return path.split('.').reduce((o,k)=> (o==null?undefined:o[k]), obj);
}

/* ---------- scale / chip builders ---------- */
function scaleRow(path, labels, cur, min){
  min = min==null?0:min;
  let b='';
  for(let i=min;i<labels.length+min;i++){
    b += h('button',{'data-act':'set','data-k':path,'data-v':i,'aria-pressed':cur===i?'true':'false','aria-label':labels[i-min]}, i);
  }
  return '<div class="scale">'+b+'</div><div class="scale-legend"><span>'+esc(labels[0])+'</span><span>'+esc(labels[labels.length-1])+'</span></div>';
}
function chip(path, label, on){
  return h('button',{class:'chip','data-act':'toggle','data-k':path,'aria-pressed':on?'true':'false'}, esc(label));
}

/* ============================================================
   TODAY
   ============================================================ */
function viewToday(){
  const e = DB.entries[curDate] || {sym:{},act:{},nut:{}};
  const sym = e.sym||{}, act=e.act||{}, nut=e.nut||{};
  const t = todayISO();
  let days='';
  for(let i=13;i>=0;i--){
    const d=addDays(t,-i), dd=parseISO(d);
    days += h('button',{'data-act':'day','data-d':d,'aria-pressed':d===curDate?'true':'false',
      class: hasData(d)?'has':'', 'aria-label':fmtLong(d)},
      '<span>'+DOW[dd.getDay()]+'</span><b>'+dd.getDate()+'</b>');
  }
  const pt = proteinTarget();
  const b = burden(e);

  return `
  <div class="view">
    <div class="dayscroll" role="group" aria-label="Choose a day">${days}</div>
    <p class="tiny muted" style="margin:6px 0 14px">${esc(fmtLong(curDate))}${curDate===t?'':' · editing a past day'}</p>

    <div class="card">
      <div class="card-head"><h3>Hot flashes today</h3>${e.hf!=null?'<span class="badge accent">logged</span>':''}</div>
      <div class="stepper">
        <button data-act="hf" data-n="-1" aria-label="One fewer">–</button>
        <span class="val">${e.hf==null?'–':e.hf}</span>
        <button data-act="hf" data-n="1" aria-label="One more">+</button>
      </div>
      <div class="btn-row" style="margin-top:10px;justify-content:center">
        <button class="btn ghost sm" data-act="set" data-k="hf" data-v="0">None today</button>
        <button class="btn ghost sm" data-act="set" data-k="hf" data-v="">Clear</button>
      </div>
      <hr class="sep">
      <label class="fl">Night sweats last night</label>
      ${scaleRow('ns', SCALE4, e.ns)}
    </div>

    <div class="section-label">How you slept</div>
    <div class="card">
      <div class="grid2">
        <div class="field"><label class="fl" for="inbed">Hours in bed</label>
          <input id="inbed" type="number" step="0.25" min="0" max="16" inputmode="decimal" data-act="num" data-k="inBedH" value="${e.inBedH??''}"></div>
        <div class="field"><label class="fl" for="slept">Hours asleep</label>
          <input id="slept" type="number" step="0.25" min="0" max="16" inputmode="decimal" data-act="num" data-k="sleepH" value="${e.sleepH??''}"></div>
      </div>
      <label class="fl">Sleep quality (0 = fine, 4 = terrible)</label>
      ${scaleRow('sym.sleepq', ['Fine','Slightly off','Poor','Bad','Awful'], sym.sleepq)}
      ${e.inBedH&&e.sleepH?`<p class="tiny muted" style="margin-top:10px">Sleep efficiency <b>${Math.round(e.sleepH/e.inBedH*100)}%</b>. CBT-I extends your sleep window once this passes about 85–90%.</p>`:''}
    </div>

    <div class="section-label">Symptoms · 0 none → 4 very severe</div>
    <div class="card">
      ${SYMS.filter(s=>s.k!=='sleepq').map(s=>`
        <div style="margin-bottom:14px">
          <label class="fl">${esc(s.n)}</label>
          ${scaleRow('sym.'+s.k, SCALE4, sym[s.k])}
        </div>`).join('')}
      ${b!=null?`<div class="callout info" style="margin-bottom:0"><span class="ctitle">Today's burden score: ${b} of 44</span>
        Built on the same 0–4 per-symptom structure as the Menopause Rating Scale — a way to watch direction over weeks and to show a clinician. Single days bounce around, and we deliberately don't label it mild or severe: there is no validated cut-off for this set of symptoms.</div>`:''}
    </div>

    <div class="section-label">Body</div>
    <div class="card">
      <div class="grid2">
        <div class="field"><label class="fl" for="wt">Weight (${U.wLabel()})</label>
          <input id="wt" type="number" step="0.1" inputmode="decimal" data-act="num" data-k="wt" data-conv="w" value="${e.wt!=null?r1(U.wOut(e.wt)):''}"></div>
        <div class="field"><label class="fl" for="wa">Waist (${U.lLabel()})</label>
          <input id="wa" type="number" step="0.1" inputmode="decimal" data-act="num" data-k="waist" data-conv="l" value="${e.waist!=null?r1(U.lOut(e.waist)):''}"></div>
      </div>
      <p class="xtiny">Waist: same landmark every time, bare skin, end of a normal exhale. Self-measurement usually reads 1–3 cm low — fine, because you are tracking change.</p>
      <hr class="sep">
      <label class="fl">${periodsPossible()?'Bleeding':'Any vaginal bleeding or spotting'}</label>
      <div class="chips">
        ${['none','spotting','light','moderate','heavy'].map(v=>h('button',{class:'chip','data-act':'set','data-k':'bleed','data-v':v,'aria-pressed':e.bleed===v?'true':'false'}, v[0].toUpperCase()+v.slice(1))).join('')}
      </div>
      ${!periodsPossible()?`<p class="xtiny">${!hasUterus()
        ? 'After a hysterectomy any bleeding is unexpected. It is usually something minor and treatable, but log it and mention it to a clinician rather than watching it.'
        : 'Your usual pattern is light or absent now, so anything new is worth logging and reporting rather than explaining away.'}</p>`:''}
    </div>

    <div class="section-label">Movement</div>
    <div class="card">
      <div class="chips" style="margin-bottom:14px">
        ${chip('act.res','Strength session', act.res)}
        ${chip('act.bal','Balance work', act.bal)}
        ${chip('act.pf','Pelvic floor', act.pf)}
      </div>
      <div class="field" style="margin-bottom:0"><label class="fl" for="aero">Aerobic minutes</label>
        <input id="aero" type="number" step="5" min="0" inputmode="numeric" data-act="num" data-k="act.aero" value="${act.aero??''}"></div>
    </div>

    <div class="section-label">Food & drink</div>
    <div class="card">
      <div class="chips" style="margin-bottom:14px">
        ${chip('nut.prot','Hit protein target'+(pt?' ('+pt.grams+'g)':''), nut.prot)}
        ${chip('nut.cal','2+ calcium servings', nut.cal)}
        ${chip('nut.fib','Good fibre day', nut.fib)}
      </div>
      <div class="grid2">
        <div class="field"><label class="fl" for="alc">Alcohol (drinks)</label>
          <input id="alc" type="number" step="1" min="0" inputmode="numeric" data-act="num" data-k="nut.alc" value="${nut.alc??''}"></div>
        <div class="field"><label class="fl" for="caf">Caffeine (cups)</label>
          <input id="caf" type="number" step="1" min="0" inputmode="numeric" data-act="num" data-k="nut.caf" value="${nut.caf??''}"></div>
      </div>
    </div>

    <div class="card">
      <label class="fl" for="notes">Notes</label>
      <textarea id="notes" data-act="num" data-k="notes" placeholder="Anything worth remembering — what helped, what set it off, questions for your next appointment.">${esc(e.notes||'')}</textarea>
    </div>

    ${DB.trigger&&DB.trigger.active?triggerBanner():''}

    <div class="btn-row split" style="margin-bottom:10px">
      <button class="btn ghost" data-act="sheet" data-s="redflags">Red flags</button>
      <button class="btn ghost" data-act="sheet" data-s="tools">Tools</button>
    </div>
    <p class="xtiny center">Everything saves automatically on this device. Nothing leaves it.</p>
  </div>`;
}

/* ============================================================
   TRENDS
   ============================================================ */
let trendRange = 30;
function viewTrends(){
  const days = rangeDates(trendRange);
  const dates = entryDates();
  if(!dates.length){
    return `<div class="view"><div class="empty">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 20V4M3 20h18"/><path d="M6.5 15.5l3.5-4.5 3.5 2.5L20 6.5"/></svg>
      <h3>Nothing to chart yet</h3>
      <p class="tiny">Fill in a check-in on the Today tab. Most patterns need about two weeks before they mean anything.</p>
      <button class="btn primary" data-act="tab" data-v="today">Start today's check-in</button>
    </div></div>`;
  }
  const hf = series(days, e=>e.hf);
  const bd = series(days, burden);
  const sq = series(days, e=>e.sym&&e.sym.sleepq!=null?4-e.sym.sleepq:null);
  const md = series(days, e=>e.sym&&e.sym.mood!=null?e.sym.mood:null);
  const wt = series(days, e=>e.wt!=null?U.wOut(e.wt):null);
  const wa = series(days, e=>e.waist!=null?U.lOut(e.waist):null);

  const hfAvg = avg(hf.map(p=>p.v));
  const hfTot = sum(hf.map(p=>p.v));
  const slAvg = avg(series(days,e=>e.sleepH).map(p=>p.v));
  const res = days.filter(d=>DB.entries[d]&&DB.entries[d].act&&DB.entries[d].act.res).length;
  const aero = sum(days.map(d=>{const e=DB.entries[d];return e&&e.act?e.act.aero:null;}));
  const logged = days.filter(hasData).length;

  const ins = insights();

  return `<div class="view">
    <div class="seg" role="group" aria-label="Time range">
      ${[7,30,90].map(n=>h('button',{'data-act':'range','data-v':n,'aria-pressed':trendRange===n?'true':'false'}, n+' days')).join('')}
    </div>

    <div class="tiles" style="margin-bottom:16px">
      <div class="tile"><div class="k">Flashes/day</div><div class="v">${hfAvg!=null?r1(hfAvg):'–'}</div><div class="d">${hfTot} total</div></div>
      <div class="tile"><div class="k">Sleep</div><div class="v">${slAvg!=null?r1(slAvg):'–'}<small> h</small></div><div class="d">average</div></div>
      <div class="tile"><div class="k">Strength</div><div class="v">${res}</div><div class="d">sessions</div></div>
      <div class="tile"><div class="k">Aerobic</div><div class="v">${aero}<small> min</small></div><div class="d">${trendRange} days</div></div>
      <div class="tile"><div class="k">Days logged</div><div class="v">${logged}</div><div class="d">of ${trendRange}</div></div>
    </div>

    <div class="section-label">What stands out</div>
    ${ins.map(i=>`<div class="callout ${i.t==='alert'?'alert':i.t==='warn'?'warn':i.t==='ok'?'ok':'info'}">
      <span class="ctitle">${esc(i.h)}</span>${i.b}
      ${i.cta?`<div style="margin-top:9px"><button class="btn sm ghost" data-act="go" data-v="${esc(i.cta.go)}">${esc(i.cta.l)}</button></div>`:''}
    </div>`).join('')}

    <div class="section-label">Hot flashes per day</div>
    <div class="card">${barChart(hf,{label:'Hot flashes per day', min1:true})}
      <p class="xtiny">Counts bounce around. Read the shape of the month, not any one bar.</p></div>

    <div class="section-label">Symptom burden</div>
    <div class="card">${lineChart(bd,{label:'Symptom burden score', area:true, ma:7, min:0, max:44})}
      <div class="chart-legend"><span><i></i> daily</span><span><i class="b"></i> 7-day average</span></div>
      <p class="xtiny">0–44, on the same 0–4 per-symptom structure the Menopause Rating Scale uses. Needs at least 8 of the 11 symptoms filled in for a day to score. No severity bands: this is not the MRS item set, and no validated cut-off exists for it — read the direction, not the number.</p></div>

    <div class="section-label">Sleep quality & mood</div>
    <div class="card">${lineChart(sq,{label:'Sleep quality', min:0, max:4, ma:7})}
      <p class="xtiny" style="margin-bottom:12px">Higher is better sleep.</p>
      ${lineChart(md,{label:'Low mood', min:0, max:4, ma:7})}
      <p class="xtiny">Higher means lower mood. Two weeks of moderate-or-worse is worth a conversation, not a wait.</p></div>

    ${wt.some(p=>p.v!=null)?`<div class="section-label">Weight</div>
    <div class="card">${lineChart(wt,{label:'Weight', ma:7, area:true})}
      <div class="chart-legend"><span><i></i> daily</span><span><i class="b"></i> 7-day average</span></div>
      <p class="xtiny">Weigh at the same time of day. Follow the dashed average — daily swings are mostly water and food.</p></div>`:''}

    ${wa.some(p=>p.v!=null)?`<div class="section-label">Waist</div>
    <div class="card">${lineChart(wa,{label:'Waist circumference'})}
      <p class="xtiny">Arguably the more useful number: with waist and BMI modelled together, waist stays predictive of mortality while BMI does not.</p></div>`:''}

    <div class="btn-row split">
      <button class="btn ghost" data-act="sheet" data-s="report">Clinician report</button>
      <button class="btn ghost" data-act="sheet" data-s="data">Export data</button>
    </div>
  </div>`;
}

/* ============================================================
   LEARN
   ============================================================ */
const LEARN_MODULES = [
  {id:'stage',      i:'◔', n:'Where am I?',              s:'Staging, and how menopause is actually diagnosed'},
  {id:'symptoms',   i:'≡', n:'Symptom library',           s:'What is happening, how long it lasts, what helps'},
  {id:'treatment',  i:'℞', n:'Treatment options',         s:'Hormone therapy, non-hormonal options, absolute risks'},
  {id:'supplements',i:'◈', n:'Supplements & remedies',    s:'What the trials actually show — mostly not much'},
  {id:'diet',       i:'◍', n:'Eating for this stage',     s:'Protein, calcium, patterns, alcohol, energy myths'},
  {id:'exercise',   i:'△', n:'Movement & strength',       s:'Resistance, bone loading, balance, pelvic floor'},
  {id:'weight',     i:'◎', n:'Weight & body composition', s:'What really changes, and what works'},
  {id:'skin',       i:'✧', n:'Skin, hair & nails',        s:'Four things with evidence; the rest is optional'},
  {id:'sleep',      i:'☾', n:'Sleep',                     s:'Triage, then real CBT-I — not a hygiene checklist'},
  {id:'mind',       i:'◇', n:'Mood, anxiety & mind',      s:'The risk window, brain fog, techniques that work'},
  {id:'sex',        i:'♡', n:'Intimacy & sexual health',  s:'Options table, lubricant criteria, pain pathway'},
  {id:'screening',  i:'✓', n:'Preventive care checklist', s:'Scans and screens for this decade — track them'},
  {id:'clinician',  i:'✎', n:'Prepare for an appointment', s:'Build a question list from your own data'},
  {id:'redflags',   i:'!', n:'Red flags',                  s:'Ten things that need care promptly'},
  {id:'sources',    i:'§', n:'Sources & what we left out', s:'Where all of this comes from'}
];
function viewLearn(){
  return `<div class="view">
    <div class="callout info"><span class="ctitle">How to read this library</span>
      Claims are tagged by evidence quality where a badge helps, and where major bodies disagree we say so rather than picking a side quietly. Reviewed July 2026.</div>
    <div class="rows">
      ${LEARN_MODULES.map(m=>h('button',{class:'row','data-act':'sheet','data-s':'learn:'+m.id},
        '<span class="ico">'+m.i+'</span><span class="txt"><b>'+esc(m.n)+'</b><span>'+esc(m.s)+'</span></span><span class="chev">'+IC.chev+'</span>')).join('')}
    </div>
    <p class="xtiny center">Education, not medical advice. Nothing here replaces a clinician who knows your history.</p>
  </div>`;
}

/* ============================================================
   YOU
   ============================================================ */
function viewYou(){
  const p = DB.profile;
  const age = p.birthYear? (new Date().getFullYear()-p.birthYear) : null;
  const pt = proteinTarget();
  const dates = entryDates();
  return `<div class="view">
    <div class="card">
      <div class="card-head"><h3>${p.name?esc(p.name):'Your profile'}</h3>
        ${age?'<span class="badge">'+age+'</span>':''}</div>
      <div class="grid2">
        <div class="field"><label class="fl" for="pn">Name</label>
          <input id="pn" type="text" data-act="prof" data-k="name" value="${esc(p.name||'')}"></div>
        <div class="field"><label class="fl" for="by">Birth year</label>
          <input id="by" type="number" min="1920" max="2015" inputmode="numeric" data-act="prof" data-k="birthYear" value="${p.birthYear||''}"></div>
      </div>
      <div class="field"><label class="fl" for="ut">Uterus (womb)</label>
        <select id="ut" data-act="prof" data-k="uterus">
          ${[['unknown','Prefer not to say'],['intact','Still there'],['hyst','Removed (hysterectomy)'],['ablation','Endometrial ablation']]
            .map(([v,l])=>`<option value="${v}"${p.uterus===v?' selected':''}>${l}</option>`).join('')}
        </select></div>
      <div class="field"><label class="fl" for="ov">Ovaries</label>
        <select id="ov" data-act="prof" data-k="ovaries">
          ${[['unknown','Prefer not to say / not sure'],['kept','Both still there'],['one','One removed'],['both','Both removed']]
            .map(([v,l])=>`<option value="${v}"${p.ovaries===v?' selected':''}>${l}</option>`).join('')}
        </select>
        <p class="xtiny">Asked separately on purpose: a hysterectomy often leaves both ovaries in place, and ovaries are sometimes removed with the uterus left. The two have completely different consequences.</p></div>
      ${periodsPossible()
        ? `<div class="field"><label class="fl" for="lp">Date of your last period</label>
           <input id="lp" type="date" data-act="prof" data-k="lastPeriod" value="${p.lastPeriod||''}">
           <p class="xtiny">Used to count months without a period and to flag bleeding that needs checking.</p></div>`
        : `<div class="field"><label class="fl" for="sd">Date of your surgery, if you know it</label>
           <input id="sd" type="date" data-act="prof" data-k="surgeryDate" value="${p.surgeryDate||''}">
           <p class="xtiny">${p.ovaries==='both'
              ? 'Both ovaries removed means menopause dates from this operation, so this app uses the surgery date rather than a last period.'
              : 'With no readable bleeding pattern, a last-period date would not mean anything — so this app asks for the surgery date instead. Staging should not be attempted until at least 3 months after surgery.'}</p></div>`}
      <div class="field" style="margin-bottom:0"><label class="fl" for="bn">Bone status</label>
        <select id="bn" data-act="prof" data-k="bone">
          ${[['unknown',"Don't know"],['normal','Normal density'],['osteopenia','Osteopenia'],['osteoporosis','Osteoporosis'],['fracture','Previous fragility fracture']]
            .map(([v,l])=>`<option value="${v}"${p.bone===v?' selected':''}>${l}</option>`).join('')}
        </select>
        <p class="xtiny">This gates the bone-loading advice in the movement module. Heavy impact work is not for everyone.</p></div>
    </div>

    ${p.stage?`<div class="card flat">
      <div class="card-head"><h4 style="margin:0">Your stage</h4>
        <button class="btn sm ghost" data-act="sheet" data-s="learn:stage">Redo</button></div>
      <p class="tiny" style="margin-bottom:0"><b>${esc(p.stage)}</b></p></div>`:
     `<button class="btn block primary" data-act="sheet" data-s="learn:stage" style="margin-bottom:14px">Find out where you are in the transition</button>`}

    <div class="section-label">Targets</div>
    <div class="card">
      <div class="field"><label class="fl" for="pg">Protein target (g per kg body weight)</label>
        <select id="pg" data-act="prof" data-k="proteinGpk">
          ${[[1.0,'1.0 — general older-adult floor'],[1.2,'1.2 — recommended baseline'],[1.4,'1.4 — active or losing weight'],[1.6,'1.6 — upper training range']]
            .map(([v,l])=>`<option value="${v}"${+p.proteinGpk===v?' selected':''}>${l}</option>`).join('')}
        </select>
        ${pt?`<p class="xtiny">At your latest weight that is about <b>${pt.grams} g/day</b>, roughly <b>${pt.perMeal} g</b> per meal across three meals.</p>`
             :'<p class="xtiny">Log a weight on the Today tab to see your grams.</p>'}</div>
      <div class="grid2" style="margin-bottom:0">
        <div class="field" style="margin-bottom:0"><label class="fl" for="wg">Weight goal (${U.wLabel()})</label>
          <input id="wg" type="number" step="0.1" inputmode="decimal" data-act="prof" data-k="weightGoal" data-conv="w" value="${p.weightGoal!=null?r1(U.wOut(p.weightGoal)):''}"></div>
        <div class="field" style="margin-bottom:0"><label class="fl" for="wag">Waist goal (${U.lLabel()})</label>
          <input id="wag" type="number" step="0.1" inputmode="decimal" data-act="prof" data-k="waistGoal" data-conv="l" value="${p.waistGoal!=null?r1(U.lOut(p.waistGoal)):''}"></div>
      </div>
    </div>

    <div class="section-label">Tools</div>
    <div class="rows">
      ${[['protein','◍','Protein calculator','Grams a day and per meal, from your weight'],
         ['phq9','◇','PHQ-9 mood check','Nine questions, tracked over time'],
         ['gad7','◇','GAD-7 anxiety check','Seven questions, tracked over time'],
         ['sleepwin','☾','Sleep window calculator','Sets your CBT-I schedule from your own logs'],
         ['breath','~','Paced breathing','Six breaths a minute, for stress and anxiety'],
         ['pmr','▤','Progressive muscle relaxation','A guided ten-minute sequence'],
         ['trigger','⚗','Two-week trigger test','Test a suspected trigger properly'],
         ['waist','◎','Waist reference','Thresholds and how to measure consistently']
        ].map(([id,i,n,s])=>h('button',{class:'row','data-act':'sheet','data-s':'tool:'+id},
          '<span class="ico">'+i+'</span><span class="txt"><b>'+n+'</b><span>'+s+'</span></span><span class="chev">'+IC.chev+'</span>')).join('')}
    </div>

    <div class="section-label">Settings</div>
    <div class="card">
      <div class="field"><label class="fl" for="un">Units</label>
        <select id="un" data-act="prof" data-k="units">
          <option value="imperial"${p.units==='imperial'?' selected':''}>Pounds and inches</option>
          <option value="metric"${p.units==='metric'?' selected':''}>Kilograms and centimetres</option>
        </select></div>
      <div class="field"><label class="fl" for="rg">Where you are</label>
        <select id="rg" data-act="prof" data-k="region">
          <option value="us"${p.region==='us'?' selected':''}>United States</option>
          <option value="uk"${p.region==='uk'?' selected':''}>United Kingdom</option>
          <option value="other"${p.region==='other'?' selected':''}>Elsewhere</option>
        </select>
        <p class="xtiny">Guidance genuinely differs — on drug labelling, SSRIs for hot flashes, testosterone access, and calcium and vitamin D targets.</p></div>
      <div class="field" style="margin-bottom:0"><label class="fl" for="th">Appearance</label>
        <select id="th" data-act="theme">
          <option value="auto"${p.theme==='auto'?' selected':''}>Match my device</option>
          <option value="light"${p.theme==='light'?' selected':''}>Light</option>
          <option value="dark"${p.theme==='dark'?' selected':''}>Dark</option>
        </select></div>
    </div>

    <div class="section-label">Your data</div>
    <div class="card">
      <p class="tiny">${dates.length} ${dates.length===1?'day':'days'} recorded${dates.length?', from '+fmtDay(dates[0]):''}. ${Store.ephemeral?'<b>This preview cannot save to disk</b> — your entries will disappear when you close the page. Installed as an app, it saves normally.':'Stored on this device only.'}</p>
      <div class="btn-row split">
        <button class="btn ghost sm" data-act="sheet" data-s="data">Export / import</button>
        <button class="btn ghost sm" data-act="sheet" data-s="report">Clinician report</button>
      </div>
    </div>

    <div class="card flat">
      <h4>Privacy, plainly</h4>
      <p class="tiny">Your entries live in this browser's storage on this device. There is no account, no server, no analytics, and no network request of any kind. Nobody — including whoever made this — can see what you write. The flip side: <b>clearing your browser data deletes it</b>, and it does not sync between devices. Export a backup now and then.</p>
      <h4 style="margin-top:14px">Medical disclaimer</h4>
      <p class="tiny">This app provides general health education compiled from published clinical guidelines. It does not diagnose, treat or prescribe, and it is not a substitute for professional medical advice. Guideline content was reviewed in <b>July 2026</b> and this field moves quickly. Always talk to a qualified clinician about your own situation, and seek care promptly for anything on the red-flag list.</p>
    </div>
    <p class="xtiny center" style="margin-bottom:20px">Meno Compass · content reviewed July 2026</p>
  </div>`;
}

/* ============================================================
   SHEETS
   ============================================================ */
function openSheet(id){ sheetStack.push(id); renderSheet(); }
function closeSheet(){ sheetStack.pop(); renderSheet(); }
function renderSheet(){
  const host = $('#sheet-host');
  if(!sheetStack.length){ host.innerHTML=''; document.body.style.overflow=''; return; }
  const id = sheetStack[sheetStack.length-1];
  const {title, body} = sheetContent(id);
  host.innerHTML = `<div class="sheet-bg" data-act="bg">
    <div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <div class="sheet-bar"><h2>${esc(title)}</h2><button class="xbtn" data-act="close" aria-label="Close">✕</button></div>
      ${body}
    </div></div>`;
  document.body.style.overflow='hidden';
  const s = host.querySelector('.sheet'); if(s) s.scrollTop=0;
  runSheetHooks(id);
}

function sheetContent(id){
  if(id.startsWith('learn:')) return learnSheet(id.slice(6));
  if(id.startsWith('tool:'))  return toolSheet(id.slice(5));
  if(id==='redflags') return learnSheet('redflags');
  if(id==='screening') return learnSheet('screening');
  if(id==='tools') return {title:'Tools', body:`<div class="rows">
    ${[['protein','Protein calculator'],['phq9','PHQ-9 mood check'],['gad7','GAD-7 anxiety check'],['sleepwin','Sleep window calculator'],['breath','Paced breathing'],['pmr','Progressive muscle relaxation'],['trigger','Two-week trigger test'],['waist','Waist reference']]
      .map(([t,n])=>h('button',{class:'row','data-act':'sheet','data-s':'tool:'+t},'<span class="txt"><b>'+n+'</b></span><span class="chev">'+IC.chev+'</span>')).join('')}
  </div>`};
  if(id==='data') return dataSheet();
  if(id==='report') return reportSheet();
  return {title:'', body:''};
}

function learnSheet(k){
  const m = LEARN_MODULES.find(x=>x.id===k) || {n:''};
  let body='';
  switch(k){
    case 'stage': body = stageSheetBody(); break;
    case 'symptoms':
      body = `<p class="tiny muted">Tap a symptom. Each card gives the prevalence and duration data, what has evidence, and what is being over-claimed.</p>
      <div class="rows">${SYMPTOMS.map(s=>h('button',{class:'row','data-act':'sheet','data-s':'learn:sym-'+s.id},
        '<span class="txt"><b>'+esc(s.name)+'</b><span>'+esc(s.quick)+'</span></span><span class="chev">'+IC.chev+'</span>')).join('')}</div>`;
      break;
    case 'treatment':   body = regionNote() + uterusNote() + TREATMENT_HTML; break;
    case 'supplements':
      body = regionNote() + SUPPLEMENTS_INTRO + SUPPLEMENTS.map(s=>`<details class="acc"><summary>
        <span style="flex:1">${esc(s.n)}</span> <span class="badge ${s.v}">${s.v==='strong'?'Good evidence':s.v==='moderate'?'Moderate':s.v==='mixed'?'Mixed':'No evidence'}</span></summary>
        <div><p style="margin-bottom:0">${s.s}</p></div></details>`).join('');
      break;
    case 'diet':      body = regionNote() + DIET_HTML; break;
    case 'exercise':  body = boneGate() + EXERCISE_HTML; break;
    case 'weight':    body = WEIGHT_HTML; break;
    case 'skin':      body = SKIN_HTML; break;
    case 'sleep':     body = SLEEP_HTML; break;
    case 'mind':      body = MIND_HTML; break;
    case 'sex':       body = SEX_HTML; break;
    case 'screening': body = screeningBody(); break;
    case 'clinician': body = clinicianBody(); break;
    case 'redflags':  body = redflagBody(); break;
    case 'sources':   body = SOURCES_HTML; break;
    default:
      if(k.startsWith('sym-')){
        const s = SYMPTOMS.find(x=>x.id===k.slice(4));
        if(s) return {title:s.name, body:'<p class="pill-note">'+esc(s.tag)+'</p>'+s.body};
      }
  }
  return {title:m.n||'', body};
}

/* Personalised note on endometrial protection, driven by the profile.
   This is the one place where "do you have a uterus" changes the answer
   rather than just the framing. */
function uterusNote(){
  const u = DB.profile.uterus;
  if(u==='hyst') return `<div class="callout ok"><span class="ctitle">You have told us your uterus was removed</span>
  So the progestogen section below does not apply to you. With no lining to protect, <b>oestrogen-only therapy is what is used</b> — and that avoids the component carrying most of the extra breast cancer signal. Over five years at ages 50–59, oestrogen-only estimates run from <b>6 fewer</b> to <b>3 extra</b> cases per 1,000 women, against <b>+8 to +10</b> for combined therapy. The endometrial cancer numbers in the risk table are also irrelevant to you.</div>`;
  if(u==='ablation') return `<div class="callout warn"><span class="ctitle">You have told us you had an endometrial ablation</span>
  You still have your uterus, so <b>you still need a progestogen alongside systemic oestrogen</b>. An ablation is not a substitute for endometrial protection — the lining can regenerate in patches. Read the progestogen section below as applying to you.</div>`;
  if(u==='intact') return `<div class="callout info"><span class="ctitle">You have your uterus</span>
  So the progestogen section below applies to you: anyone with a uterus taking systemic oestrogen needs endometrial protection. It is worth reading properly — the choice between continuous and sequential, and between progestogen types, is one of the genuinely unsettled areas.</div>`;
  return '';
}

/* Region-specific heads-up, driven by the profile setting. */
function regionNote(){
  const r = DB.profile.region;
  if(r==='uk') return `<div class="callout warn"><span class="ctitle">You have set your region to the UK</span>
  Three things differ for you. <b>Drug labelling:</b> the November 2025 US boxed-warning removal has no verified UK equivalent — UK product information still reflects the earlier MHRA risk tables. <b>Non-hormonal options:</b> NICE says do <i>not</i> routinely offer SSRIs or SNRIs as first-line for hot flashes alone, where the US Menopause Society lists them as recommended. <b>Nutrient targets:</b> the British Menopause Society uses 700 mg calcium with normal bone density (1,200 mg with osteopenia or osteoporosis) and 400 IU vitamin D — not the US figures on these pages.</div>`;
  if(r==='other') return `<div class="callout warn"><span class="ctitle">You are outside the US and UK</span>
  This library is built on US and UK guidance, and drug approvals, labelling, nutrient targets and screening programmes vary by country. Treat the evidence as transferable and the specifics as local — worth confirming with a clinician where you are.</div>`;
  return '';
}
function boneGate(){
  const b = DB.profile.bone;
  if(b==='osteoporosis'||b==='fracture'){
    return `<div class="callout alert"><span class="ctitle">Tailored to what you told us</span>
    You recorded ${b==='fracture'?'a previous fragility fracture':'osteoporosis'}. <b>Skip the high-impact and heavy-loading advice below</b> and read the "Too Fit To Fracture" rules instead: moderate loads, form over intensity, no jumping or running, and no loaded spinal bending or twisting. Ask for a physiotherapy referral — that is the standard recommendation for your situation, not a hedge.</div>`;
  }
  if(b==='unknown'){
    return `<div class="callout warn"><span class="ctitle">You have not recorded your bone status</span>
    Until you know it, treat the heavy-loading and impact sections below with caution. Bone loss averages 10–12% at spine and hip across the transition, and the safe programme differs a lot depending on where you are. Set it in your profile once you know.</div>`;
  }
  return '';
}

/* ---------- staging ---------- */
let stageAns = {};
let stageStep = 0;
function stageSheetBody(){
  const p = DB.profile;
  if(p.stage && stageStep===0 && !Object.keys(stageAns).length){
    const answers = safeStageAnswers(p.stageAnswers);
    const res = answers ? stageResult(answers) : {body:'',flags:[]};
    return `<div class="callout ok"><span class="ctitle">${esc(p.stage)}</span>${res.body||''}</div>
    ${(res.flags||[]).map(f=>'<div class="callout warn">'+f+'</div>').join('')}
    ${STAGE_CAVEAT}
    <button class="btn block ghost" data-act="stage-restart">Answer the questions again</button>`;
  }
  const qs = stageQueue(stageAns);
  if(stageStep>=qs.length){
    const res = stageResult(stageAns);
    DB.profile.stage = res.label; DB.profile.stageAnswers = Object.assign({},stageAns);
    // Stage HTML is derived from trusted content, never persisted in backups.
    save();
    return `<div class="callout ok"><span class="ctitle">${esc(res.label)}</span>${res.body}</div>
    ${res.flags.map(f=>'<div class="callout warn">'+f+'</div>').join('')}
    ${STAGE_CAVEAT}
    <div class="btn-row split"><button class="btn ghost" data-act="stage-restart">Start again</button>
    <button class="btn primary" data-act="close">Done</button></div>`;
  }
  const q = qs[stageStep];
  return `<div class="progress"><i style="width:${Math.round(stageStep/qs.length*100)}%"></i></div>
  <p class="xtiny">Question ${stageStep+1} of ${qs.length}</p>
  <h3>${esc(q.q)}</h3>
  ${q.note?`<p class="tiny muted">${esc(q.note)}</p>`:''}
  <div class="rows" style="margin-top:14px">
    ${q.a.map(a=>h('button',{class:'row','data-act':'stage-a','data-k':q.id,'data-v':a.v},
      '<span class="txt"><b>'+esc(a.t)+'</b></span><span class="chev">'+IC.chev+'</span>')).join('')}
  </div>
  ${stageStep>0?'<button class="btn ghost sm" data-act="stage-back">Back</button>':''}
  <p class="xtiny" style="margin-top:14px">Based on the STRAW+10 international staging system. This is orientation, not a diagnosis.</p>`;
}

/* ---------- screening ---------- */
function screeningBody(){
  const age = DB.profile.birthYear ? new Date().getFullYear()-DB.profile.birthYear : null;
  const nonUS = DB.profile.region && DB.profile.region!=='us';
  return `<div class="callout info"><span class="ctitle">US intervals, and one honest gap</span>
  These are current US Preventive Services Task Force and society recommendations${age?', relevant to you at '+age:''}. We have deliberately not published a blood-pressure or lipid interval, because we could not verify the current one — ask your clinician rather than trusting a number we guessed.</div>
  ${nonUS?`<div class="callout warn"><span class="ctitle">You are outside the US — these intervals will not match your programme</span>
  Screening ages, intervals and invitation systems differ substantially outside the US, and many countries run national invitation programmes instead. Use this page as a prompt to ask what <i>your</i> programme covers, and record the dates you were actually seen.</div>`:''}
  ${SCREENING.map(s=>{
    const rec = DB.screening[s.id]||{};
    return `<details class="acc"><summary><span style="flex:1">${esc(s.n)}</span>${rec.last?'<span class="badge strong">'+fmtDay(rec.last)+'</span>':''}</summary>
    <div>
      <p class="tiny"><b>${esc(s.w)}</b></p>
      <p class="tiny">${s.d}</p>
      <label class="fl" for="sc-${s.id}">Date you last had this</label>
      <input id="sc-${s.id}" type="date" data-act="screen" data-k="${s.id}" value="${rec.last||''}">
    </div></details>`;
  }).join('')}
  <p class="xtiny">Recording dates here is just for your own reference — it does not book anything, and nothing is sent anywhere.</p>`;
}

/* ---------- red flags ---------- */
function redflagBody(){
  return `<div class="callout alert"><span class="ctitle">If something on this list applies, contact a clinician</span>
  This page is deliberately short and unhedged. Every item has a documented reason, given underneath.</div>
  ${REDFLAGS.map(r=>`<details class="acc"><summary><span style="flex:1">${esc(r.n)}</span></summary><div><p style="margin-bottom:0">${r.why}</p></div></details>`).join('')}
  <div class="callout warn"><span class="ctitle">If you are thinking about harming yourself</span>
  Please reach out today — to a clinician, a crisis line in your country, or someone you trust. In the US you can call or text 988. In the UK, call 111 or the Samaritans on 116 123. You do not have to be in crisis to use them.</div>`;
}

/* ---------- clinician prep ---------- */
function clinicianBody(){
  const dates = entryDates();
  const d30 = rangeDates(30);
  const hfAvg = avg(series(d30,e=>e.hf).map(p=>p.v));
  const bdAvg = avg(series(d30,burden).map(p=>p.v));
  const last = DB.scores.slice(-4).reverse();
  return `<p class="tiny muted">Pick the topics that apply. The questions are phrased to get you specific answers rather than reassurance — and they signal that you have read the guidelines, which changes the conversation.</p>
  <div class="callout ok"><span class="ctitle">Bring your numbers</span>
  <ul class="plain tiny" style="margin-bottom:0">
    <li>${dates.length} days logged${dates.length?', from '+fmtDay(dates[0]):''}</li>
    ${hfAvg!=null?'<li>Hot flashes averaging <b>'+r1(hfAvg)+'/day</b> over the last month</li>':''}
    ${bdAvg!=null?'<li>Symptom burden averaging <b>'+r1(bdAvg)+' of 44</b> across 11 tracked symptoms</li>':''}
    ${last.length?'<li>Recent scores: '+last.map(s=>s.type.toUpperCase()+' '+s.score+' ('+fmtDay(s.date)+')').join(', ')+'</li>':''}
  </ul>
  <div style="margin-top:9px"><button class="btn sm ghost" data-act="sheet" data-s="report">Open the full report</button></div></div>
  ${CLINICIAN_TOPICS.map(t=>`<details class="acc"><summary>${esc(t.l)}</summary><div>
    <ul class="tick">${t.q.map(q=>'<li>'+esc(q)+'</li>').join('')}</ul></div></details>`).join('')}
  <div class="callout info"><span class="ctitle">Two things worth saying out loud</span>
  <p>"Can we talk in absolute risk rather than relative risk?" — a 62% relative increase sounds terrifying, and means 8 extra cases per 1,000 women over five years.</p>
  <p style="margin-bottom:0">"If hormone therapy is not suitable for me, what else is there?" — there is a real list, and it is longer than most appointments cover.</p></div>`;
}

/* ---------- data sheet ---------- */
function dataSheet(){
  return {title:'Export & import', body:`
  <div class="callout ${Store.ephemeral?'warn':'info'}"><span class="ctitle">${Store.ephemeral?'This preview is not saving to disk':'Where your data lives'}</span>
  ${Store.ephemeral
    ? 'Browser storage is unavailable in this preview, so entries are held in memory only and will be lost when you close the page. Install the app (or open the deployed version) and it will save normally.'
    : "In this browser's local storage, on this device only. Clearing browser data deletes it, and it does not sync between devices — so take a backup occasionally."}</div>
  <div class="section-label">Back up</div>
  <div class="btn-row split">
    <button class="btn primary" data-act="export-json">Download JSON</button>
    <button class="btn ghost" data-act="export-csv">Download CSV</button>
  </div>
  <p class="xtiny">JSON restores everything including settings. CSV is one row per day for a spreadsheet or to share with a clinician.</p>
  <div class="section-label">Copy instead</div>
  <p class="tiny">If downloads are blocked, copy this and paste it into a file:</p>
  <textarea id="dump" readonly style="min-height:130px;font-family:ui-monospace,monospace;font-size:.72rem">${esc(JSON.stringify(DB))}</textarea>
  <div class="btn-row"><button class="btn ghost sm" data-act="copy-dump">Copy to clipboard</button></div>
  <div class="section-label">Restore</div>
  <p class="tiny">Paste a previously exported JSON backup. <b>This replaces everything currently stored.</b></p>
  <textarea id="restore" placeholder='{"v":1,"profile":...}'></textarea>
  <button class="btn block" data-act="import-json" style="margin-top:8px">Restore from this backup</button>
  <div class="section-label">Delete</div>
  <button class="btn block danger" data-act="wipe">Erase everything on this device</button>
  <p class="xtiny">Immediate and unrecoverable. Export first.</p>`};
}

/* ---------- clinician report ---------- */
function reportSheet(){
  const d = rangeDates(90).filter(hasData);
  const p = DB.profile;
  const age = p.birthYear? new Date().getFullYear()-p.birthYear : null;
  const hf = series(rangeDates(30), e=>e.hf), bd = series(rangeDates(30), burden);
  const wt = series(rangeDates(90), e=>e.wt).filter(x=>x.v!=null);
  const wa = series(rangeDates(90), e=>e.waist).filter(x=>x.v!=null);
  const topSym = SYMS.filter(s=>s.k!=='sleepq').map(s=>({
    n:s.n, v:avg(rangeDates(30).map(dd=>{const e=DB.entries[dd];return e&&e.sym?e.sym[s.k]:null;}))
  })).filter(x=>x.v!=null).sort((a,b)=>b.v-a.v).slice(0,6);
  const meds = DB.scores.slice(-6).reverse();
  const bleeds = entryDates().filter(x=>DB.entries[x].bleed && DB.entries[x].bleed!=='none');
  return {title:'Report for your clinician', body:`
  <p class="tiny muted">A one-page summary of what you have tracked. Print it, or read from it.</p>
  <div class="card">
    <h3 style="margin-bottom:2px">Symptom summary</h3>
    <p class="xtiny">${p.name?esc(p.name)+' · ':''}${age?age+' years · ':''}Prepared ${fmtLong(todayISO())}</p>
    <hr class="sep">
    <div class="kv"><span>Days tracked (last 90)</span><b>${d.length}</b></div>
    ${p.stage?`<div class="kv"><span>Self-assessed stage</span><b>${esc(p.stage)}</b></div>`:''}
    ${p.lastPeriod?`<div class="kv"><span>Last period</span><b>${fmtDay(p.lastPeriod)} (${Math.floor(daysBetween(p.lastPeriod,todayISO())/30)} months)</b></div>`:''}
    <div class="kv"><span>Hot flashes / day (30 d)</span><b>${avg(hf.map(x=>x.v))!=null?r1(avg(hf.map(x=>x.v))):'not tracked'}</b></div>
    <div class="kv"><span>Worst single day</span><b>${hf.filter(x=>x.v!=null).length?Math.max(...hf.filter(x=>x.v!=null).map(x=>x.v)):'–'}</b></div>
    <div class="kv"><span>Night sweats, moderate+ (30 d)</span><b>${rangeDates(30).filter(x=>DB.entries[x]&&DB.entries[x].ns>=2).length} nights</b></div>
    <div class="kv"><span>Sleep (30 d average)</span><b>${avg(series(rangeDates(30),e=>e.sleepH).map(x=>x.v))!=null?r1(avg(series(rangeDates(30),e=>e.sleepH).map(x=>x.v)))+' h':'not tracked'}</b></div>
    <div class="kv"><span>Symptom burden (30 d avg)</span><b>${avg(bd.map(x=>x.v))!=null?r1(avg(bd.map(x=>x.v)))+' / 44':'not tracked'}</b></div>
    ${wt.length?`<div class="kv"><span>Weight</span><b>${r1(U.wOut(wt[wt.length-1].v))} ${U.wLabel()} (${wt.length>1?(wt[wt.length-1].v>wt[0].v?'+':'')+r1(U.wOut(wt[wt.length-1].v-wt[0].v))+' over '+daysBetween(wt[0].d,wt[wt.length-1].d)+' d':'single reading'})</b></div>`:''}
    ${wa.length?`<div class="kv"><span>Waist</span><b>${r1(U.lOut(wa[wa.length-1].v))} ${U.lLabel()}${wa.length>1?' ('+(wa[wa.length-1].v>wa[0].v?'+':'')+r1(U.lOut(wa[wa.length-1].v-wa[0].v))+')':''}</b></div>`:''}
    <div class="kv"><span>Strength sessions / week (28 d)</span><b>${r1(rangeDates(28).filter(x=>DB.entries[x]&&DB.entries[x].act&&DB.entries[x].act.res).length/4)}</b></div>
    <div class="kv"><span>Alcohol / week (28 d)</span><b>${r1(sum(rangeDates(28).map(x=>{const e=DB.entries[x];return e&&e.nut?e.nut.alc:null;}))/4)} drinks</b></div>
  </div>
  ${topSym.length?`<div class="card"><h4>Most prominent symptoms (30-day average, 0–4)</h4>
    ${topSym.map(s=>`<div class="kv"><span>${esc(s.n)}</span><b>${r1(s.v)}</b></div>`).join('')}</div>`:''}
  ${meds.length?`<div class="card"><h4>Questionnaire scores</h4>
    ${meds.map(s=>`<div class="kv"><span>${s.type.toUpperCase()} · ${fmtDay(s.date)}</span><b>${s.score}${s.band?' — '+esc(s.band):''}</b></div>`).join('')}
    <p class="xtiny">Note: several menopause symptoms — broken sleep, fatigue, poor concentration, low libido — also score points on depression scales, which can inflate totals.</p></div>`:''}
  ${bleeds.length?`<div class="card"><h4>Bleeding logged</h4>
    ${bleeds.slice(-8).reverse().map(x=>`<div class="kv"><span>${fmtDay(x)}</span><b>${esc(DB.entries[x].bleed)}</b></div>`).join('')}</div>`:''}
  ${notesDigest()}
  <div class="btn-row split">
    <button class="btn primary" data-act="print">Print / save as PDF</button>
    <button class="btn ghost" data-act="sheet" data-s="learn:clinician">Question list</button>
  </div>
  <p class="xtiny">Self-reported data from a consumer tracking app. Not a clinical record. The burden score is an unvalidated 0–44 sum of 11 self-rated symptoms on the 0–4 structure used by the Menopause Rating Scale; it has no established cut-off and is included only to show change over time.</p>`};
}
function notesDigest(){
  const ns = entryDates().filter(d=>DB.entries[d].notes).slice(-6).reverse();
  if(!ns.length) return '';
  return `<div class="card"><h4>Recent notes</h4>${ns.map(d=>`<p class="tiny"><b>${fmtDay(d)}:</b> ${esc(DB.entries[d].notes)}</p>`).join('')}</div>`;
}

/* ============================================================
   TOOLS
   ============================================================ */
function proteinTarget(){
  const wt = latestWeight();
  if(wt==null) return null;
  const g = Math.round(wt * (+DB.profile.proteinGpk||1.2));
  return {grams:g, perMeal:Math.round(g/3), kg:wt};
}
function latestWeight(){
  const ds = entryDates().slice().reverse();
  for(const d of ds){ if(DB.entries[d].wt!=null) return DB.entries[d].wt; }
  return null;
}

const PHQ9 = ['Little interest or pleasure in doing things','Feeling down, depressed, or hopeless','Trouble falling or staying asleep, or sleeping too much','Feeling tired or having little energy','Poor appetite or overeating','Feeling bad about yourself, or that you are a failure, or have let yourself or your family down','Trouble concentrating on things, such as reading the newspaper or watching television','Moving or speaking so slowly that other people could have noticed, or the opposite — being fidgety or restless','Thoughts that you would be better off dead, or of hurting yourself in some way'];
const GAD7 = ['Feeling nervous, anxious or on edge','Not being able to stop or control worrying','Worrying too much about different things','Trouble relaxing','Being so restless that it is hard to sit still','Becoming easily annoyed or irritable','Feeling afraid as if something awful might happen'];
const FREQ = ['Not at all','Several days','More than half the days','Nearly every day'];
let qAns = {};

function toolSheet(t){
  switch(t){
    case 'protein': return {title:'Protein calculator', body:proteinTool()};
    case 'phq9':    return {title:'PHQ-9 mood check', body:questionTool('phq9')};
    case 'gad7':    return {title:'GAD-7 anxiety check', body:questionTool('gad7')};
    case 'sleepwin':return {title:'Sleep window calculator', body:sleepWinTool()};
    case 'breath':  return {title:'Paced breathing', body:breathTool()};
    case 'pmr':     return {title:'Progressive muscle relaxation', body:pmrTool()};
    case 'trigger': return {title:'Two-week trigger test', body:triggerTool()};
    case 'waist':   return {title:'Waist reference', body:waistTool()};
  }
  return {title:'', body:''};
}

function proteinTool(){
  const pt = proteinTarget();
  const gpk = +DB.profile.proteinGpk||1.2;
  return `<p class="tiny">The RDA of 0.8 g/kg is a floor for avoiding deficiency, not a target for keeping muscle. Guidelines for healthy older adults use 1.0–1.2 g/kg; the training and body-composition literature uses 1.2–1.6; during intentional weight loss, 1.2–1.5.</p>
  <div class="field"><label class="fl" for="ptw">Your weight (${U.wLabel()})</label>
    <input id="ptw" type="number" step="0.1" inputmode="decimal" value="${pt?r1(U.wOut(pt.kg)):''}" data-act="prot-calc"></div>
  <div class="field"><label class="fl" for="ptg">Target</label>
    <select id="ptg" data-act="prot-calc">
      ${[1.0,1.2,1.4,1.6].map(v=>`<option value="${v}"${gpk===v?' selected':''}>${v.toFixed(1)} g/kg</option>`).join('')}
    </select></div>
  <div id="prot-out">${proteinOut(pt?pt.kg:null, gpk)}</div>
  <div class="callout info"><span class="ctitle">The per-meal threshold</span>
  After about 60 the muscle-building response is blunted — reaching it takes roughly <b>30 g of protein and 2.8 g of leucine in one sitting</b>, where a younger woman responds to any amount. Spreading intake evenly (30/30/30) produced more 24-hour muscle protein synthesis than skewing it (10/20/60). During weight loss, even distribution meant 26% versus 34% of loss coming from lean tissue.</div>
  <h4>Roughly 30 g of protein looks like</h4>
  <div class="tw"><table><tbody>
  <tr><td>Chicken or turkey breast</td><td>100–110 g cooked</td></tr>
  <tr><td>Salmon or tuna</td><td>130 g cooked</td></tr>
  <tr><td>Greek yogurt (plain, 0–2%)</td><td>280–300 g</td></tr>
  <tr><td>Cottage cheese</td><td>250 g</td></tr>
  <tr><td>Eggs</td><td>4–5 large</td></tr>
  <tr><td>Firm tofu</td><td>200 g</td></tr>
  <tr><td>Cooked lentils</td><td>330 g (about 1.7 cups)</td></tr>
  <tr><td>Whey or soy protein powder</td><td>1 scoop (~30 g powder)</td></tr>
  </tbody></table></div>
  <p class="xtiny">Breakfast is nearly always the meal that falls short. For BMI 30+, guidelines generally apply g/kg to an adjusted rather than actual body weight — we are not publishing a formula for that because we could not verify a menopause-specific one. Ask a dietitian. Anyone with kidney disease should get a target from their clinician, not an app.</p>`;
}
function proteinOut(kg, gpk){
  if(kg==null) return '<p class="tiny muted">Enter a weight to see your numbers.</p>';
  const g = Math.round(kg*gpk);
  return `<div class="tiles" style="margin-bottom:12px">
    <div class="tile"><div class="k">Per day</div><div class="v">${g}<small> g</small></div></div>
    <div class="tile"><div class="k">Per meal ×3</div><div class="v">${Math.round(g/3)}<small> g</small></div></div>
    <div class="tile"><div class="k">Leucine aim</div><div class="v">~7.5<small> g</small></div><div class="d">per day</div></div>
  </div>`;
}

function questionTool(kind){
  const items = kind==='phq9'?PHQ9:GAD7;
  const done = Object.keys(qAns).length===items.length;
  const score = done? Object.values(qAns).reduce((a,b)=>a+b,0) : null;
  let band='', note='';
  if(done){
    if(kind==='phq9'){
      band = score<5?'minimal':score<10?'mild':score<15?'moderate':score<20?'moderately severe':'severe';
    } else {
      band = score<5?'minimal':score<10?'mild':score<15?'moderate':'severe';
    }
  }
  const risk = kind==='phq9' && qAns[8]>0;
  const past = DB.scores.filter(s=>s.type===kind).slice(-6);
  return `<p class="tiny">Over the <b>last two weeks</b>, how often have you been bothered by the following?</p>
  <div class="callout warn"><span class="ctitle">Read the score carefully</span>
  Several menopause symptoms — broken sleep, fatigue, poor concentration, low libido — <b>also score points on this questionnaire</b>. The perimenopausal depression guideline says so explicitly. A raised total is a reason to talk to someone, not a diagnosis.</div>
  ${items.map((q,i)=>`<div style="margin-bottom:15px"><label class="fl">${i+1}. ${esc(q)}</label>
    <div class="scale">${FREQ.map((f,v)=>h('button',{'data-act':'q-a','data-i':i,'data-v':v,'aria-pressed':qAns[i]===v?'true':'false','aria-label':f}, v)).join('')}</div>
    <div class="scale-legend"><span>Not at all</span><span>Nearly every day</span></div></div>`).join('')}
  ${done?`<div class="callout ${score>=15?'alert':score>=10?'warn':'ok'}"><span class="ctitle">Score: ${score} of ${items.length*3} — ${band}</span>
    ${kind==='phq9'
      ? 'For context: elevated depressive symptoms are found in 45–68% of perimenopausal women versus 28–31% before. Women are 2–4× more likely to have a major depressive episode during the transition and early postmenopause. Prior depression is the strongest predictor.'
      : 'GAD-7 is the standard anxiety measure. The bands shown are its usual published ones, but we could not find validation specific to menopausal women — so read your trend over time rather than the label.'}
    ${score>=10?'<p style="margin:8px 0 0"><b>A score in this range warrants a conversation with a clinician.</b> Take these numbers with you.</p>':''}</div>`:''}
  ${risk?`<div class="callout alert"><span class="ctitle">Please reach out today</span>
    You answered yes to thoughts of being better off dead or of hurting yourself. Please contact a clinician or a crisis line now — in the US call or text <b>988</b>; in the UK call <b>111</b> or the Samaritans on <b>116 123</b>. You do not have to be in crisis to use them, and you do not have to explain yourself well.</div>`:''}
  <div class="btn-row split">
    <button class="btn ghost" data-act="q-reset">Clear</button>
    <button class="btn primary" data-act="q-save" data-k="${kind}" ${done?'':'disabled style="opacity:.5"'}>Save ${done?'score of '+score:'score'}</button>
  </div>
  ${past.length?`<div class="section-label">Your history</div>
    ${past.slice().reverse().map(s=>`<div class="kv"><span>${fmtDay(s.date)}</span><b>${s.score}${s.band?' · '+esc(s.band):''}</b></div>`).join('')}`:''}`;
}

function sleepWinTool(){
  const ds = rangeDates(14);
  const sleeps = ds.map(d=>{const e=DB.entries[d];return e&&e.sleepH!=null?e.sleepH:null;}).filter(v=>v!=null);
  const beds = ds.map(d=>{const e=DB.entries[d];return e&&e.inBedH!=null?e.inBedH:null;}).filter(v=>v!=null);
  const aSleep = avg(sleeps), aBed = avg(beds);
  const eff = (aSleep&&aBed)? aSleep/aBed*100 : null;
  const win = aSleep? Math.max(5, Math.round(aSleep*4)/4) : null;
  return `<div class="callout info"><span class="ctitle">Why this is the effective part</span>
  In 150 postmenopausal women with chronic insomnia: sleep hygiene education alone produced <b>4%</b> remission. CBT-I produced <b>54%</b> at the end of treatment and <b>68% at six months</b>, with 40–43 more minutes of sleep a night. Sleep restriction is the engine.</div>
  ${sleeps.length<5
    ? '<div class="callout warn"><span class="ctitle">Log a few more nights first</span>You have '+sleeps.length+' night'+(sleeps.length===1?'':'s')+' of sleep data in the last two weeks. This needs about a week of honest logging — hours in bed and hours actually asleep — before it gives you a sensible window.</div>'
    : `<div class="tiles" style="margin-bottom:14px">
        <div class="tile"><div class="k">Actual sleep</div><div class="v">${r1(aSleep)}<small> h</small></div><div class="d">14-day average</div></div>
        ${aBed?`<div class="tile"><div class="k">Time in bed</div><div class="v">${r1(aBed)}<small> h</small></div></div>
        <div class="tile"><div class="k">Efficiency</div><div class="v">${Math.round(eff)}<small>%</small></div><div class="d">${eff>=85?'extend the window':'hold the window'}</div></div>`:''}
      </div>
      <div class="card">
        <h4>Your starting window: ${r1(win)} hours</h4>
        <div class="field"><label class="fl" for="swk">Wake time you will keep every single day</label>
          <input id="swk" type="time" value="06:30" data-act="sw-calc" style="width:auto"></div>
        <div id="sw-out">${swOut('06:30', win)}</div>
      </div>`}
  <h4>The rules while you do this</h4>
  <ul class="tick">
    <li><b>Fixed wake time</b>, seven days a week, regardless of how the night went. This is the anchor.</li>
    <li>Do not go to bed before your window opens, even if you are exhausted.</li>
    <li>If you are awake and frustrated, <b>get out of bed</b>. Somewhere dim and dull. Return when sleepy — not when it feels like you should be.</li>
    <li><b>No clock-watching.</b> Turn it away.</li>
    <li>Bed for sleep and sex only.</li>
    <li>Once efficiency passes about <b>85–90%</b>, extend the window by 15–30 minutes.</li>
    <li>Expect to feel <b>worse in week one or two</b>. That is the mechanism, not failure.</li>
  </ul>
  <div class="callout alert"><span class="ctitle">Do not do this unsupervised if you have</span>
  Bipolar disorder · a seizure disorder · untreated sleep apnea. Sleep deprivation is a trigger in all three — work with a clinician instead. And if you snore, wake unrefreshed, get morning headaches, or CBT-I does not work, ask to be tested for sleep apnea: it affects <b>20% of midlife women</b> and is routinely missed.</div>
  <p class="xtiny">This calculator implements the sleep-restriction component of CBT-I. It is not therapy, and clinician- or programme-delivered CBT-I is better. Telephone-delivered CBT-I worked well in peri- and postmenopausal women, so ask about remote options.</p>`;
}
function swOut(wake, win){
  if(!win) return '';
  const [hh,mm] = wake.split(':').map(Number);
  let t = hh*60+mm - Math.round(win*60);
  while(t<0) t+=1440;
  const bh = String(Math.floor(t/60)).padStart(2,'0'), bm = String(t%60).padStart(2,'0');
  return `<div class="callout ok" style="margin-bottom:0"><span class="ctitle">Earliest bedtime: ${bh}:${bm}</span>
  Do not get into bed before this, and get up at ${wake} every day. When you are sleeping through most of that window, move the bedtime 15–30 minutes earlier.</div>`;
}

function breathTool(){
  return `<div class="callout alert"><span class="ctitle">What this is and is not for</span>
  <p>Slow-paced breathing has meta-analytic support for <b>stress (g = −0.35), anxiety (−0.32) and low mood (−0.40)</b> — small-to-medium effects. Ten of twelve trials used <i>slow</i> pacing and worked; the two using fast pacing did not.</p>
  <p style="margin-bottom:0"><b>It is rated Level I NOT recommended for hot flashes.</b> Larger trials found paced respiration no better than shallow breathing or usual care. Use it for anxiety, where it earns its place. Do not let anyone tell you it stops flashes.</p></div>
  <div class="card center">
    <div id="breath-ring" style="width:170px;height:170px;margin:8px auto 14px;border-radius:50%;border:3px solid var(--accent);display:grid;place-items:center;transition:transform 4s ease-in-out;background:var(--accent-soft)">
      <div><div id="breath-word" style="font-size:1.15rem;font-weight:700">Ready</div>
      <div id="breath-count" class="tiny muted">6 breaths per minute</div></div>
    </div>
    <div class="btn-row split"><button class="btn primary" data-act="breath-start">Start</button>
      <button class="btn ghost" data-act="breath-stop">Stop</button></div>
    <p class="xtiny" style="margin-top:10px">About five seconds in, five out — roughly six breaths a minute. The mechanistic study used six seconds each way; anywhere in that range is the point. Through the nose if comfortable. Two to five minutes is plenty.</p>
  </div>
  <p class="tiny">The authors of the meta-analysis explicitly warned against "miscalibration between hype and evidence" — this is a useful, cheap, low-risk tool with a modest effect, not a cure for anything.</p>`;
}

const PMR_STEPS = [
  ['Settle','Sit or lie somewhere you will not be interrupted. Let your breathing slow. Nothing to achieve here.'],
  ['Hands and forearms','Clench both fists. Hold — feel the tension. Now release completely, and notice the difference for a few breaths.'],
  ['Upper arms','Bend your elbows and tense your biceps. Hold. Release, and let your arms be heavy.'],
  ['Shoulders','Lift your shoulders towards your ears. Hold. Drop them, and let them keep dropping.'],
  ['Face','Scrunch your whole face — brow, eyes, jaw. Hold. Release, and let your jaw hang slightly open.'],
  ['Neck','Press your head gently back against the surface behind you. Hold. Release.'],
  ['Chest and back','Take a breath in and hold it, tensing your chest. Release with a long exhale.'],
  ['Stomach','Tighten your abdominal muscles. Hold. Release, and let your belly soften completely.'],
  ['Thighs','Press your legs together and tense your thighs. Hold. Release.'],
  ['Calves','Point your toes towards your face to tense your calves. Hold. Release.'],
  ['Feet','Curl your toes downwards. Hold. Release.'],
  ['Whole body','Scan from your feet upwards. Anywhere still holding on, invite it to let go. Stay here as long as you like.']
];
function pmrTool(){
  return `<p class="tiny">Systematic review of 46 publications across 16 countries and over 3,400 adults: supportive results for stress (24 studies), anxiety (21) and low mood (11), effect sizes small to very large. Sessions of <b>5–28 minutes</b> worked, and <b>length did not significantly affect outcomes</b> — so a short one counts.</p>
  <div class="card">
    <div class="progress"><i id="pmr-bar" style="width:0%"></i></div>
    <h3 id="pmr-title" style="margin:12px 0 4px">Ready when you are</h3>
    <p id="pmr-text" class="tiny">Tense each muscle group for about 5 seconds, then release for about 15 and pay attention to the contrast. That contrast is the active ingredient.</p>
    <div class="btn-row split"><button class="btn primary" data-act="pmr-start">Start</button>
      <button class="btn ghost" data-act="pmr-stop">Stop</button></div>
  </div>
  <p class="xtiny">If you have an injury or pain anywhere, skip that group or tense only very gently. Effects improve when combined with music, mindfulness or slow breathing.</p>`;
}

function triggerTool(){
  const t = DB.trigger;
  if(t && t.active){
    const day = daysBetween(t.start, todayISO())+1;
    const phase = day<=14 ? 'removal' : 'reintroduction';
    const dayIn = day<=14 ? day : day-14;
    const A = triggerStats(t, 'remove'), B = triggerStats(t, 'base');
    return `<div class="callout ok"><span class="ctitle">Test running: ${esc(t.item)}</span>
    Day ${day} — <b>${phase} phase</b>, day ${dayIn} of 14. Keep logging as normal; the comparison happens automatically.</div>
    <div class="progress"><i style="width:${Math.min(100, Math.round(day/28*100))}%"></i></div>
    <div class="tiles" style="margin:14px 0">
      <div class="tile"><div class="k">Before</div><div class="v">${B!=null?r1(B):'–'}</div><div class="d">flashes/day</div></div>
      <div class="tile"><div class="k">During removal</div><div class="v">${A!=null?r1(A):'–'}</div><div class="d">flashes/day</div></div>
    </div>
    ${A!=null&&B!=null&&day>=14?`<div class="callout info"><span class="ctitle">${Math.abs(A-B)<0.8?'No clear difference so far':(A<B?'Symptoms lower without it':'Symptoms higher without it — probably noise')}</span>
      ${Math.abs(A-B)<0.8?'That is a useful result. It means you can stop policing this one and put the effort somewhere with better evidence.':'Now reintroduce it for two weeks and see whether the pattern reverses. If it does not, the first result was probably coincidence.'}</div>`:''}
    <button class="btn block ghost" data-act="trig-stop">End this test</button>
    <p class="xtiny">Honest caveat: this is a single-person, unblinded experiment with no control for everything else changing in your life. It is the fairest version available to you, which is not the same as proof.</p>`;
  }
  return `<div class="callout warn"><span class="ctitle">Start here: trigger-avoidance is not a proven treatment</span>
  The Menopause Society states plainly that <b>there are no clinical trials assessing whether avoiding triggers relieves vasomotor symptoms</b>, and rates it not recommended. The most-quoted caffeine study was cross-sectional, and its own authors said they could not advise patients without further research.</div>
  <p class="tiny">So why offer this? Because individual responses vary, and a structured two-week removal followed by reintroduction is far more informative than the usual approach of vaguely avoiding six things at once and never knowing which mattered.</p>
  <div class="field"><label class="fl" for="trig">What do you want to test?</label>
    <select id="trig">${['Alcohol','Caffeine','Spicy food','Sugar','Late meals','Hot drinks','Something else'].map(v=>`<option>${v}</option>`).join('')}</select></div>
  <button class="btn block primary" data-act="trig-start">Start a 14-day removal</button>
  <h4 style="margin-top:18px">How it works</h4>
  <ul class="tick">
    <li><b>Days 1–14:</b> remove it completely. Change nothing else. Keep logging.</li>
    <li><b>Days 15–28:</b> bring it back at your usual amount. Keep logging.</li>
    <li>The app compares your hot flash counts and sleep across the phases.</li>
    <li>A difference under about one flash a day is noise. Be willing to conclude nothing happened — that is a genuinely useful answer.</li>
  </ul>
  <p class="xtiny">One separate note: if alcohol is the thing you are testing, cutting it back is worth doing regardless of what this shows. The evidence for that sits with breast cancer risk and sleep quality, not hot flashes.</p>`;
}
function triggerStats(t, which){
  if(which==='base'){
    const ds=[]; for(let i=1;i<=14;i++) ds.push(addDays(t.start,-i));
    return avg(ds.map(d=>{const e=DB.entries[d];return e?e.hf:null;}));
  }
  const ds=[]; for(let i=0;i<14;i++){ const d=addDays(t.start,i); if(d<=todayISO()) ds.push(d); }
  return avg(ds.map(d=>{const e=DB.entries[d];return e?e.hf:null;}));
}
function triggerBanner(){
  const t=DB.trigger, day=daysBetween(t.start,todayISO())+1;
  if(day>28){ return ''; }
  return `<div class="callout info"><span class="ctitle">Trigger test day ${day}: ${esc(t.item)}</span>
  ${day<=14?'Removal phase — keep it out and keep logging.':'Reintroduction phase — back to your usual amount.'}
  <div style="margin-top:8px"><button class="btn sm ghost" data-act="sheet" data-s="tool:trigger">View results</button></div></div>`;
}

function waistTool(){
  const wa = entryDates().slice().reverse().map(d=>DB.entries[d].waist).find(v=>v!=null);
  return `<p class="tiny">The International Atherosclerosis Society consensus argues waist should be treated as a <b>vital sign</b>. Modelled together with BMI, waist stays predictive of mortality while BMI becomes unrelated or even inversely related. A 10% larger waist meant 1.48× higher mortality after BMI adjustment; in coronary artery disease, 2.05×.</p>
  ${wa!=null?`<div class="tiles" style="margin-bottom:14px"><div class="tile"><div class="k">Your latest</div><div class="v">${r1(U.lOut(wa))}<small> ${U.lLabel()}</small></div>
    <div class="d">${wa>=105?'class I threshold':wa>=90?'above 90 cm':wa>=80?'above 80 cm':'below 80 cm'}</div></div></div>`:''}
  <h4>Thresholds for women</h4>
  <div class="tw"><table><tbody>
  <tr><td>At normal weight</td><td><b>80 cm / 31.5 in</b></td></tr>
  <tr><td>At overweight</td><td><b>90 cm / 35.4 in</b></td></tr>
  <tr><td>Class I obesity</td><td>105 cm / 41.3 in</td></tr>
  </tbody></table></div>
  <p class="xtiny">Ethnicity-specific single cut-points for women include 80 cm for Chinese and Asian Indian women, 85 cm for Korean and Tunisian women, 90 cm for Japanese women.</p>
  <h4>How to measure it the same way every time</h4>
  <ul class="tick">
    <li>Top of the hip bone, <b>or</b> midway between lowest rib and hip bone. These differ by about 2 cm in women — <b>pick one and never change</b>.</li>
    <li>Bare skin, standing relaxed, tape snug but not compressing.</li>
    <li>At the end of a normal exhale. Do not suck in.</li>
    <li>Same time of day, ideally morning before eating.</li>
  </ul>
  <div class="callout ok"><span class="ctitle">The encouraging part</span>
  Diet and exercise reduce waist <b>with or without weight loss</b> — one large trial found about 5 cm of reduction versus control. Aerobic work moved it most (−2.30 cm across 101 trials in postmenopausal women).</div>
  <p class="xtiny">Self-measurement correlates well with clinical measurement (r = 0.8–0.9) but typically underestimates by 1–3 cm. Irrelevant when you are tracking your own change.</p>`;
}

/* ---------- animated tool hooks ---------- */
let breathTimer=null, pmrTimer=null;
function runSheetHooks(id){
  if(id!=='tool:breath' && breathTimer){ clearInterval(breathTimer); breathTimer=null; }
  if(id!=='tool:pmr' && pmrTimer){ clearInterval(pmrTimer); pmrTimer=null; }
}
function breathStart(){
  const ring=document.getElementById('breath-ring'), word=document.getElementById('breath-word'), cnt=document.getElementById('breath-count');
  if(!ring) return;
  if(breathTimer) clearInterval(breathTimer);
  let phase=0, n=0;
  const tick=()=>{
    if(phase%2===0){ ring.style.transitionDuration='5s'; ring.style.transform='scale(1.22)'; word.textContent='Breathe in'; }
    else { ring.style.transitionDuration='5s'; ring.style.transform='scale(0.86)'; word.textContent='Breathe out'; n++; cnt.textContent=n+' breath'+(n===1?'':'s'); }
    phase++;
  };
  tick(); breathTimer=setInterval(tick,5000);
}
function breathStop(){
  if(breathTimer) clearInterval(breathTimer); breathTimer=null;
  const ring=document.getElementById('breath-ring'), word=document.getElementById('breath-word');
  if(ring){ ring.style.transform='scale(1)'; word.textContent='Stopped'; }
}
function pmrStart(){
  if(pmrTimer) clearInterval(pmrTimer);
  let i=0;
  const show=()=>{
    const t=document.getElementById('pmr-title'), x=document.getElementById('pmr-text'), b=document.getElementById('pmr-bar');
    if(!t){ clearInterval(pmrTimer); return; }
    if(i>=PMR_STEPS.length){ t.textContent='Done'; x.textContent='Notice how your body feels now compared with when you started. That comparison is worth a moment.'; b.style.width='100%'; b.classList.add('ok'); clearInterval(pmrTimer); pmrTimer=null; return; }
    t.textContent=PMR_STEPS[i][0]; x.textContent=PMR_STEPS[i][1];
    b.style.width=Math.round((i+1)/PMR_STEPS.length*100)+'%';
    i++;
  };
  show(); pmrTimer=setInterval(show, 45000);
}
function pmrStop(){ if(pmrTimer) clearInterval(pmrTimer); pmrTimer=null;
  const t=document.getElementById('pmr-title'); if(t) t.textContent='Stopped'; }

/* ============================================================
   ONBOARDING
   ============================================================ */
function viewOnboard(){
  return `<div class="view">
    <div style="text-align:center;padding:18px 0 6px">
      <div style="font-size:2.6rem;line-height:1">◔</div>
      <h1 style="margin-top:8px">Meno Compass</h1>
      <p class="muted tiny">A private tracker and a straight-talking reference for perimenopause and beyond.</p>
    </div>
    <div class="card">
      <h3>What this is</h3>
      <ul class="tick">
        <li><b>A tracker first.</b> Twenty seconds a day builds the patterns and the report your clinician actually needs.</li>
        <li><b>A reference that tells you when the evidence is thin.</b> Every claim is tagged, and where major guidelines disagree, it says so.</li>
        <li><b>Completely private.</b> No account, no server, no analytics. Your entries stay in this browser on this device.</li>
      </ul>
      <div class="callout warn" style="margin-bottom:0"><span class="ctitle">What it is not</span>
      It does not diagnose, treat or prescribe, and it is not a substitute for a clinician who knows your history. Content reviewed July 2026 — this field moves fast.</div>
    </div>
    <div class="card">
      <h3>A few basics</h3>
      <div class="grid2">
        <div class="field"><label class="fl" for="ob-n">First name (optional)</label>
          <input id="ob-n" type="text" placeholder="Optional"></div>
        <div class="field"><label class="fl" for="ob-y">Birth year</label>
          <input id="ob-y" type="number" min="1920" max="2015" inputmode="numeric" placeholder="e.g. 1975"></div>
      </div>
      <div class="field"><label class="fl" for="ob-u">Units</label>
        <select id="ob-u"><option value="imperial">Pounds and inches</option><option value="metric">Kilograms and centimetres</option></select></div>
      <div class="field"><label class="fl" for="ob-r">Where you are</label>
        <select id="ob-r"><option value="us">United States</option><option value="uk">United Kingdom</option><option value="other">Elsewhere</option></select>
        <p class="xtiny">Guidance differs between the US and UK on several points, and the app will tell you where.</p></div>
      <button class="btn block primary" data-act="ob-done">Get started</button>
      <button class="btn block ghost" data-act="ob-skip" style="margin-top:8px">Skip for now</button>
    </div>
  </div>`;
}

/* ============================================================
   RENDER + EVENTS
   ============================================================ */
function applyTheme(){
  const t = DB.profile.theme||'auto';
  const dark = t==='dark' || (t==='auto' && window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.setAttribute('data-theme', dark?'dark':'light');
  const meta=document.querySelector('meta[name="theme-color"]');
  if(meta) meta.setAttribute('content', dark?'#141016':'#fbf9fa');
}
const TAB_TITLES = {today:['Today','Daily check-in'], trends:['Trends','Patterns & insights'], learn:['Learn','Evidence-based guidance'], you:['You','Profile, tools & data']};
function render(){
  applyTheme();
  if(!DB.profile.onboarded){
    $('#app').innerHTML = viewOnboard();
    $('#tabs').style.display='none';
    $('#topbar').style.display='none';
    return;
  }
  $('#tabs').style.display='';
  $('#topbar').style.display='';
  const [t,s] = TAB_TITLES[curTab];
  $('#topbar').innerHTML = '<h1>'+esc(t)+'<span class="sub">'+esc(s)+'</span></h1>'
    + (curTab==='today'? '<button class="xbtn" data-act="sheet" data-s="redflags" aria-label="Red flags" title="Red flags">!</button>':'');
  const map = {today:viewToday, trends:viewTrends, learn:viewLearn, you:viewYou};
  $('#app').innerHTML = map[curTab]();
  const strip = document.querySelector('.dayscroll');
  if(strip){
    const sel = strip.querySelector('[aria-pressed="true"]');
    if(sel) strip.scrollLeft = Math.max(0, sel.offsetLeft - strip.clientWidth/2 + sel.offsetWidth/2);
  }
  document.querySelectorAll('nav.tabs button').forEach(b=>{
    b.setAttribute('aria-current', b.dataset.v===curTab?'page':'false');
  });
  window.scrollTo(0,0);
}

function handleAction(el, ev){
  const a = el.dataset.act;
  const e = () => entry(curDate);
  switch(a){
    case 'tab': curTab = el.dataset.v; sheetStack=[]; renderSheet(); render(); return;
    case 'day': curDate = el.dataset.d; render(); return;
    case 'range': trendRange = +el.dataset.v; render(); return;
    case 'hf': {
      const cur = e().hf==null?0:e().hf;
      const nv = Math.max(0, cur + (+el.dataset.n));
      e().hf = nv; save(); render(); return;
    }
    case 'set': {
      const v = el.dataset.v;
      setPath(e(), el.dataset.k, v===''?null:(isNaN(v)?v:+v));
      save(); render(); return;
    }
    case 'toggle': {
      const cur = getPath(e(), el.dataset.k);
      setPath(e(), el.dataset.k, cur?null:true);
      save(); render(); return;
    }
    case 'theme': DB.profile.theme = el.value; save(true); render(); return;
    case 'sheet': openSheet(el.dataset.s); return;
    case 'close': closeSheet(); return;
    case 'bg': if(ev.target===el) closeSheet(); return;
    case 'go': {
      const g = el.dataset.v;
      if(g.startsWith('learn:')||g.startsWith('tool:')) openSheet(g);
      else openSheet(g);
      return;
    }
    case 'stage-a': stageAns[el.dataset.k]=el.dataset.v; stageStep++; renderSheet(); return;
    case 'stage-back': {
      stageStep = Math.max(0, stageStep-1);
      const q = stageQueue(stageAns)[stageStep];
      if(q) delete stageAns[q.id];
      renderSheet(); return;
    }
    case 'stage-restart': stageAns={}; stageStep=0; DB.profile.stage=null; save(); renderSheet(); return;
    case 'q-a': qAns[+el.dataset.i]=+el.dataset.v; renderSheet(); return;
    case 'q-reset': qAns={}; renderSheet(); return;
    case 'q-save': {
      const kind = el.dataset.k;
      const items = kind==='phq9'?PHQ9:GAD7;
      const score = Object.values(qAns).reduce((x,y)=>x+y,0);
      const band = kind==='phq9' ? (score<5?'minimal':score<10?'mild':score<15?'moderate':score<20?'moderately severe':'severe')
                                 : (score<5?'minimal':score<10?'mild':score<15?'moderate':'severe');
      DB.scores.push({date:todayISO(), type:kind, score, band});
      save(true); qAns={}; toast('Score saved'); renderSheet(); return;
    }
    case 'breath-start': breathStart(); return;
    case 'breath-stop': breathStop(); return;
    case 'pmr-start': pmrStart(); return;
    case 'pmr-stop': pmrStop(); return;
    case 'trig-start': {
      const sel=document.getElementById('trig');
      DB.trigger = {active:true, item: sel?sel.value:'Alcohol', start: todayISO()};
      save(true); toast('Trigger test started'); renderSheet(); return;
    }
    case 'trig-stop': DB.trigger=null; save(true); renderSheet(); return;
    case 'export-json': download('meno-compass-backup-'+todayISO()+'.json', JSON.stringify(DB,null,2), 'application/json'); return;
    case 'export-csv': download('meno-compass-'+todayISO()+'.csv', toCSV(), 'text/csv'); return;
    case 'copy-dump': {
      const ta=document.getElementById('dump');
      if(ta){ ta.select(); try{ document.execCommand('copy'); toast('Copied'); }catch(x){ toast('Select and copy manually'); } }
      return;
    }
    case 'import-json': {
      const ta=document.getElementById('restore');
      if(!ta||!ta.value.trim()){ toast('Paste a backup first'); return; }
      try{
        const obj=JSON.parse(ta.value);
        if(!obj || typeof obj!=='object' || !obj.entries) throw new Error('bad');
        DB = migrate(obj); save(true); sheetStack=[]; renderSheet(); render(); toast('Backup restored');
      }catch(x){ toast('That does not look like a valid backup'); }
      return;
    }
    case 'wipe': {
      if(el.dataset.confirm==='1'){
        Store.clear(); DB=blankDB(); save(true); sheetStack=[]; renderSheet(); render(); toast('Everything erased'); return;
      }
      el.dataset.confirm='1'; el.textContent='Tap again to erase permanently'; return;
    }
    case 'print': window.print(); return;
    case 'ob-done': {
      const n=document.getElementById('ob-n'), y=document.getElementById('ob-y'),
            u=document.getElementById('ob-u'), r=document.getElementById('ob-r');
      DB.profile.name = n.value.trim();
      if(y.value) DB.profile.birthYear = +y.value;
      DB.profile.units = u.value; DB.profile.region = r.value;
      DB.profile.onboarded = true; save(true); render();
      setTimeout(()=>openSheet('learn:stage'), 350);
      return;
    }
    case 'ob-skip': DB.profile.onboarded=true; save(true); render(); return;
  }
}

function handleInput(el){
  const a = el.dataset.act;
  if(a==='num'){
    const k = el.dataset.k, conv = el.dataset.conv;
    let v = el.type==='number' ? (el.value===''?null:+el.value) : (el.value.trim()||null);
    if(v!=null && conv==='w') v = U.wIn(v);
    if(v!=null && conv==='l') v = U.lIn(v);
    setPath(entry(curDate), k, v);
    save(); return;
  }
  if(a==='prof'){
    const k=el.dataset.k, conv=el.dataset.conv;
    let v = el.type==='number' ? (el.value===''?null:+el.value) : el.value;
    if(el.tagName==='SELECT' && !isNaN(v) && k==='proteinGpk') v=+v;
    if(v!=null && v!=='' && conv==='w') v=U.wIn(v);
    if(v!=null && v!=='' && conv==='l') v=U.lIn(v);
    DB.profile[k] = (v===''?null:v);
    save();
    if(k==='units'||k==='proteinGpk'||k==='uterus'||k==='ovaries') render();
    return;
  }
  if(a==='screen'){
    DB.screening[el.dataset.k] = {last: el.value||null};
    save(); return;
  }
  if(a==='prot-calc'){
    const w=document.getElementById('ptw'), g=document.getElementById('ptg');
    const kg = w.value? U.wIn(+w.value) : null;
    document.getElementById('prot-out').innerHTML = proteinOut(kg, +g.value);
    return;
  }
  if(a==='sw-calc'){
    const ds=rangeDates(14);
    const sleeps=ds.map(d=>{const x=DB.entries[d];return x&&x.sleepH!=null?x.sleepH:null;}).filter(v=>v!=null);
    const aSleep=avg(sleeps); const win = aSleep?Math.max(5,Math.round(aSleep*4)/4):null;
    document.getElementById('sw-out').innerHTML = swOut(el.value, win);
    return;
  }
}

/* ---------- export ---------- */
function toCSV(){
  const cols = ['date','hot_flashes','night_sweats_0_4','hours_in_bed','hours_asleep','sleep_efficiency_pct',
    ...SYMS.map(s=>s.k), 'burden_score_0_44_unvalidated','weight_kg','waist_cm','bleeding','strength_session','balance','pelvic_floor',
    'aerobic_min','protein_target_met','calcium_2plus','fibre_ok','alcohol_drinks','caffeine_cups','notes'];
  const rows = [cols.join(',')];
  entryDates().forEach(d=>{
    const e=DB.entries[d], s=e.sym||{}, ac=e.act||{}, nu=e.nut||{};
    const eff = (e.sleepH&&e.inBedH)?Math.round(e.sleepH/e.inBedH*100):'';
    const r = [d, e.hf??'', e.ns??'', e.inBedH??'', e.sleepH??'', eff,
      ...SYMS.map(x=>s[x.k]??''), burden(e)??'',
      e.wt!=null?r1(e.wt):'', e.waist!=null?r1(e.waist):'', e.bleed||'',
      ac.res?1:'', ac.bal?1:'', ac.pf?1:'', ac.aero??'',
      nu.prot?1:'', nu.cal?1:'', nu.fib?1:'', nu.alc??'', nu.caf??'',
      '"'+String(e.notes||'').replace(/"/g,'""')+'"'];
    rows.push(r.join(','));
  });
  if(DB.scores.length){
    rows.push('');
    rows.push('questionnaire_date,type,score,band');
    DB.scores.forEach(s=>rows.push([s.date,s.type,s.score,s.band||''].join(',')));
  }
  return rows.join('\n');
}
function download(name, text, mime){
  try{
    const blob = new Blob([text], {type:mime});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href=url; a.download=name; document.body.appendChild(a); a.click();
    setTimeout(()=>{ URL.revokeObjectURL(url); a.remove(); }, 500);
    toast('Downloaded '+name);
  }catch(x){ toast('Download blocked — use the copy box instead'); }
}

/* ---------- boot ---------- */
function boot(){
  load();
  document.body.insertAdjacentHTML('afterbegin',
    '<header class="topbar" id="topbar"></header><main id="app"></main>'
    + '<nav class="tabs" id="tabs"><div class="inner">'
    + Object.entries(TAB_TITLES).map(([k,v])=>h('button',{'data-act':'tab','data-v':k},IC[k]+'<span>'+v[0]+'</span>')).join('')
    + '</div></nav><div id="sheet-host"></div>');
  document.addEventListener('click', ev=>{
    const el = ev.target.closest('[data-act]');
    if(!el) return;
    /* The sheet backdrop carries data-act="bg" and wraps everything inside the
       sheet, so never preventDefault for it — that would block native
       <details> toggling, text selection and link taps within the sheet. */
    if(el.dataset.act==='bg'){
      if(ev.target===el){ ev.preventDefault(); closeSheet(); }
      return;
    }
    if(el.tagName!=='BUTTON' && el.tagName!=='A') return;
    ev.preventDefault();
    handleAction(el, ev);
  });
  document.addEventListener('input', ev=>{
    const el = ev.target.closest('[data-act]');
    if(el && (el.tagName==='INPUT'||el.tagName==='TEXTAREA')) handleInput(el);
  });
  document.addEventListener('change', ev=>{
    const el = ev.target.closest('[data-act]');
    if(el && el.tagName==='SELECT') { if(el.dataset.act==='theme'){ handleAction(el, ev); } else handleInput(el); }
    if(el && el.type==='date') handleInput(el);
    if(el && el.type==='time') handleInput(el);
  });
  document.addEventListener('keydown', ev=>{ if(ev.key==='Escape' && sheetStack.length) closeSheet(); });
  if(window.matchMedia) matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', applyTheme);
  window.addEventListener('beforeunload', flush);
  document.addEventListener('visibilitychange', ()=>{ if(document.visibilityState==='hidden') flush(); });
  const hash = (location.hash||'').replace('#','');
  if(TAB_TITLES[hash]) curTab = hash;
  render();
  if(hash==='redflags') openSheet('redflags');
  window.addEventListener('hashchange', ()=>{
    const hh=(location.hash||'').replace('#','');
    if(TAB_TITLES[hh]){ curTab=hh; sheetStack=[]; renderSheet(); render(); }
    else if(hh==='redflags') openSheet('redflags');
  });
  if('serviceWorker' in navigator && location.protocol.startsWith('http')){
    navigator.serviceWorker.register('sw.js').catch(()=>{});
  }
}
document.addEventListener('DOMContentLoaded', boot);
