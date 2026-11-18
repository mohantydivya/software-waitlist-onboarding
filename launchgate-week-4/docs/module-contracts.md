# Module contracts

Every service function returns `{ ok: true, ...data }` or `{ ok: false, code, message, fields?, existingEntryId? }`. Services don't throw for rule refusals. An `actor` is `{ role, entryId? }`.

## Data structures

```js
// LocalStorage key "launchgate.data"
{
  version: 1,
  currentBatchId: 'b-beta',
  entries:   [{ entryId, name, email, company, jobTitle, companySize, useCase, status, batchId, createdAt, updatedAt }],
  decisions: [{ decisionId, entryId, approverId, decision, note, decidedAt }],  // decision: approve | reject | hold
  batches:   [{ batchId, label, capacity, opensOn }],
  invites:   [{ code, entryId, issuedAt, expiresAt, usedAt, voidedAt }],
  steps:     [{ entryId, stepId, status, completedAt, data }],                  // status: pending | complete
  audit:     [{ eventId, actorRole, actorId, action, entryId, result, code, detail, createdAt }], // result: success | blocked
}

// sessionStorage key "launchgate.session", one per tab
{ role, entryId }   // entryId for a prospect only
```

Queue position, seats used and left, funnel counts and conversion are not stored. They're calculated from these records.

## Function signatures

| Module | Function | Permitted role |
| --- | --- | --- |
| waitlistService | `joinWaitlist(form, actor)` returns `{ entry, position }` | Visitor, Prospect |
| waitlistService | `filterQueue(entries, { status, companySize, useCase })` | Pure |
| funnelService | `startReview(entryId, actor)` | Approver |
| funnelService | `transition(state, entryId, to, actor)` throws `LaunchError` | Internal, checks the role itself |
| funnelService | `canTransition(from, to)`, `allowedTargets(from)` | Pure |
| funnelService | `queuePosition(entries, entryId)` returns a number or `null` | Pure |
| approvalService | `approve(entryId, note, actor)` returns `{ entry, decision, invite, seatsLeft }` | Approver |
| approvalService | `reject(entryId, note, actor)`, `hold(entryId, note, actor)` | Approver |
| approvalService | `setCapacity(batchId, value, actor)`, `setCurrentBatch(batchId, actor)` | Founder |
| inviteService | `redeemInvite(entryId, code, actor)` | Prospect, own entry |
| inviteService | `reissueInvite(entryId, actor)` returns `{ invite }` | Approver |
| inviteService | `activeInvite(state, entryId)`, `isExpired(invite, atMs?)` | Pure |
| onboardingService | `completeStep(entryId, stepId, data, actor)` returns `{ activated }` | Prospect, own entry |
| onboardingService | `getChecklist(state, entryId)`, `checklistProgress(state, entryId)` | Pure |
| metrics | `seatsUsed`, `seatsLeft`, `batchSummaries`, `currentBatch`, `statusCounts`, `funnelMetrics` | Pure |
| validators | `validateSignup`, `validateNote`, `validateCapacity`, `validateInviteCodeInput`, `validateStepData` return field messages | Pure |
| roleGuard | `can(role, action)`, `canAccessScreen(role, screen)` | Pure |
| roleGuard | `enforce(actor, action, entryId)`, `guardedAction({ action, actor, entryId }, body)` | The guard |
| roleGuard | `logBlocked(event)`, `logBlockedScreen(actor, screen, entryId)` | Writes an audit event |
| storage | `readState()`, `writeState(state)`, `resetState(actor)`, `useBackend(backend)` | Infrastructure |
| clock | `now()`, `nowIso()`, `setClock(fn)`, `resetClock()` | Infrastructure |

## Error codes

| Code | Meaning | Audited as blocked |
| --- | --- | --- |
| `ERR_FORBIDDEN` | Wrong role, or a prospect acting on another entry | Yes |
| `ERR_INVALID_TRANSITION` | The move isn't allowed from the current stage | Yes |
| `ERR_DUPLICATE_EMAIL` | The email is already on the waitlist | Yes |
| `ERR_NOTE_REQUIRED` | The reject or hold note is under 10 characters | Yes |
| `ERR_CAPACITY_FULL` | No seat left in the current batch | Yes |
| `ERR_CAPACITY_BELOW_USED` | Capacity is lower than the seats already used | Yes |
| `ERR_CODE_INVALID` | The code doesn't exist | Yes |
| `ERR_CODE_FOREIGN` | The code belongs to another prospect | Yes |
| `ERR_CODE_USED` | The code has already been redeemed | Yes |
| `ERR_CODE_EXPIRED` | The code is past its expiry | Yes |
| `ERR_CODE_VOID` | The code was replaced by a reissue | Yes |
| `ERR_CODE_STILL_VALID` | A reissue was attempted before expiry | Yes |
| `ERR_STEP_ORDER` | A step was attempted before the previous one was done | Yes |
| `ERR_STEP_DONE` | The step is already complete | Yes |
| `ERR_NOT_FOUND` | The entry, batch or step doesn't exist | Yes |
| `ERR_VALIDATION` | A form mistake. `fields` holds the messages | No |
| `ERR_STORAGE` | LocalStorage couldn't be read or written | No |

## Audit actions

`entry.join`, `entry.review`, `entry.approve`, `entry.reject`, `entry.hold`, `status.change`, `invite.issue`, `invite.redeem`, `invite.reissue`, `onboarding.complete`, `capacity.set`, `batch.setCurrent`, `data.reset`, and `screen.<name>` for refused direct links.
