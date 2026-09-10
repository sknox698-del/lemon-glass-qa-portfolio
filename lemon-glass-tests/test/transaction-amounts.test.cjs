const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const f=require('../renderer/finance-model.js');
const bundle=fs.readFileSync(path.join(__dirname,'../renderer/assets/index-Cvs3_7yw.js'),'utf8');
const actions=fs.readFileSync(path.join(__dirname,'../renderer/lemon-glass-actions.js'),'utf8');
function quick(type,amount,keepOpen=false) {
  let transactions=[],otherWrites=0,closed=0;const messages=[];
  const context={window:{LemonFinance:f,LemonGlass:{validateBudgetDate:()=>true}},
    e:type,g:amount,d:'Test',y:'2026-09-09',S:'Other',C:'',b:true,avPaymentMethod:'Cash',
    h:message=>messages.push(message),i:updater=>transactions=updater(transactions),
    l:()=>otherWrites++,u:()=>otherWrites++,o:()=>otherWrites++,t:()=>closed++,
    m:()=>{},_:()=>{},T:()=>{},E:()=>{},L:()=>{},V:()=>{},avSetPaymentMethod:()=>{},jm:()=>8};
  vm.createContext(context);
  const start=bundle.indexOf('    X = (W = !1) =>',bundle.indexOf('function D7('));
  const end=bundle.indexOf('\n    O = {',start);
  vm.runInContext('const '+bundle.slice(start,end).trim().replace(/,$/,';')+'\nglobalThis.submit=X;',context);
  context.submit(keepOpen);
  return {transactions,otherWrites,closed,messages};
}
test('Quick Add and Save-and-add-another reject negative, zero, blank and non-finite amounts',()=>{
  for(const type of ['expense','income','bill','goal','aside'])for(const amount of ['-50','-50,00 €','0','-0','', 'NaN','Infinity','1e309','nonsense'])for(const keep of [false,true]) {
    const result=quick(type,amount,keep);
    assert.equal(result.transactions.length,0,`${type}: ${amount}`);
    assert.equal(result.otherWrites,0);
    assert.equal(result.closed,0);
    assert.match(result.messages[0],/greater than zero/);
  }
});
test('positive localized amounts are stored unsigned and transaction type determines totals',()=>{
  for(const [amount,expected] of [['50',50],['50,25',50.25],['1.234,56 €',1234.56],['0,01',0.01]])for(const type of ['expense','income']) {
    const result=quick(type,amount);
    assert.equal(result.transactions.length,1);
    assert.equal(result.transactions[0].amount,expected);
    assert.equal(result.transactions[0].type,type);
    const row=f.report({openingBalance:2000,transactions:result.transactions},'2026-09',1)[0];
    assert.equal(row.ending,f.money(2000+(type==='income'?expected:-expected)));
    assert.equal(row.expenses,type==='expense'?expected:0);
  }
});
test('real transaction editor rejects invalid input without changing the original and accepts a positive repair',()=>{
  let saved={transactions:[{id:1,merchant:'Test',amount:-50,type:'expense',date:'2026-09-09',category:'Other'}]};
  const controls={},buttons={},messages=[];let writes=0;
  const stub=()=>({append(){},appendChild(){}});
  const context={window:{LemonFinance:f},getData:()=>saved,getCategories:()=>['Other','Income'],
    modal:()=>({body:stub(),actions:stub(),layer:{}}),element:stub,
    field:(label,value)=>{const control={value,addEventListener(){}};controls[label]=control;return{control,wrap:{}};},
    button:(label,style,callback)=>{buttons[label]=callback;return{};},
    closeLayer:()=>{},showToast:message=>messages.push(message),monthFromDate:()=>8,validateBudgetDate:()=>true,
    updateData:updater=>{saved=updater(saved);writes++;}};
  vm.createContext(context);
  vm.runInContext(actions.slice(actions.indexOf('  const numberValue ='),actions.indexOf('  const monthFromDate ='))+
    actions.slice(actions.indexOf('  function editTransaction(id)'),actions.indexOf('  function deleteTransaction(')),context);
  context.editTransaction(1);
  for(const value of ['-50','-50,00','0','','Infinity','bad']) {
    controls.Amount.value=value;buttons['Save changes']();assert.equal(writes,0);assert.equal(saved.transactions[0].amount,-50);
    assert.match(messages.at(-1),/greater than zero/);
  }
  controls.Amount.value='50,00';buttons['Save changes']();
  assert.equal(writes,1);assert.equal(saved.transactions[0].amount,50);assert.equal(saved.transactions[0].type,'expense');
});
test('workbook import skips invalid amounts with a count and keeps valid debit and credit signs by type',async()=>{
  let saved=[];const messages=[];
  const rows=[['Description','Debit','Credit','Date'],['Bad debit',-50,0,'2026-09-09'],['Bad credit',0,-50,'2026-09-09'],
    ['Infinite',Infinity,0,'2026-09-09'],['Malformed','oops',0,'2026-09-09'],['Empty',0,0,'2026-09-09'],
    ['Expense',50,0,'2026-09-09'],['Income',0,100,'2026-09-09']];
  const context={window:{LemonFinance:f},Nh:()=>({SheetNames:['Sep'],Sheets:{Sep:{}}}),hr:{sheet_to_json:()=>rows},avBudgetYear:2026,
    avSetTransactions:updater=>saved=updater(saved),re:message=>messages.push(message),Oe:{current:null}};
  vm.createContext(context);
  const start=bundle.indexOf('    Mt = async (Ee) =>');
  const code=bundle.slice(start,bundle.indexOf('\n    },',start)+7).trim().replace(/,$/,';');
  vm.runInContext('const '+code+'\nglobalThis.importWorkbook=Mt;',context);
  await context.importWorkbook({name:'qa.xlsx',arrayBuffer:async()=>new ArrayBuffer(0)});
  assert.equal(saved.length,2);
  assert.equal(saved[0].amount,50);assert.equal(saved[0].type,'expense');
  assert.equal(saved[1].amount,100);assert.equal(saved[1].type,'income');
  assert.match(messages[0],/4 rows skipped/);
});
test('direct bill payment rejects invalid amounts before bill status or transactions change',()=>{
  let writes=0;const messages=[];
  const context={window:{LemonFinance:f},avSetBills:()=>writes++,avSetTransactions:()=>writes++,re:message=>messages.push(message)};
  vm.createContext(context);
  const start=bundle.indexOf('    Ze = (Ee) =>',bundle.indexOf('function d7()'));
  const code=bundle.slice(start,bundle.indexOf('\n    ht =',start)).trim().replace(/,$/,';');
  vm.runInContext('const '+code+'\nglobalThis.pay=Ze;',context);
  for(const amount of [-50,0,NaN,Infinity])context.pay({id:1,amount,status:'upcoming'});
  assert.equal(writes,0);assert.equal(messages.length,4);
  context.pay({id:1,amount:50,status:'upcoming'});assert.equal(writes,2);
});
test('bill payment dialog saves only a finite positive outstanding amount',()=>{
  for(const [amount,paid,expected] of [[-50,0,null],[0,0,null],[Infinity,0,null],[50,50,null],[50,75,null],[50,20,30]]) {
    let saved={bills:[{id:1,name:'Bill',amount,due:'2026-09-09',status:'upcoming'}],transactions:paid?[{billId:1,type:'expense',amount:paid}]:[]};
    let writes=0;const buttons={},messages=[];const stub=()=>({append(){},appendChild(){}});
    const context={window:{LemonFinance:f},getData:()=>saved,cycleKeyFromDate:()=> '2026-09',selectedBudgetMonth:()=> '2026-09',
      modal:()=>({body:stub(),actions:stub(),layer:{}}),element:stub,field:(label,value)=>({control:{value},wrap:{}}),
      button:(label,style,callback)=>{buttons[label]=callback;return{};},closeLayer:()=>{},showToast:message=>messages.push(message),
      addMonths:()=> '2026-10-09',formatDate:value=>value,monthFromDate:()=>8,validateBudgetDate:()=>true,
      updateData:updater=>{saved=updater(saved);writes++;}};
    vm.createContext(context);
    vm.runInContext(actions.slice(actions.indexOf('  function payBill('),actions.indexOf('  function deleteBill(')),context);
    context.payBill(1);buttons['Save payment']();
    assert.equal(writes,expected===null?0:1);
    if(expected===null){assert.equal(saved.bills[0].status,'upcoming');assert.match(messages[0],/greater than zero/);}
    else assert.equal(saved.transactions[0].amount,expected);
  }
});
