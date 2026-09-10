# Lemon Glass source regression snapshot

Version 1.9.4-rc.2. This is a testable source excerpt, not the complete desktop application or installer. No account data is included. Package metadata is retained because tests inspect it; do not run npm start or install the desktop dependencies in this excerpt.

With Node.js 24, open this directory and run:

```sh
node --test test/*.test.cjs
```

No dependency installation is required for these tests. The suite combines model behavior, action execution with simulated storage/DOM objects, and source-structure assertions. It does not launch Electron or exercise 75 real browser workflows.

Start with test/recurring-income-duplicates.test.cjs and renderer/finance-model.js. The repository root links to the portfolio and execution evidence. Source and tests were produced through the AI-assisted Lemon Glass development workflow; this snapshot does not establish independent authorship of every line by Steven Knox.
