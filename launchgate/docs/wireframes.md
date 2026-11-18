# Wireframes

Low-fidelity layouts for the laptop width. On phones every screen becomes a single column, and the navbar collapses. Screenshots of the finished screens are in [screenshots/]

## Landing and waitlist form

```
+----------------------------------------------------------+
| LaunchGate   Join  Demo login  Settings     [Switch role]|
+---------------------------+------------------------------+
| Product pitch             | Join the waitlist            |
| Headline and lead         | [Name]        [Work email]   |
|                           | [Company]     [Job title]    |
| 1 Join   2 Get reviewed   | [Size v]      [Use v]        |
| 3 Redeem 4 Onboard        | Fictional data notice        |
|                           | [ Join the waitlist ]        |
+---------------------------+------------------------------+
```

## Role select

```
+------------------+------------------+------------------+
| Prospect         | Approver         | Founder          |
| What they do     | What they do     | What they do     |
| [Prospect v]     |                  |                  |
| [Enter]          | [Enter]          | [Enter]          |
+------------------+------------------+------------------+
```

## My status

```
+----------------------------------------------------------+
| Current stage                              (status badge)|
| (1)-----(2)-----(3)-----(4)-----(5)                      |
+------------------+---------------------------------------+
| Queue position   | What happens next                     |
| #3               | Text and action                       |
+------------------+---------------------------------------+
| Redeem your invite (Approved only)                       |
| Simulated invitation: code and expiry                    |
| [Invite code]  [Redeem code]                             |
+----------------------------------------------------------+
```

## Onboarding checklist

```
+----------------------------------------------------------+
| Progress                    [=======--------] 2 of 4 steps|
+----------------------------------------------------------+
| 1. Create workspace profile                     Complete |
| 2. Choose use-case template                     Complete |
| 3. Invite teammates (current)                            |
|    [Teammate emails]  [Complete this step]               |
| 4. Finish the tour      Locked: complete the previous step|
+----------------------------------------------------------+
```

## Approval queue

```
+----------------------------------------------------------+
| Seats in Beta, 4 of 6 used     [========----]  2 seats left|
+-------------+--------------------------------------------+
| Filters     | 9 prospects                                |
| [Status v]  | Prospect | Size | Use | Joined | Status    |
| [Size v]    | Name     | ...  | ... | ...    | (badge)   |
| [Use v]     | Name     | ...  | ... | ...    | (badge)   |
| [Clear]     | (cards instead of rows on phones)          |
+-------------+--------------------------------------------+
```

## Prospect detail and decision

```
+---------------------------------------+------------------+
| Stage tracker across the full width                      |
+---------------------------------------+------------------+
| Profile                               | Decision         |
| Email, size, use, joined, position    | [Start review]   |
|                                       | [Approve]        |
| History                               | [Put on hold]    |
| Audit events for this prospect        | [Reject]         |
|                                       | Invitation panel |
+---------------------------------------+------------------+
Confirm modal: prospect, decision, seats left, note, [Confirm]
```

## Founder dashboard

```
+-----------+-----------+-----------+----------------------+
| Signups   | Approval  | Activated | Signup to activation |
+-----------+-----------+-----------+----------------------+
| Funnel                         | Launch capacity          |
| Joined      ==============     | [Current batch v]        |
| Reviewed    ==========         | [Capacity] [Save]        |
| Approval    ======             +--------------------------+
| Onboarding  ====               | Where prospects are now  |
| Activated   ==                 +--------------------------+
+--------------------------------+ Try the role check       |
| Launch batches table           | [Try to approve]         |
+--------------------------------+--------------------------+
```

## Audit trail and settings

```
+----------------------------------------------------------+
| [Action v]        [Result v]         [Role v]            |
+----------------------------------------------------------+
| Approve                                        (Blocked) |
| Unauthorized: Founder cannot perform this action.        |
| Founder, about Hiro Tanaka, date, ERR_FORBIDDEN          |
+----------------------------------------------------------+

+---------------------------+------------------------------+
| Current role              | Demo data                    |
| [Switch role]             | [Reset sample data]          |
+---------------------------+------------------------------+
| Known limitations                                        |
+----------------------------------------------------------+
```
