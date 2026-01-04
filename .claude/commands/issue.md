# Create New Issue

You are creating a new GitHub issue based on the user's description.

**User's issue description:** $ARGUMENTS

## Workflow

### Step 1: Initial Exploration

Before creating the issue, do a quick exploration to understand:

- What area of the codebase is affected
- Whether this is a bug fix or feature request
- Key files or components involved

Use Glob and Grep to search for relevant code. Read 2-3 key files to understand the context. Keep this exploration brief - just enough to write a good issue.

### Step 2: Draft the Issue

Prepare the issue content with:

**Title:** A clear, concise title describing the issue

**Body:** Use this structure:

```markdown
## Description

[Clear description based on user input and your exploration]

## Context

[Why is this needed? What problem does it solve?]

## Acceptance Criteria

- [ ] [Criterion 1]
- [ ] [Criterion 2]
- [ ] [Criterion 3]

## Technical Notes

**Affected files:**
- [file:line - brief description]

**Current behavior:** (for bugs)
[What happens now]

**Expected behavior:** (for bugs)
[What should happen]

**Implementation approach:** (for features)
[High-level approach based on initial exploration]
```

### Step 3: Create the Issue

Use the GitHub CLI to create the issue:

```bash
gh issue create --title "Issue title" --body "$(cat <<'EOF'
## Description
...

## Context
...

## Acceptance Criteria
- [ ] ...

## Technical Notes
...
EOF
)"
```

Add appropriate labels based on the issue type:
- `bug` - Something is broken or not working correctly
- `feature` - New functionality that doesn't exist
- `enhancement` - Improving existing functionality
- `cleanup` - Code cleanup, refactoring, removing dead code
- `docs` - Documentation changes

Example with label:
```bash
gh issue create --title "..." --body "..." --label "bug"
```

### Step 4: Technical Deep Dive (Optional)

For complex issues, use the Task tool with `subagent_type="Explore"` to do a thorough technical exploration:

For **bugs**: Ask the agent to do root cause analysis - trace the code path, identify where the bug originates, and document the fix approach.

For **features/enhancements**: Ask the agent to explore the implementation - identify all files that need changes, understand the existing patterns, and outline the implementation steps.

After the exploration, update the issue with implementation details:

```bash
gh issue comment <issue-number> --body "$(cat <<'EOF'
## Implementation Plan

1. Step one
2. Step two
...
EOF
)"
```

## Output

After completing all steps, summarize:

- Issue number and URL created
- Type (bug/feature/etc)
- Key findings from the technical exploration
- Brief overview of the implementation plan (if created)
