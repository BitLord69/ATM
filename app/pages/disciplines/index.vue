<script setup lang="ts">
/**
 * Public information page for all disc sport disciplines
 * Serves as a hub for learning about different event types
 */

const disciplines = [
  {
    name: "Disc Golf",
    slug: "golf",
    icon: "tabler:golf",
    description: "Throw discs at targets in the fewest throws possible, similar to traditional golf.",
  },
  {
    name: "Accuracy",
    slug: "accuracy",
    icon: "tabler:target",
    description: "Precision throwing at various distances and target types.",
  },
  {
    name: "Distance",
    slug: "distance",
    icon: "tabler:line",
    description: "Throw the disc as far as possible in different categories.",
  },
  {
    name: "Self-Caught Flight (SCF)",
    slug: "self-caught-flight",
    icon: "tabler:run",
    description: "Throw and catch your own disc for maximum distance.",
  },
  {
    name: "Discathon",
    slug: "discathon",
    icon: "tabler:route",
    description: "Complete a course in the fewest throws with specific disc requirements.",
  },
  {
    name: "Double Disc Court (DDC)",
    slug: "double-disc-court",
    icon: "tabler:users",
    description: "Team-based game with two discs in play simultaneously.",
  },
  {
    name: "Freestyle",
    slug: "freestyle",
    icon: "tabler:stars",
    description: "Artistic performance and tricks with flying discs.",
  },
];
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
