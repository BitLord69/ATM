<script setup lang="ts">
import type { DisciplineSettingsResponse } from "~/types/tournaments";

import { disciplineSettingsPatchSchema } from "#shared/schemas/discipline-settings";

definePageMeta({ ssr: false, layout: "tournament-admin" });

const route = useRoute();
const slug = computed(() => String(route.params.slug || ""));
const discipline = computed(() => String(route.params.discipline || "").toLowerCase());

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
  cumulativeRounds: "",
});

const saveError = ref<string | null>(null);
const saveSuccess = ref<string | null>(null);
const saving = ref(false);

watch(
  data,
  (value) => {
    if (!value || Array.isArray(value)) {
      return;
    }

    form.rounds = typeof value.rounds === "number" ? String(value.rounds) : "";
    form.cumulativeRounds = typeof value.cumulativeRounds === "number" ? String(value.cumulativeRounds) : "";
  },
  { immediate: true },
);

function toOptionalInt(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const parsed = Number(trimmed);
  if (!Number.isInteger(parsed)) {
    return null;
  }

  return parsed;
}

async function saveSettings() {
  saveError.value = null;
  saveSuccess.value = null;
  saving.value = true;

  const payload = {
    rounds: toOptionalInt(form.rounds),
    cumulativeRounds: toOptionalInt(form.cumulativeRounds),
  };

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

    <div v-else class="space-y-3 max-w-xl">
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

      <div class="card bg-base-100 border border-base-300">
        <div class="card-body p-4">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <FormField label="Rounds">
              <input
                v-model="form.rounds"
                class="input input-bordered w-full"
                type="number"
                min="1"
                step="1"
              >
            </FormField>

            <FormField label="Cumulative rounds">
              <input
                v-model="form.cumulativeRounds"
                class="input input-bordered w-full"
                type="number"
                min="1"
                step="1"
              >
            </FormField>
          </div>

          <div class="card-actions justify-end mt-2">
            <button
              class="btn btn-primary"
              type="button"
              :disabled="saving"
              @click="saveSettings"
            >
              <span
                v-if="saving"
                class="loading loading-spinner loading-xs"
              />
              <span v-else>Save settings</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
