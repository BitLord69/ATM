# Database ER Diagram

This diagram reflects the current schema relationships in the project (including divisions, entries, starting-list locks, and tournament registration lock).

Maintenance rule: whenever a DB schema table/relation changes in `lib/db/schema/*`, update this ER diagram in the same PR.

```mermaid
erDiagram
  user {
    text id PK
    text email
    text role
    text country
    text distance_unit
    text pdga_number
    text home_club
    text date_of_birth
    text gender_category
  }

  session {
    text id PK
    text user_id FK
    text token
  }

  account {
    text id PK
    text user_id FK
    text provider_id
    text account_id
  }

  verification {
    text id PK
    text identifier
    text value
  }

  organization {
    text id PK
    text name
    text slug
  }

  member {
    text id PK
    text organization_id FK
    text user_id FK
    text role
  }

  invitation {
    text id PK
    text organization_id FK
    text inviter_id FK
    text email
    text status
  }

  tournaments {
    int id PK
    text organization_id FK
    text contact_user_id FK
    text name
    text slug
    int start_date
    int end_date
    int closed_at
  }

  tournament_membership {
    text id PK
    int tournament_id FK
    text user_id FK
    text organization_id FK
    text role
    text status
  }

  venues {
    int id PK
    text name
    real lat
    real long
    int changed_by FK
  }

  tournamentvenues {
    int id PK
    int tournament_id FK
    int venue_id FK
    int changed_by FK
  }

  player {
    text id PK
    text user_id FK
    text display_name
    text date_of_birth
    text gender_category
  }

  division_policy {
    text id PK
    int tournament_id FK
    text age_reference_mode
    text starting_list_mode
    int show_minor_overlays
  }

  tournament_division {
    text id PK
    int tournament_id FK
    text code
    text label
    int is_enabled
    int sort_order
  }

  event_entry {
    text id PK
    text player_id FK
    int tournament_id FK
    text discipline
    text major_division
    text minor_division_tags
    text primary_minor_division
    text active_competitive_division
  }

  starting_list_entry {
    text id PK
    text event_entry_id FK
    int tournament_id FK
    text discipline
    int round_number
    int position
    int start_number
    text active_competitive_division_snapshot
  }

  starting_list_lock {
    text id PK
    int tournament_id FK
    text discipline
    int round_number
    int is_locked
    text locked_by
    int locked_at
  }

  tournament_registration_lock {
    text id PK
    int tournament_id FK
    int is_locked
    text locked_by
    int locked_at
  }

  tournament_player_number {
    text id PK
    int tournament_id FK
    text player_id FK
    int player_number
    text assignment_mode
    text assigned_by
    int assigned_at
  }

  user ||--o{ session : has
  user ||--o{ account : has
  user ||--o{ member : member_of
  user ||--o{ invitation : invites
  user ||--o{ tournament_membership : assigned
  user ||--o{ tournaments : contact_for
  user ||--o{ venues : changed_by
  user ||--|| player : player_profile

  organization ||--o{ member : has
  organization ||--o{ invitation : has
  organization ||--o{ tournaments : owns
  organization ||--o{ tournament_membership : scoped_membership

  tournaments ||--o{ tournament_membership : has
  tournaments ||--o{ tournamentvenues : has
  venues ||--o{ tournamentvenues : linked_in

  tournaments ||--o| division_policy : has_policy
  tournaments ||--o{ tournament_division : offers
  tournaments ||--o{ event_entry : has_entries
  tournaments ||--o{ starting_list_entry : has_starting_lists
  tournaments ||--o{ starting_list_lock : has_starting_list_locks
  tournaments ||--o| tournament_registration_lock : has_registration_lock
  tournaments ||--o{ tournament_player_number : has_player_numbers

  player ||--o{ event_entry : registers
  player ||--o{ tournament_player_number : assigned_number
  event_entry ||--o{ starting_list_entry : ordered_as
```
