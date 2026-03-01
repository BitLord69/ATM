import type { ComputedRef, Ref } from "vue";

import { computed, onBeforeRouteLeave, ref, useRouter } from "#imports";

type UnsavedChangesGuardOptions = {
  title?: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
};

export function useUnsavedChangesGuard(
  hasUnsavedChanges: Ref<boolean> | ComputedRef<boolean>,
  options?: UnsavedChangesGuardOptions,
) {
  const router = useRouter();

  const showLeaveConfirmModal = ref(false);
  const pendingLeavePath = ref<string | null>(null);
  const bypassUnsavedLeaveGuard = ref(false);

  const modalTitle = computed(() => options?.title || "Unsaved changes");
  const modalMessage = computed(() => options?.message || "You have unsaved changes. Leave this page without saving?");
  const modalConfirmText = computed(() => options?.confirmText || "Leave page");
  const modalCancelText = computed(() => options?.cancelText || "Stay");

  onBeforeRouteLeave((to) => {
    if (bypassUnsavedLeaveGuard.value) {
      bypassUnsavedLeaveGuard.value = false;
      return true;
    }

    if (hasUnsavedChanges.value) {
      pendingLeavePath.value = to.fullPath;
      showLeaveConfirmModal.value = true;
      return false;
    }

    return true;
  });

  function cancelLeavePage() {
    showLeaveConfirmModal.value = false;
    pendingLeavePath.value = null;
  }

  async function confirmLeavePage() {
    const targetPath = pendingLeavePath.value;
    showLeaveConfirmModal.value = false;
    pendingLeavePath.value = null;

    if (!targetPath) {
      return;
    }

    bypassUnsavedLeaveGuard.value = true;
    await router.push(targetPath);
  }

  return {
    showLeaveConfirmModal,
    modalTitle,
    modalMessage,
    modalConfirmText,
    modalCancelText,
    confirmLeavePage,
    cancelLeavePage,
  };
}
