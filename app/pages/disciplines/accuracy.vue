<template>
  <div class="container mx-auto p-4 max-w-4xl">
    <div class="mb-4">
      <NuxtLink to="/tournaments" class="btn btn-ghost btn-sm gap-2">
        <Icon name="tabler:arrow-left" size="18" />
        Back to Tournaments
      </NuxtLink>
    </div>

    <h1 class="text-4xl font-bold mb-6">
      Accuracy
    </h1>

    <div class="prose max-w-none">
      <p class="text-lg mb-4">
        Accuracy is a precision throwing event where players aim at targets from various distances.
      </p>

      <h2>Overview</h2>
      <p>
        Players throw at targets placed at different distances, typically ranging from 5 to 20 meters. Points are awarded based on successful throws that pass through or hit designated target areas.
      </p>

      <div class="alert alert-info mt-6">
        <Icon name="tabler:info-circle" size="24" />
        <div>
          <p class="font-semibold">
            Want to compete in Accuracy events?
          </p>
          <p class="text-sm">
            Check our tournament listings to find upcoming events featuring Accuracy.
          </p>
        </div>
        <NuxtLink to="/tournaments" class="btn btn-primary btn-sm">
          View Tournaments
        </NuxtLink>
      </div>
    </div>
  </div>
</template>
