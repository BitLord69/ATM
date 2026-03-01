<script setup lang="ts">
const isNavigating = ref(false);
let activeTimer: ReturnType<typeof setTimeout> | null = null;
const router = useRouter();

function startNavigationFeedback() {
  if (activeTimer) {
    clearTimeout(activeTimer);
  }

  activeTimer = setTimeout(() => {
    isNavigating.value = true;
  }, 80);
}

function stopNavigationFeedback() {
  if (activeTimer) {
    clearTimeout(activeTimer);
    activeTimer = null;
  }

  isNavigating.value = false;
}

const removeBeforeEach = router.beforeEach(() => {
  startNavigationFeedback();
});

const removeAfterEach = router.afterEach(() => {
  stopNavigationFeedback();
});

const removeOnError = router.onError(() => {
  stopNavigationFeedback();
});

onBeforeUnmount(() => {
  removeBeforeEach();
  removeAfterEach();
  removeOnError();
  stopNavigationFeedback();
});
</script>

<template>
  <Transition
    enter-active-class="transition-opacity duration-150"
    enter-from-class="opacity-0"
    enter-to-class="opacity-100"
    leave-active-class="transition-opacity duration-150"
    leave-from-class="opacity-100"
    leave-to-class="opacity-0"
  >
    <div
      v-if="isNavigating"
      class="fixed top-3 left-1/2 -translate-x-1/2 z-9999"
      aria-live="polite"
      aria-atomic="true"
    >
      <div class="alert alert-info shadow-lg py-2 px-3">
        <span class="loading loading-spinner loading-sm" />
        <span class="text-sm font-medium">Loading next page...</span>
      </div>
    </div>
  </Transition>
</template>
