<script setup lang="ts">
export type SearchableSelectOption = {
  value: string;
  label: string;
  sublabel?: string;
};

const props = withDefaults(defineProps<{
  modelValue: string;
  options: SearchableSelectOption[];
  id?: string;
  placeholder?: string;
  emptyText?: string;
  disabled?: boolean;
  size?: "sm" | "md";
  allowCustom?: boolean;
  autocomplete?: string;
  inputClass?: string;
}>(), {
  placeholder: "Search or select...",
  emptyText: "No matching options",
  disabled: false,
  size: "md",
  allowCustom: false,
  autocomplete: "off",
  inputClass: "",
});

const emit = defineEmits<{
  "update:modelValue": [value: string];
}>();

const containerRef = ref<HTMLElement | null>(null);
const inputRef = ref<HTMLInputElement | null>(null);
const isOpen = ref(false);
const query = ref("");
const activeIndex = ref(0);
const listboxId = useId();

const selectedOption = computed(() =>
  props.options.find(opt => opt.value === props.modelValue) ?? null,
);

const displayValue = computed(() => {
  if (isOpen.value) {
    return query.value;
  }
  return selectedOption.value?.label ?? props.modelValue;
});

const filteredOptions = computed(() => {
  const q = query.value.trim().toLowerCase();
  if (!q) {
    return props.options.slice(0, 50);
  }
  return props.options
    .filter(opt =>
      opt.label.toLowerCase().includes(q)
      || (opt.sublabel && opt.sublabel.toLowerCase().includes(q)),
    )
    .slice(0, 50);
});

watch(filteredOptions, () => {
  activeIndex.value = 0;
});

function openDropdown() {
  if (props.disabled) {
    return;
  }
  if (!isOpen.value) {
    query.value = "";
    isOpen.value = true;
    activeIndex.value = 0;
  }
}

function closeDropdown() {
  if (!isOpen.value) {
    return;
  }
  if (props.allowCustom && query.value.trim()) {
    const exact = props.options.find(opt => opt.label.toLowerCase() === query.value.trim().toLowerCase());
    emit("update:modelValue", exact ? exact.value : query.value.trim());
  }
  isOpen.value = false;
  query.value = "";
}

function selectOption(option: SearchableSelectOption) {
  emit("update:modelValue", option.value);
  isOpen.value = false;
  query.value = "";
}

function clearSelection() {
  emit("update:modelValue", "");
  query.value = "";
  inputRef.value?.focus();
  openDropdown();
}

function onInput(event: Event) {
  const val = (event.target as HTMLInputElement).value;
  query.value = val;
  if (!isOpen.value) {
    isOpen.value = true;
  }
  if (props.allowCustom) {
    emit("update:modelValue", val);
  }
}

function onKeydown(event: KeyboardEvent) {
  if (!isOpen.value && (event.key === "ArrowDown" || event.key === "Enter")) {
    openDropdown();
    return;
  }
  if (!isOpen.value) {
    return;
  }
  if (event.key === "ArrowDown") {
    event.preventDefault();
    if (filteredOptions.value.length > 0) {
      activeIndex.value = (activeIndex.value + 1) % filteredOptions.value.length;
    }
  }
  else if (event.key === "ArrowUp") {
    event.preventDefault();
    if (filteredOptions.value.length > 0) {
      activeIndex.value = (activeIndex.value - 1 + filteredOptions.value.length) % filteredOptions.value.length;
    }
  }
  else if (event.key === "Enter") {
    const chosen = filteredOptions.value[activeIndex.value];
    if (chosen) {
      event.preventDefault();
      selectOption(chosen);
    }
  }
  else if (event.key === "Escape") {
    event.preventDefault();
    closeDropdown();
  }
}

function handleOutsideClick(event: MouseEvent) {
  if (containerRef.value && !containerRef.value.contains(event.target as Node)) {
    closeDropdown();
  }
}

onMounted(() => {
  document.addEventListener("mousedown", handleOutsideClick);
});

onBeforeUnmount(() => {
  document.removeEventListener("mousedown", handleOutsideClick);
});
</script>

<template>
  <div
    ref="containerRef"
    class="relative w-full"
  >
    <div class="relative flex items-center">
      <input
        :id="id"
        ref="inputRef"
        type="text"
        role="combobox"
        :autocomplete="autocomplete"
        :aria-expanded="isOpen"
        :aria-controls="listboxId"
        aria-autocomplete="list"
        class="input input-bordered w-full pr-14 bg-base-100 text-base-content border-base-content/20 hover:border-base-content/40 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        :class="[size === 'sm' ? 'input-sm' : '', inputClass]"
        :value="displayValue"
        :placeholder="placeholder"
        :disabled="disabled"
        @focus="openDropdown"
        @click="openDropdown"
        @input="onInput"
        @keydown="onKeydown"
      >
      <div class="absolute right-2 flex items-center gap-0.5">
        <button
          v-if="modelValue && !disabled"
          type="button"
          class="btn btn-ghost btn-xs btn-circle opacity-60 hover:opacity-100"
          aria-label="Clear selection"
          @mousedown.prevent="clearSelection"
        >
          <Icon
            name="tabler:x"
            size="14"
          />
        </button>
        <button
          type="button"
          class="btn btn-ghost btn-xs btn-circle opacity-70"
          tabindex="-1"
          aria-label="Toggle options"
          :disabled="disabled"
          @mousedown.prevent="isOpen ? closeDropdown() : (inputRef?.focus(), openDropdown())"
        >
          <Icon
            name="tabler:chevron-down"
            size="16"
            class="transition-transform duration-150"
            :class="isOpen ? 'rotate-180' : ''"
          />
        </button>
      </div>
    </div>

    <ul
      v-if="isOpen"
      :id="listboxId"
      role="listbox"
      class="menu bg-base-200 border border-primary/50 ring-1 ring-primary/20 rounded-box shadow-2xl absolute z-50 mt-1.5 w-full max-h-60 overflow-y-auto flex-nowrap p-1.5"
    >
      <li
        v-for="(option, index) in filteredOptions"
        :key="option.value"
        role="option"
        :aria-selected="option.value === modelValue"
      >
        <button
          type="button"
          class="flex flex-col items-start gap-0 py-2 px-3 text-left rounded-lg hover:bg-primary/15"
          :class="{
            'bg-primary text-primary-content font-semibold hover:bg-primary': option.value === modelValue,
            'bg-base-300': index === activeIndex && option.value !== modelValue,
          }"
          @mousedown.prevent="selectOption(option)"
        >
          <span class="text-sm">{{ option.label }}</span>
          <span
            v-if="option.sublabel"
            class="text-xs opacity-65"
          >{{ option.sublabel }}</span>
        </button>
      </li>
      <li
        v-if="filteredOptions.length === 0"
        class="px-3 py-2 text-xs opacity-60"
      >
        {{ emptyText }}
      </li>
    </ul>
  </div>
</template>
