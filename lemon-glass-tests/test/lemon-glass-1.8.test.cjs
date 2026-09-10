const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('the completed account-period and recurring-cycle work remains present', () => {
  const onboarding = read('renderer/account-onboarding.js');
  const actions = read('renderer/lemon-glass-actions.js');
  const bundle = read('renderer/assets/index-Cvs3_7yw.js');

  assert.match(onboarding, /budgetStartMonth/);
  assert.match(onboarding, /budgetDuration/);
  assert.match(onboarding, /Opening balance/);
  assert.match(onboarding, /type: "income"/);
  assert.match(actions, /startMonthKey/);
  assert.match(bundle, /avCycleKey/);
  assert.match(bundle, /avSelectedMonthIsFuture/);
  assert.match(bundle, /avAccountBudgetDuration/);
});

test('quick-add income is always stored as income', () => {
  const bundle = read('renderer/assets/index-Cvs3_7yw.js');

  assert.match(bundle, /type: e === "income" \? "income" : "expense"/);
  assert.match(bundle, /category: e === "income" \? "Income"/);
});

test('savings contributions and releases use atomic savings actions', () => {
  const bundle = read('renderer/assets/index-Cvs3_7yw.js');

  assert.match(bundle, /LemonGlass\?\.contributeSavings\(d.id, avAmount\)/);
  assert.match(bundle, /d.reserveSource \|\| d.goalId != null/);
  assert.match(bundle, /g.reserveSource \|\| g.goalId != null/);
});

test('header banner and three masculine palettes are available', () => {
  const actions = read('renderer/lemon-glass-actions.js');
  const css = read('renderer/theme-refresh.css');

  for (const theme of ['midnight-steel', 'forest-slate', 'copper-night']) {
    assert.match(actions, new RegExp(theme));
    assert.match(css, new RegExp(`data-theme="${theme}"`));
  }
  assert.match(css, /\.topbar\s*\{[\s\S]*display: grid/);
  assert.match(css, /\.product-wordmark\s*\{[\s\S]*position: static/);
});

test('bill payments warn across months and all saved dates stay in budget', () => {
  const actions = read('renderer/lemon-glass-actions.js');
  const bundle = read('renderer/assets/index-Cvs3_7yw.js');

  assert.match(actions, /Bill belongs to another month/);
  assert.match(actions, /Continue to payment/);
  assert.match(actions, /Date is outside this budget/);
  assert.match(actions, /Use adjusted date/);
  assert.match(actions, /validateBudgetDate,/);
  assert.match(bundle, /setSelectedBudgetMonth/);
  assert.match(bundle, /validateBudgetDate/);
});

test('visible financial screens use full year-month cycle keys', () => {
  const bundle = read('renderer/assets/index-Cvs3_7yw.js');

  assert.match(bundle, /avDashboardCycleKey/);
  assert.match(bundle, /avTransactionCycleKey/);
  assert.match(bundle, /avBillsCycleKey/);
  assert.match(bundle, /window\.LemonFinance\.report/);
});

test('budget navigation and overview continue across December into the next year', () => {
  const bundle = read('renderer/assets/index-Cvs3_7yw.js');

  assert.match(bundle, /avSelectedBudgetYear/);
  assert.match(bundle, /avAccountBudgetEndMonth/);
  assert.match(bundle, /Ye\.setMonth\(Ye\.getMonth\(\) \+ Ee\)/);
  assert.match(bundle, /onClick: \(\) => t\(m\.monthKey\)/);
});
