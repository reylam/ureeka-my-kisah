# PARUPINTAS API contract

The API is implemented; its route table, the access rule for each route and the response envelope are in
[`backend/README.md`](../../backend/README.md#api). The JSON shapes are the types in
[`src/types/domain.ts`](../src/types/domain.ts) and [`src/types/account.ts`](../src/types/account.ts),
and every call the frontend makes is one function in [`src/services/recordsApi.ts`](../src/services/recordsApi.ts).

The end-to-end test (`backend/tests/e2e/flow.test.js`) checks the field lists the API sends against
these types, so a mismatch fails a test rather than a page.

## The rules worth reading first

- **Screening, not diagnosis.** Every model output is a prompt for a clinician. No probability, result
  or performance figure is ever made up, on either side.
- **Patients have no account.** Their access code is the whole credential for one visit. It opens only
  a narrow summary (status, masked name, place in line, queue number, priority, outcome word), never the
  image, the scores or the symptoms.
- **Roles are decided by the database.** The role in the browser only decides which screens are drawn.
  Every request is authorised again by the API and by Row Level Security from the token alone.
- **Status moves only forward, and only through the database functions** that check the caller:
  `waiting → examining → queued → served`.
