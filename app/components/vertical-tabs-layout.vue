<script setup lang="ts">
export type VerticalTabConfig = {
  id: string;
  label: string;
  description?: string;
};

const props = defineProps<{
  tabs: VerticalTabConfig[];
  modelValue: string;
  showBulkActions?: boolean;
  initialOpenTabIds?: string[];
  sessionStateKey?: string;
}>();

const emit = defineEmits<{
  (event: "update:modelValue", value: string): void;
}>();

const openTabIds = ref<string[]>([]);
const hasInitializedOpenTabs = ref(false);
const SESSION_STORAGE_PREFIX = "vertical-tabs:";

const hasAnyOpenTabs = computed(() => openTabIds.value.length > 0);
const areAllTabsOpen = computed(() => props.tabs.length > 0 && openTabIds.value.length === props.tabs.length);

const focusedTabId = computed(() => {
  if (!props.modelValue) {
    return "";
  }

  return props.tabs.some(tab => tab.id === props.modelValue) ? props.modelValue : "";
});

watch(
  () => [props.tabs, props.modelValue, props.initialOpenTabIds, props.sessionStateKey] as const,
  () => {
    const validTabIds = new Set(props.tabs.map(tab => tab.id));

    if (!hasInitializedOpenTabs.value) {
      let nextOpenTabIds = (props.initialOpenTabIds || []).filter(tabId => validTabIds.has(tabId));

      if (import.meta.client && props.sessionStateKey) {
        const storageKey = `${SESSION_STORAGE_PREFIX}${props.sessionStateKey}`;
        const savedValue = sessionStorage.getItem(storageKey);
        if (savedValue) {
          try {
            const parsed = JSON.parse(savedValue);
            if (Array.isArray(parsed)) {
              nextOpenTabIds = parsed.filter(
                (tabId): tabId is string => typeof tabId === "string" && validTabIds.has(tabId),
              );
            }
          }
          catch {
            sessionStorage.removeItem(storageKey);
          }
        }
      }

      openTabIds.value = nextOpenTabIds;
      hasInitializedOpenTabs.value = true;
    }
    else {
      openTabIds.value = openTabIds.value.filter(tabId => validTabIds.has(tabId));
    }

    if (
      props.modelValue
      && validTabIds.has(props.modelValue)
      && !openTabIds.value.includes(props.modelValue)
    ) {
      openTabIds.value = [...openTabIds.value, props.modelValue];
    }
  },
  { immediate: true, deep: true },
);

watch(
  openTabIds,
  (value) => {
    if (!import.meta.client || !props.sessionStateKey) {
      return;
    }

    const storageKey = `${SESSION_STORAGE_PREFIX}${props.sessionStateKey}`;
    sessionStorage.setItem(storageKey, JSON.stringify(value));
  },
  { deep: true },
);

function isOpen(tabId: string) {
  return openTabIds.value.includes(tabId);
}

function toggleTab(tabId: string) {
  if (isOpen(tabId)) {
    openTabIds.value = openTabIds.value.filter(id => id !== tabId);
    if (focusedTabId.value === tabId) {
      emit("update:modelValue", "");
    }
    return;
  }

  openTabIds.value = [...openTabIds.value, tabId];
  emit("update:modelValue", tabId);
}

function openAllTabs() {
  openTabIds.value = props.tabs.map(tab => tab.id);
  if (!focusedTabId.value && props.tabs[0]?.id) {
    emit("update:modelValue", props.tabs[0].id);
  }
}

function closeAllTabs() {
  openTabIds.value = [];
  emit("update:modelValue", "");
}
</script>

<template>
  <div class="space-y-2">
    <div
      v-if="showBulkActions && tabs.length > 1"
      class="flex items-center justify-end gap-2"
    >
      <button
        type="button"
        class="btn btn-ghost btn-xs"
        :disabled="areAllTabsOpen"
        @click="openAllTabs"
      >
        Open all
      </button>
      <button
        type="button"
        class="btn btn-ghost btn-xs"
        :disabled="!hasAnyOpenTabs"
        @click="closeAllTabs"
      >
        Close all
      </button>
    </div>

    <section
      v-for="tab in tabs"
      :key="tab.id"
      class="rounded-box bg-base-100 border border-base-300/50"
    >
      <button
        type="button"
        class="w-full px-4 py-2 text-left flex items-center justify-between gap-2"
        :aria-expanded="isOpen(tab.id)"
        @click="toggleTab(tab.id)"
      >
        <span class="font-medium">{{ tab.label }}</span>
        <svg
          class="h-4 w-4 shrink-0 transition-transform duration-150"
          :class="isOpen(tab.id) ? 'rotate-180' : ''"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fill-rule="evenodd"
            d="M5.22 7.22a.75.75 0 0 1 1.06 0L10 10.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 8.28a.75.75 0 0 1 0-1.06Z"
            clip-rule="evenodd"
          />
        </svg>
      </button>

      <div
        v-if="isOpen(tab.id)"
        class="px-4 pb-4"
      >
        <slot
          :name="tab.id"
          :active-tab-id="focusedTabId"
        />
      </div>
    </section>
  </div>
</template>
