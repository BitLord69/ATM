<script setup lang="ts">
const { data: activeTournaments, pending: activePending } = await useFetch("/api/tournaments/public", {
  query: { filter: "active" },
});

const { data: upcomingTournaments, pending: upcomingPending } = await useFetch("/api/tournaments/public", {
  query: { filter: "upcoming" },
});

const isLoading = computed(() => activePending.value || upcomingPending.value);

const featuredTournaments = computed(() =>
  upcomingTournaments.value?.slice(0, 3) || [],
);
</script>

<template>
  <div class="hero bg-base-300 container mx-auto my-6">
    <div class="hero-content text-center min-h-100">
      <!-- Loading State -->
      <div
        v-if="isLoading"
        class="flex flex-col items-center justify-center py-20"
      >
        <span class="loading loading-spinner loading-lg mb-4" />
        <p class="text-lg opacity-70">
          Loading tournaments...
        </p>
      </div>

      <!-- Main Content -->
      <div
        v-else
        class="max-w-4xl"
      >
        <h1 class="text-5xl font-bold my-4">
          Allround Tournament Manager
        </h1>
        <p class="text-xl mb-6 opacity-80">
          Your complete platform for managing allround frisbee tournaments worldwide
        </p>

        <!-- Hero Carousel -->
        <div class="carousel w-full h-64 mb-6 rounded-lg overflow-hidden">
          <div id="slide1" class="carousel-item relative w-full">
            <img
              src="https://img.daisyui.com/images/stock/photo-1625726411847-8cbb60cc71e6.webp"
              class="w-full object-cover"
            >
            <div class="absolute left-5 right-5 top-1/2 flex -translate-y-1/2 transform justify-between">
              <a href="#slide4" class="btn btn-circle">❮</a>
              <a href="#slide2" class="btn btn-circle">❯</a>
            </div>
          </div>
          <div id="slide2" class="carousel-item relative w-full">
            <img
              src="https://img.daisyui.com/images/stock/photo-1609621838510-5ad474b7d25d.webp"
              class="w-full object-cover"
            >
            <div class="absolute left-5 right-5 top-1/2 flex -translate-y-1/2 transform justify-between">
              <a href="#slide1" class="btn btn-circle">❮</a>
              <a href="#slide3" class="btn btn-circle">❯</a>
            </div>
          </div>
          <div id="slide3" class="carousel-item relative w-full">
            <img
              src="https://img.daisyui.com/images/stock/photo-1414694762283-acccc27bca85.webp"
              class="w-full object-cover"
            >
            <div class="absolute left-5 right-5 top-1/2 flex -translate-y-1/2 transform justify-between">
              <a href="#slide2" class="btn btn-circle">❮</a>
              <a href="#slide4" class="btn btn-circle">❯</a>
            </div>
          </div>
          <div id="slide4" class="carousel-item relative w-full">
            <img
              src="https://img.daisyui.com/images/stock/photo-1665553365602-b2fb8e5d1707.webp"
              class="w-full object-cover"
            >
            <div class="absolute left-5 right-5 top-1/2 flex -translate-y-1/2 transform justify-between">
              <a href="#slide3" class="btn btn-circle">❮</a>
              <a href="#slide1" class="btn btn-circle">❯</a>
            </div>
          </div>
        </div>

        <!-- Active Tournaments Alert -->
        <div
          v-if="activeTournaments && activeTournaments.length > 0"
          class="alert alert-success mb-6"
        >
          <Icon
            name="tabler:live-photo"
            size="24"
          />
          <span class="font-semibold">
            {{ activeTournaments.length }} tournament{{ activeTournaments.length !== 1 ? 's' : '' }} happening right now!
          </span>
          <NuxtLink
            to="/tournaments?filter=active"
            class="btn btn-sm btn-ghost"
          >
            View Live
          </NuxtLink>
        </div>

        <div class="flex flex-col sm:flex-row gap-4 justify-center mb-8">
          <NuxtLink
            to="/tournaments"
            class="btn btn-primary btn-lg gap-2"
          >
            <Icon
              name="tabler:trophy"
              size="24"
            />
            Browse Tournaments
          </NuxtLink>
          <NuxtLink
            to="/signin"
            class="btn btn-accent btn-lg gap-2"
          >
            <Icon
              name="tabler:login"
              size="24"
            />
            Sign In
          </NuxtLink>
        </div>

        <!-- Featured Tournaments -->
        <div
          v-if="featuredTournaments.length > 0"
          class="mt-12"
        >
          <h2 class="text-2xl font-bold mb-6">
            Upcoming Tournaments
          </h2>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <NuxtLink
              v-for="tournament in featuredTournaments"
              :key="tournament.id"
              :to="`/tournaments/${tournament.slug}`"
              class="card bg-base-100 shadow-xl hover:shadow-2xl transition-all hover:scale-105"
            >
              <div class="card-body p-4">
                <h3 class="card-title text-base">
                  {{ tournament.name }}
                </h3>
                <div class="text-xs opacity-70">
                  <div class="flex items-center gap-1 mb-1">
                    <Icon
                      name="tabler:calendar"
                      size="14"
                    />
                    <span>{{ new Date(tournament.startDate).toLocaleDateString() }}</span>
                  </div>
                  <div
                    v-if="tournament.city || tournament.country"
                    class="flex items-center gap-1"
                  >
                    <Icon
                      name="tabler:map-pin"
                      size="14"
                    />
                    <span>{{ [tournament.city, tournament.country].filter(Boolean).join(", ") }}</span>
                  </div>
                </div>
              </div>
            </NuxtLink>
          </div>
        </div>

        <!-- Features Section -->
        <div class="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
          <div class="card bg-base-100">
            <div class="card-body">
              <Icon
                name="tabler:tournament"
                size="32"
                class="text-primary mb-2"
              />
              <h3 class="card-title text-lg">
                Multi-Event Support
              </h3>
              <p class="text-sm opacity-70">
                Manage Golf, Accuracy, Distance, SCF, Discathon, DDC, and Freestyle events all in one place
              </p>
            </div>
          </div>
          <div class="card bg-base-100">
            <div class="card-body">
              <Icon
                name="tabler:users"
                size="32"
                class="text-primary mb-2"
              />
              <h3 class="card-title text-lg">
                Team Collaboration
              </h3>
              <p class="text-sm opacity-70">
                Invite tournament directors, scorers, and staff with role-based permissions
              </p>
            </div>
          </div>
          <div class="card bg-base-100">
            <div class="card-body">
              <Icon
                name="tabler:chart-line"
                size="32"
                class="text-primary mb-2"
              />
              <h3 class="card-title text-lg">
                Real-Time Scoring
              </h3>
              <p class="text-sm opacity-70">
                Live score updates, leaderboards, and comprehensive reporting for participants and spectators
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
