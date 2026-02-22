# Form Guidelines

Use `FormField` for standard form inputs across pages.

## Component

- Path: `app/components/form-field.vue`
- Purpose: consistent labels, required marker (`*`), hint text, and inline error text.

## Usage

Wrap each input/select/textarea in `FormField`:

- `label` (required): field label text
- `required` (optional): shows required marker
- `error` (optional): inline error text
- `hint` (optional): supporting helper text
- `wrapper-class` (optional): extra layout classes (for grid spans, margins, width)

## Pattern

- Keep existing DaisyUI input/select/textarea classes (`input input-bordered`, `select select-bordered`, `textarea textarea-bordered`).
- For validation, pass per-field message via `:error`.
- Do not duplicate label/error/hint markup outside `FormField` unless there is a special-case UX requirement.
