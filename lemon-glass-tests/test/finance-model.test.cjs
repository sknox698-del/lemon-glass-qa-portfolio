const test=require('node:test'),assert=require('node:assert/strict');
const f=require('../renderer/finance-model.js');
const base=()=>({openingBalance:0,transactions:[],bills:[],recurring:[],household:[],reserves:[]});
test('budget months cross the year in order and honor shorter durations',()=>{
 assert.deepEqual(f.months('2026-09',12).map(m=>m.short),['Sept 26','Oct 26','Nov 26','Dec 26','Jan 27','Feb 27','Mar 27','Apr 27','May 27','Jun 27','Jul 27','Aug 27']);
 assert.deepEqual(f.months('2026-09',4).map(m=>m.key),['2026-09','2026-10','2026-11','2026-12']);
});
test('opening balance is visible in its opening month and counted once',()=>{
 const d=base();d.transactions=[{id:1,paymentMethod:'Opening balance',date:'2026-09-01',type:'income',amount:250}];
 const rows=f.report(d,'2026-09',12,6);assert.equal(rows[0].income,250);assert.equal(rows[11].ending,250);
 assert.equal(f.cycle({date:'2026-09-01'},6),'2026-08');
});
test('income schedules never reduce available money and recorded income increases it',()=>{
 const d=base();d.recurring=[{id:'salary',category:'Income',amount:1000,startMonthKey:'2026-09',frequency:'Monthly'}];
 let row=f.report(d,'2026-09',1,6)[0];assert.equal(row.expenses,0);assert.equal(row.available,0);assert.equal(row.expectedIncome,1000);
 d.transactions=[{recurringId:'salary',date:'2026-09-08',type:'income',amount:1000}];row=f.report(d,'2026-09',1,6)[0];assert.equal(row.income,1000);assert.equal(row.available,1000);assert.equal(row.expectedIncome,0);
});
test('recurring payment edits, deletions, pauses and schedule changes recalculate remaining commitments',()=>{
 const d=base();d.openingBalance=500;d.recurring=[{id:'r',amount:100,type:'expense',startMonthKey:'2026-09'}];
 d.transactions=[{id:'p',recurringId:'r',date:'2026-09-08',type:'expense',amount:40}];
 assert.equal(f.report(d,'2026-09',1)[0].available,400);
 d.recurring[0].amount=150;assert.equal(f.report(d,'2026-09',1)[0].available,350);
 d.transactions=[];assert.equal(f.report(d,'2026-09',1)[0].available,350);
 d.recurring[0].paused=true;assert.equal(f.report(d,'2026-09',1)[0].available,500);
 d.recurring[0].paused=false;d.recurring[0].startMonthKey='2026-10';assert.equal(f.report(d,'2026-09',1)[0].available,500);
});
test('quarterly and yearly schedules respect start year',()=>{
 assert.equal(f.applies({startMonthKey:'2026-11',frequency:'Quarterly'},'2027-02','2026-09'),true);
 assert.equal(f.applies({startMonthKey:'2026-11',frequency:'Quarterly'},'2026-08','2026-09'),false);
 assert.equal(f.applies({startMonthKey:'2026-11',frequency:'Yearly'},'2027-11','2026-09'),true);
});
test('deleting or reducing a bill transaction reopens the bill; changing type invalidates payment',()=>{
 const before={...base(),bills:[{id:'b',amount:100,status:'paid'}],transactions:[{id:'p',billId:'b',type:'expense',amount:100,date:'2026-09-08'}]};
 for(const transactions of [[],[{...before.transactions[0],amount:30}],[{...before.transactions[0],type:'income'}]])assert.equal(f.reconcile(before,{...before,transactions}).bills[0].status,'upcoming');
 assert.equal(f.reconcile(before,{...before,bills:[{...before.bills[0],amount:150}]}).bills[0].status,'upcoming');
});
test('household partial payment edits and deletions reconcile both cycles without losing manual payments',()=>{
 const before={...base(),household:[{id:'h',paidByCycle:{'2026-09':125}}],transactions:[{id:'p',householdMemberId:'h',type:'income',amount:100,date:'2026-09-08'}]};
 assert.equal(f.reconcile(before,{...before,transactions:[]}).household[0].paidByCycle['2026-09'],25);
 const moved=f.reconcile(before,{...before,transactions:[{...before.transactions[0],amount:50,date:'2026-10-08'}]}).household[0].paidByCycle;
 assert.equal(moved['2026-09'],25);assert.equal(moved['2026-10'],50);
 const next={...before,household:[{id:'h',paidByCycle:{'2026-09':175}}],transactions:[...before.transactions,{id:'p2',householdMemberId:'h',type:'income',amount:50,date:'2026-09-09'}]};
 assert.equal(f.reconcile(before,next).household[0].paidByCycle['2026-09'],175);
});
test('year-separated transactions and savings stay in their own report cycles',()=>{
 const d=base();d.goals=[{id:1,current:100}];d.transactions=[{date:'2026-09-08',type:'income',amount:1000},{date:'2027-09-08',type:'income',amount:9999}];d.reserves=[{amount:100,goalId:1,reservedAt:'2026-10-08'}];
 const rows=f.report(d,'2026-09',4);assert.equal(rows.reduce((s,r)=>s+r.income,0),1000);assert.equal(rows[0].savings,0);assert.equal(rows[1].savings,100);assert.equal(rows[1].available,900);
});

test('recurring expense reserve appears in totals without deducting the expense twice',()=>{
 const d=base();d.openingBalance=1000;d.recurring=[{id:'rent',amount:200,type:'expense',reserved:true,startMonthKey:'2026-09'}];
 const r=f.reserveSummary(d,'2026-09','2026-09');assert.equal(r.total,200);assert.equal(r.expenseOverlap,200);assert.equal(r.entries[0].type,'Recurring expenses');
 assert.equal(f.report(d,'2026-09',1)[0].available,800);
 d.transactions=[{recurringId:'rent',amount:50,type:'expense',date:'2026-09-08'}];assert.equal(f.reserveSummary(d,'2026-09','2026-09').total,150);assert.equal(f.report(d,'2026-09',1)[0].available,800);
 d.transactions[0].amount=200;assert.equal(f.reserveSummary(d,'2026-09','2026-09').total,0);assert.equal(f.report(d,'2026-09',1)[0].available,800);
});
test('recurring income can be reserved before and after receipt without inventing bank income',()=>{
 const d=base();d.openingBalance=1000;d.recurring=[{id:'salary',type:'income',amount:300,reserved:true,startMonthKey:'2026-09'}];
 let r=f.report(d,'2026-09',1)[0];assert.equal(r.reserved,300);assert.equal(r.ending,1000);assert.equal(r.available,1000);
 d.transactions=[{recurringId:'salary',date:'2026-09-08',type:'income',amount:300}];r=f.report(d,'2026-09',1)[0];assert.equal(r.reserved,300);assert.equal(r.ending,1300);assert.equal(r.available,1300);
});
test('reserve edits, pauses, removal and cycle releases recalculate dynamically',()=>{
 const d=base();d.recurring=[{id:'r',type:'income',amount:200,reserved:true,startMonthKey:'2026-12',frequency:'Quarterly'}];
 assert.equal(f.reserveSummary(d,'2027-03','2026-09').total,200);assert.equal(f.reserveSummary(d,'2027-02','2026-09').total,0);
 d.recurring[0].amount=350;assert.equal(f.reserveSummary(d,'2027-03','2026-09').total,350);
 d.recurring[0].reserveReleasedCycles=['2027-03'];assert.equal(f.reserveSummary(d,'2027-03','2026-09').total,0);assert.equal(f.reserveSummary(d,'2027-06','2026-09').total,350);
 d.recurring[0].paused=true;assert.equal(f.reserveSummary(d,'2027-06','2026-09').total,0);
 d.recurring=[];assert.equal(f.reserveSummary(d,'2027-06','2026-09').total,0);
});
test('manual, bill, recurring expense and recurring income reserves share one cycle-scoped total',()=>{
 const d=base();d.openingBalance=2000;
 d.reserves=[{id:1,amount:50,reservedAt:'2026-09-08'},{id:2,amount:999,reservedAt:'2026-10-08'}];
 d.bills=[{id:'b',reserved:100,due:'2026-09-08',status:'upcoming'}];
 d.recurring=[{id:'e',type:'expense',amount:200,reserved:true,startMonthKey:'2026-09'},{id:'i',type:'income',amount:300,reserved:true,startMonthKey:'2026-09'}];
 const summary=f.reserveSummary(d,'2026-09','2026-09');assert.equal(summary.total,650);assert.equal(summary.entries.length,4);assert.equal(summary.expenseOverlap,200);
 const row=f.report(d,'2026-09',1)[0];assert.equal(row.reserved,650);assert.equal(row.available,1650);
});

test('reserved recurring income credits bank balance and never behaves as a debit',()=>{
 const d=base();d.openingBalance=1000;d.recurring=[{id:'credit',type:'income',category:'Income',amount:300,reserved:true,startMonthKey:'2026-09'}];
 let row=f.report(d,'2026-09',1)[0];assert.equal(row.ending,1000);assert.equal(row.available,1000);assert.equal(row.expenses,0);assert.equal(f.reserveSummary(d,'2026-09','2026-09').pendingIncome,300);
 d.transactions=[{id:'receipt',recurringId:'credit',type:'income',amount:100,date:'2026-09-09',cleared:true}];
 row=f.report(d,'2026-09',1)[0];assert.equal(row.ending,1100);assert.equal(row.available,1100);assert.equal(row.income,100);assert.equal(row.expenses,0);assert.equal(f.reserveSummary(d,'2026-09','2026-09').pendingIncome,200);
 d.transactions[0].amount=300;row=f.report(d,'2026-09',1)[0];assert.equal(row.ending,1300);assert.equal(row.available,1300);assert.equal(row.expenses,0);
 d.recurring[0].reserveReleasedCycles=['2026-09'];row=f.report(d,'2026-09',1)[0];assert.equal(row.available,1300);
});
test('deleting a reserved recurring income receipt removes the credit and releases its unfunded hold',()=>{
 const d=base();d.openingBalance=1000;d.recurring=[{id:'r',type:'income',amount:300,reserved:true,startMonthKey:'2026-09'}];
 d.transactions=[{recurringId:'r',type:'income',amount:300,date:'2026-09-09'}];assert.equal(f.report(d,'2026-09',1)[0].ending,1300);
 d.transactions=[];const row=f.report(d,'2026-09',1)[0];assert.equal(row.ending,1000);assert.equal(row.available,1000);assert.equal(row.expenses,0);
});

test('available spending includes received recurring income once while deducting real holds and expenses',()=>{
 const d=base();d.openingBalance=5000;
 d.transactions=[{recurringId:'salary',amount:2500,type:'income',date:'2026-09-09',cleared:true}];
 d.recurring=[{id:'salary',type:'income',amount:2500,reserved:true,startMonthKey:'2026-09'},{id:'rent',type:'expense',amount:1000,reserved:true,startMonthKey:'2026-09'}];
 d.reserves=[{id:'saving',amount:500,type:'Savings',reservedAt:'2026-09-09'}];d.bills=[{id:'bill',reserved:200,status:'upcoming',due:'2026-09-09'}];
 const reserve=f.reserveSummary(d,'2026-09','2026-09'),row=f.report(d,'2026-09',1)[0];
 assert.equal(reserve.total,4200);assert.equal(reserve.incomeCredits,2500);assert.equal(reserve.deductibleTotal,1700);
 assert.equal(row.ending,7500);assert.equal(row.available,5800);assert.equal(row.expenses,1000);
 d.recurring[0].reserved=false;assert.equal(f.report(d,'2026-09',1)[0].available,5800);assert.equal(f.report(d,'2026-09',1)[0].ending,7500);
});
test('income reserve amount changes and releases never debit or create available money',()=>{
 const d=base();d.openingBalance=1000;d.transactions=[{type:'income',recurringId:'salary',amount:300,date:'2026-09-09'}];d.recurring=[{id:'salary',type:'income',amount:300,reserved:true,startMonthKey:'2026-09'}];
 for(const amount of [100,300,1000]){d.recurring[0].amount=amount;assert.equal(f.report(d,'2026-09',1)[0].available,1300)}
 d.recurring[0].reserveReleasedCycles=['2026-09'];assert.equal(f.report(d,'2026-09',1)[0].available,1300);
 d.transactions=[];assert.equal(f.report(d,'2026-09',1)[0].available,1000);
});
