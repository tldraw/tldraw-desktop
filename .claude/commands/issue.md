# Create New Issue

You are creating a new issue in `planning/issues/` based on the user's description.

**User's issue description:** $ARGUMENTS

## Workflow

### Step 1: Initial Exploration

Before creating the issue, do a quick exploration to understand:

- What area of the codebase is affected
- Whether this is a bug fix or feature request
- Key files or components involved

Use Glob and Grep to search for relevant code. Read 2-3 key files to understand the context. Keep this exploration brief - just enough to write a good issue.

### Step 2: Determine Issue Number

List the files in `planning/issues/` to find the next issue number. Issues use zero-padded 4-digit numbers (0001, 0002, etc).

### Step 3: Create the Issue File

Create a new file at `planning/issues/XXXX-short-description.md` using this template:

````markdown
# [Issue Title]

**Status:** `open`
**Priority:** `medium`
**Type:** `feature` | `bug` | `enhancement` | `cleanup` | `docs`

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

## Related

- Related: #XXXX (if applicable)

## Implementation Plan

...

## Implementation Notes

...

```

Choose the appropriate **Type**:

- `bug` - Something is broken or not working correctly
- `feature` - New functionality that doesn't exist
- `enhancement` - Improving existing functionality
- `cleanup` - Code cleanup, refactoring, removing dead code
- `docs` - Documentation changes

### Step 4: Technical Deep Dive

After creating the issue file, use the Task tool with `subagent_type="Explore"` to do a thorough technical exploration:

For **bugs**: Ask the agent to do root cause analysis - trace the code path, identify where the bug originates, and document the fix approach.

For **features/enhancements**: Ask the agent to explore the implementation - identify all files that need changes, understand the existing patterns, and outline the implementation steps.

Example prompt for the subagent:
```
````

Thoroughly explore the codebase to create an implementation plan for: [issue title]

[For bugs]: Trace the code path to identify the root cause. Document:

1. Where the bug originates
2. What causes the incorrect behavior
3. The specific fix needed
4. Any edge cases to consider

[For features]: Explore how to implement this feature. Document:

1. All files that need to be modified or created
2. Existing patterns to follow
3. Step-by-step implementation approach
4. Integration points with existing code
5. Any potential complications

Be thorough - this will become the implementation plan for the issue.

```

### Step 5: Complete the Implementation Plan

Take the findings from the subagent and update the issue file's `## Implementation Plan` section with:

1. A clear, numbered list of implementation steps
2. Specific files to modify with line numbers where helpful
3. Code snippets or patterns to follow (if relevant)
4. Testing considerations
5. Any risks or edge cases identified

The Implementation Plan should be detailed enough that someone could follow it to implement the fix/feature.

## Output

After completing all steps, summarize:

- Issue number and file path created
- Type (bug/feature/etc)
- Key findings from the technical exploration
- Brief overview of the implementation plan
```
