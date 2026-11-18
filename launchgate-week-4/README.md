# LaunchGate

A waitlist, approval queue and guided onboarding funnel for a controlled software launch. Prospects join a waitlist, an Operations Approver admits them against a launch capacity, the Founder watches the funnel, and approved prospects redeem an invite and finish a four-step checklist.

Built with HTML, CSS, JavaScript ES modules and Bootstrap 5, running on sample data in LocalStorage. There is no backend. The product being launched, "Beacon", is fictional.

| Approval queue | Founder dashboard | Phone |
| --- | --- | --- |
| ![Approval queue on a laptop](docs/screenshots/queue-1280.png) | ![Founder dashboard on a laptop](docs/screenshots/dashboard-1280.png) | ![Approval queue at 360 px](docs/screenshots/queue-360.png) |

## Run it

ES modules don't load from `file://`, so serve the folder:

```sh
npm start        # python3 -m http.server 5173
```

Then open <http://localhost:5173>. The VS Code Live Server extension also works. There is nothing to install: Bootstrap is vendored in `assets/vendor/`.

```sh
npm test         # runs the logic tests with node:test
```

### Tool versions used

| Tool | Version |
| --- | --- |
| Node.js (tests only, needs 20 or later) | 20.19.6 |
| Python (static server only) | 3.9.6 |
| Bootstrap (vendored) | 5.3.8 |

### Deploy

The app uses relative paths only, so the repository root can be published as is on GitHub Pages, Netlify or Vercel, with no build step.

## Roles

Open **Demo login** and pick a role. Each browser tab keeps its own role, so you can put an approver and a prospect side by side and watch changes appear across tabs.

| Role | Can | Cannot |
| --- | --- | --- |
| Prospect | Join, see their status and position, redeem their own code, complete their own steps | Act on anyone else's entry, or make decisions |
| Operations Approver | Review, approve, reject, hold, reissue expired codes, read the audit trail | Set capacity, or redeem codes |
| Founder | Set capacity, choose the current batch, view metrics, read the audit trail | Approve, reject, hold or change a decision |

## Sample data

Reset it at any time from **Settings**. Dates are relative to the moment of the reset.

| Prospect | Stage | Useful for |
| --- | --- | --- |
| Sara Haddad (`e-007`) | Approved, code `LG-DEMO-VALD` | The happy path through redeem and onboarding |
| Jun Park (`e-008`) | Approved, code `LG-DEMO-EXPD` | An expired code, and reissuing it as the approver |
| Daniel Reyes (`e-004`) | Approved, code `LG-DEMO-ALFA` | Entering this code as Sara shows a foreign-code refusal |
| Kofi Mensah (`e-006`) | Onboarding, 2 of 4 steps done | Locked steps |
| Priya Raman (`e-003`) | Onboarding, code `LG-DEMO-USED` | `launchgate.redeem('LG-DEMO-USED')` shows a used-code refusal |
| Maya Lindqvist (`e-001`) | Activated | The welcome screen, and a duplicate signup with `maya@brightfern.example` |
| Rafael Costa (`e-011`), Ingrid Solberg (`e-012`) | On Hold | Decisions from hold |
| Oliver Grant (`e-009`), Nadia Petrova (`e-010`) | Rejected | Final-stage refusals |
| Aisha Bello (`e-013`), Marco Bianchi (`e-014`) | Under Review | The queue |
| `e-015` to `e-019` | Waitlisted | The queue, and starting a review |

| Batch | Capacity | Used | Note |
| --- | --- | --- | --- |
| Alpha | 4 | 4 | Full. Make it current on the dashboard to see "No seats left" |
| Beta | 6 | 4 | The current batch, with 2 seats left |
| General release | 10 | 0 | Empty |

## Try a blocked action

Sign in as the Founder, then try any of these. Each one shows an Unauthorized message, changes no data and adds a blocked event to the audit trail.

- Press **Try to approve the next prospect** on the dashboard.
- Open the direct link `#/queue/e-016`.
- Run `launchgate.approve('e-016')` in the browser console. `window.launchgate` runs as the current role, through the same guard as the buttons.

## Architecture

```
index.html            page shell
assets/css/styles.css theme on top of Bootstrap
assets/js/app.js      hash router, role session, cross-tab refresh, console API
assets/js/logic/      business rules. No DOM, so everything here runs in Node
  roleGuard.js        permissions, and guardedAction(): the one guard every action runs through
  funnelService.js    the state machine, and transition(): the only code that changes a status
  approvalService.js  approve, reject, hold, capacity
  inviteService.js    single-use, expiring codes
  onboardingService.js ordered checklist, activation
  waitlistService.js  signup and queue filters
  metrics.js          seats and funnel numbers, always derived from records
  validators.js       form rules
  audit.js            append-only event log
  storage.js          versioned LocalStorage, swappable for tests
  clock.js            the one clock, replaceable in tests
  sampleData.js       demo data
assets/js/ui/         DOM code: components, forms, and one file per screen in views/
assets/vendor/        Bootstrap 5.3.8
tests/                node:test suite for assets/js/logic
docs/                 personas, funnel diagram, module contracts, wireframes, demo checklist
```

How an action runs, for example `approve(entryId, note, actor)`:

1. `guardedAction` re-reads storage, so a decision made in another tab is seen.
2. `enforce` checks the role, and refuses before any rule runs.
3. The service body calls `transition`, which checks the stage, role and preconditions such as seats.
4. On success the changes and their audit events are written together.
5. On any refusal the working copy is thrown away, and only a blocked audit event is saved. A service can't leave half-finished changes behind.

More detail:

- [Funnel status diagram and rules](docs/funnel-status.md)
- [Module contracts, data structures and error codes](docs/module-contracts.md)
- [Persona cards](docs/personas.md)
- [Wireframes](docs/wireframes.md)
- [Scripted demo checklist and test cases](docs/demo-checklist.md)
- [Problem statement and research notes](docs/product-notes.md)

## Decisions where the PRD left room

- **On Hold to On Hold is refused.** Rule 2 can be read as allowing it, but it isn't a change of stage, so a held prospect is released by approving or rejecting them.
- **Queue position counts only Waitlisted and Under Review.** A prospect on hold is out of the line and sees no position.
- **A prospect holds a seat from approval onward, even if their code expires.** That follows the seat rule, and an approver can reissue the code.
- **"Current batch" is chosen by the Founder.** The PRD refers to a current batch without saying how it's set.
- **A mistyped form is not a blocked attempt.** Empty fields and bad formats show inline errors without an audit event. Rule refusals are logged, including duplicate emails, short decision notes, capacity below seats used and bad invite codes.
- **Only the Approver opens prospect details.** The Founder sees totals and the audit trail.

## Known limitations

- LocalStorage is isolated per browser and is not a secure database. A real product needs a server that enforces roles and uniqueness.
- Front-end role checks are for demonstration, not security. Someone with developer tools can edit LocalStorage or import a service and pass any role.
- Two tabs acting in the same instant could still collide, because LocalStorage has no locking. Re-reading before each write makes this rare, not impossible.
- Invitations are simulated on screen. No email or SMS is sent, and so the code is visible on the prospect's status page.
- Stretch items from the PRD (bulk approve, referrals, CSV export, Chart.js, dark theme, React port) are not built.
