<script setup lang="ts">
/**
 * Public information page about Self-Caught Flight (SCF)
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
      Self-Caught Flight (SCF)
    </h1>

    <div class="prose max-w-none">
      <p class="text-lg mb-4">
        Self-Caught Flight is a disc sport event where players throw a disc and then run to catch it themselves before it hits the ground.
      </p>

      <h2>Overview</h2>
      <p>
        The objective of SCF is to throw a flying disc as far as possible, then catch it yourself before it touches the ground. The distance is measured from the throwing line to the point where the catch is made.
      </p>

      <h2>Rules</h2>
      <ul>
        <li>Player throws the disc from a designated throwing area</li>
        <li>Player must catch their own throw before it hits the ground</li>
        <li>Distance is measured where the catch is completed</li>
        <li>Players typically get multiple attempts, with the best distance counting</li>
        <li>The disc must be caught cleanly (trapped against body doesn't count)</li>
      </ul>

      <h2>Technique</h2>
      <p>
        Successful SCF requires:
      </p>
      <ul>
        <li><strong>Throwing skill</strong> - Achieving maximum distance and hang time</li>
        <li><strong>Speed and agility</strong> - Running fast enough to reach the disc</li>
        <li><strong>Catching ability</strong> - Making a clean catch while running at full speed</li>
        <li><strong>Angle control</strong> - Throwing at an angle that allows time to run under the disc</li>
      </ul>

      <h2>Competition Format</h2>
      <p>
        In tournaments, SCF is typically run with:
      </p>
      <ul>
        <li>Qualification rounds - Multiple attempts, top distances advance</li>
        <li>Finals - Head-to-head or best distance wins</li>
        <li>Separate men's and women's divisions</li>
        <li>Age-based categories</li>
      </ul>

      <div class="alert alert-info mt-6">
        <Icon
          name="tabler:info-circle"
          size="24"
        />
        <div>
          <p class="font-semibold">
            Want to compete in SCF events?
          </p>
          <p class="text-sm">
            Check our tournament listings to find upcoming events featuring Self-Caught Flight.
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
