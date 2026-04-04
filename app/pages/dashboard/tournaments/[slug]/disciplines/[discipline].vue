<script setup lang="ts">
definePageMeta({ ssr: false, layout: "tournament-admin" });

const route = useRoute();
const discipline = computed(() => String(route.params.discipline || "").toLowerCase());

const disciplineLabelMap: Record<string, string> = {
  golf: "Disc golf",
  accuracy: "Accuracy",
  distance: "Distance",
  scf: "SCF",
  discathon: "Discathon",
  ddc: "DDC",
  freestyle: "Freestyle",
};

const disciplineLabel = computed(() => disciplineLabelMap[discipline.value] || discipline.value.toUpperCase());
</script>

<template>
  <div>
    <FormHeader
      :title="`${disciplineLabel} Management`"
      title-tag="h1"
      title-class="text-2xl font-bold"
      wrapper-class="mb-3"
    />

    <EmptyStateAlert
      :message="`This workspace section is reserved for managing ${disciplineLabel}.`"
    />
  </div>
</template>
