# Nuxt Minimal Starter

Look at the [Nuxt documentation](https://nuxt.com/docs/getting-started/introduction) to learn more.

## Setup

Make sure to install dependencies:

````bash
# pnpm
pnpm install

## Development Server

Start the development server on `http://localhost:3000`:

```bash
# pnpm
pnpm dev
````

## Production

Build the application for production:

```bash
# pnpm
pnpm build
```

Locally preview production build:

```bash
# pnpm
pnpm preview
```

Check out the [deployment documentation](https://nuxt.com/docs/getting-started/deployment) for more information.

## Proactive Delivery Rules

When introducing a new component, composable, utility, or project-wide UX rule, always roll it out proactively.

- Reuse first: replace obvious duplicate patterns in existing pages while implementing the new artifact.
- Centralize logic: prefer shared composables/utilities over page-local repeated logic.
- Document usage: update relevant docs with usage examples and migration notes.
- Keep compatibility: use safe defaults so existing pages continue to work.
- Validate changes: run diagnostics on all touched files before handoff.

### Minimum proactive checklist

1. Implement the new artifact.
2. Apply it to current known pages using the same pattern.
3. Add/update docs for future usage.
4. Verify diagnostics are clean.
