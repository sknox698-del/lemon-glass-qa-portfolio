# Test strategy | Steven Knox

## Objective and oracle

Demonstrate how acceptance criteria become automated checks and developer-ready evidence. The specification below is the test oracle; passing code alone is not evidence that requirements are correct. This fictional request queue represents a small engineering workflow relevant to discussing QA at Synera, without reproducing its software.

Requirements:

- R1: Empty credentials show required-field feedback; incorrect credentials cannot reach the dashboard. The documented demo credentials succeed.
- R2: Signed-in users navigate between dashboard and request form. Sign-out ends the demo session and direct navigation returns to sign-in.
- R3: Trimmed project names contain 3-60 characters; material is Aluminum or Steel; load is an integer from 1 through 10000 N inclusive. Invalid submissions must not create queue entries.
- R4: A valid submission shows confirmation and exactly one row containing the normalized name, chosen material, exact load, and Queued status. A reload retains the row in this tab.

## Risk and coverage

| ID | Priority / requirement | Action / data | Expected outcome |
| --- | --- | --- | --- |
| TC01 | P2 / R1 | Submit empty sign-in | Required feedback; remain signed out |
| TC02 | P1 / R1 | Correct email, wrong password | Credential error; no dashboard |
| TC03 | P2 / R1-R2 | Valid sign-in; navigate out and back | Correct routes; queue stays empty |
| TC04 | P1 / R2 | Sign out; open request route directly | Sign-in shown; form unavailable |
| TC05 | P1 / R3 | Whitespace name, missing material/load | All relevant errors; queue empty |
| TC06 | P1 / R3 | Loads 0, -1, 10001, 1.5 | Reject each; no queue entry |
| TC07 | P1 / R3-R4 | Padded name; load 1; reload | Trimmed row with exact values persists |
| TC08 | P1 / R3-R4 | Steel; load 10000 | Inclusive upper bound accepted once |

TC06 contains four named steps inside one test; the suite totals eight tests. A failure stops later steps in that test. In the baseline all steps run; in mutation mode the first (zero) detects the defect.

## Design and execution

Each test receives a new browser context, so sessionStorage cannot leak across tests. Setup uses the actual sign-in UI. Semantic role/label selectors express user intent; table structure locators scope assertions to submitted rows. Playwright assertions wait for observable states, with no fixed sleeps. Exact values, row counts and rejected-side-effect checks reduce false positives.

Local execution with a locked dependency tree removes public-site uptime, account limits and external data variation. The runner owns the server and refuses to reuse another instance. Zero retries keep failures visible. Screenshots and retained traces support diagnosis; JSON and HTML provide repeatable reporting.

Exit criteria for this delivery: all eight baseline tests pass with no skips/retries; TC06 fails when the zero-load defect is enabled; failure screenshot, trace and report exist; an unchanged normal run remains green. Record results separately from expectations in evidence/VERIFICATION.md.

## Triage and regression

For a failure, record test ID, environment, input, expected behavior, actual behavior, reproduction, impact, severity and priority. Use the assertion diff and trace to distinguish test/setup failures from application defects. Reproduce the smallest failing input, propose a cause, fix it, rerun the focused test, then the complete suite. See DEFECT-ANALYSIS.md for the controlled example.

## Limits and next coverage

This is functional Chromium E2E coverage, not exhaustive QA. Next cases: name lengths 2/3/60/61; malformed email; repeated submissions and double clicks; multiple queued rows; session-data clearing after sign-out; keyboard/focus and screen-reader review; Firefox/WebKit; narrow viewports. A real product also needs server authorization, API/persistence checks, security and performance testing, and representative engineering files. No CI execution or other browser/OS execution is claimed.
