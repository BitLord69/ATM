# Future Follow-ups

This file mirrors active follow-up notes tracked in repository memory so they are easy to review in the codebase.

## Social Auth

- Future UX TODO: when user home/profile page is created, show a persistent badge with connected social provider(s) (GitHub/Google/Facebook) and add a button to disconnect linked social login providers (if provider/API supports unlink).
- Current implementation: one-time post-login success alert appears on dashboard when socialConnected query is present.

## Moderation and Messaging

- Moderation/notifications TODO: evolve current ban-request notifications into a general messaging framework with reusable entities for message threads, recipients/audiences (players, volunteers, staff), delivery status, and tournament-scoped broadcast actions.
- Messaging roadmap TODO: add notification center UI (not just unread badge), optional email templates per event type, and role-based compose permissions for tournament admins vs global admins.
