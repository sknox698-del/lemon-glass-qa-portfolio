const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const f = require('../renderer/finance-model.js');
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const fixture = () => ({openingBalance:1000, transactions:[], bills:[], recurring:[], household:[],
  goals:[{id:7,name:'Holiday',current:100,target:200,monthly:50,targetDate:'2027-09-09'},
    {id:8,name:'Holiday',current:25,target:100}],
  reserves:[{id:'first',goalId:'7',amount:40,reservedAt:'2026-09-06'},
    {id:'second',goalId:7,amount:60,reservedAt:'2026-10-06'},
    {id:'other-goal',goalId:8,amount:25,reservedAt:'2026-09-06'},
    {id:'manual',name:'Holiday savings',type:'Savings',amount:30,reservedAt:'2026-09-06'}]});

test('actual Delete goal handler saves goal and all linked reserve removals in one update', () => {
  let saved = fixture();
  const untouched = JSON.stringify(saved);
  const writes = [], events = [], actions = new Map(), messages = [];
  const stub = () => ({append(){},appendChild(){}});
  const context = {
    window:{LemonFinance:f,dispatchEvent:event=>events.push(event)},
    CustomEvent:class {constructor(type,options){this.type=type;this.detail=options.detail;}},
    getActiveAccount:()=>({id:'test'}), accountDataKey:id=>id,
    getData:()=>saved, budgetCycleStartDay:()=>6, savingsDate:()=> '2026-09-06',
    writeJson:(key,data)=>{assert.equal(key,'test');saved=JSON.parse(JSON.stringify(data));writes.push(saved);},
    modal:()=>({body:stub(),actions:stub(),layer:{}}), element:stub,
    field:(name,value)=>({control:{value},wrap:{}}),
    button:(label,style,action)=>{actions.set(label,action);return {};},
    closeLayer:()=>{}, showToast:message=>messages.push(message)
  };
  vm.createContext(context);
  const source=read('renderer/lemon-glass-actions.js');
  vm.runInContext(source.slice(source.indexOf('  const updateData ='),source.indexOf('  const element ='))+
    source.slice(source.indexOf('  function editGoal(id)'),source.indexOf('  function manageGoals()')),context);
  vm.runInContext('editGoal("7")',context);
  actions.get('Delete goal')();
  assert.equal(writes.length,1);
  assert.equal(events.length,1);
  assert.deepEqual(saved.goals.map(g=>g.id),[8]);
  assert.deepEqual(saved.reserves.map(r=>r.id).sort(),['manual','other-goal']);
  assert.equal(f.reserveSummary(saved,'2026-09','2026-09').total,55);
  const row=f.report(saved,'2026-09',1)[0];
  assert.equal(row.available,945);
  assert.equal(row.ending,1000);
  assert.match(messages[0],/Linked reserves released/);
  assert.deepEqual(JSON.parse(JSON.stringify(events[0].detail.data)),saved);
  assert.deepEqual(f.syncSavings(saved),saved);
  // A stale second click cannot release another goal or alter bank activity.
  actions.get('Delete goal')();
  assert.deepEqual(saved,writes[0]);
  assert.equal(JSON.stringify(fixture()),untouched);
});

test('deleting the last or an unfunded goal leaves no savings-linked holds', () => {
  for(const current of [0,100]) {
    const before=f.syncSavings({...fixture(),goals:[{id:7,current}]});
    const after=f.syncSavings({...before,goals:[]});
    assert.deepEqual(after.reserves.map(r=>r.id),['manual']);
    assert.equal(f.report(after,'2026-09',1)[0].available,970);
    assert.equal(f.report(after,'2026-09',1)[0].ending,1000);
  }
});

test('legacy orphan cleanup survives actual renderer save/reload and preserves both migration backups', () => {
  const storage=new Map(),account={id:'qa',budgetStartMonth:'2026-09'};
  const original={...fixture(),goals:[]};
  storage.set('qa',JSON.stringify(original));
  storage.set('qa.before-savings-sync','original Issue 1 backup');
  storage.set('other',JSON.stringify(fixture()));
  const other=storage.get('other');
  const context={window:{LemonFinance:f,LemonGlass:{budgetCycleStartDay:()=>6},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)}},
    avGetActiveAccount:()=>account,avAccountDataKey:id=>id,avReadJson:(key,fallback)=>storage.has(key)?JSON.parse(storage.get(key)):fallback};
  vm.createContext(context);
  const source=read('renderer/assets/index-Cvs3_7yw.js');
  vm.runInContext(source.slice(source.indexOf('function avEmptyAccountData()'),source.indexOf('const avCycleStartDay =')),context);
  const loaded=context.avLoadActiveAccountData();
  assert.deepEqual(Array.from(loaded.reserves,r=>r.id),['manual']);
  context.avPersistActiveAccountData(loaded,'qa');
  assert.deepEqual(JSON.parse(storage.get('qa')).reserves,loaded.reserves);
  assert.deepEqual(Array.from(context.avLoadActiveAccountData().reserves,r=>r.id),['manual']);
  assert.equal(storage.get('qa.before-savings-sync-v2'),JSON.stringify(original));
  assert.equal(storage.get('qa.before-savings-sync'),'original Issue 1 backup');
  assert.equal(storage.get('other'),other);
});
