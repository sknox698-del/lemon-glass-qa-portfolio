(function (root) {
  'use strict';
  const money = value => Math.round((Number(value) || 0) * 100) / 100;
  const validTransactionAmount = value => typeof value === 'number' && Number.isFinite(value) && value > 0;
  const kind = entry => entry.type || (entry.category === 'Income' ? 'income' : 'expense');
  const opening = entry => entry.openingBalanceEntry || entry.paymentMethod === 'Opening balance';
  const cycle = (entry, startDay = 6) => {
    if (opening(entry)) return entry.openingMonth || String(entry.date || '').slice(0, 7);
    const date = new Date(`${entry.date || entry.due || entry.paidDate}T12:00:00`);
    if (Number.isNaN(date.getTime())) return '';
    if (date.getDate() < startDay) date.setMonth(date.getMonth() - 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  };
  const months = (start, duration) => Array.from({length: Math.max(1, Number(duration) || 12)}, (_, offset) => {
    const date = new Date(`${start}-01T12:00:00`);
    date.setMonth(date.getMonth() + offset);
    return {key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
      month: date.toLocaleDateString('en-GB', {month: 'long', year: 'numeric'}),
      short: date.toLocaleDateString('en-GB', {month: 'short', year: '2-digit'})};
  });
  const applies = (entry, key, start) => {
    if (entry.paused) return false;
    const origin = entry.startMonthKey || `${start.slice(0,4)}-${String((entry.startMonth ?? 0) + 1).padStart(2,'0')}`;
    const delta = (Number(key.slice(0,4)) - Number(origin.slice(0,4))) * 12 + Number(key.slice(5)) - Number(origin.slice(5));
    return delta >= 0 && delta % (entry.frequency === 'Quarterly' ? 3 : entry.frequency === 'Yearly' ? 12 : 1) === 0;
  };
  const linked = (transaction, entry) => transaction.recurringId != null
    ? String(transaction.recurringId) === String(entry.id)
    : transaction.recurring && transaction.merchant === entry.name;
  const remaining = (entry, transactions) => Math.max(0, money(entry.amount - transactions
    .filter(t => kind(t) === kind(entry) && linked(t, entry)).reduce((sum,t) => sum + money(t.amount), 0)));
  // Pending activity counts too: mark it cleared instead of recording again.
  const recordedRecurringPayment = (data, entry, date, startDay = 6) =>
    (data.transactions || []).some(t => kind(t) === kind(entry) && linked(t, entry) &&
      cycle(t, startDay) === cycle({date}, startDay));
  const recordedRecurringIncome = (data, entry, date, startDay = 6) => kind(entry) === 'income' &&
    recordedRecurringPayment(data, entry, date, startDay);
  // Goal balances own savings. A goal-linked hold cannot outlive its goal.
  // Match IDs only: an ordinary reserve may have the same name as a deleted goal.
  const syncSavings = (data, date = '1970-01-01') => {
    const goalIds = new Set((data.goals || []).map(goal => String(goal.id)));
    let reserves = (data.reserves || []).filter(r => r.goalId == null || goalIds.has(String(r.goalId)));
    const goals = (data.goals || []).map(goal => {
      const current = Number.isFinite(Number(goal.current)) ? Math.max(0, money(goal.current)) : 0;
      const matches = r => r.goalId != null && String(r.goalId) === String(goal.id);
      const linked = reserves.filter(matches).map(r => ({...r, amount:Number.isFinite(Number(r.amount)) ? Math.max(0, money(r.amount)) : 0,
        reservedAt:cycle({date:r.reservedAt}) ? r.reservedAt : date}));
      let excess = money(linked.reduce((sum,r) => sum + r.amount, 0) - current);
      // Reduce the latest allocations first, preserving earlier contribution dates.
      for (const r of [...linked].sort((a,b) => b.reservedAt.localeCompare(a.reservedAt))) {
        const reduction = Math.min(r.amount, Math.max(0, excess));
        r.amount = money(r.amount - reduction); excess = money(excess - reduction);
      }
      if (excess < 0) {
        const existing = linked.find(r => r.reservedAt === date);
        if (existing) existing.amount = money(existing.amount - excess);
        else linked.push({id:`goal-reserve-${goal.id}-${date}`, goalId:goal.id,
          name:`${goal.name} savings`, amount:money(-excess), type:'Savings',
          note:'Protected savings goal balance', reservedAt:date});
      }
      reserves = [...reserves.filter(r => !matches(r)), ...linked.filter(r => r.amount > 0)
        .map(r => ({...r, name:`${goal.name} savings`, type:'Savings'}))];
      return {...goal,current};
    });
    return {...data,goals,reserves};
  };
  const contributeSavings = (data, id, amount, date) => {
    const before = syncSavings(data, date);
    return syncSavings({...before, goals:before.goals.map(g => String(g.id) === String(id)
      ? {...g, current:money(g.current + Math.min(Math.max(0,money(amount)), Math.max(0,money(g.target - g.current))))} : g)}, date);
  };
  const releaseSavings = (data, id, date) => {
    const before = syncSavings(data, date);
    const reserve = before.reserves.find(r => String(r.id) === String(id));
    if (!reserve || reserve.goalId == null) return before;
    return syncSavings({...before, reserves:before.reserves.filter(r => r !== reserve),
      goals:before.goals.map(g => String(g.id) === String(reserve.goalId)
        ? {...g,current:Math.max(0,money(g.current - reserve.amount))} : g)}, date);
  };
  const reserveEntries = (data, key, start, startDay = 6) => {
    data = syncSavings(data, `${start}-${String(startDay).padStart(2,'0')}`);
    const transactions = (data.transactions || []).filter(t => cycle(t, startDay) === key);
    const manual = (data.reserves || []).filter(r =>
      (r.goalId != null && data.goals.some(g => String(g.id) === String(r.goalId))) || cycle({date:r.reservedAt}, startDay) === key);
    const bills = (data.bills || []).filter(b => b.status !== 'paid' && Number(b.reserved) > 0 && cycle({date:b.reservedAt || b.due}, startDay) === key)
      .map(b => ({id:'bill-reserve-' + b.id, reserveSource:'bill', sourceId:b.id, name:b.name, amount:money(b.reserved), type:'Bills', note:'Reserved for this bill', cycleKey:key}));
    const recurring = (data.recurring || []).filter(r => r.reserved && applies(r,key,start) && !(r.reserveReleasedCycles || []).includes(key))
      .map(r => ({id:'recurring-reserve-' + r.id, reserveSource:'recurring', sourceId:r.id, name:r.name,
        amount:kind(r) === 'income' ? money(r.amount) : remaining(r,transactions),
        type:kind(r) === 'income' ? 'Recurring income' : 'Recurring expenses',
        pendingIncome:kind(r) === 'income' ? remaining(r,transactions) : 0,
        expenseCommitment:kind(r) === 'expense', incomeCredit:kind(r) === 'income', cycleKey:key,
        note:kind(r) === 'income' ? 'Income credit tracked here; already included in the balance when received, never deducted again' : 'Unpaid recurring expense; counted once in available money'})).filter(r => r.amount > 0);
    return [...manual,...bills,...recurring];
  };
  const reserveSummary = (data,key,start,startDay = 6) => {
    const entries = reserveEntries(data,key,start,startDay);
    return {entries,total:money(entries.reduce((sum,r)=>sum+money(r.amount),0)),
      incomeCredits:money(entries.filter(r=>r.incomeCredit).reduce((sum,r)=>sum+money(r.amount),0)),
      deductibleTotal:money(entries.filter(r=>!r.incomeCredit).reduce((sum,r)=>sum+money(r.amount),0)),
      pendingIncome:money(entries.reduce((sum,r)=>sum+money(r.pendingIncome),0)),
      expenseOverlap:money(entries.filter(r=>r.expenseCommitment).reduce((sum,r)=>sum+money(r.amount),0))};
  };
  const report = (data, start, duration, startDay = 6) => {
    data = syncSavings(data, `${start}-${String(startDay).padStart(2,'0')}`);
    let balance = money(data.openingBalance);
    return months(start, duration).map(month => {
      const transactions = (data.transactions || []).filter(t => cycle(t, startDay) === month.key);
      const income = money(transactions.filter(t => kind(t) === 'income').reduce((sum,t) => sum + money(t.amount), 0));
      const actualExpenses = money(transactions.filter(t => kind(t) === 'expense').reduce((sum,t) => sum + money(t.amount), 0));
      const scheduled = (data.recurring || []).filter(r => applies(r, month.key, start));
      const committed = money(scheduled.filter(r => kind(r) === 'expense').reduce((sum,r) => sum + remaining(r, transactions), 0));
      const expectedIncome = money(scheduled.filter(r => kind(r) === 'income').reduce((sum,r) => sum + remaining(r, transactions), 0));
      const reserves = (data.reserves || []).filter(r => cycle({date:r.reservedAt}, startDay) === month.key);
      const reserve = reserveSummary(data, month.key, start, startDay), reserved = reserve.total;
      const savings = money(reserves.filter(r => r.goalId != null).reduce((sum,r) => sum + money(r.amount), 0));
      balance = money(balance + income - actualExpenses);
      return {...month, income, actualExpenses, expectedIncome, expenses:money(actualExpenses + committed), savings,
        ending:balance, reserved, available:money(balance - committed - reserve.deductibleTotal + reserve.expenseOverlap), net:money(income - actualExpenses)};
    });
  };
  // Adjust only transaction-driven changes; preserve manually entered household payments.
  const reconcile = (before, next, startDay = 6) => {
    const oldTx = before.transactions || [], newTx = next.transactions || [];
    const bills = (next.bills || []).map(bill => {
      const hasLink = list => list.some(t => t.billId != null && String(t.billId) === String(bill.id));
      if (!hasLink(oldTx) && !hasLink(newTx)) return bill;
      const paid = money(newTx.filter(t => t.billId != null && String(t.billId) === String(bill.id) && kind(t) === 'expense').reduce((sum,t) => sum + money(t.amount),0));
      return {...bill, status:paid >= money(bill.amount) && paid > 0 ? 'paid' : 'upcoming'};
    });
    const household = (next.household || []).map(member => {
      let paidByCycle = {...member.paidByCycle};
      const keys = new Set([...oldTx,...newTx].filter(t => String(t.householdMemberId) === String(member.id)).map(t => cycle(t,startDay)));
      const total = (list,key) => money(list.filter(t => String(t.householdMemberId) === String(member.id) && kind(t) === 'income' && cycle(t,startDay) === key).reduce((sum,t) => sum + money(t.amount),0));
      const oldMember = (before.household || []).find(m => String(m.id) === String(member.id));
      for (const key of keys) {
        // Contribution forms already increment their member's paid total.
        if (money(paidByCycle[key]) !== money(oldMember?.paidByCycle?.[key])) continue;
        paidByCycle[key] = Math.max(0,money(money(paidByCycle[key]) + total(newTx,key) - total(oldTx,key)));
      }
      return {...member,paidByCycle};
    });
    return {...next,bills,household};
  };
  const api = {money,validTransactionAmount,kind,opening,cycle,months,applies,remaining,recordedRecurringPayment,recordedRecurringIncome,syncSavings,contributeSavings,releaseSavings,reserveEntries,reserveSummary,report,reconcile};
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.LemonFinance = api;
})(typeof window === 'object' ? window : globalThis);
