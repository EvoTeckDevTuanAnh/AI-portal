# Agency Rule

## HOW THE AGENT MUST WORK

1. ALWAYS check git status + working tree before and after any change.
2. READ agencyStatus.md → agencyMemory.md → relevant agencyDiary.md first; Git + Code + Tests = truth.
3. Verify the actual failing behavior (reproduce) before fixing.
4. Do not commit unless the user explicitly asks.
5. Run lint/typecheck when the repo defines them.
6. Update agencyDiary.md (what happened) and agencyStatus.md (where we are) after every session.
7. Update agencyMemory.md only for lasting project knowledge (memory gate).
8. Never modify files belonging to other plugins/agents unless requested.