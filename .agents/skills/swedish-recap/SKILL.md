---
name: swedish-recap
description: Generates clean, well-formatted Swedish session recaps, outstanding task lists, and idea reviews inside raw copyable markdown codeblocks. Trigger whenever the user asks for a recap, summary, sammanfattning, genomgång, or status update.
---

# Swedish Recap & Summary Skill (ATM)

## Instructions
When the user asks for a recap, summary, sammanfattning, status update, or review of ideas:

1. **Language:** Always write the response in **Swedish**.
2. **Format:** Output the entire recap within a single fenced codeblock with the language identifier `markdown`:
   ````markdown
   # 🏆 Sessionssammanfattning — ATM

   ## 1. Genomfört arbete
   ...

   ## 2. Kvarstående uppgifter (To-Do)
   ...

   ## 3. Nya idéer (Kräver godkännande innan dokumentation)
   ...
   ````
3. **Idea Handling:** Never automatically write new ideas into `docs/future-followups.md` until the user has explicitly OK'd them in the conversation.
