# Open Issues

## Sync protocol follow-up

The current incremental sync protocol protects record-level writes, deletes,
and mobile imports. Two deliberate follow-up items remain:

1. **Field-level task merge**: concurrent edits to different fields of the
   same task still use deterministic last-write-wins. A future change should
   store per-field versions and show a clear resolution when both devices edit
   the same field.
2. **Safe history compaction**: `sync_changes` and delete tombstones remain
   retained so a long-offline device cannot restore deleted data. Compaction
   must first add device acknowledgement tracking and an inactive-device
   retention policy; deleting history on a timer would risk data resurrection.

Tracking: [GitHub Issue #16](https://github.com/Kairos-931/task-manager-chrome/issues/16).
This file records the product context so the issue remains actionable even
outside GitHub.
