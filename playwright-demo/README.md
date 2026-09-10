# Playwright workflow demonstration

A separate fictional engineering-request app for Steven Knox's QA portfolio. This is not Lemon Glass, Synera software or a real engineering service. Implementation and recorded execution were substantially AI-assisted.

## Run locally

Prerequisites: Node.js 22 or 24 and npm. From this directory:

```sh
npm ci
npx playwright install chromium
npm start
```

Open http://127.0.0.1:4173. Public fictional credentials: `steven@example.test` / `DemoPass123!`.

The data stays in browser sessionStorage. Sign-out clears it. The client-side credential check is a demonstration only, not secure authentication. Do not enter real information.

## Run tests

Stop the manually started demo server first; port 4173 must be free.

```sh
npm test
npm run report
```

The suite has eight Chromium scenarios covering login, navigation, required fields, invalid loads, valid boundaries and reload persistence. Two workers, zero retries; failure screenshots and traces are retained. On Windows, use npm.cmd/npx.cmd if PowerShell blocks the scripts. Linux may require `npx playwright install --with-deps chromium`.

## Demonstrate a test detecting a defect

```sh
npm run test:mutation
```

This intentionally exits with code 1: minimum load is lowered from 1 to 0, so TC06 detects the acceptance of an invalid 0 N request. The mutation is process-specific; the next normal run uses the original rule without changing assertions. See [defect analysis](docs/DEFECT-ANALYSIS.md).

The published historical evidence is summarized in [the evidence index](../evidence/README.md). Original interactive HTML reports/traces are retained in the supplied application package, rather than uploaded with their local machine paths. New local runs generate their own reports. The 10 September archived rerun required intervention when server teardown stalled; assertion completion must not be confused with successful server cleanup.
