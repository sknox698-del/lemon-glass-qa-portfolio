const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../renderer/lemon-glass-actions.js'),'utf8');
const bundle=fs.readFileSync(path.join(__dirname,'../renderer/assets/index-Cvs3_7yw.js'),'utf8');
const f=require('../renderer/finance-model.js');
const populated=()=>({openingBalance:100,transactions:[{id:1,type:'expense',amount:10,date:'2026-09-09'}],
  bills:[{id:2}],goals:[{id:3,current:20}],reserves:[{id:4,goalId:3,amount:20}],recurring:[{id:5}],
  household:[{id:6}],categoryBudgets:{Groceries:50}});
function setup(){
  let active={id:'a',name:'Steve QA',budgetStartMonth:'2026-09',budgetDuration:12};
  let fail='',closed=0,focus='',dialog;
  const original=JSON.stringify(populated()),buttons={},events=[],messages=[];
  const storage=new Map([['data.a',original],['data.b',original],['accounts',JSON.stringify([active,{id:'b'}])],['preferences','sunshine-orange']]);
  const localStorage={getItem:key=>storage.get(key)??null,setItem:(key,value)=>{
    if((fail==='backup'&&key.includes('before-fresh-start'))||(fail==='save'&&key==='data.a'))throw Error('Disk full');
    storage.set(key,value);
  }};
  const context={document:{activeElement:{focus(){focus='trigger';}}},
    window:{localStorage,dispatchEvent:e=>events.push(e)},CustomEvent:class{constructor(type,options){this.type=type;this.detail=options.detail;}},
    getActiveAccount:()=>active,accountDataKey:id=>'data.'+id,
    writeJson:(key,data)=>localStorage.setItem(key,JSON.stringify(data)),
    showToast:message=>messages.push(message),closeLayer:()=>closed++,element:(tag,style,text)=>({text}),
    modal:()=>dialog={panel:{setAttribute(){}},body:{appendChild(){}},actions:{append(){}},layer:{addEventListener(name,fn){this[name]=fn;}}},
    button:(label,style,callback)=>{buttons[label]=callback;return{focus(){focus=label;}};}};
  vm.createContext(context);
  vm.runInContext(source.slice(source.indexOf('  const emptyData ='),source.indexOf('  const getData ='))+
    source.slice(source.indexOf('  function freshStart()'),source.indexOf('  function saveNow()')),context);
  return {open:()=>context.freshStart(),storage,original,buttons,events,messages,context,
    active:value=>active=value,fail:value=>fail=value,focus:()=>focus,closed:()=>closed,dialog:()=>dialog};
}
test('Fresh Start is a native keyboard-accessible button wired to the exported action',()=>{
  assert.match(bundle,/p\.jsxs\("button", \{\s*type: "button",\s*className: "text-btn dashboard-fresh-start",\s*onClick: \(\) => window\.LemonGlass\?\.freshStart\(\)/);
  assert.match(source,/window\.LemonGlass = \{[\s\S]*?\n    freshStart,/);
});
test('opening, cancellation and Escape never modify saved account data',()=>{
  for(const action of ['cancel','escape']) {
    const h=setup(),before=[...h.storage];h.open();
    assert.deepEqual([...h.storage],before);assert.equal(h.focus(),'Keep my account');
    if(action==='cancel')h.buttons['Keep my account']();else h.dialog().layer.keydown({key:'Escape',preventDefault(){}});
    h.buttons['Start fresh']();
    assert.deepEqual([...h.storage],before);assert.equal(h.events.length,0);assert.equal(h.focus(),'trigger');
  }
});
test('confirmation clears only active finances, preserves an exact recovery copy and updates UI once',()=>{
  const h=setup(),others=[...h.storage].filter(([key])=>key!=='data.a');h.open();
  h.buttons['Start fresh']();h.buttons['Start fresh']();
  const saved=JSON.parse(h.storage.get('data.a'));
  assert.equal(saved.openingBalance,0);
  for(const key of ['transactions','bills','goals','reserves','recurring','household'])assert.deepEqual(saved[key],[]);
  assert.deepEqual(saved.categoryBudgets,{});
  for(const [key,value] of others)assert.equal(h.storage.get(key),value);
  const backups=[...h.storage].filter(([key])=>key.includes('before-fresh-start'));
  assert.equal(backups.length,1);assert.equal(backups[0][1],h.original);
  assert.equal(h.events.length,1);
  assert.deepEqual(JSON.parse(JSON.stringify(h.events[0].detail.data)),saved);
  assert.equal(f.report(saved,'2026-09',1)[0].available,0);
  assert.match(h.messages.at(-1),/ready for a fresh start/);
  const reload={window:{LemonFinance:f,LemonGlass:{budgetCycleStartDay:()=>6},localStorage:h.context.window.localStorage},
    avGetActiveAccount:()=>({id:'a',budgetStartMonth:'2026-09'}),avAccountDataKey:id=>'data.'+id,
    avReadJson:(key,fallback)=>JSON.parse(h.storage.get(key)||JSON.stringify(fallback))};
  vm.createContext(reload);
  vm.runInContext(bundle.slice(bundle.indexOf('function avEmptyAccountData()'),bundle.indexOf('const avCycleStartDay =')),reload);
  assert.deepEqual(JSON.parse(JSON.stringify(reload.avLoadActiveAccountData())),saved);
});
test('no-account and account-switch cases cannot reset the wrong account',()=>{
  const h=setup(),before=[...h.storage];h.active(null);h.open();assert.equal(h.dialog(),undefined);
  h.active({id:'a',name:'Steve QA'});h.open();h.active({id:'b',name:'Other'});h.buttons['Start fresh']();
  assert.deepEqual([...h.storage],before);assert.equal(h.events.length,0);assert.match(h.messages.at(-1),/active account changed/);
});
test('backup or reset write failure keeps existing finances and permits retry',()=>{
  for(const failure of ['backup','save']) {
    const h=setup();h.open();h.fail(failure);h.buttons['Start fresh']();
    assert.equal(h.storage.get('data.a'),h.original);assert.equal(h.events.length,0);assert.equal(h.closed(),0);
    assert.match(h.messages.at(-1),/could not be saved/);
    h.fail('');h.buttons['Start fresh']();assert.equal(h.events.length,1);
  }
});
