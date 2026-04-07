<script lang="ts" setup>
const route = useRoute();

function decodeErrorValue(value: unknown): string {
  if (typeof value === "string" && value.trim().length > 0) {
    try {
      return decodeURIComponent(value);
    }
    catch {
      return value;
    }
  }

  if (Array.isArray(value) && typeof value[0] === "string") {
    return decodeErrorValue(value[0]);
  }

  return "";
}

const rawError = computed(() => decodeErrorValue(route.query.error));
const flow = computed(() => decodeErrorValue(route.query.flow).toLowerCase());

const friendlyError = computed(() => {
  const fallback = "An unknown error has occurred.";
  const normalized = rawError.value.toLowerCase();

  const invitationBlocked
    = normalized.includes("sign up")
      || normalized.includes("signup")
      || normalized.includes("not allowed")
      || normalized.includes("invitation")
      || normalized.includes("forbidden");

  if (flow.value === "social" && invitationBlocked) {
    return "Invitation required. Please use your invitation link first, then continue with social sign-in.";
  }

  return rawError.value || fallback;
});
</script>

<template>
  <div class="card bg-base-300 container mt-4 min-h-72 text-center mx-auto flex flex-col items-center justify-center gap-4">
    <div role="alert" class="alert alert-error min-w-1/2 text-center">
      <span>Ouchie - {{ friendlyError }}</span>
    </div>
    <NuxtLink to="/" class="btn btn-primary">
      Go back home
      <Icon name="tabler:home" size="32" />
    </NuxtLink>
  </div>
</template>
