# Deployment environment variables (GitHub + Vercel)

## Security first

The current `.env` values have been shared in plain text. Treat them as compromised and rotate these immediately:

- `BETTER_AUTH_SECRET`
- `AUTH_GITHUB_CLIENT_SECRET`
- `GOOGLE_CLIENT_SECRET`
- `FACEBOOK_CLIENT_SECRET`
- `BREVO_SMTP_KEY`

Also rotate any OAuth client IDs/secrets in their providers if they were exposed publicly.

---

## Vercel variables

Set these in **Vercel Project > Settings > Environment Variables**.

Use deploy commands from this repo:

- Preview: `pnpm deploy:vercel:preview`
- Production: `pnpm deploy:vercel:prod`

To sync vars directly from local files:

- All cloud targets: `pnpm env:sync:cloud`
- GitHub only: `pnpm env:sync:github`
- Vercel only: `pnpm env:sync:vercel`

Use these environments:

- **Production**: always required
- **Preview**: required if you want auth/email to work on preview deployments
- **Development**: optional in Vercel (local `.env` usually handles this)

### Required app/runtime variables

- `TURSO_DATABASE_URL`
- `TURSO_AUTH_TOKEN`
- `BETTER_AUTH_SECRET`
- `BETTER_AUTH_URL`
- `AUTH_GITHUB_CLIENT_ID`
- `AUTH_GITHUB_CLIENT_SECRET`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `FACEBOOK_CLIENT_ID`
- `FACEBOOK_CLIENT_SECRET`
- `BREVO_SMTP_HOST`
- `BREVO_SMTP_PORT`
- `BREVO_SMTP_USER`
- `BREVO_SMTP_KEY`
- `BREVO_FROM_EMAIL`

### Value guidance

- Do **not** use local values in cloud:
  - `TURSO_DATABASE_URL=http://127.0.0.1:8080` ❌
  - `BETTER_AUTH_URL=http://localhost:3000` ❌
- Use:
  - `TURSO_DATABASE_URL=<your turso remote url>`
  - `BETTER_AUTH_URL=https://<your-vercel-domain>`

---

## GitHub repository secrets

Current workflow usage in `.github/workflows/lint.yaml` only references:

- `TURSO_DATABASE_URL`
- `TURSO_AUTH_TOKEN`

Set these in **GitHub > Repo > Settings > Secrets and variables > Actions**.

Or sync from CLI (uses `.env` + `.env.cloud`):

```bash
pnpm env:sync:github
```

---

## Safe sync source files

- `.env` = local defaults
- `.env.cloud` = cloud overrides (ignored by git)
- `.env.cloud.example` = template committed to repo

Create `.env.cloud` from `.env.cloud.example` and set at least:

- `TURSO_DATABASE_URL` (remote URL)
- `TURSO_AUTH_TOKEN` (remote token)
- `BETTER_AUTH_URL` (https deployed URL)

The sync script blocks if it detects localhost values for cloud-only fields.

---

## OAuth callback updates (required)

After updating `BETTER_AUTH_URL`, update callback/redirect URLs in providers:

- GitHub OAuth app
- Google OAuth app
- Facebook app

Use your deployed domain callback URLs (and preview URL patterns if needed).

---

## Quick validation checklist

1. `pnpm build` passes locally.
2. Vercel preview deploy succeeds.
3. Sign-in works for each enabled provider.
4. Email flow works (send test invite/reset, depending on feature).
5. GitHub Actions `Lint` workflow passes with repo secrets set.

---

## Sync local DB data to remote Turso

If you need to seed cloud data from your local database state, use:

1. Ensure remote schema is up to date first (apply migrations / schema scripts).
2. Set environment variables for sync (PowerShell):

```powershell
$env:LOCAL_TURSO_DATABASE_URL="file:local.db"
$env:REMOTE_TURSO_DATABASE_URL="libsql://<your-remote-db>.turso.io"
$env:REMOTE_TURSO_AUTH_TOKEN="<your-remote-token>"
```

3. Run:

```bash
pnpm db:sync-local-to-remote
```

Notes:

- This script clears matching remote tables and then inserts all rows from local.
- It only copies tables that exist in both local and remote databases.
- Run it against production only when you intentionally want remote data replaced.
