<template>
  <div class="container mx-auto p-4 max-w-4xl">
    <div class="mb-4">
      <NuxtLink to="/tournaments" class="btn btn-ghost btn-sm gap-2">
        <Icon name="tabler:arrow-left" size="18" />
        Back to Tournaments
      </NuxtLink>
    </div>

    <h1 class="text-4xl font-bold mb-6">
      Discathon
    </h1>

    <div class="prose max-w-none">
      <p class="text-lg mb-4">
        Discathon is a distance race event where players complete a course using specific disc requirements.
      </p>

      <h2>Overview</h2>
      <p>
        Players race through a marked course, alternating throws between two different discs, completing the course in the fewest throws possible.
      </p>

      <div class="alert alert-info mt-6">
        <Icon name="tabler:info-circle" size="24" />
        <div>
          <p class="font-semibold">
            Want to compete in Discathon events?
          </p>
          <p class="text-sm">
            Check our tournament listings to find upcoming events featuring Discathon.
          </p>
        </div>
        <NuxtLink to="/tournaments" class="btn btn-primary btn-sm">
          View Tournaments
        </NuxtLink>
      </div>
    </div>
  </div>
</template>
