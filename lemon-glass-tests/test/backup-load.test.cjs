const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm');
const finance = require('../renderer/finance-model.js');
const source = fs.readFileSync(require.resolve('../renderer/lemon-glass-actions.js'),'utf8');
function setup() {
  const account = {id:'original',name:'Steve',type:'Personal',budgetStartMonth:'2026-09',budgetDuration:12};
  const data = {openingBalance:1000,transactions:[{id:1,merchant:'Salary',date:'2026-09-10',amount:500,type:'income',cleared:true}],
    bills:[],reserves:[{id:3,goalId:2,name:'Holiday savings',amount:50,type:'Savings',reservedAt:'2026-09-10'}],
    goals:[{id:2,name:'Holiday',current:50,target:100}],recurring:[],household:[],categoryBudgets:{}};
  const storage = new Map([['accounts',JSON.stringify([account])],['active','original'],['data.original',JSON.stringify(data)],['categories','["Other"]'],['preferences','{"theme":"sunshine-orange"}'],['profile','{"name":"Steve"}']]);
  let payload, fail='', sequence=0;
  const context={ACCOUNTS_KEY:'accounts',ACTIVE_ACCOUNT_KEY:'active',CATEGORIES_KEY:'categories',PREFERENCES_KEY:'preferences',PROFILE_KEY:'profile',
    getActiveAccount:()=>account,getAccounts:()=>JSON.parse(storage.get('accounts')),getData:()=>data,getCategories:()=>JSON.parse(storage.get('categories')),
    readJson:(key,fallback)=>JSON.parse(storage.get(key)||JSON.stringify(fallback)),accountDataKey:id=>'data.'+id,
    showToast(){},download:(name,text)=>payload=text,
    window:{LemonFinance:finance,crypto:{randomUUID:()=>String(++sequence)},localStorage:{getItem:key=>storage.get(key)??null,
      setItem:(key,value)=>{if(key===fail)throw Error('Full');storage.set(key,value)},removeItem:key=>storage.delete(key)}}};
  vm.createContext(context);
  vm.runInContext(source.slice(source.indexOf('  function backupData()'),source.indexOf('  function loadBackup()')),context);
  context.backupData();
  return {context,storage,data,backup:()=>payload,fail:key=>fail=key};
}
test('exported JSON restores all financial data into a new account without replacing originals or preferences',()=>{
  const h=setup(),before=new Map(h.storage),payload=h.context.parseBackup(h.backup());
  const restored=h.context.restoreBackup(payload);
  assert.notEqual(restored.id,'original');
  assert.deepEqual(JSON.parse(h.storage.get('data.'+restored.id)),h.data);
  for(const key of ['data.original','preferences','profile'])assert.equal(h.storage.get(key),before.get(key));
  assert.equal(JSON.parse(h.storage.get('accounts')).length,2);
  assert.equal(h.storage.get('active'),restored.id);
  assert.equal(finance.report(JSON.parse(h.storage.get('data.'+restored.id)),'2026-09',1)[0].ending,1500);
});
test('BOM backups load; invalid or unsupported files leave storage untouched',()=>{
  const h=setup(),before=[...h.storage];assert.equal(h.context.parseBackup('\uFEFF'+h.backup()).product,'Lemon Glass');
  for(const bad of ['{','null','[]','{}',JSON.stringify({...JSON.parse(h.backup()),version:'future'}),
    JSON.stringify({...JSON.parse(h.backup()),data:{...h.data,transactions:[null]}})]) {
    assert.throws(()=>h.context.parseBackup(bad));assert.deepEqual([...h.storage],before);
  }
});
test('failure at every storage step rolls back the restore, including account index and active account',()=>{
  for(const key of ['data.restored-1','avera.tutorial.restored-1.v1','categories','accounts','active']) {
    const h=setup(),before=[...h.storage];h.fail(key);
    assert.throws(()=>h.context.restoreBackup(h.context.parseBackup(h.backup())));
    assert.deepEqual([...h.storage],before);
  }
});
test('saved custom categories are added without deleting existing categories; repeated restores use new IDs',()=>{
  const h=setup(),payload=h.context.parseBackup(h.backup());payload.categories=['Custom','Other'];
  const a=h.context.restoreBackup(payload),b=h.context.restoreBackup(payload);
  assert.notEqual(a.id,b.id);assert.deepEqual(JSON.parse(h.storage.get('categories')),['Other','Custom']);
});
test('legacy inconsistent savings are repaired only in the restored copy',()=>{
  const h=setup(),before=h.storage.get('data.original'),payload=h.context.parseBackup(h.backup());
  payload.data.reserves[0].amount=100;
  const a=h.context.restoreBackup(payload),data=JSON.parse(h.storage.get('data.'+a.id));
  assert.equal(data.reserves[0].amount,50);assert.equal(h.storage.get('data.original'),before);
});
