# Tournament Authorization & Multi-Role System

## Overview

This implements a tournament-scoped role system where users can have different roles across different tournaments within an organization.

## Database Schema

### `tournament_membership` table

- Links users to tournaments with specific roles
- Fields: `userId`, `tournamentId`, `organizationId`, `role`, `status`, `expiresAt`
- Roles: `owner`, `admin`, `td` (tournament director), `scorer`, `viewer`
- Status: `active`, `suspended`, `expired`

### `tournament` table updates

- Added `organizationId` to link tournaments to organizations

## Authorization System

### Server-side utility: `server/utils/authorization.ts`

**Key functions:**

- `can(user, action, tournamentContext)` - Check if user can perform an action
- `hasRoleLevel(tournamentContext, minRole)` - Check role hierarchy
- `isTournamentActive(startDate, endDate)` - Check tournament date status
- `getTournamentStatus(startDate, endDate)` - Return 'active' | 'coming' | 'past'
- `isPrivilegedMember(tournamentContext)` - Check if user is TD or higher

**Role Hierarchy:**

- owner (5) - Full control, can delete tournament
- admin (4) - Can manage tournament
- td (3) - Tournament director, can edit tournament and events
- scorer (2) - Can enter/edit scores
- viewer (1) - Read-only access

**Action Examples:**

- `tournament:delete` - owner only
- `tournament:edit` - td and above
- `score:enter` - scorer and above
- `tournament:view` - all roles

**Global Sysadmin:**

- Users with `user.role === 'admin'` bypass all checks (god mode)

## API Endpoints

### `GET /api/tournaments/my-tournaments`

Returns all tournaments the user is a member of, enriched with:

- Tournament details
- User's role and status
- Computed `tournamentStatus` (active/coming/past)
- `isSysadmin` flag

## Frontend Components

### Store: `app/stores/tournament.ts`

Manages:

- List of user's tournament memberships
- Active/selected tournament context
- Tournament selector modal visibility
- Auto-selection logic on login
- Filtered tournament views

**Auto-selection logic:**

- If 1 active tournament → auto-select
- If multiple active + not sysadmin/TD → show selector modal
- If no active tournaments → show message on dashboard

### Component: `app/components/tournament-selector-modal.vue`

Modal dialog for selecting a tournament when multiple are active

### Page: `app/pages/dashboard/index.vue`

- Displays active tournament context
- Shows "no active tournaments" alert if needed
- Filterable tournament list (all/active/coming/past)
- Click tournament card to switch context
- Tournament cards show: role, status, dates, event types

## Usage Example

### In a server API route:

\`\`\`typescript
import { can } from "~/server/utils/authorization";

export default defineEventHandler(async (event) => {
const user = event.context.session?.user;
const tournamentContext = await getUserTournamentContext(user.id, tournamentId);

if (!can(user, "score:enter", tournamentContext)) {
throw createError({ statusCode: 403, message: "Forbidden" });
}

// Proceed with score entry...
});
\`\`\`

### In a Vue component:

\`\`\`vue

<script setup>
import { useTournamentStore } from "~/stores/tournament";

const tournamentStore = useTournamentStore();

// Check if user has active tournament
if (tournamentStore.activeTournament) {
  const role = tournamentStore.activeTournament.role;
  // Show/hide UI based on role
}
</script>

\`\`\`

## Next Steps

1. **Run migration** to add `tournament_membership` table and update `tournament` table
2. **Seed data** with sample tournament memberships for testing
3. **Update navigation** to show active tournament in header/nav
4. **Implement permission checks** in all tournament-scoped API routes
5. **Add tournament switching UI** to nav bar
6. **Add membership management** pages for TDs/admins to invite/remove members

## Migration Command

\`\`\`bash
pnpm drizzle-kit generate
pnpm drizzle-kit migrate
\`\`\`
