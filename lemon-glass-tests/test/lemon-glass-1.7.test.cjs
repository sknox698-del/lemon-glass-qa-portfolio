const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('euro inputs and outputs use European decimal formatting', () => {
  const actions = read('renderer/lemon-glass-actions.js');
  const bundle = read('renderer/assets/index-Cvs3_7yw.js');
  const onboarding = read('renderer/account-onboarding.js');

  assert.match(actions, /Intl\.NumberFormat\("de-DE"/);
  assert.match(actions, /currency: "EUR"/);
  assert.match(actions, /replace\(\/\\s\+\(\?=€\)\//);
  assert.match(actions, /raw\.includes\(","\)[\s\S]*replace\(\/\\\.\/g, ""\)/);
  assert.match(bundle, /new Intl\.NumberFormat\("de-DE"/);
  assert.match(onboarding, /balanceInput\.placeholder = "0,00 €"/);
});

test('household paid state is stored per cycle while member plans persist', () => {
  const actions = read('renderer/lemon-glass-actions.js');
  const bundle = read('renderer/assets/index-Cvs3_7yw.js');

  assert.match(actions, /paidByCycle/);
  assert.match(actions, /addMemberPayment/);
  assert.match(actions, /memberPaidForCycle/);
  assert.match(bundle, /avMemberPaidForCycle/);
  assert.match(bundle, /u = a\.reduce\(\(h, d\) => h \+ avMemberPaid\(d\), 0\)/);
});

test('recurring payments are calendar events and current-month conflicts have guided errors', () => {
  const actions = read('renderer/lemon-glass-actions.js');
  const bundle = read('renderer/assets/index-Cvs3_7yw.js');

  assert.match(bundle, /avDayRecurring/);
  assert.match(bundle, /showCalendarEvent\("recurring", T\.id\)/);
  assert.match(actions, /Recurring payment details/);
  assert.match(actions, /function validateCurrentMonth/);
  assert.match(actions, /Current month needs attention/);
  assert.match(actions, /Hint:/);
});

test('Sunshine Orange is the default and previous theme choices remain available', () => {
  const actions = read('renderer/lemon-glass-actions.js');
  const css = read('renderer/theme-refresh.css');

  for (const theme of [
    'sunshine-orange',
    'sunshine-aqua',
    'ocean-breeze',
    'mint-garden',
    'lavender-dream',
    'rose-quartz',
    'sunset-peach',
  ]) assert.match(actions, new RegExp(theme));
  assert.match(actions, /preferenceValue\(THEME_KEY, "sunshine-orange"\)/);
  assert.match(css, /:root\[data-theme="sunshine-orange"\]/);
  assert.match(css, /--scheme-b: #ff9f62/);
});
