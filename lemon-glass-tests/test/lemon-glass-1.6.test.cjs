const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('installer and renderer both enforce the requested blank installation', () => {
  const actions = read('renderer/lemon-glass-actions.js');
  const installer = read('build/installer.nsh');
  const packageJson = JSON.parse(read('package.json'));

  assert.match(actions, /lemon-glass\.data-reset\.1\.6\.0/);
  assert.match(installer, /RMDir \/r "\$APPDATA\\Lemon Glass"/);
  assert.match(installer, /RMDir \/r "\$APPDATA\\avera-personal-finance"/);
  assert.match(installer, /\$\{IfNot\} \$\{isUpdated\}/);
  assert.equal(packageJson.build.nsis.deleteAppDataOnUninstall, true);
});

test('account lifecycle and annual rollover are available', () => {
  const onboarding = read('renderer/account-onboarding.js');

  assert.match(onboarding, /function openEditAccount/);
  assert.match(onboarding, /function openDeleteAccount/);
  assert.match(onboarding, /function openYearRollover/);
  assert.match(onboarding, /type === "income"[\s\S]*-Number\(transaction\.amount/);
  assert.match(onboarding, /rolledFrom: account\.id/);
  assert.match(onboarding, /openingBalance: 0[\s\S]*categoryBudgets[\s\S]*transactions: openingBalance/);
  assert.match(onboarding, /merchant: "Opening Balance"[\s\S]*type: "income"/);
});

test('core editing, localization, reporting, and settings actions are wired', () => {
  const actions = read('renderer/lemon-glass-actions.js');

  for (const action of [
    'deleteBill',
    'editBill',
    'editGoal',
    'editRecurring',
    'editTransaction',
    'deleteTransaction',
    'exportReport',
    'exportTransactions',
    'saveNow',
  ]) {
    assert.match(actions, new RegExp(`\\b${action},`));
  }
  assert.match(actions, /DD\/MM\/YYYY|padStart\(2, "0"\).*\//s);
  assert.match(actions, /Year-end rollover reminder/);
  assert.match(actions, /data\.categoryBudgets/);
});

test('compiled UI uses dynamic years, cumulative balances, and the new layout', () => {
  const bundle = read('renderer/assets/index-Cvs3_7yw.js');

  assert.match(bundle, /function avFlipClock/);
  assert.match(bundle, /dashboard-save/);
  assert.match(bundle, /avTransactionsThroughSelected\.reduce/);
  assert.match(bundle, /title: "Money Reserve"/);
  assert.match(bundle, /title: "Recurring"/);
  assert.match(bundle, /editBill\(m\.id\)/);
  assert.match(bundle, /editGoal\(d\.id\)/);
  assert.match(bundle, /editRecurring\(m\.id\)/);
  assert.doesNotMatch(bundle, /children: "2026"/);
});
