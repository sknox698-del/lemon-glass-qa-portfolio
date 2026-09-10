const test = require('node:test');
const assert = require('node:assert/strict');
const f = require('../renderer/finance-model.js');
const fs = require('node:fs'), vm = require('node:vm'), path = require('node:path');
const date = '2026-09-06';
const sample = (current, reserve) => ({openingBalance:1000, goals:[{id:'g',name:'Trip',current,target:100,monthly:50}],
  reserves:reserve ? [{id:'r',goalId:'g',amount:reserve,reservedAt:date}] : []});
function check(data, expected) {
  assert.equal(data.goals[0].current, expected);
  assert.equal(f.money(data.reserves.filter(r => r.goalId === 'g').reduce((s,r) => s + r.amount,0)), expected);
  for (const key of ['2026-09','2026-10','2027-01']) {
    assert.equal(f.reserveSummary(data,key,'2026-09').total,expected);
  }
  assert.equal(f.report(data,'2026-09',2)[1].available,1000-expected);
  assert.equal(f.report(data,'2026-09',2)[1].ending,1000);
}
for (const [saved,held] of [[50,100],[50,0],[100,50]]) test(`legacy savings ${saved}/reserve ${held} repairs on read and remains stable`, () => {
  const original = sample(saved,held), snapshot=JSON.stringify(original);
  assert.equal(f.reserveSummary(original,'2026-09','2026-09').total,saved);
  const repaired = f.syncSavings(original,date);
  check(repaired,saved);
  assert.equal(JSON.stringify(original),snapshot);
  assert.deepEqual(f.syncSavings(JSON.parse(JSON.stringify(repaired)),date),repaired);
});
test('contributions cap at target, round cents, and repeat safely', () => {
  let d = sample(0,0);
  for (const expected of [50,100,100]) {d=f.contributeSavings(d,'g',50,date);check(d,expected);}
  assert.equal(new Set(d.reserves.map(r=>r.id)).size,d.reserves.length);
  d=sample(99.95,99.95);check(f.contributeSavings(d,'g',0.1,date),100);
});
test('edits up and down, rename and release update both balances', () => {
  let d=f.syncSavings(sample(100,100),date);
  d=f.syncSavings({...d,goals:[{...d.goals[0],current:50,name:'Holiday'}]},date);check(d,50);
  assert.equal(d.reserves[0].name,'Holiday savings');
  d=f.syncSavings({...d,goals:[{...d.goals[0],current:100}]},date);check(d,100);
  d=f.releaseSavings(d,d.reserves[0].id,date);check(d,0);
  check(f.releaseSavings(d,'r',date),0);
  check(f.contributeSavings(d,'g',50,date),50);
});
test('multiple cycles preserve earlier allocations and release only the linked amount', () => {
  let d=f.contributeSavings(sample(0,0),'g',50,date);
  d=f.contributeSavings(d,'g',50,'2026-10-06');check(d,100);
  assert.equal(d.reserves.length,2);
  assert.deepEqual(f.report(d,'2026-09',2).map(r=>r.savings),[50,50]);
  d=f.releaseSavings(d,d.reserves[1].id,date);check(d,50);
  assert.equal(d.reserves[0].reservedAt,date);
});
test('orphan cleanup preserves unrelated reserves and other accounts', () => {
  const other=sample(20,20), snapshot=JSON.stringify(other);
  const manual={id:'manual',amount:25,reservedAt:date},orphan={id:'orphan',goalId:'deleted',amount:30,reservedAt:date};
  let d=sample(50,100);d.reserves.push(manual,orphan);
  d=f.syncSavings(d,date);
  assert.deepEqual(d.reserves.filter(r=>r.id==='manual'||r.id==='orphan'),[manual]);
  assert.equal(f.reserveSummary(d,'2026-09','2026-09').total,75);
  const deleted=f.syncSavings({...d,goals:[]},date);
  assert.deepEqual(deleted.reserves,[manual]);
  assert.equal(JSON.stringify(other),snapshot);
});
test('invalid savings values cannot create negative or infinite protected balances', () => {
  for(const value of [-10,NaN,Infinity,'invalid'])check(f.syncSavings(sample(value,100),date),0);
  check(f.syncSavings(sample('50',Infinity),date),50);
});
test('actual renderer load and save repair persisted data and retain an original per-account backup', () => {
  const source=fs.readFileSync(path.join(__dirname,'../renderer/assets/index-Cvs3_7yw.js'),'utf8');
  const storage=new Map(), account={id:'qa',budgetStartMonth:'2026-09'};
  const context={window:{LemonFinance:f,LemonGlass:{budgetCycleStartDay:()=>6},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)}},
    avGetActiveAccount:()=>account,avAccountDataKey:id=>id,avReadJson:(key,fallback)=>storage.has(key)?JSON.parse(storage.get(key)):fallback};
  vm.createContext(context);
  vm.runInContext(source.slice(source.indexOf('function avEmptyAccountData()'),source.indexOf('const avCycleStartDay =')),context);
  storage.set('qa',JSON.stringify(sample(50,100)));
  storage.set('other',JSON.stringify(sample(100,50)));
  const original=storage.get('qa'),other=storage.get('other');
  let loaded=context.avLoadActiveAccountData();check(loaded,50);
  assert.equal(storage.get('qa.before-savings-sync-v2'),original);
  context.avPersistActiveAccountData(loaded,'qa');
  check(JSON.parse(storage.get('qa')),50);
  loaded=context.avLoadActiveAccountData();check(loaded,50);
  assert.equal(storage.get('qa.before-savings-sync-v2'),original);
  assert.equal(storage.get('other'),other);
});
