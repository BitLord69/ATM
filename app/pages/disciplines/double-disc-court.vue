<template>
  <div class="container mx-auto p-4 max-w-4xl">
    <div class="mb-4">
      <NuxtLink to="/tournaments" class="btn btn-ghost btn-sm gap-2">
        <Icon name="tabler:arrow-left" size="18" />
        Back to Tournaments
      </NuxtLink>
    </div>

    <h1 class="text-4xl font-bold mb-6">
      Double Disc Court (DDC)
    </h1>

    <div class="prose max-w-none">
      <p class="text-lg mb-4">
        Double Disc Court is a fast-paced team sport played with two discs simultaneously.
      </p>

      <h2>Overview</h2>
      <p>
        Two teams of two players each compete on a court with two discs in play at the same time. Points are scored by landing discs in the opponent's court or catching discs thrown by opponents.
      </p>

      <div class="alert alert-info mt-6">
        <Icon name="tabler:info-circle" size="24" />
        <div>
          <p class="font-semibold">
            Want to compete in DDC events?
          </p>
          <p class="text-sm">
            Check our tournament listings to find upcoming events featuring Double Disc Court.
          </p>
        </div>
        <NuxtLink to="/tournaments" class="btn btn-primary btn-sm">
          View Tournaments
        </NuxtLink>
      </div>
    </div>
  </div>
</template>
