const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
function context(){
  const ctx=vm.createContext({console,document:{addEventListener(){}},window:{},localStorage:{getItem(){return null},setItem(){},removeItem(){}},setTimeout,clearTimeout});
  for(const file of ['content-a.js','content-b.js','app-core.js','app-views.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,file),'utf8'),ctx);
  return ctx;
}
test('crafted backup loses HTML, attributes and unknown keys before rendering',()=>{
  const ctx=context();
  const result=vm.runInContext(`(()=>{
    const raw={v:1,profile:{onboarded:true,stage:'old',stageResult:{body:'<img src=x onerror=alert(1)>',flags:['<svg onload=alert(1)>']},birthYear:'" onfocus="alert(1)',lastPeriod:'" onfocus="alert(1)'},entries:{'2026-01-01':{sleepH:'" onfocus="alert(1)',notes:'normal note',sym:{mood:2}}},scores:[{date:'2026-01-01',type:'phq9',score:'<img>'}]};
    DB=migrate(raw);return {clean:DB,html:stageSheetBody()};
  })()`,ctx);
  assert.equal(result.clean.profile.stageResult,undefined);
  assert.equal(result.clean.profile.birthYear,null);
  assert.equal(result.clean.entries['2026-01-01'].sleepH,undefined);
  assert.equal(result.clean.entries['2026-01-01'].notes,'normal note');
  assert.equal(result.clean.scores.length,0);
  assert.doesNotMatch(result.html,/onerror|onload|onfocus|<img/);
});
test('valid stage answers are recomputed and valid records survive round trip',()=>{
  const ctx=context();
  const result=vm.runInContext(`(()=>{
    const raw=blankDB();raw.profile.onboarded=true;raw.profile.stageAnswers={age:'45p',uterus:'intact',ovaries:'kept',contra:'no',cycle:'var7',vms:'some'};
    raw.entries['2026-01-01']={sleepH:7,sym:{mood:2},act:{aero:30},nut:{alc:0},notes:'hello'};
    DB=migrate(raw);return {clean:DB,html:stageSheetBody()};
  })()`,ctx);
  assert.equal(result.clean.entries['2026-01-01'].sleepH,7);
  assert.ok(result.clean.profile.stage);
  assert.ok(result.html.includes('<p>'));
});
test('standalone bundle contains the exact patched sources',()=>{
  const html=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
  for(const file of ['app-core.js','app-views.js'])assert.ok(html.includes(fs.readFileSync(path.join(__dirname,file),'utf8')));
});
