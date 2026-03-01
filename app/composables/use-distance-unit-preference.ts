type DistanceUnit = "km" | "mi";

const DISTANCE_UNIT_STORAGE_KEY = "atm.distanceUnit";

function isDistanceUnit(value: unknown): value is DistanceUnit {
  return value === "km" || value === "mi";
}

export function useDistanceUnitPreference(defaultUnit: DistanceUnit = "km") {
  const authStore = useAuthStore();
  const distanceUnit = ref<DistanceUnit>(defaultUnit);
  const isSavingDistanceUnitPreference = ref(false);

  if (import.meta.client) {
    const savedUnit = localStorage.getItem(DISTANCE_UNIT_STORAGE_KEY);
    if (isDistanceUnit(savedUnit)) {
      distanceUnit.value = savedUnit;
    }
  }

  watch(
    () => authStore.currentUser?.distanceUnit,
    (value) => {
      if (!isDistanceUnit(value)) {
        return;
      }

      distanceUnit.value = value;
      if (import.meta.client) {
        localStorage.setItem(DISTANCE_UNIT_STORAGE_KEY, value);
      }
    },
    { immediate: true },
  );

  watch(
    () => distanceUnit.value,
    async (value, oldValue) => {
      if (value === oldValue) {
        return;
      }

      if (import.meta.client) {
        localStorage.setItem(DISTANCE_UNIT_STORAGE_KEY, value);
      }

      if (!authStore.isSignedIn || !authStore.currentUser?.id) {
        return;
      }

      if (isSavingDistanceUnitPreference.value) {
        return;
      }

      isSavingDistanceUnitPreference.value = true;
      try {
        await $fetch("/api/users/preferences", {
          method: "PATCH",
          body: {
            distanceUnit: value,
          },
        });

        if (authStore.currentUser) {
          authStore.currentUser.distanceUnit = value;
        }
      }
      catch (err) {
        console.error("Failed to save distance unit preference", err);
      }
      finally {
        isSavingDistanceUnitPreference.value = false;
      }
    },
  );

  return {
    distanceUnit,
  };
}
