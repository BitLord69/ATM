<script setup lang="ts">
const props = withDefaults(defineProps<{
  message: string | null;
  type?: "success" | "error" | "warning" | "info";
  icon?: string;
  autoHideMs?: number;
  dismissible?: boolean;
  role?: "status" | "alert";
}>(), {
  type: "info",
  icon: undefined,
  autoHideMs: 5000,
  dismissible: true,
  role: "status",
});

const emit = defineEmits<{
  (event: "dismiss"): void;
}>();

const dismissTimer = ref<number | null>(null);

const resolvedIcon = computed(() => {
  if (props.icon) {
    return props.icon;
  }

  if (props.type === "success") {
    return "tabler:circle-check";
  }
  if (props.type === "error") {
    return "tabler:alert-circle";
  }
  if (props.type === "warning") {
    return "tabler:alert-triangle";
  }
  return "tabler:info-circle";
});

const alertClass = computed(() => {
  if (props.type === "success") {
    return "alert-success";
  }
  if (props.type === "error") {
    return "alert-error";
  }
  if (props.type === "warning") {
    return "alert-warning";
  }
  return "alert-info";
});

const iconToneClass = computed(() => {
  if (props.type === "success") {
    return "bg-base-100/85 text-success";
  }
  if (props.type === "error") {
    return "bg-base-100/90 text-error";
  }
  if (props.type === "warning") {
    return "bg-base-100/90 text-warning-content";
  }
  return "bg-base-100/85 text-info";
});

const dismissButtonClass = computed(() => {
  if (props.type === "success") {
    return "border-base-100/30 bg-base-100/10 text-success-content hover:bg-base-100/20 hover:text-success-content";
  }
  if (props.type === "error") {
    return "border-base-100/25 bg-base-100/10 text-error-content hover:bg-base-100/20 hover:text-error-content";
  }
  if (props.type === "warning") {
    return "border-base-100/25 bg-base-100/10 text-warning-content hover:bg-base-100/20 hover:text-warning-content";
  }
  return "border-base-100/30 bg-base-100/10 text-info-content hover:bg-base-100/20 hover:text-info-content";
});

function clearDismissTimer() {
  if (dismissTimer.value) {
    clearTimeout(dismissTimer.value);
    dismissTimer.value = null;
  }
}

function dismiss() {
  clearDismissTimer();
  emit("dismiss");
}

watch(
  () => props.message,
  (message) => {
    clearDismissTimer();

    if (!message || props.autoHideMs <= 0) {
      return;
    }

    dismissTimer.value = window.setTimeout(() => {
      dismissTimer.value = null;
      emit("dismiss");
    }, props.autoHideMs);
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  clearDismissTimer();
});
</script>

<template>
  <div
    v-if="message"
    :role="role"
    class="alert gap-3"
    :class="[alertClass]"
  >
    <span
      class="inline-flex size-8 shrink-0 items-center justify-center rounded-full"
      :class="[iconToneClass]"
    >
      <Icon
        :name="resolvedIcon"
        size="18"
      />
    </span>
    <span class="flex-1">{{ message }}</span>
    <button
      v-if="dismissible"
      type="button"
      class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-lg font-semibold leading-none transition-colors ml-auto"
      :class="[dismissButtonClass]"
      aria-label="Dismiss message"
      @click="dismiss"
    >
      <span class="relative block h-3.5 w-3.5" aria-hidden="true">
        <span class="absolute left-1/2 top-1/2 h-0.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-full bg-current" />
        <span class="absolute left-1/2 top-1/2 h-0.5 w-3.5 -translate-x-1/2 -translate-y-1/2 -rotate-45 rounded-full bg-current" />
      </span>
    </button>
  </div>
</template>
