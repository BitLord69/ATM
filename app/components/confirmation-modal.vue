<script setup lang="ts">
type Props = {
  open: boolean;
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  isDangerous?: boolean;
  confirmDisabled?: boolean;
};

type Emits = {
  (e: "confirm"): void;
  (e: "cancel"): void;
};

withDefaults(defineProps<Props>(), {
  message: "",
  confirmText: "Confirm",
  cancelText: "Cancel",
  isDangerous: false,
  confirmDisabled: false,
});

defineEmits<Emits>();
</script>

<template>
  <dialog
    class="modal"
    :class="{ 'modal-open': open }"
  >
    <div class="modal-box">
      <h3 class="font-bold text-lg mb-3">
        {{ title }}
      </h3>

      <p
        v-if="message"
        class="text-base opacity-90 mb-4"
      >
        {{ message }}
      </p>

      <div v-if="$slots.default" class="mb-4">
        <slot />
      </div>

      <div class="modal-action">
        <button
          class="btn btn-ghost"
          @click="$emit('cancel')"
        >
          {{ cancelText }}
        </button>
        <button
          :class="isDangerous ? 'btn btn-error' : 'btn btn-primary'"
          :disabled="confirmDisabled"
          @click="$emit('confirm')"
        >
          {{ confirmText }}
        </button>
      </div>
    </div>
    <div
      class="modal-backdrop"
      @click="$emit('cancel')"
    />
  </dialog>
</template>
