<template>
  <div class="navbar bg-primary text-primary-content">
    <div class="navbar-start">
      <NuxtLink to="/" class="btn btn-ghost">
        <img
          src="/logo.png"
          alt="Logo"
          class="h-8 w-8 mr-2 inline-block"
        >
      </NuxtLink>
    </div>
    <div class="navbar-end">
      <NuxtLink to="/signin" class="btn btn-accent">
        Sign in
      </NuxtLink>
    </div>
  </div>
</template>
