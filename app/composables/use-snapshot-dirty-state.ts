import { computed, ref } from "#imports";

export function useSnapshotDirtyState(createSnapshot: () => string) {
  const initialSnapshot = ref("");
  const hasLoadedInitialState = ref(false);

  const hasUnsavedChanges = computed(() => {
    if (!hasLoadedInitialState.value) {
      return false;
    }
    return createSnapshot() !== initialSnapshot.value;
  });

  function captureInitialSnapshot() {
    initialSnapshot.value = createSnapshot();
    hasLoadedInitialState.value = true;
  }

  return {
    hasUnsavedChanges,
    captureInitialSnapshot,
  };
}
