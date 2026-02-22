<script setup lang="ts">
type Props = {
  open: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDangerous?: boolean;
};

type Emits = {
  (e: "confirm"): void;
  (e: "cancel"): void;
};

withDefaults(defineProps<Props>(), {
  confirmText: "Confirm",
  cancelText: "Cancel",
  isDangerous: false,
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

      <p class="text-base opacity-90 mb-6">
        {{ message }}
      </p>

      <div class="modal-action">
        <button
          class="btn btn-ghost"
          @click="$emit('cancel')"
        >
          {{ cancelText }}
        </button>
        <button
          :class="isDangerous ? 'btn btn-error' : 'btn btn-primary'"
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
