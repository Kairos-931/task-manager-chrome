# Sync hardening plan

## Goal

Prevent TaskMaster data from being silently overwritten or restored when the
extension, the mobile quick-add page, and multiple devices write around the
same time.

## Users and experience

Users continue to add, edit, complete, and delete tasks offline. The
extension saves locally immediately. Its status only reports cloud success
after the Worker has accepted or reconciled the change.

## Scope

- The Worker returns the canonical record whenever it rejects an older write.
- Default categories use stable IDs on every device; legacy name-based values
  are converted during normal load and sync.
- A valid local backup remains authoritative even when it contains zero tasks.
- Extension sync requests are serialized and a remote response cannot overwrite
  a newer local edit made while the request was in flight.
- Mobile pending tasks use ID-only deduplication and are acknowledged after a
  durable local import, including retrying an acknowledgement after an earlier
  interruption.
- Once incremental sync is active, legacy full-snapshot clients receive an
  explicit upgrade-required response instead of becoming a second writer.
- Deleting a category moves its tasks and default selection to a remaining
  category, so no task keeps an invisible category ID.

## Constraints

- Extension source is in `shared/` and needs `npm run build` plus a Chrome
  extension reload to take effect.
- Worker and mobile quick-add code are both in `backend/index.js`; deployment
  is a separate explicit action.
- Existing delete tombstones are retained. History compaction requires device
  acknowledgement tracking and is deliberately not introduced in this change.

## Acceptance checks

1. A stale write is rejected and its sender receives the newer canonical task.
2. A zero-task backup retains its categories and weekly-goal settings.
3. Phone-created tasks with equal titles import independently and are not lost
   when acknowledgement is retried.
4. A category selected on the phone has the same ID the extension renders.
5. A local edit made during another sync remains pending and is uploaded next.
6. A legacy full-snapshot write cannot overwrite an active incremental dataset.
