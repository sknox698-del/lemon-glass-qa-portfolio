# AI-assisted QA and debugging

Prepared for Steven Knox with substantial AI assistance in implementation, documentation and execution. The assistant performed the recorded verification; the project does not establish Steven's independent Playwright proficiency or professional automation experience.

## Review approach

Start with explicit acceptance criteria and use them to assess proposed tests. For this project, invalid requests must leave the queue unchanged, while valid submissions must preserve the exact expected values. Semantic locators and observable assertions make that behavior reviewable.

The controlled zero-load mutation checks whether TC06 detects a broken requirement. Its failure screenshot and trace provide observed evidence; the subsequent normal regression verifies the intended boundary is restored. A passing result is limited to the scenarios and environment exercised.

An AI-generated app and test can share the same misunderstanding. Review the acceptance criteria independently and challenge them with rejected and adjacent valid inputs. Do not replace failed assertions with weaker checks solely to obtain a passing run.

The demonstration uses fictional data. Professional AI-assisted workflows should use approved tools, protect client information and retain reviewable evidence of failures and fixes.
