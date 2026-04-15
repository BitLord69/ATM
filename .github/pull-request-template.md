## Summary

- What changed?
- Why was this needed?
- Any risks or edge cases?

## Scope

- [ ] UI changes
- [ ] API changes
- [ ] Auth/permissions changes
- [ ] Database/schema changes
- [ ] Env/config changes

## Database Checklist

- [ ] I ran: `pnpm db:ensure-latest-schema`
- [ ] If schema/migrations changed, I also ran: `pnpm db:migrate:cloud`
- [ ] I confirmed no unintended data-destructive operations

## Local Validation

- [ ] I ran: `pnpm lint`
- [ ] I ran: `pnpm typecheck`
- [ ] I ran (optional but recommended): `pnpm build`
- [ ] I manually tested affected user flows

## Deploy/Environment Checklist

- [ ] Required Vercel env vars are present for target environments
- [ ] If env values changed, I synced them (for example `pnpm env:sync:vercel`)
- [ ] `BETTER_AUTH_URL` matches deployed domain expectations
- [ ] OAuth callback URLs are correct for the target environment

## PR Deployment Notes (Vercel)

- [ ] Preview deployment should build without extra manual steps
- [ ] If this PR depends on DB changes, cloud DB was migrated before merge

## Smoke Test Plan

- [ ] Sign-in works
- [ ] Invitation send works
- [ ] Invitation accept/finalize works
- [ ] Admin/TD access behaves as expected

## Reviewer Focus

- Please focus on:
- Potential regressions in:
- Any follow-up tasks after merge:
