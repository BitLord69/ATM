<script setup lang="ts">
import type { DisciplineType } from "~/composables/use-discipline-catalog";

/**
 * Public information page for all disc sport disciplines
 * Serves as a hub for learning about different event types
 */
import { disciplineCatalog } from "~/composables/use-discipline-catalog";

const disciplineDescriptions: Record<DisciplineType, string> = {
  golf: "Throw discs at targets in the fewest throws possible, similar to traditional golf.",
  accuracy: "Precision throwing at various distances and target types.",
  distance: "Throw the disc as far as possible in different categories.",
  scf: "Throw and catch your own disc for maximum distance.",
  discathon: "Complete a course in the fewest throws with specific disc requirements.",
  ddc: "Team-based game with two discs in play simultaneously.",
  freestyle: "Artistic performance and tricks with flying discs.",
};

const disciplineNames: Record<DisciplineType, string> = {
  golf: "Disc golf",
  accuracy: "Accuracy",
  distance: "Distance",
  scf: "Self-Caught Flight (SCF)",
  discathon: "Discathon",
  ddc: "Double Disc Court (DDC)",
  freestyle: "Freestyle",
};

const disciplines = disciplineCatalog.map(discipline => ({
  name: disciplineNames[discipline.type],
  slug: discipline.publicSlug,
  icon: discipline.icon,
  description: disciplineDescriptions[discipline.type],
}));
</script>

<template>
  <div class="container mx-auto p-4 max-w-7xl">
    <div class="mb-8">
      <h1 class="text-4xl font-bold mb-2">
        Disc Sport Disciplines
      </h1>
      <p class="text-lg opacity-70">
        Learn about the different events in allround frisbee tournaments
      </p>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <NuxtLink
        v-for="discipline in disciplines"
        :key="discipline.slug"
        :to="`/disciplines/${discipline.slug}`"
        class="card bg-base-100 border border-base-300 shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200"
      >
        <div class="card-body">
          <div class="flex items-start gap-4">
            <Icon
              :name="discipline.icon"
              size="32"
              class="text-primary shrink-0"
            />
            <div>
              <h2 class="card-title text-lg mb-2">
                {{ discipline.name }}
              </h2>
              <p class="text-sm opacity-70">
                {{ discipline.description }}
              </p>
            </div>
          </div>
        </div>
      </NuxtLink>
    </div>

    <div class="mt-12 text-center">
      <NuxtLink
        to="/tournaments"
        class="btn btn-primary btn-lg gap-2"
      >
        <Icon
          name="tabler:tournament"
          size="24"
        />
        Browse Tournaments
      </NuxtLink>
    </div>
  </div>
</template>
