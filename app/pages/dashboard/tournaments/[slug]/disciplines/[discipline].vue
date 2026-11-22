<script setup lang="ts">
import type { DisciplineSettingsResponse } from "~/types/tournaments";

import { disciplineSettingsPatchSchema } from "#shared/schemas/discipline-settings";

definePageMeta({ ssr: false, layout: "tournament-admin" });

const route = useRoute();
const slug = computed(() => String(route.params.slug || ""));
const discipline = computed(() => String(route.params.discipline || "").toLowerCase());
const isGolf = computed(() => discipline.value === "golf");

const disciplineLabelMap: Record<string, string> = {
  golf: "Disc golf",
  accuracy: "Accuracy",
  distance: "Distance",
  scf: "SCF",
  discathon: "Discathon",
  ddc: "DDC",
  freestyle: "Freestyle",
};

const disciplineLabel = computed(() => disciplineLabelMap[discipline.value] || discipline.value.toUpperCase());

const activeSettingsTab = ref("rounds");
const settingsTabs = computed(() => {
  const base = [
    { id: "rounds", label: "Rounds & Progression" },
  ];
  if (isGolf.value) {
    base.push(
      { id: "pools", label: "Pools & Starting Format" },
      { id: "courses", label: "Course, Layout & Par per Round" },
    );
  }
  return base;
});

const { data, pending, error, refresh } = await useFetch<DisciplineSettingsResponse>(() => `/api/tournaments/${slug.value}/discipline-settings/${discipline.value}`);

onMounted(() => {
  void refresh();
});

if (error.value) {
  throw createError({
    statusCode: error.value.statusCode || 404,
    message: error.value.message || "Discipline settings not found",
  });
}

type RoundLayoutDraft = {
  venueId: string;
  venueName: string;
  layoutId: string;
  layoutName: string;
};

const form = reactive({
  rounds: "",
  progressionMode: "straight" as "straight" | "cut",
  cumulativeRounds: "",
  poolMode: "static" as "static" | "dynamic",
  poolCount: 1,
  golfStartEnabled: false,
  roundPars: [] as string[],
  roundLayouts: [] as RoundLayoutDraft[],
});

function createEmptyRoundLayout(): RoundLayoutDraft {
  return {
    venueId: "",
    venueName: "",
    layoutId: "",
    layoutName: "",
  };
}

const golfVenues = computed(() => {
  if (!data.value || Array.isArray(data.value) || !Array.isArray(data.value.golfVenues)) {
    return [];
  }
  return data.value.golfVenues;
});

const golfVenueOptions = computed(() =>
  golfVenues.value.map(v => ({
    value: String(v.id),
    label: v.name,
    sublabel: v.courseLayouts.length > 0
      ? `${v.courseLayouts.length} layout${v.courseLayouts.length === 1 ? "" : "s"}`
      : "No layouts yet",
  })),
);

function getLayoutOptionsForRound(roundIndex: number) {
  const venueIdStr = form.roundLayouts[roundIndex]?.venueId;
  if (!venueIdStr) {
    return [];
  }
  const venueItem = golfVenues.value.find(v => String(v.id) === venueIdStr);
  if (!venueItem) {
    return [];
  }
  return venueItem.courseLayouts.map(l => ({
    value: l.id,
    label: l.name,
    sublabel: l.holeCount ? `Par ${l.par} · ${l.holeCount} holes` : `Par ${l.par}`,
  }));
}

function onRoundVenueChange(roundIndex: number, venueIdStr: string) {
  syncRoundArraysLength(roundIndex + 1);
  const current = form.roundLayouts[roundIndex] ?? createEmptyRoundLayout();
  if (!venueIdStr) {
    form.roundLayouts[roundIndex] = createEmptyRoundLayout();
    return;
  }

  const venueItem = golfVenues.value.find(v => String(v.id) === venueIdStr);
  const prevVenueId = current.venueId;
  form.roundLayouts[roundIndex] = {
    venueId: venueIdStr,
    venueName: venueItem?.name ?? "",
    layoutId: prevVenueId === venueIdStr ? current.layoutId : "",
    layoutName: prevVenueId === venueIdStr ? current.layoutName : "",
  };
}

function onRoundLayoutChange(roundIndex: number, layoutIdStr: string) {
  syncRoundArraysLength(roundIndex + 1);
  const current = form.roundLayouts[roundIndex] ?? createEmptyRoundLayout();
  if (!layoutIdStr) {
    form.roundLayouts[roundIndex] = {
      ...current,
      layoutId: "",
      layoutName: "",
    };
    return;
  }

  const venueItem = golfVenues.value.find(v => String(v.id) === current.venueId);
  const layoutItem = venueItem?.courseLayouts.find(l => l.id === layoutIdStr);
  form.roundLayouts[roundIndex] = {
    ...current,
    layoutId: layoutIdStr,
    layoutName: layoutItem?.name ?? "",
  };

  if (layoutItem && typeof layoutItem.par === "number") {
    form.roundPars[roundIndex] = String(layoutItem.par);
  }
}

function toOptionalInt(value: string) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) {
    return null;
  }

  const parsed = Number(trimmed);
  if (!Number.isInteger(parsed)) {
    return null;
  }

  return parsed;
}

const parsedRoundsCount = computed(() => {
  const count = toOptionalInt(form.rounds);
  if (!count || count < 1) {
    return 0;
  }
  return Math.min(count, 50);
});

const poolPreviewLabels = computed(() => {
  const count = Math.max(1, Math.min(8, Number(form.poolCount) || 1));
  return Array.from({ length: count }, (_, idx) => `Pool ${String.fromCharCode(65 + idx)}`);
});

function syncRoundArraysLength(targetLength: number) {
  while (form.roundPars.length < targetLength) {
    form.roundPars.push("");
  }
  while (form.roundLayouts.length < targetLength) {
    form.roundLayouts.push(createEmptyRoundLayout());
  }
}

watch(parsedRoundsCount, (newCount) => {
  syncRoundArraysLength(newCount);
});

function applyFirstParToAllRounds() {
  const firstPar = form.roundPars[0]?.trim() || "";
  const firstLayout = form.roundLayouts[0];
  if (!firstPar && !firstLayout?.venueId) {
    return;
  }
  syncRoundArraysLength(parsedRoundsCount.value);
  for (let i = 1; i < parsedRoundsCount.value; i++) {
    if (firstPar) {
      form.roundPars[i] = firstPar;
    }
    if (firstLayout?.venueId) {
      form.roundLayouts[i] = { ...firstLayout };
    }
  }
}

function createSnapshot() {
  const activeParSlice = form.roundPars
    .slice(0, parsedRoundsCount.value)
    .map(item => String(item ?? "").trim());

  const activeLayoutSlice = form.roundLayouts
    .slice(0, parsedRoundsCount.value)
    .map(item => ({
      venueId: item?.venueId || "",
      layoutId: item?.layoutId || "",
    }));

  return JSON.stringify({
    rounds: String(form.rounds ?? "").trim(),
    progressionMode: form.progressionMode,
    cumulativeRounds: form.progressionMode === "cut" ? String(form.cumulativeRounds ?? "").trim() : "",
    poolMode: isGolf.value ? form.poolMode : undefined,
    poolCount: isGolf.value ? Number(form.poolCount) : undefined,
    golfStartEnabled: isGolf.value ? form.golfStartEnabled : undefined,
    roundPars: isGolf.value ? activeParSlice : undefined,
    roundLayouts: isGolf.value ? activeLayoutSlice : undefined,
  });
}

const {
  hasUnsavedChanges,
  captureInitialSnapshot,
} = useSnapshotDirtyState(createSnapshot);

const {
  showLeaveConfirmModal,
  modalTitle,
  modalMessage,
  modalConfirmText,
  modalCancelText,
  confirmLeavePage,
  cancelLeavePage,
} = useUnsavedChangesGuard(hasUnsavedChanges);

const progressionModeOptions = [
  { value: "straight", label: "Straight sum of all rounds", sublabel: "No cut — all rounds count directly" },
  { value: "cut", label: "Cut after preliminary rounds", sublabel: "Advance top players to Semifinal / Final" },
];

const poolCountOptions = Array.from({ length: 8 }, (_, idx) => {
  const count = idx + 1;
  const labels = Array.from({ length: count }, (_, i) => String.fromCharCode(65 + i)).join(", ");
  return {
    value: String(count),
    label: count === 1 ? "1 pool (All players)" : `${count} pools (${labels})`,
  };
});

const poolModeOptions = [
  { value: "static", label: "Static pools", sublabel: "Same pool throughout the tournament" },
  { value: "dynamic", label: "Dynamic sorting", sublabel: "Round 2+ resorted by standings" },
];

const saveError = ref<string | null>(null);
const saveSuccess = ref<string | null>(null);
const saving = ref(false);
let successTimer: ReturnType<typeof setTimeout> | null = null;

function dismissSuccess() {
  saveSuccess.value = null;
  if (successTimer) {
    clearTimeout(successTimer);
    successTimer = null;
  }
}

watch(saveSuccess, (message) => {
  if (successTimer) {
    clearTimeout(successTimer);
    successTimer = null;
  }
  if (message) {
    successTimer = setTimeout(() => {
      saveSuccess.value = null;
      successTimer = null;
    }, 4000);
  }
});

onBeforeUnmount(() => {
  if (successTimer) {
    clearTimeout(successTimer);
  }
});

watch(
  data,
  (value) => {
    if (!value || Array.isArray(value)) {
      return;
    }

    const roundsNum = typeof value.rounds === "number" ? value.rounds : null;
    const cumNum = typeof value.cumulativeRounds === "number" ? value.cumulativeRounds : null;

    form.rounds = roundsNum != null ? String(roundsNum) : "";
    if (cumNum != null && (roundsNum == null || cumNum < roundsNum)) {
      form.progressionMode = "cut";
      form.cumulativeRounds = String(cumNum);
    }
    else {
      form.progressionMode = "straight";
      form.cumulativeRounds = cumNum != null ? String(cumNum) : "";
    }

    form.poolMode = value.poolMode === "dynamic" ? "dynamic" : "static";
    form.poolCount = typeof value.poolCount === "number" && value.poolCount >= 1 ? value.poolCount : 1;
    form.golfStartEnabled = !!value.golfStartEnabled;

    const incomingPars = Array.isArray(value.roundPars) ? value.roundPars : [];
    const incomingLayouts = Array.isArray(value.roundLayouts) ? value.roundLayouts : [];
    const targetLen = Math.max(roundsNum ?? 0, incomingPars.length, incomingLayouts.length);
    form.roundPars = Array.from({ length: targetLen }, (_, idx) => {
      const par = incomingPars[idx];
      return typeof par === "number" ? String(par) : "";
    });
    form.roundLayouts = Array.from({ length: targetLen }, (_, idx) => {
      const item = incomingLayouts[idx];
      if (!item) {
        return createEmptyRoundLayout();
      }
      return {
        venueId: item.venueId != null ? String(item.venueId) : "",
        venueName: item.venueName ?? "",
        layoutId: item.layoutId ?? "",
        layoutName: item.layoutName ?? "",
      };
    });

    captureInitialSnapshot();
  },
  { immediate: true },
);

async function saveSettings() {
  saveError.value = null;
  saveSuccess.value = null;
  saving.value = true;

  const rounds = toOptionalInt(form.rounds);
  const cumulativeRounds = form.progressionMode === "cut"
    ? toOptionalInt(form.cumulativeRounds)
    : null;

  const payload: Record<string, unknown> = {
    rounds,
    cumulativeRounds,
  };

  if (isGolf.value) {
    payload.poolMode = form.poolMode;
    payload.poolCount = Number(form.poolCount) || 1;
    payload.golfStartEnabled = form.golfStartEnabled;
    payload.roundPars = Array.from({ length: parsedRoundsCount.value }, (_, idx) =>
      toOptionalInt(form.roundPars[idx] ?? ""));
    payload.roundLayouts = Array.from({ length: parsedRoundsCount.value }, (_, idx) => {
      const item = form.roundLayouts[idx];
      if (!item?.venueId) {
        return null;
      }
      const parsedVenueId = Number(item.venueId);
      if (!Number.isInteger(parsedVenueId) || parsedVenueId <= 0) {
        return null;
      }
      return {
        venueId: parsedVenueId,
        venueName: item.venueName || null,
        layoutId: item.layoutId || null,
        layoutName: item.layoutName || null,
      };
    });
  }

  const parsed = disciplineSettingsPatchSchema.safeParse(payload);
  if (!parsed.success) {
    saveError.value = parsed.error.issues[0]?.message || "Invalid settings";
    saving.value = false;
    return;
  }

  try {
    await $fetch(`/api/tournaments/${slug.value}/discipline-settings/${discipline.value}`, {
      method: "PATCH",
      body: parsed.data,
    });

    saveSuccess.value = `${disciplineLabel.value} settings saved.`;
    await refresh();
    captureInitialSnapshot();
  }
  catch (err: any) {
    saveError.value = err?.data?.message || err?.message || "Failed to save discipline settings";
  }
  finally {
    saving.value = false;
  }
}
</script>

<template>
  <div>
    <FormHeader
      :title="`${disciplineLabel} settings`"
      title-tag="h1"
      title-class="text-2xl font-bold"
      wrapper-class="mb-3"
    />

    <PageLoadingState v-if="pending" />

    <div v-else class="space-y-4">
      <div class="flex flex-wrap items-center justify-end gap-2">
        <button
          class="btn btn-sm btn-primary"
          type="button"
          :disabled="saving || !hasUnsavedChanges"
          @click="saveSettings"
        >
          <span
            v-if="saving"
            class="loading loading-spinner loading-xs"
          />
          <span v-else>Save settings</span>
        </button>
      </div>

      <div
        v-if="saveError"
        role="alert"
        class="alert alert-error py-2 flex items-center justify-between"
      >
        <span class="text-sm">{{ saveError }}</span>
        <button
          type="button"
          class="btn btn-ghost btn-xs btn-circle"
          aria-label="Close error message"
          @click="saveError = null"
        >
          <Icon
            name="tabler:x"
            size="14"
          />
        </button>
      </div>
      <div
        v-if="saveSuccess"
        role="status"
        class="alert alert-success py-2 flex items-center justify-between"
      >
        <span class="text-sm">{{ saveSuccess }}</span>
        <button
          type="button"
          class="btn btn-ghost btn-xs btn-circle"
          aria-label="Close success message"
          @click="dismissSuccess"
        >
          <Icon
            name="tabler:x"
            size="14"
          />
        </button>
      </div>

      <div
        v-if="data && !Array.isArray(data) && !data.isEnabled"
        class="alert alert-warning"
      >
        <span>This discipline is currently disabled for this tournament.</span>
      </div>

      <VerticalTabsLayout
        v-model="activeSettingsTab"
        :tabs="settingsTabs"
        :initial-open-tab-ids="['rounds', 'pools', 'courses']"
        :session-state-key="`discipline-settings:${slug}:${discipline}`"
      >
        <template #rounds>
          <div class="space-y-3">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
              <FormField
                label="Total rounds"
                hint="Total number of rounds played in this discipline."
              >
                <input
                  v-model="form.rounds"
                  class="input input-bordered w-full"
                  type="number"
                  min="1"
                  max="50"
                  step="1"
                  placeholder="e.g. 2"
                >
              </FormField>

              <FormField
                label="Round progression"
                hint="Sum all rounds directly or apply a cut before finals."
              >
                <SearchableSelect
                  :model-value="form.progressionMode"
                  :options="progressionModeOptions"
                  placeholder="Select progression..."
                  @update:model-value="form.progressionMode = ($event === 'cut' ? 'cut' : 'straight')"
                />
              </FormField>
            </div>

            <div
              v-if="form.progressionMode === 'cut'"
              class="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1"
            >
              <FormField
                label="Preliminary rounds before cut"
                hint="Number of cumulative rounds summed to determine who makes the cut."
              >
                <input
                  v-model="form.cumulativeRounds"
                  class="input input-bordered w-full"
                  type="number"
                  min="1"
                  :max="parsedRoundsCount || 50"
                  step="1"
                  placeholder="e.g. 2"
                >
              </FormField>
            </div>
          </div>
        </template>

        <template
          v-if="isGolf"
          #pools
        >
          <div class="space-y-3">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
              <FormField
                label="Number of pools"
                hint="Split the field into pools (e.g. Pool A, Pool B) or keep everyone in 1 pool."
              >
                <SearchableSelect
                  :model-value="String(form.poolCount)"
                  :options="poolCountOptions"
                  placeholder="Select number of pools..."
                  @update:model-value="form.poolCount = Math.max(1, Math.min(8, Number($event) || 1))"
                />
              </FormField>

              <FormField
                label="Pool assignment across rounds"
                hint="Keep pools fixed for all rounds or resort by standings after each round."
              >
                <SearchableSelect
                  :model-value="form.poolMode"
                  :options="poolModeOptions"
                  placeholder="Select pool assignment..."
                  @update:model-value="form.poolMode = ($event === 'dynamic' ? 'dynamic' : 'static')"
                />
              </FormField>
            </div>

            <div class="flex flex-wrap items-center gap-1.5 text-xs opacity-80">
              <span>Active pools:</span>
              <span
                v-for="poolLabel in poolPreviewLabels"
                :key="poolLabel"
                class="badge badge-sm badge-outline"
              >
                {{ poolLabel }}
              </span>
            </div>

            <div class="divider my-1" />

            <label class="flex items-start gap-3 cursor-pointer py-1">
              <input
                v-model="form.golfStartEnabled"
                type="checkbox"
                class="toggle toggle-primary toggle-sm mt-0.5 shrink-0"
              >
              <div class="space-y-0.5 min-w-0 flex-1">
                <div class="font-medium text-sm">
                  Golf start (Tee-time / start order in ATM)
                </div>
                <div class="text-xs opacity-70 whitespace-normal break-words">
                  Leave off when an external scoring app (Tjing / UDisc) handles shotgun starting holes. Enable if ATM starting lists should define tee-off order.
                </div>
              </div>
            </label>
          </div>
        </template>

        <template
          v-if="isGolf"
          #courses
        >
          <div class="space-y-3">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <p class="text-xs opacity-70">
                Optionally select a golf venue and layout to prefill par — each round's par is saved independently so future course changes never alter past tournaments.
              </p>
              <button
                v-if="parsedRoundsCount > 1 && (form.roundPars[0]?.trim() || form.roundLayouts[0]?.venueId)"
                type="button"
                class="btn btn-ghost btn-xs"
                @click="applyFirstParToAllRounds"
              >
                Copy R1 to all rounds
              </button>
            </div>

            <div
              v-if="parsedRoundsCount === 0"
              class="text-sm opacity-70"
            >
              Enter Total rounds above to configure Course, Layout & Par for each round.
            </div>

            <div
              v-else
              class="space-y-3"
            >
              <div
                v-for="roundIdx in parsedRoundsCount"
                :key="roundIdx"
                class="rounded-box bg-base-200/60 border border-base-300/60 p-3 space-y-2"
              >
                <div class="text-xs font-semibold uppercase tracking-wide opacity-75">
                  Round {{ roundIdx }}
                </div>
                <div
                  class="grid grid-cols-1 gap-3"
                  :class="golfVenues.length > 0 ? 'sm:grid-cols-[1fr_1fr_6rem]' : 'sm:grid-cols-2'"
                >
                  <FormField
                    v-if="golfVenues.length > 0"
                    label="Venue"
                  >
                    <SearchableSelect
                      :model-value="form.roundLayouts[roundIdx - 1]?.venueId || ''"
                      :options="golfVenueOptions"
                      size="sm"
                      placeholder="Select golf venue..."
                      empty-text="No golf venues"
                      @update:model-value="onRoundVenueChange(roundIdx - 1, $event)"
                    />
                  </FormField>

                  <FormField
                    v-if="golfVenues.length > 0"
                    label="Course layout"
                  >
                    <SearchableSelect
                      :model-value="form.roundLayouts[roundIdx - 1]?.layoutId || ''"
                      :options="getLayoutOptionsForRound(roundIdx - 1)"
                      size="sm"
                      :disabled="!form.roundLayouts[roundIdx - 1]?.venueId"
                      :placeholder="form.roundLayouts[roundIdx - 1]?.venueId ? 'Select layout (prefills par)...' : 'Pick venue first'"
                      empty-text="No layouts on this venue"
                      @update:model-value="onRoundLayoutChange(roundIdx - 1, $event)"
                    />
                  </FormField>

                  <FormField label="Par">
                    <input
                      v-model="form.roundPars[roundIdx - 1]"
                      class="input input-bordered input-sm w-full"
                      type="number"
                      min="18"
                      max="150"
                      step="1"
                      placeholder="e.g. 54"
                    >
                  </FormField>
                </div>
              </div>
            </div>
          </div>
        </template>
      </VerticalTabsLayout>

      <div class="flex justify-end pt-2">
        <button
          class="btn btn-sm btn-primary"
          type="button"
          :disabled="saving || !hasUnsavedChanges"
          @click="saveSettings"
        >
          <span
            v-if="saving"
            class="loading loading-spinner loading-xs"
          />
          <span v-else>Save settings</span>
        </button>
      </div>

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
    </div>
  </div>
</template>
