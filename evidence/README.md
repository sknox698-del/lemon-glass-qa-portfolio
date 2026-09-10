# Evidence and provenance

These records originate from Steven_Knox_Synera_Application_Package.zip, dated 10 September 2026. All automated runs were performed by the assistant. Manual observations are attributed separately in the portfolio.

| Recorded run | Result | Scope |
| --- | --- | --- |
| Lemon Glass rc.2 source | 75 passed, 0 failed | Node model, simulated action and source-structure checks |
| Separate Playwright demo | 8 passed, 0 unexpected, 0 skipped, 0 flaky | Chromium, fictional engineering-request app |
| Controlled mutation | TC06 failed as intended | Invalid 0 N accepted after minimum changed from 1 to 0 |

[Original Node output](lemon-glass-source-run.txt) · [Extracted Playwright statistics](playwright-recorded-stats.json) · [Original failure screenshot](playwright-intentional-failure.png)

The statistics JSON is a clearly labeled extraction of the original reports' `stats` objects, with original-file SHA-256 hashes. It is not an original full Playwright report or a newly executed test result. The unchanged screenshot shows Bracket study / Aluminum / 0 N / Queued, corroborating the controlled failure.

Original full JSON/HTML reports and traces remain in the supplied package. They are not published here because they contain local machine paths. The September 10 browser run finished its assertions but needed intervention for server teardown. Its duration is not a performance result; it was not a new clean-install check.

The repository's Lemon Glass publication copy was independently rerun by the assistant on Windows on 10 September: 75 passed, 0 failed. The media files still describe the original saved package runs. No new Playwright execution is claimed during repository preparation.

The Lemon Glass source excerpt excludes account backups and live user data and is not a complete distribution. Prepared manual cases are not new manual passes; the original manual build was unrecorded, and rc.2 patch installation acceptance was pending.
