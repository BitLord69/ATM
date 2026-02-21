<script setup lang="ts">
/**
 * Public information page about Disc Golf
 */
</script>

<template>
  <div class="container mx-auto p-4 max-w-4xl">
    <div class="mb-4">
      <NuxtLink
        to="/tournaments"
        class="btn btn-ghost btn-sm gap-2"
      >
        <Icon
          name="tabler:arrow-left"
          size="18"
        />
        Back to Tournaments
      </NuxtLink>
    </div>

    <h1 class="text-4xl font-bold mb-6">
      Disc Golf
    </h1>

    <div class="prose max-w-none">
      <p class="text-lg mb-4">
        Disc Golf is a disc sport in which players throw a flying disc at a target; it is played using rules similar to golf.
      </p>

      <h2>Overview</h2>
      <p>
        Disc golf is usually played on a course with 9 or 18 holes. Players complete a hole by throwing a disc from a tee area toward a target (the basket), throwing again from the landing position of the disc until the basket is reached. The player with the lowest number of total throws wins.
      </p>

      <h2>Equipment</h2>
      <p>
        Players use different types of discs for different types of throws:
      </p>
      <ul>
        <li><strong>Drivers</strong> - For long-distance throws</li>
        <li><strong>Mid-range discs</strong> - For controlled, accurate shots</li>
        <li><strong>Putters</strong> - For short, precise throws near the basket</li>
      </ul>

      <h2>Scoring</h2>
      <p>
        Like traditional golf, disc golf uses terms like "par", "birdie", and "bogey". The objective is to complete each hole in the fewest throws possible. Tournament formats can include:
      </p>
      <ul>
        <li>Stroke play (total throws)</li>
        <li>Match play (head-to-head)</li>
        <li>Best disc (player's choice)</li>
      </ul>

      <div class="alert alert-info mt-6">
        <Icon
          name="tabler:info-circle"
          size="24"
        />
        <div>
          <p class="font-semibold">
            Want to compete in Disc Golf tournaments?
          </p>
          <p class="text-sm">
            Check our tournament listings to find upcoming events featuring Disc Golf.
          </p>
        </div>
        <NuxtLink
          to="/tournaments"
          class="btn btn-primary btn-sm"
        >
          View Tournaments
        </NuxtLink>
      </div>
    </div>
  </div>
</template>
