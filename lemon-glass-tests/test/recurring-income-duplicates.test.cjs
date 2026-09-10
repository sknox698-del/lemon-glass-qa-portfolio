const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const f = require('../renderer/finance-model.js');
const salary = {id:7,name:'Salary',type:'income',category:'Income',amount:500,startMonthKey:'2026-09'};
const receipt = extra => ({id:'receipt',recurringId:'7',merchant:'Salary',type:'income',amount:500,date:'2026-09-09',recurring:true,cleared:true,...extra});

test('duplicate income matches ID and budget cycle including pending receipts', () => {
  for(const cleared of [true,false]) {
    const data={transactions:[receipt({cleared})]};
    assert.equal(f.recordedRecurringIncome(data,salary,'2026-10-05',6),true);
    assert.equal(f.recordedRecurringIncome(data,salary,'2026-10-06',6),false);
    assert.equal(f.recordedRecurringIncome(data,salary,'2027-09-09',6),false);
    assert.equal(f.recordedRecurringIncome(data,salary,'2026-09-20',20),false);
  }
});
test('legacy receipts match recurring name, while explicit IDs distinguish same-name schedules', () => {
  assert.equal(f.recordedRecurringIncome({transactions:[receipt({recurringId:undefined})]},salary,'2026-09-10'),true);
  assert.equal(f.recordedRecurringIncome({transactions:[receipt({recurringId:8})]},salary,'2026-09-10'),false);
  assert.equal(f.recordedRecurringIncome({transactions:[receipt({recurringId:undefined,recurring:false})]},salary,'2026-09-10'),false);
  assert.equal(f.recordedRecurringIncome({transactions:[receipt({merchant:'Old salary name'})]},salary,'2026-09-10'),true);
});
test('guard applies only to income and permits recording again after a receipt is deleted', () => {
  assert.equal(f.recordedRecurringIncome({transactions:[receipt({type:'expense'})]},salary,'2026-09-10'),false);
  assert.equal(f.recordedRecurringIncome({transactions:[]},salary,'2026-09-10'),false);
  assert.equal(f.recordedRecurringIncome({transactions:[receipt()]},{...salary,type:'expense'},'2026-09-10'),false);
});

// Execute the real form and synchronous account write code, with only DOM/storage
// adapters replaced. Keeping both dialogs open reproduces stale form submissions.
function harness(entry=salary,transactions=[]) {
  let saved={openingBalance:1000,goals:[],reserves:[],bills:[],household:[],recurring:[entry],transactions};
  const dialogs=[],messages=[],writes=[],events=[];
  let current;
  const context={
    window:{LemonFinance:f,dispatchEvent:e=>events.push(e)},
    CustomEvent:class{constructor(type,options){this.type=type;this.detail=options.detail;}},
    getData:()=>saved, getActiveAccount:()=>({id:'qa'}),accountDataKey:id=>id,
    budgetCycleStartDay:()=>6,savingsDate:()=> '2026-09-06',
    writeJson:(key,data)=>{saved=JSON.parse(JSON.stringify(data));writes.push(saved);},
    modal:()=>{current={fields:{},buttons:{},layer:{},body:{append(){}},actions:{append(){}}};dialogs.push(current);return current;},
    field:(name,value)=>{const control={value};current.fields[name]=control;return {control,wrap:{}};},
    button:(label,style,callback)=>{current.buttons[label]=callback;return {};},
    closeLayer:()=>{},showToast:message=>messages.push(message),numberValue:control=>Number(control.value),
    validateBudgetDate:()=>true,monthFromDate:date=>Number(date.slice(5,7))-1
  };
  vm.createContext(context);
  const source=fs.readFileSync(path.join(__dirname,'../renderer/lemon-glass-actions.js'),'utf8');
  vm.runInContext(source.slice(source.indexOf('  const updateData ='),source.indexOf('  const element ='))+
    source.slice(source.indexOf('  function payRecurring(id)'),source.indexOf('  function payBill(')),context);
  return {open(){vm.runInContext('payRecurring(7)',context);current.fields['Payment date'].value='2026-09-09';return current;},
    data:()=>saved,messages,writes,events};
}
test('rapid repeat submits and a second open form insert income exactly once', () => {
  const h=harness(),first=h.open(),second=h.open();
  first.buttons['Record income']();
  first.buttons['Record income']();
  second.buttons['Record income']();
  assert.equal(h.writes.length,1);
  assert.equal(h.events.length,1);
  assert.equal(h.data().transactions.length,1);
  assert.equal(h.data().transactions[0].amount,500);
  assert.equal(f.report(h.data(),'2026-09',1)[0].ending,1500);
  assert.match(h.messages.at(-1),/Income already recorded.*Transactions/);
});
test('reopening from persisted pending income blocks even a different amount', () => {
  const h=harness(salary,JSON.parse(JSON.stringify([receipt({cleared:false,amount:200})]))),dialog=h.open();
  dialog.fields.Amount.value=300;
  dialog.buttons['Record income']();
  assert.equal(h.writes.length,0);
  assert.equal(h.data().transactions.length,1);
  assert.equal(h.data().transactions[0].amount,200);
  assert.match(h.messages.at(-1),/already recorded/);
});
test('form allows the next budget cycle and an account with no existing receipt', () => {
  const h=harness(salary,[receipt()]),dialog=h.open();
  dialog.fields['Payment date'].value='2026-10-06';
  dialog.buttons['Record income']();
  assert.equal(h.data().transactions.length,2);
  const other=harness(),otherDialog=other.open();
  otherDialog.buttons['Record income']();
  assert.equal(other.data().transactions.length,1);
});
test('rapid expense submissions and a second open form record only one payment', () => {
  const h=harness({...salary,type:'expense',category:'Housing',reserved:true}),dialog=h.open(),second=h.open();
  dialog.buttons['Record payment']();
  dialog.buttons['Record payment']();
  second.buttons['Record payment']();
  assert.equal(h.data().transactions.length,1);
  assert.equal(h.data().transactions[0].type,'expense');
  assert.equal(h.writes.length,1);
  assert.equal(h.events.length,1);
  const row=f.report(h.data(),'2026-09',1)[0];
  assert.equal(row.ending,500);
  assert.equal(row.available,500);
  assert.equal(row.expenses,500);
  assert.equal(row.reserved,0);
  assert.match(h.messages.at(-1),/Payment already recorded.*Transactions/);
});

const expense = {...salary,name:'Rent',type:'expense',category:'Housing'};
const payment = extra => receipt({merchant:'Rent',type:'expense',category:'Housing',...extra});
test('expense duplicate detection respects cycle boundaries, years and custom start days', () => {
  const data={transactions:[payment()]};
  assert.equal(f.recordedRecurringPayment(data,expense,'2026-10-05',6),true);
  assert.equal(f.recordedRecurringPayment(data,expense,'2026-10-06',6),false);
  assert.equal(f.recordedRecurringPayment(data,expense,'2027-09-09',6),false);
  assert.equal(f.recordedRecurringPayment(data,expense,'2026-09-20',20),false);
});
test('reloaded pending or partial expense prevents another recording even with a changed amount', () => {
  for(const cleared of [true,false]) {
    const saved=JSON.parse(JSON.stringify([payment({amount:200,cleared})]));
    const h=harness(expense,saved),dialog=h.open();
    dialog.fields.Amount.value=300;
    dialog.buttons['Record payment']();
    assert.equal(h.writes.length,0);
    assert.deepEqual(h.data().transactions,saved);
    assert.match(h.messages.at(-1),/Payment already recorded/);
  }
});
test('expense links distinguish schedules, manual transactions and income', () => {
  assert.equal(f.recordedRecurringPayment({transactions:[payment({recurringId:undefined})]},expense,'2026-09-09'),true);
  assert.equal(f.recordedRecurringPayment({transactions:[payment({recurringId:8})]},expense,'2026-09-09'),false);
  assert.equal(f.recordedRecurringPayment({transactions:[payment({recurringId:undefined,recurring:false})]},expense,'2026-09-09'),false);
  assert.equal(f.recordedRecurringPayment({transactions:[payment({merchant:'Previous name'})]},expense,'2026-09-09'),true);
  assert.equal(f.recordedRecurringPayment({transactions:[receipt()]},expense,'2026-09-09'),false);
});
test('next-cycle expenses and replacement of deleted payments remain possible without changing another account', () => {
  const h=harness(expense,[payment()]),dialog=h.open();
  dialog.fields['Payment date'].value='2026-10-06';
  dialog.buttons['Record payment']();
  assert.equal(h.data().transactions.length,2);
  const other=harness(expense),otherDialog=other.open();
  otherDialog.buttons['Record payment']();
  assert.equal(other.data().transactions.length,1);
  assert.equal(h.data().transactions.length,2);
  other.data().transactions=[];
  other.open().buttons['Record payment']();
  assert.equal(other.data().transactions.length,1);
});
