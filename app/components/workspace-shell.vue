<script setup lang="ts">
type WorkspaceLink = {
  kind?: "link";
  id: string;
  label: string;
  icon?: string;
  to: string;
  indented?: boolean;
};

type WorkspaceSection = {
  kind: "section";
  id: string;
  label: string;
  icon?: string;
  defaultOpen?: boolean;
  items: WorkspaceLink[];
};

export type WorkspaceNavItem = WorkspaceLink | WorkspaceSection;

const props = defineProps<{
  items: WorkspaceNavItem[];
  activeId: string;
  heading?: string;
  backTo?: string;
  backLabel?: string;
  badgeText?: string;
}>();

const sectionOpenState = ref<Record<string, boolean>>({});
const WORKSPACE_NAV_STATE_KEY = "workspace-shell:nav-state";
const selectedNavId = ref("");

function isNavSelected(id: string) {
  return (selectedNavId.value || props.activeId) === id;
}

function onNavClick(id: string) {
  selectedNavId.value = id;
}

function isSectionOpen(item: WorkspaceSection) {
  const explicit = sectionOpenState.value[item.id];
  if (typeof explicit === "boolean") {
    return explicit;
  }

  if (item.defaultOpen) {
    return true;
  }

  return item.items.some(child => child.id === props.activeId);
}

function isSectionActive(item: WorkspaceSection) {
  return item.items.some(child => child.id === props.activeId);
}

function onSectionToggle(sectionId: string) {
  sectionOpenState.value[sectionId] = !sectionOpenState.value[sectionId];
}

watch(
  () => props.items,
  (items) => {
    for (const item of items) {
      if (item.kind !== "section") {
        continue;
      }

      if (typeof sectionOpenState.value[item.id] === "boolean") {
        continue;
      }

      sectionOpenState.value[item.id] = !!item.defaultOpen || item.items.some(child => child.id === props.activeId);
    }
  },
  { immediate: true },
);

watch(
  () => props.activeId,
  (id) => {
    selectedNavId.value = id;
  },
  { immediate: true },
);

onMounted(() => {
  const raw = sessionStorage.getItem(WORKSPACE_NAV_STATE_KEY);
  if (!raw) {
    return;
  }

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const normalized: Record<string, boolean> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === "boolean") {
        normalized[key] = value;
      }
    }
    sectionOpenState.value = {
      ...sectionOpenState.value,
      ...normalized,
    };
  }
  catch {
    sessionStorage.removeItem(WORKSPACE_NAV_STATE_KEY);
  }
});

watch(
  sectionOpenState,
  (state) => {
    sessionStorage.setItem(WORKSPACE_NAV_STATE_KEY, JSON.stringify(state));
  },
  { deep: true },
);
</script>

<template>
  <div class="w-full p-4 md:p-6">
    <div class="mb-4 flex items-center justify-between gap-2">
      <div class="flex items-center gap-2">
        <NuxtLink
          to="/"
          class="btn btn-ghost btn-sm"
        >
          <img
            src="/logo-symbol.png"
            srcset="/logo-symbol-32.png 32w, /logo-symbol-64.png 64w, /logo-symbol-128.png 128w"
            sizes="(max-width: 640px) 24px, 40px"
            alt="Logo"
            class="w-6 sm:w-6 md:w-10 prefers-dark-logo dark:invert dark:brightness-125"
          >
        </NuxtLink>
        <NuxtLink
          :to="backTo || '/dashboard'"
          class="btn btn-ghost btn-sm"
        >
          {{ backLabel || '← Back' }}
        </NuxtLink>
      </div>

      <h1
        v-if="heading"
        class="text-xl font-bold flex-1 text-center"
      >
        {{ heading }}
      </h1>
      <p
        v-if="badgeText"
        class="text-xs opacity-70"
      >
        {{ badgeText }}
      </p>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)] gap-4">
      <aside class="rounded-box border border-base-300/60 bg-base-200 p-2 h-fit">
        <ul class="menu w-full gap-1">
          <template
            v-for="item in items"
            :key="item.id"
          >
            <li v-if="item.kind !== 'section'">
              <NuxtLink
                :to="item.to"
                :class="[
                  isNavSelected(item.id) ? 'active' : '',
                  item.indented ? 'pl-6 text-sm' : '',
                ]"
                @click="onNavClick(item.id)"
              >
                <Icon
                  v-if="item.icon"
                  :name="item.icon"
                  size="14"
                  class="opacity-80"
                />
                <span>{{ item.label }}</span>
              </NuxtLink>
            </li>
            <li v-else>
              <button
                type="button"
                class="w-full text-left px-3 py-2 rounded-btn cursor-pointer flex items-center justify-between gap-2"
                :class="isSectionActive(item) ? 'bg-base-300/60' : ''"
                :aria-expanded="isSectionOpen(item) ? 'true' : 'false'"
                @click="onSectionToggle(item.id)"
              >
                <span class="inline-flex items-center gap-1.5">
                  <Icon
                    v-if="item.icon"
                    :name="item.icon"
                    size="14"
                    class="opacity-80"
                  />
                  <span>{{ item.label }}</span>
                </span>
                <span
                  class="text-xs opacity-70"
                  aria-hidden="true"
                >
                  {{ isSectionOpen(item) ? '▾' : '▸' }}
                </span>
              </button>

              <div v-if="isSectionOpen(item)">
                <ul class="mt-1 pl-2">
                  <li
                    v-for="child in item.items"
                    :key="child.id"
                  >
                    <NuxtLink
                      :to="child.to"
                      class="text-sm"
                      :class="[
                        isNavSelected(child.id) ? 'active' : '',
                        child.indented ? 'pl-6' : 'pl-4',
                      ]"
                      @click="onNavClick(child.id)"
                    >
                      <Icon
                        v-if="child.icon"
                        :name="child.icon"
                        size="13"
                        class="opacity-80"
                      />
                      <span>{{ child.label }}</span>
                    </NuxtLink>
                  </li>
                </ul>
              </div>
            </li>
          </template>
        </ul>
      </aside>

      <section class="rounded-box border border-base-300/60 bg-base-200 p-4">
        <slot />
      </section>
    </div>
  </div>
</template>

<style scoped>
/* Fallback for OS-level dark mode (for browsers without Tailwind `dark:` enabled) */
@media (prefers-color-scheme: dark) {
  .prefers-dark-logo {
    filter: invert(1) brightness(1.15);
  }
}
</style>
