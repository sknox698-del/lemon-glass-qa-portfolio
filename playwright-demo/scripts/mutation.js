import { spawnSync } from 'node:child_process';

console.log('Controlled defect: accept zero load. TC06 should fail. Exit code 1 is expected.');
const result = spawnSync(process.execPath, ['node_modules/@playwright/test/cli.js', 'test', '--grep', 'TC06'], {
  stdio: 'inherit', env: { ...process.env, QA_MUTATION: '1' },
});
process.exit(result.status ?? 1);
