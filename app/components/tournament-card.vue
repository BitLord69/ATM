<script setup lang="ts">
withDefaults(defineProps<{
  title: string;
  description?: string | null;
  dateText?: string | null;
  locationText?: string | null;
  isActive?: boolean;
  status?: "future" | "past" | "active" | string | null;
  showStatusBadge?: boolean;
  cardClass?: string;
  bodyClass?: string;
  descriptionClass?: string;
  metaClass?: string;
  iconSize?: number;
  eventTypesWrapperClass?: string;
  hasGolf?: boolean;
  hasAccuracy?: boolean;
  hasDistance?: boolean;
  hasSCF?: boolean;
  hasDiscathon?: boolean;
  hasDDC?: boolean;
  hasFreestyle?: boolean;
}>(), {
  description: "",
  dateText: "",
  locationText: "",
  isActive: false,
  status: null,
  showStatusBadge: true,
  cardClass: "",
  bodyClass: "card-body p-5 flex flex-col h-full",
  descriptionClass: "text-base opacity-70 line-clamp-2 mb-3",
  metaClass: "text-sm opacity-70 space-y-1.5 mb-3",
  iconSize: 16,
  eventTypesWrapperClass: "flex flex-wrap gap-1.5 pt-3 border-t border-base-300",
  hasGolf: false,
  hasAccuracy: false,
  hasDistance: false,
  hasSCF: false,
  hasDiscathon: false,
  hasDDC: false,
  hasFreestyle: false,
});

defineEmits<{
  (event: "click"): void;
}>();
</script>

<template>
  <div
    class="card bg-base-100 border border-base-300 shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105"
    :class="cardClass"
    @click="$emit('click')"
  >
    <div :class="bodyClass">
      <div class="flex items-start justify-between gap-2 mb-2">
        <h3 class="card-title text-lg flex-1">
          {{ title }}
        </h3>

        <slot name="title-right">
          <span
            v-if="showStatusBadge && isActive"
            class="badge badge-success badge-sm gap-1 shrink-0"
          >
            <span class="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
            Live
          </span>
          <span
            v-else-if="showStatusBadge && status === 'future'"
            class="badge badge-info badge-sm shrink-0"
          >
            Upcoming
          </span>
          <span
            v-else-if="showStatusBadge && status === 'past'"
            class="badge badge-ghost badge-sm shrink-0"
          >
            Past
          </span>
        </slot>
      </div>

      <p
        v-if="description"
        :class="descriptionClass"
      >
        {{ description }}
      </p>

      <slot name="meta-top" />

      <div
        v-if="dateText || locationText"
        :class="metaClass"
      >
        <div
          v-if="dateText"
          class="flex items-center gap-1.5"
        >
          <Icon
            name="tabler:calendar"
            :size="iconSize"
          />
          <span>{{ dateText }}</span>
        </div>
        <div
          v-if="locationText"
          class="flex items-center gap-1.5"
        >
          <Icon
            name="tabler:map-pin"
            :size="iconSize"
          />
          <span>{{ locationText }}</span>
        </div>
      </div>

      <EventTypesList
        :has-golf="hasGolf"
        :has-accuracy="hasAccuracy"
        :has-distance="hasDistance"
        :has-scf="hasSCF"
        :has-discathon="hasDiscathon"
        :has-ddc="hasDDC"
        :has-freestyle="hasFreestyle"
        size="md"
        :wrapper-class="eventTypesWrapperClass"
      />

      <slot name="actions" />
    </div>
  </div>
</template>
