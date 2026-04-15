## Hotfix Summary

- Incident/bug:
- Root cause:
- Why this fix is safe for fast merge:

## Impact

- [ ] Production bug
- [ ] Security issue
- [ ] Data integrity issue
- [ ] Availability/performance issue

## Minimum Validation (Required)

- [ ] `pnpm lint`
- [ ] `pnpm typecheck`
- [ ] I manually reproduced the issue before fix
- [ ] I manually verified the fix after change

## DB/Config Safety

- [ ] No DB change
- [ ] DB change included and reviewed (`pnpm db:ensure-latest-schema`)
- [ ] Cloud migration needed and completed (`pnpm db:migrate:cloud`)
- [ ] No env var change
- [ ] Env var change included and synced

## Deployment Notes

- [ ] Safe for Vercel preview deploy
- [ ] Any post-deploy action is documented below

Post-deploy actions (if any):

-

## Rollback Plan

- How to revert quickly if this fails:
- How to verify rollback succeeded:

## Reviewer Focus (Hotfix)

- Highest-risk files:
- Fastest way to verify this in app:
