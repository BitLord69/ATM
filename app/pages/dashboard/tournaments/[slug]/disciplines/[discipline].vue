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

const { data, pending, error, refresh } = await useFetch<DisciplineSettingsResponse>(() => `/api/tournaments/${slug.value}/discipline-settings/${discipline.value}`);

if (error.value) {
  throw createError({
    statusCode: error.value.statusCode || 404,
    message: error.value.message || "Discipline settings not found",
  });
}

const form = reactive({
  rounds: "",
  progressionMode: "straight" as "straight" | "cut",
  cumulativeRounds: "",
  poolMode: "static" as "static" | "dynamic",
  poolCount: 1,
  golfStartEnabled: false,
  roundPars: [] as string[],
});

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

function syncRoundParsLength(targetLength: number) {
  while (form.roundPars.length < targetLength) {
    form.roundPars.push("");
  }
}

watch(parsedRoundsCount, (newCount) => {
  syncRoundParsLength(newCount);
});

function applyFirstParToAllRounds() {
  const firstPar = form.roundPars[0]?.trim() || "";
  if (!firstPar) {
    return;
  }
  for (let i = 1; i < parsedRoundsCount.value; i++) {
    form.roundPars[i] = firstPar;
  }
}

function createSnapshot() {
  const activeParSlice = form.roundPars
    .slice(0, parsedRoundsCount.value)
    .map(item => String(item ?? "").trim());

  return JSON.stringify({
    rounds: String(form.rounds ?? "").trim(),
    progressionMode: form.progressionMode,
    cumulativeRounds: form.progressionMode === "cut" ? String(form.cumulativeRounds ?? "").trim() : "",
    poolMode: isGolf.value ? form.poolMode : undefined,
    poolCount: isGolf.value ? Number(form.poolCount) : undefined,
    golfStartEnabled: isGolf.value ? form.golfStartEnabled : undefined,
    roundPars: isGolf.value ? activeParSlice : undefined,
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

const saveError = ref<string | null>(null);
const saveSuccess = ref<string | null>(null);
const saving = ref(false);

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
    const targetLen = Math.max(roundsNum ?? 0, incomingPars.length);
    form.roundPars = Array.from({ length: targetLen }, (_, idx) => {
      const par = incomingPars[idx];
      return typeof par === "number" ? String(par) : "";
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

    <div v-else class="space-y-4 max-w-2xl">
      <div
        v-if="saveError"
        class="alert alert-error"
      >
        <span>{{ saveError }}</span>
      </div>
      <div
        v-if="saveSuccess"
        class="alert alert-success"
      >
        <span>{{ saveSuccess }}</span>
      </div>

      <div
        v-if="data && !Array.isArray(data) && !data.isEnabled"
        class="alert alert-warning"
      >
        <span>This discipline is currently disabled for this tournament.</span>
      </div>

      <!-- Rounds & Cut Progression -->
      <div class="card bg-base-100 border border-base-300">
        <div class="card-body p-4 space-y-3">
          <h2 class="card-title text-base">
            Rounds & Progression
          </h2>

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
              <select
                v-model="form.progressionMode"
                class="select select-bordered w-full"
              >
                <option value="straight">
                  Straight sum of all rounds (no cut)
                </option>
                <option value="cut">
                  Cut after preliminary rounds (Semifinal / Final)
                </option>
              </select>
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
      </div>

      <!-- Disc Golf Specific Settings: Pools, Golf Start & Course Par -->
      <template v-if="isGolf">
        <div class="card bg-base-100 border border-base-300">
          <div class="card-body p-4 space-y-3">
            <h2 class="card-title text-base">
              Pools & Starting Format
            </h2>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
              <FormField
                label="Number of pools"
                hint="Split the field into pools (e.g. Pool A, Pool B) or keep everyone in 1 pool."
              >
                <select
                  v-model.number="form.poolCount"
                  class="select select-bordered w-full"
                >
                  <option
                    v-for="count in 8"
                    :key="count"
                    :value="count"
                  >
                    {{ count === 1 ? "1 pool (All players)" : `${count} pools (${Array.from({ length: count }, (_, i) => String.fromCharCode(65 + i)).join(", ")})` }}
                  </option>
                </select>
              </FormField>

              <FormField
                label="Pool assignment across rounds"
                hint="Keep pools fixed for all rounds or resort by standings after each round."
              >
                <select
                  v-model="form.poolMode"
                  class="select select-bordered w-full"
                >
                  <option value="static">
                    Static pools (same pool throughout tournament)
                  </option>
                  <option value="dynamic">
                    Dynamic sorting (Round 2+ sorted by standings)
                  </option>
                </select>
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

            <label class="label cursor-pointer justify-start gap-3 py-1">
              <input
                v-model="form.golfStartEnabled"
                type="checkbox"
                class="toggle toggle-primary toggle-sm"
              >
              <div class="space-y-0.5">
                <div class="font-medium text-sm">
                  Golf start (Tee-time / start order in ATM)
                </div>
                <div class="text-xs opacity-70">
                  Leave off when an external scoring app (Tjing / UDisc) handles shotgun starting holes. Enable if ATM starting lists should define tee-off order.
                </div>
              </div>
            </label>
          </div>
        </div>

        <div class="card bg-base-100 border border-base-300">
          <div class="card-body p-4 space-y-3">
            <div class="flex items-center justify-between gap-2">
              <div>
                <h2 class="card-title text-base">
                  Course Par per Round (Optional)
                </h2>
                <p class="text-xs opacity-70">
                  When Course Par is set, results display both total strokes (e.g. 54) and relative to par (e.g. -4).
                </p>
              </div>
              <button
                v-if="parsedRoundsCount > 1 && form.roundPars[0]?.trim()"
                type="button"
                class="btn btn-ghost btn-xs"
                @click="applyFirstParToAllRounds"
              >
                Copy R1 Par to all
              </button>
            </div>

            <div
              v-if="parsedRoundsCount === 0"
              class="text-sm opacity-70"
            >
              Enter Total rounds above to configure Course Par for each round.
            </div>

            <div
              v-else
              class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3"
            >
              <FormField
                v-for="roundIdx in parsedRoundsCount"
                :key="roundIdx"
                :label="`Round ${roundIdx} Par`"
              >
                <input
                  v-model="form.roundPars[roundIdx - 1]"
                  class="input input-bordered w-full"
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
      </template>

      <div class="flex justify-end">
        <button
          class="btn btn-primary"
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
