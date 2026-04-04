<script setup lang="ts">
definePageMeta({ ssr: false, layout: "tournament-admin" });

const route = useRoute();
const slug = computed(() => route.params.slug as string);

const { data, error } = await useFetch(() => `/api/tournaments/${slug.value}/edit`);

if (error.value) {
  throw createError({
    statusCode: error.value.statusCode || 404,
    message: error.value.message || "Tournament not found",
  });
}

const tournamentName = computed(() => {
  if (!data.value || Array.isArray(data.value)) {
    return "Tournament";
  }
  return data.value.name || "Tournament";
});
</script>

<template>
  <div>
    <FormHeader
      :title="tournamentName"
      title-tag="h1"
      title-class="text-2xl font-bold"
      wrapper-class="mb-3"
    />

    <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
      <NuxtLink :to="`/dashboard/tournaments/${slug}/edit`" class="card bg-base-100 border border-base-300 hover:border-primary transition-colors">
        <div class="card-body p-4">
          <h2 class="card-title text-lg">
            Details
          </h2>
          <p class="text-sm opacity-70">
            General information, contacts, and discipline toggles.
          </p>
        </div>
      </NuxtLink>
      <NuxtLink :to="`/dashboard/tournaments/${slug}/venues`" class="card bg-base-100 border border-base-300 hover:border-primary transition-colors">
        <div class="card-body p-4">
          <h2 class="card-title text-lg">
            Venues
          </h2>
          <p class="text-sm opacity-70">
            Manage tournament venues and discipline coverage.
          </p>
        </div>
      </NuxtLink>
      <NuxtLink :to="`/dashboard/tournaments/${slug}/schedule`" class="card bg-base-100 border border-base-300 hover:border-primary transition-colors">
        <div class="card-body p-4">
          <h2 class="card-title text-lg">
            Schedule
          </h2>
          <p class="text-sm opacity-70">
            Build overall schedule across disciplines and rounds.
          </p>
        </div>
      </NuxtLink>
      <NuxtLink :to="`/dashboard/tournaments/${slug}/starting-lists`" class="card bg-base-100 border border-base-300 hover:border-primary transition-colors">
        <div class="card-body p-4">
          <h2 class="card-title text-lg">
            Starting Lists
          </h2>
          <p class="text-sm opacity-70">
            Generate, lock, and reorder lists by discipline and round.
          </p>
        </div>
      </NuxtLink>
      <NuxtLink :to="`/dashboard/tournaments/${slug}/players`" class="card bg-base-100 border border-base-300 hover:border-primary transition-colors md:col-span-2">
        <div class="card-body p-4">
          <h2 class="card-title text-lg">
            Players
          </h2>
          <p class="text-sm opacity-70">
            Manage registrations and player-related tournament operations.
          </p>
        </div>
      </NuxtLink>
    </div>
  </div>
</template>
