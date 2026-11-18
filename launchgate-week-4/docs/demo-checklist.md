# Demo checklist and test cases

Start each run from **Settings > Reset sample data**. Mark the Result column as you go.

## Critical path

| # | As | Do | Expected | Result |
| --- | --- | --- | --- | --- |
| 1 | Visitor | Submit the form on the landing page with a fictional name and email | Confirmation shows queue position #8 | |
| 2 | Prospect | Open My status | Stage is Waitlisted, position #8, with a next-step message | |
| 3 | Approver | Open the queue and filter by Status: Waitlisted | The new prospect is listed last | |
| 4 | Approver | Open them and press Start review | Stage becomes Under Review | |
| 5 | Approver | Press Approve and confirm | The summary shows 2 seats now and 1 after. Invite code issued | |
| 6 | Prospect | Open My status and enter the code | Moves to the onboarding checklist | |
| 7 | Prospect | Complete all four steps in order | Later steps stay locked until their turn | |
| 8 | Prospect | Finish the last step | Welcome screen, stage is Activated | |
| 9 | Founder | Open the dashboard | Signups 20, Reached approval 9, Activated 4 | |

## Refusals

| # | As | Do | Expected | Result |
| --- | --- | --- | --- | --- |
| 1 | Visitor | Sign up with `MAYA@brightfern.example` | "Already on the waitlist", with a link to check status | |
| 2 | Founder | Press Try to approve the next prospect | Unauthorized message, and a blocked audit event | |
| 3 | Founder | Open `#/queue/e-016` | Unauthorized screen, and a blocked audit event | |
| 4 | Founder | Run `launchgate.approve('e-016')` in the console | `ERR_FORBIDDEN`, and the data is unchanged | |
| 5 | Sara Haddad | Redeem `LG-DEMO-ALFA` | "Belongs to someone else" | |
| 6 | Jun Park | Redeem `LG-DEMO-EXPD` | "Has expired", with advice on what to do next | |
| 7 | Priya Raman | Run `launchgate.redeem('LG-DEMO-USED')` | `ERR_CODE_USED` | |
| 8 | Approver | Open Jun Park and press Reissue invite code | A new code appears, and the old one stops working | |
| 9 | Approver | Reject a prospect with a 5-character note | An inline error, and the dialog stays open | |
| 10 | Approver | Open Oliver Grant (Rejected) | Explains that no more decisions can be made | |
| 11 | Founder | Set Beta capacity to 3 | Refused, because 4 seats are already used | |
| 12 | Founder, then Approver | Make Alpha current, then open a waitlisted prospect | Approve is disabled and labelled "No seats left" | |
| 13 | Approver | Then run `launchgate.approve('e-017')` | `ERR_CAPACITY_FULL` | |

## Automated tests

`npm test` runs the logic tests. They cover the checks proposed in the PRD:

| PRD check | Test file |
| --- | --- |
| Duplicate email signup | `tests/waitlist.test.js` |
| Invalid transition, such as Waitlisted to Activated, and every other from-to pair | `tests/funnel.test.js` |
| Prospect or Founder trying to approve | `tests/approval.test.js` |
| Approval beyond batch capacity | `tests/approval.test.js` |
| Invite code used twice, expired code, another prospect's code | `tests/invite.test.js` |
| Skipping an onboarding step | `tests/onboarding.test.js` |
| Decision on a Rejected prospect | `tests/approval.test.js` |
| Blocked attempt written to the audit trail | `tests/roleGuard.test.js` |
| Critical path from join to Activated | `tests/criticalPath.test.js` |
| Storage, validators, metrics and sample data | `tests/storage.test.js`, `tests/validators.test.js`, `tests/metrics.test.js`, `tests/sampleData.test.js` |

## Peer walkthrough

The PRD asks for two or three peers to try these tasks without help. This has not been run yet.

| Task | Peer 1 | Peer 2 | Peer 3 | Notes |
| --- | --- | --- | --- | --- |
| Join the waitlist | | | | |
| Approve a prospect | | | | |
| Redeem and onboard | | | | |
| Set capacity | | | | |
