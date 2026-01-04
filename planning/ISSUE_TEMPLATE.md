# Issue Template

Use this template when creating new issue files in the `planning/` folder.

## File Naming Convention

```
planning/issues/XXXX-short-description.md
```

Where `XXXX` is a zero-padded issue number (e.g., `0001`, `0002`).

---

## Template

```markdown
# [Issue Title]

**Status:** `open` | `in-progress` | `closed`
**Priority:** `high` | `medium` | `low`
**Type:** `feature` | `bug` | `enhancement` | `cleanup` | `docs`

## Description

[Clear description of the issue or feature request]

## Context

[Why is this needed? What problem does it solve?]

## Acceptance Criteria

- [ ] [Criterion 1]
- [ ] [Criterion 2]
- [ ] [Criterion 3]

## Technical Notes

[Implementation details, affected files, related code, etc.]

## Related

- Blocks: #XXXX
- Blocked by: #XXXX
- Related: #XXXX
```

## Implementation Plan

[Leave this section as "...". We will write this using a followup prompt that explores the issue]

## Implementation Notes

[Leave this section as "...". We will write this after the issue has been implemented.]

---

## Example Issue

See `planning/issues/0001-implement-rename-file.md` for a reference implementation.
