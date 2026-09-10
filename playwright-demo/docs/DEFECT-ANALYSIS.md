# Structured defect analysis | QA-DEMO-001

**Title:** Zero-load request enters the engineering review queue.

**Provenance:** Intentionally injected portfolio defect, isolated behind `QA_MUTATION=1`. It is not a customer or Synera defect. The normal delivered app requires load >= 1.

**Severity:** Medium in this fictional workflow: invalid engineering input is accepted, undermining queue quality. **Priority:** P1 for the demo because it violates an explicit acceptance criterion. Production priority would require actual impact and frequency evidence.

## Reproduce

1. Stop any server on port 4173.
2. Run `npm run test:mutation`, which runs TC06 against the injected variant.
3. Equivalent UI steps with that variant: sign in using the demo credentials; select New request; enter Bracket study, Aluminum, and load 0; submit.

**Expected:** Stay on the form, show "Load must be a whole number from 1 to 10000 N.", create no row.

**Actual in injected variant:** Navigate to the dashboard and create a Queued row with load 0 N. TC06 fails because the expected validation alert is absent. The saved screenshot shows the accepted invalid row; the trace shows the input, submission and transition.

**Evidence:** `evidence/mutation-report/`, `evidence/mutation-results/`, and `evidence/VERIFICATION.md`. Open with `npx playwright show-report evidence/mutation-report`.

## Cause, correction and retest

The experiment deliberately changes `minimum` in `app/app.js` from 1 to 0. This shifts the inclusive lower boundary, admitting a value the requirement excludes. This is a controlled known cause, not a claim of diagnosing an unknown production incident.

Normal execution restores minimum 1 by leaving QA_MUTATION unset. TC06 checks rejected values and an empty queue; TC07 proves the adjacent valid value 1 remains accepted. Run `npm test -- --grep TC06`, then `npm test`. The default suite should pass without weakening any assertion.

A real service must also enforce the same contract server-side. This demonstration has browser-local data only, so its validation does not constitute secure backend validation.
