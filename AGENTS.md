# Project Rules & Communication Guidelines (ATM)

## Mandatory Response & Summary Protocol

1. **Always Swedish:** All communications, status updates, and session recaps must be in Swedish.
2. **Raw Markdown Block Requirement for Recaps:** Whenever a recap, summary, list of outstanding tasks, or review of new ideas is requested, it MUST be wrapped inside a single copyable ` ```markdown ... ``` ` block without raw file URL links (`file:///...`), focusing solely on the actual site changes, functionality, and outstanding items (no git/terminal command boilerplate). Never format the recap as loose rendered HTML/chat text that loses its Markdown syntax on copy-paste.
3. **New Ideas Policy:** New ideas must always be presented in a dedicated section and explicitly require user approval ("OK") before being added to `docs/future-followups.md`.
4. **Continuous Documentation & Help Page Synchronization:** Whenever functionality, admin/tournament routes, permissions, settings, or workflows are added, modified, moved, or removed, the relevant technical documentation in `docs/` (and the future in-app Help Page once implemented) MUST always be updated in the same step.
5. **Explicit Git Push Only:** NEVER commit or push to git automatically. Only execute `git commit` or `git push` when the user explicitly requests it (e.g. "pusha till git", "push it").
6. **/prestanda Command Integration:** Whenever the user invokes `/prestanda` or asks for a performance, architecture, security, or quality check, follow the `prestanda` skill protocol to conduct a thorough four-pillar audit (Modularity, Code Quality, Security, Performance) and present the results in a copyable markdown codeblock without making any code modifications prior to explicit user approval.
7. **Always Assume Production Environment:** Always assume that tests, migrations, behaviors, and user reports refer to the live production environment (Vercel + Turso Cloud) alongside local development unless the user explicitly states otherwise.
