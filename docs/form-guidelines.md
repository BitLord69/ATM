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

## Unsaved Changes Standard

- Use a modal for route-leave confirmation, not browser-native `window.confirm` or `beforeunload` dialogs.
- Reuse `useUnsavedChangesGuard` from `app/composables/use-unsaved-changes-guard.ts` for form/edit pages.
- Render `ConfirmationModal` with values returned by the composable (`modalTitle`, `modalMessage`, `modalConfirmText`, `modalCancelText`).

## New Form Page Checklist

1. Create a page snapshot function.

```ts
function createSnapshot() {
  return JSON.stringify({ form: formState.value, items: items.value });
}
```

2. Use `useSnapshotDirtyState` to derive `hasUnsavedChanges`.

```ts
const {
  hasUnsavedChanges,
  captureInitialSnapshot,
} = useSnapshotDirtyState(createSnapshot);
```

3. After loading initial form data, call `captureInitialSnapshot()`.

```ts
watch(data, (value) => {
  if (!value) {
    return;
  }
  // populate form state...
  captureInitialSnapshot();
}, { immediate: true });
```

4. Call `useUnsavedChangesGuard` in `<script setup>`.

```ts
const {
  showLeaveConfirmModal,
  modalTitle,
  modalMessage,
  modalConfirmText,
  modalCancelText,
  confirmLeavePage,
  cancelLeavePage,
} = useUnsavedChangesGuard(hasUnsavedChanges);
```

5. Add `ConfirmationModal` near the end of your template.

```vue
<ConfirmationModal
	:open="showLeaveConfirmModal"
	:title="modalTitle"
	:message="modalMessage"
	:confirm-text="modalConfirmText"
	:cancel-text="modalCancelText"
	:is-dangerous="true"
	@confirm="confirmLeavePage"
	@cancel="cancelLeavePage"
/>
```

6. Do not add `window.confirm` or `beforeunload` for form-leave warnings.
