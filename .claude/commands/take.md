---
model: opus
---

# Take Issue

You are taking up a GitHub issue to implement it.

**User's input:** $ARGUMENTS

## Workflow

### Step 1: Find the Issue

The user may reference an issue in various ways:

- Direct number: "1", "issue 1", "#1"
- Description: "dirty tracking", "rename file", "dark mode"
- Partial match: "rename", "sync", "persistence"

First, list open issues:

```bash
gh issue list --state open
```

Then find the matching issue:

1. **If the input contains a number** (like "1" or "#5"), look for that issue number
2. **If the input is descriptive**, search issue titles and bodies for matches:
   ```bash
   gh issue list --search "keyword"
   ```

If you find exactly one match, proceed to Step 2.

If you find multiple potential matches, ask the user to clarify which one they meant, listing the options.

If you find **no matching issue**, ask the user:

```
I couldn't find an issue matching "$ARGUMENTS".

Would you like me to create a new issue for this instead?
- Yes, create a new issue for: [restate what they asked for]
- No, let me clarify what I'm looking for
```

If they say yes, invoke the `/issue` skill with their original description.

### Step 2: Read and Understand the Issue

View the full issue:

```bash
gh issue view <issue-number>
```

Pay attention to:

- **Labels**: bug, feature, enhancement, cleanup, docs
- **Description**: What needs to be done
- **Acceptance Criteria**: Definition of done
- **Technical Notes**: Affected files, implementation hints

If there's no implementation plan in the issue or comments, use the Task tool with `subagent_type="Explore"` and `model="opus"` to create one before proceeding.

### Step 3: Assign the Issue

Assign the issue to indicate you're working on it:

```bash
gh issue edit <issue-number> --add-assignee @me
```

### Step 4: Create Implementation Todo List

Use an Opus subagent with Plan Mode to create a detailed Plan based on:

1. The Implementation Plan (if available in issue or comments)
2. The Acceptance Criteria
3. Your understanding of the changes needed

### Step 5: Implement the Changes

Work through the todo list systematically:

1. **Read before editing** - Always read files before modifying them
2. **Follow existing patterns** - Match the codebase's style and conventions
3. **Make focused changes** - Don't over-engineer or add unrequested features
4. **Update todos** - Mark items complete as you finish them

For each change:

- Understand the existing code first
- Make the minimal change needed
- Verify the change makes sense in context

### Step 6: Verify the Implementation

After implementing:

1. **Run type checking**:

   ```bash
   npm run typecheck
   ```

2. **Run linting**:

   ```bash
   npm run lint
   ```

3. **Fix any errors** before proceeding

4. **Write e2e test** - For most issues, write a small but meaningful e2e test that tests the most relevant behavior. Run ONLY this test (with `npm run e2e -g <test name>`) to validate that it passes. Once it has passed, run the other tests.

5. **Suggest further manual testing if needed** - For UI changes, suggest running `npm run dev` to verify

### Step 7: Close the Issue

Once all acceptance criteria are met, close the issue with a comment summarizing the implementation:

```bash
gh issue close <issue-number> --comment "$(cat <<'EOF'
## Implementation Summary

- Key changes made
- Files modified
- Testing notes

EOF
)"
```

### Step 8: Summarize

Provide a summary to the user of:

- What issue was implemented
- Key changes made (files modified)
- Manual testing steps
- Any acceptance criteria that couldn't be met (and why)
- Suggestions for testing or follow-up work

## Important Notes

- **Ask questions** if requirements are unclear - use AskUserQuestion
- **Don't guess** at implementation details that aren't specified
- **Keep changes focused** on the issue at hand
- **Commit separately** - Don't auto-commit; let the user decide when to commit
