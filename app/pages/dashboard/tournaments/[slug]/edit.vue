<script setup lang="ts">
import type { TournamentEditTabId } from "~/schemas/ui/tournament-edit-tabs";

import { cloneTournamentBodySchema, editTournamentBodySchema } from "#shared/schemas/tournament-edit";
import { disciplineByKey, disciplineKeyOrder } from "~/composables/use-discipline-catalog";
import {
  hasValidCoordinates,
  parseCoordinate,
} from "~/composables/use-leaflet-map";
import { tournamentEditFieldToTab, tournamentEditTabs } from "~/schemas/ui/tournament-edit-tabs";

definePageMeta({
  ssr: false,
  layout: "tournament-admin",
});

type EditableVenue = {
  id?: number;
  key: string;
  name: string;
  description: string;
  facilities: string;
  lat: number;
  long: number;
  hasGolf: boolean;
  hasAccuracy: boolean;
  hasDistance: boolean;
  hasSCF: boolean;
  hasDiscathon: boolean;
  hasDDC: boolean;
  hasFreestyle: boolean;
};

type ExistingVenue = {
  id: number;
  name: string;
  description: string | null;
  facilities: string | null;
  lat: number;
  long: number;
  hasGolf: boolean;
  hasAccuracy: boolean;
  hasDistance: boolean;
  hasSCF: boolean;
  hasDiscathon: boolean;
  hasDDC: boolean;
  hasFreestyle: boolean;
};

const route = useRoute();
const router = useRouter();
const slug = computed(() => route.params.slug as string);
const selectedVenueRadiusKm = ref(300);

const { data, pending, error, refresh } = await useFetch(() => `/api/tournaments/${slug.value}/edit`, {
  query: {
    radiusKm: selectedVenueRadiusKm,
  },
  watch: [selectedVenueRadiusKm],
});

if (error.value) {
  throw createError({
    statusCode: error.value.statusCode || 404,
    message: error.value.message || "Tournament not found",
  });
}

const form = reactive({
  name: "",
  slug: "",
  description: "",
  country: "",
  city: "",
  contactName: "",
  contactEmail: "",
  contactPhone: "",
  directorName: "",
  directorEmail: "",
  directorPhone: "",
  lat: 0,
  long: 0,
  startDate: "",
  endDate: "",
  hasGolf: false,
  hasAccuracy: false,
  hasDistance: false,
  hasSCF: false,
  hasDiscathon: false,
  hasDDC: false,
  hasFreestyle: false,
  banRequestEmailEnabled: true,
});

const venues = ref<EditableVenue[]>([]);
const selectedExistingVenueId = ref<string>("");
const isVenueModalOpen = ref(false);
const venueModalMode = ref<"add" | "edit">("add");
const venueModalIndex = ref<number | null>(null);
const venueDraft = ref<EditableVenue | null>(null);
const venueModalError = ref<string | null>(null);
const saveError = ref<string | null>(null);
const saveSuccess = ref<string | null>(null);
const showDeleteTournamentModal = ref(false);
const showDeleteVenueModal = ref(false);
const showCloneTournamentModal = ref(false);
const deletingTournament = ref(false);
const cloningTournament = ref(false);
const deletingVenueId = ref<number | null>(null);
const cloneTournamentError = ref<string | null>(null);
const cloneNameInput = ref<HTMLInputElement | null>(null);
const cloneDraft = reactive({
  name: "",
  startDate: "",
  endDate: "",
  includeVenues: true,
});
const venueEditScope = ref<"tournament" | "global">("tournament");
const isExistingVenueDraft = computed(() => !!venueDraft.value?.id);
const isAddingExistingVenue = computed(() => venueModalMode.value === "add" && isExistingVenueDraft.value);
const canToggleVenueEditScope = computed(() => venueModalMode.value === "edit" && isExistingVenueDraft.value);
const isTournamentVenueScope = computed(() => venueEditScope.value === "tournament");
const shouldLockGlobalVenueFields = computed(() => isExistingVenueDraft.value && isTournamentVenueScope.value);
const venueModalTitle = computed(() => {
  if (!isExistingVenueDraft.value) {
    return "Create venue";
  }

  if (canToggleVenueEditScope.value && !isTournamentVenueScope.value) {
    return "Edit global venue";
  }

  if (venueModalMode.value === "edit") {
    return "Edit venue for tournament";
  }

  return "Add existing venue";
});
const venueModalDescription = computed(() => {
  if (!isExistingVenueDraft.value) {
    return "Add venue details, disciplines, and location.";
  }

  if (canToggleVenueEditScope.value && !isTournamentVenueScope.value) {
    return "Update global venue fields used by all tournaments linked to this venue record.";
  }

  return venueModalMode.value === "edit"
    ? "Update disciplines for this tournament only."
    : "Review details before linking this reusable venue to the tournament.";
});
const venueModalPrimaryActionLabel = computed(() => {
  if (!isExistingVenueDraft.value) {
    return "Create venue";
  }

  if (canToggleVenueEditScope.value && !isTournamentVenueScope.value) {
    return "Save globally";
  }

  if (venueModalMode.value === "edit") {
    return "Save for tournament";
  }

  return "Add existing venue";
});
const pendingDeleteVenue = ref<{ id: number; name: string; index: number } | null>(null);
const selectedVenueDisciplineFilters = ref<DisciplineKey[]>([]);
const allVenueDisciplineFilterOptions = disciplineKeyOrder.map(key => ({
  key,
  label: disciplineByKey[key].label,
  icon: disciplineByKey[key].icon,
}));
const disciplineCoverageByVenue = computed<Record<DisciplineKey, boolean>>(() => ({
  hasGolf: venues.value.some(venue => venue.hasGolf),
  hasAccuracy: venues.value.some(venue => venue.hasAccuracy),
  hasDistance: venues.value.some(venue => venue.hasDistance),
  hasSCF: venues.value.some(venue => venue.hasSCF),
  hasDiscathon: venues.value.some(venue => venue.hasDiscathon),
  hasDDC: venues.value.some(venue => venue.hasDDC),
  hasFreestyle: venues.value.some(venue => venue.hasFreestyle),
}));

function getDisciplineToggleLabel(key: DisciplineKey, label: string) {
  if (form[key] && !disciplineCoverageByVenue.value[key]) {
    return `${label} *`;
  }

  return label;
}

function getDisciplineToggleTooltip(key: DisciplineKey, label: string) {
  if (!form[key]) {
    return `${label} is disabled for this tournament.`;
  }

  if (!disciplineCoverageByVenue.value[key]) {
    return `No venue is assigned to ${label} yet. Add or update a venue to include this discipline.`;
  }

  return `${label} has at least one venue assigned.`;
}

function getDisciplineToggleLabelClass(key: DisciplineKey) {
  if (form[key] && !disciplineCoverageByVenue.value[key]) {
    return "text-warning font-semibold";
  }

  return "";
}

function toDateInput(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function fromDateInput(value: string) {
  if (!value) {
    return null;
  }

  const parts = value.split("-");
  if (parts.length !== 3) {
    return null;
  }

  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);

  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return null;
  }

  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }

  return Date.UTC(year, month - 1, day);
}

const venueDisciplineFilterOptions = computed(() =>
  allVenueDisciplineFilterOptions.filter(option => form[option.key]),
);
const { distanceUnit: venueDistanceUnit } = useDistanceUnitPreference("km");
const {
  activeTab: activeDetailsTab,
  openTabForField: openDetailsTabForField,
} = useSchemaTabs<TournamentEditTabId>({
  tabs: tournamentEditTabs,
  defaultTab: "general",
  fieldToTab: tournamentEditFieldToTab,
});
const showCloseTournamentModal = ref(false);
const showDisciplineDisableModal = ref(false);
const pendingDisableDiscipline = ref<{ key: DisciplineKey; label: string } | null>(null);
const pendingDisableVenueCount = ref(0);
const validationMessages = ref<string[]>([]);
const fieldErrors = ref<Record<string, string>>({});
const touchedFields = ref<Record<string, boolean>>({});
const submitAttempted = ref(false);
const saving = ref(false);
let successTimeout: ReturnType<typeof setTimeout> | null = null;

function createSnapshot() {
  return JSON.stringify({
    form: {
      name: form.name,
      slug: form.slug,
      description: form.description,
      country: form.country,
      city: form.city,
      contactName: form.contactName,
      contactEmail: form.contactEmail,
      contactPhone: form.contactPhone,
      directorName: form.directorName,
      directorEmail: form.directorEmail,
      directorPhone: form.directorPhone,
      lat: form.lat,
      long: form.long,
      startDate: form.startDate,
      endDate: form.endDate,
      hasGolf: form.hasGolf,
      hasAccuracy: form.hasAccuracy,
      hasDistance: form.hasDistance,
      hasSCF: form.hasSCF,
      hasDiscathon: form.hasDiscathon,
      hasDDC: form.hasDDC,
      hasFreestyle: form.hasFreestyle,
      banRequestEmailEnabled: form.banRequestEmailEnabled,
    },
    venues: venues.value.map(v => ({
      id: v.id ?? null,
      name: v.name,
      description: v.description,
      facilities: v.facilities,
      lat: v.lat,
      long: v.long,
      hasGolf: v.hasGolf,
      hasAccuracy: v.hasAccuracy,
      hasDistance: v.hasDistance,
      hasSCF: v.hasSCF,
      hasDiscathon: v.hasDiscathon,
      hasDDC: v.hasDDC,
      hasFreestyle: v.hasFreestyle,
    })),
  });
}

const {
  hasUnsavedChanges,
  captureInitialSnapshot,
} = useSnapshotDirtyState(createSnapshot);

const {
  showLeaveConfirmModal,
  modalTitle,
  modalMessage,
  modalConfirmText,
  modalCancelText,
  confirmLeavePage,
  cancelLeavePage,
} = useUnsavedChangesGuard(hasUnsavedChanges);

function setTournamentDiscipline(key: DisciplineKey, value: boolean) {
  form[key] = value;
}

function onTournamentDisciplineToggle(key: DisciplineKey, label: string, value: boolean) {
  if (value) {
    setTournamentDiscipline(key, true);
    return;
  }

  const affectedVenueCount = venues.value.filter(venue => venue[key]).length;
  if (affectedVenueCount === 0) {
    setTournamentDiscipline(key, false);
    return;
  }

  pendingDisableDiscipline.value = { key, label };
  pendingDisableVenueCount.value = affectedVenueCount;
  showDisciplineDisableModal.value = true;
}

function cancelDisableDiscipline() {
  showDisciplineDisableModal.value = false;
  pendingDisableDiscipline.value = null;
  pendingDisableVenueCount.value = 0;
}

function confirmDisableDiscipline() {
  const pending = pendingDisableDiscipline.value;
  if (!pending) {
    cancelDisableDiscipline();
    return;
  }

  setTournamentDiscipline(pending.key, false);
  for (const venue of venues.value) {
    venue[pending.key] = false;
  }

  cancelDisableDiscipline();
}

function buildNewVenue() {
  return {
    key: crypto.randomUUID(),
    name: "",
    description: "",
    facilities: "",
    lat: form.lat || 0,
    long: form.long || 0,
    hasGolf: false,
    hasAccuracy: false,
    hasDistance: false,
    hasSCF: false,
    hasDiscathon: false,
    hasDDC: false,
    hasFreestyle: false,
  };
}

function openAddVenueModal(venue?: EditableVenue) {
  venueModalMode.value = "add";
  venueModalIndex.value = null;
  venueModalError.value = null;
  venueEditScope.value = venue?.id ? "tournament" : "global";
  venueDraft.value = venue
    ? {
        ...venue,
        key: crypto.randomUUID(),
      }
    : buildNewVenue();
  isVenueModalOpen.value = true;
}

function openEditVenueModal(index: number) {
  const venue = venues.value[index];
  if (!venue) {
    return;
  }

  venueModalMode.value = "edit";
  venueModalIndex.value = index;
  venueModalError.value = null;
  venueEditScope.value = venue.id ? "tournament" : "global";
  venueDraft.value = {
    ...venue,
  };
  isVenueModalOpen.value = true;
}

function closeVenueModal() {
  isVenueModalOpen.value = false;
  venueModalIndex.value = null;
  venueModalError.value = null;
  venueDraft.value = null;
}

function closeVenueModalWithSave() {
  if (!venueDraft.value) {
    closeVenueModal();
    return;
  }

  if (venueModalMode.value === "add" && !venueDraft.value.name.trim()) {
    closeVenueModal();
    return;
  }

  void saveVenueFromModal();
}

function applyGlobalVenueFields(target: EditableVenue, source: EditableVenue) {
  target.name = source.name;
  target.description = source.description;
  target.facilities = source.facilities;
  target.lat = source.lat;
  target.long = source.long;
}

function syncGlobalVenueFieldsAcrossDrafts(sourceVenueId: number, source: EditableVenue) {
  for (const linkedVenue of venues.value) {
    if (linkedVenue.id === sourceVenueId) {
      applyGlobalVenueFields(linkedVenue, source);
    }
  }
}

async function saveVenueFromModal() {
  if (!venueDraft.value) {
    return;
  }

  const draft = venueDraft.value;
  const requiresGlobalFieldValidation = !shouldLockGlobalVenueFields.value;

  if (requiresGlobalFieldValidation) {
    if (!draft.name.trim()) {
      venueModalError.value = "Venue name is required.";
      return;
    }

    if (!Number.isFinite(draft.lat) || !Number.isFinite(draft.long)) {
      venueModalError.value = "Latitude and longitude are required.";
      return;
    }
  }

  if (isExistingVenueDraft.value && canToggleVenueEditScope.value && !isTournamentVenueScope.value) {
    try {
      await $fetch(`/api/tournaments/${slug.value}/venues/${draft.id}/global`, {
        method: "PATCH",
        body: {
          name: draft.name.trim(),
          description: draft.description || null,
          facilities: draft.facilities || null,
          lat: draft.lat,
          long: draft.long,
        },
      });

      syncGlobalVenueFieldsAcrossDrafts(draft.id as number, draft);
    }
    catch (err: any) {
      venueModalError.value = err?.data?.message || err?.message || "Failed to save global venue";
      return;
    }
  }

  let persistedVenue: EditableVenue | null = null;
  try {
    const result = await $fetch<{
      success: boolean;
      venue: {
        id: number;
        name: string;
        description: string | null;
        facilities: string | null;
        lat: number;
        long: number;
        hasGolf: boolean;
        hasAccuracy: boolean;
        hasDistance: boolean;
        hasSCF: boolean;
        hasDiscathon: boolean;
        hasDDC: boolean;
        hasFreestyle: boolean;
      };
    }>(`/api/tournaments/${slug.value}/venues/upsert`, {
      method: "POST",
      body: {
        id: draft.id,
        name: draft.name.trim(),
        description: draft.description || null,
        facilities: draft.facilities || null,
        lat: draft.lat,
        long: draft.long,
        hasGolf: draft.hasGolf,
        hasAccuracy: draft.hasAccuracy,
        hasDistance: draft.hasDistance,
        hasSCF: draft.hasSCF,
        hasDiscathon: draft.hasDiscathon,
        hasDDC: draft.hasDDC,
        hasFreestyle: draft.hasFreestyle,
      },
    });

    persistedVenue = {
      key: draft.key,
      id: result.venue.id,
      name: result.venue.name,
      description: result.venue.description || "",
      facilities: result.venue.facilities || "",
      lat: result.venue.lat,
      long: result.venue.long,
      hasGolf: !!result.venue.hasGolf,
      hasAccuracy: !!result.venue.hasAccuracy,
      hasDistance: !!result.venue.hasDistance,
      hasSCF: !!result.venue.hasSCF,
      hasDiscathon: !!result.venue.hasDiscathon,
      hasDDC: !!result.venue.hasDDC,
      hasFreestyle: !!result.venue.hasFreestyle,
    };
  }
  catch (err: any) {
    venueModalError.value = err?.data?.message || err?.message || "Failed to save venue";
    return;
  }

  venueModalError.value = null;

  if (venueModalMode.value === "edit" && venueModalIndex.value !== null) {
    const current = venues.value[venueModalIndex.value];
    if (!current) {
      closeVenueModal();
      return;
    }

    if (shouldLockGlobalVenueFields.value) {
      venues.value.splice(venueModalIndex.value, 1, {
        ...current,
        id: persistedVenue?.id || current.id,
        hasGolf: draft.hasGolf,
        hasAccuracy: draft.hasAccuracy,
        hasDistance: draft.hasDistance,
        hasSCF: draft.hasSCF,
        hasDiscathon: draft.hasDiscathon,
        hasDDC: draft.hasDDC,
        hasFreestyle: draft.hasFreestyle,
      });
    }
    else {
      venues.value.splice(venueModalIndex.value, 1, {
        ...(persistedVenue || draft),
      });
    }
  }
  else {
    venues.value.push({
      ...(persistedVenue || draft),
      key: crypto.randomUUID(),
    });
  }

  closeVenueModal();
}

const availableVenues = computed<ExistingVenue[]>(() => {
  if (!data.value || Array.isArray(data.value)) {
    return [];
  }
  return (data.value.availableVenues || []) as ExistingVenue[];
});

const availableVenueRadiusKm = computed<number | null>(() => {
  if (!data.value || Array.isArray(data.value)) {
    return null;
  }

  const raw = (data.value as { availableVenueRadiusKm?: number }).availableVenueRadiusKm;
  return typeof raw === "number" && Number.isFinite(raw) ? raw : null;
});

const unlinkedAvailableVenues = computed(() => {
  const linkedIds = new Set(venues.value.map(v => v.id).filter((id): id is number => typeof id === "number"));
  return availableVenues.value.filter(v => !linkedIds.has(v.id));
});

const filteredAvailableVenues = computed(() => {
  if (selectedVenueDisciplineFilters.value.length === 0) {
    return unlinkedAvailableVenues.value;
  }

  return unlinkedAvailableVenues.value.filter(venue =>
    selectedVenueDisciplineFilters.value.some(key => !!venue[key]),
  );
});

watch(
  venueDisciplineFilterOptions,
  (options) => {
    const allowedKeys = new Set(options.map(option => option.key));
    selectedVenueDisciplineFilters.value = selectedVenueDisciplineFilters.value.filter(key => allowedKeys.has(key));
  },
  { immediate: true },
);

watch(
  filteredAvailableVenues,
  (value) => {
    if (!selectedExistingVenueId.value) {
      return;
    }

    const selectedId = Number(selectedExistingVenueId.value);
    if (!value.some(venue => venue.id === selectedId)) {
      selectedExistingVenueId.value = "";
    }
  },
  { immediate: true },
);

function toggleVenueDisciplineFilter(key: DisciplineKey) {
  if (selectedVenueDisciplineFilters.value.includes(key)) {
    selectedVenueDisciplineFilters.value = selectedVenueDisciplineFilters.value.filter(value => value !== key);
    return;
  }

  selectedVenueDisciplineFilters.value = [...selectedVenueDisciplineFilters.value, key];
}

function clearVenueDisciplineFilters() {
  selectedVenueDisciplineFilters.value = [];
}

function isVenueDisciplineFilterActive(key: DisciplineKey) {
  return selectedVenueDisciplineFilters.value.includes(key);
}

watch(
  () => availableVenueRadiusKm.value,
  (value) => {
    if (typeof value === "number") {
      selectedVenueRadiusKm.value = value;
    }
  },
  { immediate: true },
);

function addExistingVenue() {
  const id = Number(selectedExistingVenueId.value);
  if (!id || Number.isNaN(id)) {
    return;
  }

  const existing = filteredAvailableVenues.value.find(v => v.id === id);
  if (!existing) {
    return;
  }

  openAddVenueModal({
    id: existing.id,
    key: `existing-${existing.id}-${Date.now()}`,
    name: existing.name,
    description: existing.description || "",
    facilities: existing.facilities || "",
    lat: existing.lat,
    long: existing.long,
    hasGolf: !!existing.hasGolf,
    hasAccuracy: !!existing.hasAccuracy,
    hasDistance: !!existing.hasDistance,
    hasSCF: !!existing.hasSCF,
    hasDiscathon: !!existing.hasDiscathon,
    hasDDC: !!existing.hasDDC,
    hasFreestyle: !!existing.hasFreestyle,
  });

  selectedExistingVenueId.value = "";
}

function removeVenue(index: number) {
  venues.value.splice(index, 1);
}

function requestDeleteVenue(index: number) {
  const venueToDelete = venues.value[index];
  if (!venueToDelete?.id) {
    removeVenue(index);
    return;
  }

  pendingDeleteVenue.value = {
    id: venueToDelete.id,
    name: venueToDelete.name || `Venue ${index + 1}`,
    index,
  };
  showDeleteVenueModal.value = true;
}

function cancelDeleteVenue() {
  showDeleteVenueModal.value = false;
  pendingDeleteVenue.value = null;
}

async function confirmDeleteVenue() {
  if (!pendingDeleteVenue.value) {
    cancelDeleteVenue();
    return;
  }

  const target = pendingDeleteVenue.value;
  deletingVenueId.value = target.id;

  try {
    await $fetch(`/api/tournaments/${slug.value}/venues/${target.id}`, {
      method: "DELETE",
    });

    venues.value.splice(target.index, 1);
    saveSuccess.value = `Venue \"${target.name}\" deleted.`;
  }
  catch (err: any) {
    saveError.value = err?.data?.message || err?.message || "Failed to delete venue";
  }
  finally {
    deletingVenueId.value = null;
    cancelDeleteVenue();
  }
}

function requestCloneTournament() {
  if (saving.value || deletingTournament.value || cloningTournament.value) {
    return;
  }

  cloneDraft.name = form.name;
  cloneDraft.startDate = form.startDate;
  cloneDraft.endDate = form.endDate;
  cloneDraft.includeVenues = true;
  cloneTournamentError.value = null;
  showCloneTournamentModal.value = true;

  nextTick(() => {
    cloneNameInput.value?.focus();
    cloneNameInput.value?.select();
  });
}

function cancelCloneTournament() {
  if (cloningTournament.value) {
    return;
  }

  showCloneTournamentModal.value = false;
  cloneTournamentError.value = null;
}

async function confirmCloneTournament() {
  if (cloningTournament.value) {
    return;
  }

  const payload = {
    name: cloneDraft.name.trim(),
    startDate: fromDateInput(cloneDraft.startDate),
    endDate: fromDateInput(cloneDraft.endDate),
    includeVenues: cloneDraft.includeVenues,
  };

  const parsed = cloneTournamentBodySchema.safeParse(payload);
  if (!parsed.success) {
    cloneTournamentError.value = parsed.error.issues[0]?.message || "Please complete clone details.";
    return;
  }

  cloneTournamentError.value = null;
  cloningTournament.value = true;

  try {
    const result = await $fetch<{ success: boolean; slug: string }>(`/api/tournaments/${slug.value}/clone`, {
      method: "POST",
      body: parsed.data,
    });

    showCloneTournamentModal.value = false;
    await router.push({
      path: `/dashboard/tournaments/${result.slug}/edit`,
      query: { cloned: "1" },
    });
  }
  catch (err: any) {
    cloneTournamentError.value = err?.data?.message || err?.message || "Failed to clone tournament";
  }
  finally {
    cloningTournament.value = false;
  }
}

async function consumeCloneSuccessFlag() {
  if (route.query.cloned !== "1") {
    return;
  }

  saveSuccess.value = "Tournament cloned successfully.";

  if (successTimeout) {
    clearTimeout(successTimeout);
  }
  successTimeout = setTimeout(() => {
    saveSuccess.value = null;
    successTimeout = null;
  }, 4000);

  const nextQuery = { ...route.query };
  delete nextQuery.cloned;
  await router.replace({ path: route.path, query: nextQuery });
}

onMounted(() => {
  void consumeCloneSuccessFlag();
});

function requestCloseTournament() {
  if (saving.value || deletingTournament.value || cloningTournament.value) {
    return;
  }

  showCloseTournamentModal.value = true;
}

function cancelCloseTournament() {
  if (saving.value) {
    return;
  }

  showCloseTournamentModal.value = false;
}

async function confirmCloseTournament() {
  if (saving.value) {
    return;
  }

  showCloseTournamentModal.value = false;
  await saveTournament(true);
}

function requestDeleteTournament() {
  if (saving.value || deletingTournament.value) {
    return;
  }
  showDeleteTournamentModal.value = true;
}

function cancelEdit() {
  if (import.meta.client && window.history.state?.back) {
    router.back();
    return;
  }

  void navigateTo(`/dashboard/tournaments/${slug.value}`);
}

function cancelDeleteTournament() {
  showDeleteTournamentModal.value = false;
}

async function confirmDeleteTournament() {
  showDeleteTournamentModal.value = false;
  deletingTournament.value = true;

  try {
    await $fetch(`/api/tournaments/${slug.value}/delete`, {
      method: "DELETE",
    });
    await router.push("/dashboard");
  }
  catch (err: any) {
    saveError.value = err?.data?.message || err?.message || "Failed to delete tournament";
  }
  finally {
    deletingTournament.value = false;
  }
}

function onTournamentMapClick(event: any) {
  const { lat, lng } = event.latlng;
  form.lat = roundCoord(lat);
  form.long = roundCoord(lng);
}

function onVenueModalMapClick(event: any) {
  if (shouldLockGlobalVenueFields.value) {
    return;
  }

  if (!venueDraft.value) {
    return;
  }

  const { lat, lng } = event.latlng;
  venueDraft.value.lat = roundCoord(lat);
  venueDraft.value.long = roundCoord(lng);
}

const toCoordinate = parseCoordinate;
const hasMapCoordinates = hasValidCoordinates;
function roundCoord(value: number) {
  return Number(value.toFixed(6));
}

const tournamentCenter = computed<[number, number]>(() => {
  const lat = toCoordinate(form.lat);
  const long = toCoordinate(form.long);

  if (hasMapCoordinates(lat, long)) {
    return [lat, long];
  }

  return [59.67497, 12.85981];
});

const tournamentMapVenues = computed(() => {
  return venues.value.map(venue => ({
    id: venue.id ?? (Number.parseInt(venue.key.replace(/\D/g, ""), 10) || 0),
    name: venue.name,
    description: venue.description || null,
    facilities: venue.facilities || null,
    lat: venue.lat,
    long: venue.long,
    hasGolf: venue.hasGolf,
    hasAccuracy: venue.hasAccuracy,
    hasDistance: venue.hasDistance,
    hasSCF: venue.hasSCF,
    hasDiscathon: venue.hasDiscathon,
    hasDDC: venue.hasDDC,
    hasFreestyle: venue.hasFreestyle,
  }));
});

watch(
  data,
  (value) => {
    if (!value || Array.isArray(value)) {
      return;
    }

    form.name = value.name || "";
    form.slug = value.slug || "";
    form.description = value.description || "";
    form.country = value.country || "";
    form.city = value.city || "";
    form.contactName = value.contactName || "";
    form.contactEmail = value.contactEmail || "";
    form.contactPhone = value.contactPhone || "";
    form.directorName = value.directorName || "";
    form.directorEmail = value.directorEmail || "";
    form.directorPhone = value.directorPhone || "";
    form.lat = value.lat || 0;
    form.long = value.long || 0;
    form.startDate = toDateInput(value.startDate);
    form.endDate = toDateInput(value.endDate);
    form.hasGolf = !!value.hasGolf;
    form.hasAccuracy = !!value.hasAccuracy;
    form.hasDistance = !!value.hasDistance;
    form.hasSCF = !!value.hasSCF;
    form.hasDiscathon = !!value.hasDiscathon;
    form.hasDDC = !!value.hasDDC;
    form.hasFreestyle = !!value.hasFreestyle;
    form.banRequestEmailEnabled = value.banRequestEmailEnabled !== false;

    venues.value = (value.venues || []).map((v: any) => ({
      id: v.id,
      key: String(v.id),
      name: v.name || "",
      description: v.description || "",
      facilities: v.facilities || "",
      lat: v.lat || 0,
      long: v.long || 0,
      hasGolf: !!v.hasGolf,
      hasAccuracy: !!v.hasAccuracy,
      hasDistance: !!v.hasDistance,
      hasSCF: !!v.hasSCF,
      hasDiscathon: !!v.hasDiscathon,
      hasDDC: !!v.hasDDC,
      hasFreestyle: !!v.hasFreestyle,
    }));

    captureInitialSnapshot();
  },
  { immediate: true },
);

const isTournamentClosed = computed(() => data.value && !Array.isArray(data.value) ? data.value.closedAt != null : false);
const canCloseTournament = computed(() => !isTournamentClosed.value);

function markTouched(field: string) {
  touchedFields.value[field] = true;
}

function getFieldError(field: string) {
  return fieldErrors.value[field] || "";
}

function shouldShowFieldError(field: string) {
  return !!getFieldError(field) && (submitAttempted.value || !!touchedFields.value[field]);
}

async function saveTournament(closeTournament = false) {
  saveError.value = null;
  saveSuccess.value = null;
  validationMessages.value = [];
  submitAttempted.value = true;
  saving.value = true;

  const requestBody = {
    name: form.name,
    description: form.description || null,
    country: form.country || null,
    city: form.city || null,
    contactName: form.contactName || null,
    contactEmail: form.contactEmail || null,
    contactPhone: form.contactPhone || null,
    directorName: form.directorName || null,
    directorEmail: form.directorEmail || null,
    directorPhone: form.directorPhone || null,
    lat: form.lat,
    long: form.long,
    startDate: fromDateInput(form.startDate),
    endDate: fromDateInput(form.endDate),
    hasGolf: form.hasGolf,
    hasAccuracy: form.hasAccuracy,
    hasDistance: form.hasDistance,
    hasSCF: form.hasSCF,
    hasDiscathon: form.hasDiscathon,
    hasDDC: form.hasDDC,
    hasFreestyle: form.hasFreestyle,
    banRequestEmailEnabled: form.banRequestEmailEnabled,
    closeTournament,
    venues: venues.value.map(v => ({
      id: v.id,
      name: v.name,
      description: v.description || null,
      facilities: v.facilities || null,
      lat: v.lat,
      long: v.long,
      hasGolf: v.hasGolf,
      hasAccuracy: v.hasAccuracy,
      hasDistance: v.hasDistance,
      hasSCF: v.hasSCF,
      hasDiscathon: v.hasDiscathon,
      hasDDC: v.hasDDC,
      hasFreestyle: v.hasFreestyle,
    })),
  };

  const validation = editTournamentBodySchema.safeParse(requestBody);
  if (!validation.success) {
    fieldErrors.value = {};
    for (const issue of validation.error.issues) {
      const path = issue.path.join(".");
      if (path && !fieldErrors.value[path]) {
        fieldErrors.value[path] = issue.message;
      }
    }

    const firstIssueField = validation.error.issues[0]?.path?.[0];
    if (typeof firstIssueField === "string") {
      openDetailsTabForField(firstIssueField);
    }

    validationMessages.value = validation.error.issues.map((issue) => {
      const path = issue.path.length ? `${issue.path.join(".")}: ` : "";
      return `${path}${issue.message}`;
    });
    saving.value = false;
    return;
  }

  fieldErrors.value = {};

  try {
    const result = await $fetch<{ success: boolean; slug: string }>(`/api/tournaments/${slug.value}/edit`, {
      method: "PATCH",
      body: requestBody,
    });

    saveSuccess.value = closeTournament ? "Tournament closed." : "Tournament saved.";

    if (successTimeout) {
      clearTimeout(successTimeout);
    }
    successTimeout = setTimeout(() => {
      saveSuccess.value = null;
      successTimeout = null;
    }, 4000);

    captureInitialSnapshot();

    if (result.slug && result.slug !== slug.value) {
      await router.replace(`/dashboard/tournaments/${result.slug}/edit`);
    }
    await refresh();
    await refreshNuxtData();
  }
  catch (err: any) {
    saveError.value = err?.data?.message || err?.message || "Failed to save tournament";
  }
  finally {
    saving.value = false;
  }
}
</script>

<template>
  <div>
    <div class="mb-4 flex flex-wrap items-center justify-end gap-2">
      <button
        class="btn btn-primary btn-sm"
        type="button"
        :disabled="saving"
        @click="saveTournament(false)"
      >
        <span
          v-if="saving"
          class="loading loading-spinner loading-xs"
        />
        <span v-else>Save Tournament</span>
      </button>
      <button
        class="btn btn-outline btn-sm"
        type="button"
        :disabled="cloningTournament || saving"
        @click="requestCloneTournament"
      >
        <span
          v-if="cloningTournament"
          class="loading loading-spinner loading-xs"
        />
        <span v-else>Clone Tournament</span>
      </button>
      <NuxtLink
        :to="`/tournaments/${form.slug || slug}`"
        class="btn btn-outline btn-sm"
      >
        View Public Page
      </NuxtLink>
    </div>

    <PageLoadingState
      v-if="pending && (!data || Array.isArray(data))"
      wrapper-class="py-12"
    />

    <div
      v-else-if="data && !Array.isArray(data)"
      class="space-y-3"
    >
      <FormHeader
        title="Edit Tournament"
        description="Update tournament details and venues. The slug remains permanent after creation."
        title-tag="h1"
        title-class="text-3xl font-bold"
      />

      <div
        v-if="saveError"
        class="alert alert-error gap-2"
      >
        <button
          class="btn btn-ghost btn-xs"
          @click="saveError = null"
        >
          ✕
        </button>
        <span>{{ saveError }}</span>
      </div>
      <div
        v-if="validationMessages.length > 0"
        class="alert alert-warning gap-2"
      >
        <button
          class="btn btn-ghost btn-xs"
          @click="validationMessages = []"
        >
          ✕
        </button>
        <div>
          <p class="font-semibold mb-1">
            Please fix the following:
          </p>
          <ul class="list-disc list-inside text-sm">
            <li
              v-for="message in validationMessages"
              :key="message"
            >
              {{ message }}
            </li>
          </ul>
        </div>
      </div>
      <div
        v-if="saveSuccess"
        class="alert alert-success gap-2"
      >
        <button
          class="btn btn-ghost btn-xs"
          @click="saveSuccess = null"
        >
          ✕
        </button>
        <span>{{ saveSuccess }}</span>
      </div>

      <div class="card bg-base-200 shadow-sm border border-base-300/60">
        <div class="card-body">
          <VerticalTabsLayout
            v-model="activeDetailsTab"
            :tabs="tournamentEditTabs"
            :initial-open-tab-ids="['general', 'map', 'venue-actions', 'venue-list']"
            :session-state-key="`tournament-edit:${slug}`"
          >
            <template #general>
              <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-x-4 gap-y-3">
                <FormField
                  label="Tournament Name"
                  required
                  wrapper-class="xl:col-span-2"
                  :error="getFieldError('name')"
                >
                  <input
                    v-model="form.name"
                    class="input input-bordered w-full"
                    :class="{ 'input-error': shouldShowFieldError('name') }"
                    type="text"
                    required
                    wrapper-class="xl:col-span-2"
                    :error="getFieldError('name')"
                  >
                  <input
                    v-model="form.name"
                    class="input input-bordered w-full"
                    :class="{ 'input-error': shouldShowFieldError('name') }"
                    type="text"
                    required
                    :aria-invalid="shouldShowFieldError('name')"
                    @blur="markTouched('name')"
                  >
                </FormField>
                <FormField label="Slug">
                  <input
                    v-model="form.slug"
                    class="input input-bordered w-full bg-base-300 text-base-content cursor-not-allowed opacity-70"
                    type="text"
                    readonly
                    title="Slug cannot be changed"
                  >
                </FormField>
                <FormField
                  label="Description"
                  wrapper-class="xl:col-span-3"
                >
                  <textarea
                    v-model="form.description"
                    class="textarea textarea-bordered w-full"
                    rows="3"
                  />
                </FormField>
                <FormField label="Country">
                  <CountrySelect v-model="form.country" />
                </FormField>
                <FormField label="City">
                  <input
                    v-model="form.city"
                    class="input input-bordered w-full"
                    type="text"
                  >
                </FormField>
                <div class="grid grid-cols-2 gap-3">
                  <FormField label="Start Date">
                    <input
                      v-model="form.startDate"
                      class="input input-bordered w-full"
                      type="date"
                    >
                  </FormField>
                  <FormField label="End Date">
                    <input
                      v-model="form.endDate"
                      class="input input-bordered w-full"
                      type="date"
                    >
                  </FormField>
                </div>
              </div>
            </template>

            <template #contacts>
              <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <div class="rounded-box border border-base-300/50 p-3">
                  <h3 class="font-semibold mb-3">
                    Contact Person
                  </h3>
                  <div class="grid grid-cols-1 gap-3">
                    <FormField label="Name">
                      <input
                        v-model="form.contactName"
                        class="input input-bordered w-full"
                        type="text"
                      >
                    </FormField>
                    <FormField label="Email">
                      <input
                        v-model="form.contactEmail"
                        class="input input-bordered w-full"
                        type="email"
                      >
                    </FormField>
                    <FormField label="Phone">
                      <input
                        v-model="form.contactPhone"
                        class="input input-bordered w-full"
                        type="text"
                      >
                    </FormField>
                  </div>
                </div>

                <div class="rounded-box border border-base-300/50 p-3">
                  <h3 class="font-semibold mb-3">
                    Tournament Director
                  </h3>
                  <div class="grid grid-cols-1 gap-3">
                    <FormField label="Name">
                      <input
                        v-model="form.directorName"
                        class="input input-bordered w-full"
                        type="text"
                      >
                    </FormField>
                    <FormField label="Email">
                      <input
                        v-model="form.directorEmail"
                        class="input input-bordered w-full"
                        type="email"
                      >
                    </FormField>
                    <FormField label="Phone">
                      <input
                        v-model="form.directorPhone"
                        class="input input-bordered w-full"
                        type="text"
                      >
                    </FormField>
                  </div>
                </div>

                <div class="rounded-box border border-base-300/50 p-3 xl:col-span-2">
                  <h3 class="font-semibold mb-2">
                    Moderation Notifications
                  </h3>
                  <p class="text-sm opacity-70 mb-2">
                    Allow optional email notifications when tournament admins submit ban requests.
                  </p>
                  <ToggleField
                    :model-value="form.banRequestEmailEnabled"
                    label="Enable moderation email notifications"
                    :desktop-inline="true"
                    @update:model-value="form.banRequestEmailEnabled = $event as boolean"
                  />
                </div>
              </div>
            </template>

            <template #disciplines>
              <div class="space-y-1">
                <div class="rounded-box bg-base-100 p-3 md:p-4 grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 border border-base-300/50">
                  <ToggleField
                    :model-value="form.hasGolf"
                    :label="getDisciplineToggleLabel('hasGolf', disciplineByKey.hasGolf.label)"
                    :icon="disciplineByKey.hasGolf.icon"
                    :desktop-inline="true"
                    :tooltip="getDisciplineToggleTooltip('hasGolf', disciplineByKey.hasGolf.label)"
                    :label-class="getDisciplineToggleLabelClass('hasGolf')"
                    @update:model-value="onTournamentDisciplineToggle('hasGolf', disciplineByKey.hasGolf.label, $event as boolean)"
                  />
                  <ToggleField
                    :model-value="form.hasAccuracy"
                    :label="getDisciplineToggleLabel('hasAccuracy', disciplineByKey.hasAccuracy.label)"
                    :icon="disciplineByKey.hasAccuracy.icon"
                    :desktop-inline="true"
                    :tooltip="getDisciplineToggleTooltip('hasAccuracy', disciplineByKey.hasAccuracy.label)"
                    :label-class="getDisciplineToggleLabelClass('hasAccuracy')"
                    @update:model-value="onTournamentDisciplineToggle('hasAccuracy', disciplineByKey.hasAccuracy.label, $event as boolean)"
                  />
                  <ToggleField
                    :model-value="form.hasDistance"
                    :label="getDisciplineToggleLabel('hasDistance', disciplineByKey.hasDistance.label)"
                    :icon="disciplineByKey.hasDistance.icon"
                    :desktop-inline="true"
                    :tooltip="getDisciplineToggleTooltip('hasDistance', disciplineByKey.hasDistance.label)"
                    :label-class="getDisciplineToggleLabelClass('hasDistance')"
                    @update:model-value="onTournamentDisciplineToggle('hasDistance', disciplineByKey.hasDistance.label, $event as boolean)"
                  />
                  <ToggleField
                    :model-value="form.hasSCF"
                    :label="getDisciplineToggleLabel('hasSCF', disciplineByKey.hasSCF.label)"
                    :icon="disciplineByKey.hasSCF.icon"
                    :desktop-inline="true"
                    :tooltip="getDisciplineToggleTooltip('hasSCF', disciplineByKey.hasSCF.label)"
                    :label-class="getDisciplineToggleLabelClass('hasSCF')"
                    @update:model-value="onTournamentDisciplineToggle('hasSCF', disciplineByKey.hasSCF.label, $event as boolean)"
                  />
                  <ToggleField
                    :model-value="form.hasDiscathon"
                    :label="getDisciplineToggleLabel('hasDiscathon', disciplineByKey.hasDiscathon.label)"
                    :icon="disciplineByKey.hasDiscathon.icon"
                    :desktop-inline="true"
                    :tooltip="getDisciplineToggleTooltip('hasDiscathon', disciplineByKey.hasDiscathon.label)"
                    :label-class="getDisciplineToggleLabelClass('hasDiscathon')"
                    @update:model-value="onTournamentDisciplineToggle('hasDiscathon', disciplineByKey.hasDiscathon.label, $event as boolean)"
                  />
                  <ToggleField
                    :model-value="form.hasDDC"
                    :label="getDisciplineToggleLabel('hasDDC', disciplineByKey.hasDDC.label)"
                    :icon="disciplineByKey.hasDDC.icon"
                    :desktop-inline="true"
                    :tooltip="getDisciplineToggleTooltip('hasDDC', disciplineByKey.hasDDC.label)"
                    :label-class="getDisciplineToggleLabelClass('hasDDC')"
                    @update:model-value="onTournamentDisciplineToggle('hasDDC', disciplineByKey.hasDDC.label, $event as boolean)"
                  />
                  <ToggleField
                    :model-value="form.hasFreestyle"
                    :label="getDisciplineToggleLabel('hasFreestyle', disciplineByKey.hasFreestyle.label)"
                    :icon="disciplineByKey.hasFreestyle.icon"
                    :desktop-inline="true"
                    :tooltip="getDisciplineToggleTooltip('hasFreestyle', disciplineByKey.hasFreestyle.label)"
                    :label-class="getDisciplineToggleLabelClass('hasFreestyle')"
                    @update:model-value="onTournamentDisciplineToggle('hasFreestyle', disciplineByKey.hasFreestyle.label, $event as boolean)"
                  />
                </div>
                <p class="text-xs opacity-70 leading-tight">
                  * No venue assigned yet
                </p>
              </div>
            </template>

            <template #map>
              <div class="space-y-4">
                <h2 class="card-title">
                  Tournament Location (click map to set)
                </h2>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <FormField
                    label="Latitude"
                    required
                    :error="getFieldError('lat')"
                  >
                    <input
                      v-model.number="form.lat"
                      class="input input-bordered w-full"
                      :class="{ 'input-error': shouldShowFieldError('lat') }"
                      type="number"
                      step="0.000001"
                      required
                      :aria-invalid="shouldShowFieldError('lat')"
                      @blur="markTouched('lat')"
                    >
                  </FormField>
                  <FormField
                    label="Longitude"
                    required
                    :error="getFieldError('long')"
                  >
                    <input
                      v-model.number="form.long"
                      class="input input-bordered w-full"
                      :class="{ 'input-error': shouldShowFieldError('long') }"
                      type="number"
                      step="0.000001"
                      required
                      :aria-invalid="shouldShowFieldError('long')"
                      @blur="markTouched('long')"
                    >
                  </FormField>
                </div>

                <ClientOnly>
                  <TournamentMap
                    :lat="tournamentCenter[0]"
                    :long="tournamentCenter[1]"
                    :name="form.name || 'Tournament'"
                    :city="form.city || null"
                    :country="form.country || null"
                    :venues="tournamentMapVenues"
                    height="360px"
                    @map-click="onTournamentMapClick"
                  />
                </ClientOnly>
              </div>
            </template>

            <template #venue-actions>
              <div class="space-y-4">
                <div class="space-y-3">
                  <h2 class="card-title">
                    Manage Venues
                  </h2>

                  <div class="flex items-center justify-between gap-2">
                    <p class="text-xs font-semibold uppercase tracking-wide opacity-70">
                      Filters
                    </p>
                    <p class="text-xs opacity-70">
                      {{ filteredAvailableVenues.length }} matching existing venues
                    </p>
                  </div>

                  <div class="flex flex-wrap md:flex-nowrap items-end gap-2">
                    <RadiusControl
                      v-model="selectedVenueRadiusKm"
                      v-model:display-unit="venueDistanceUnit"
                      label="Nearby radius"
                      :show-unit-toggle="true"
                    />
                    <div class="flex flex-wrap items-center gap-2 self-end w-full md:w-auto md:ml-auto md:justify-end md:shrink-0">
                      <button
                        type="button"
                        class="btn btn-xs"
                        :class="selectedVenueDisciplineFilters.length === 0 ? 'btn-primary' : 'btn-outline'"
                        @click="clearVenueDisciplineFilters"
                      >
                        All venue types
                      </button>
                      <button
                        v-for="option in venueDisciplineFilterOptions"
                        :key="option.key"
                        type="button"
                        class="btn btn-xs"
                        :class="isVenueDisciplineFilterActive(option.key) ? 'btn-primary' : 'btn-outline'"
                        @click="toggleVenueDisciplineFilter(option.key)"
                      >
                        <Icon
                          :name="option.icon"
                          size="14"
                          class="opacity-85"
                        />
                        <span>{{ option.label }}</span>
                      </button>
                      <span
                        v-if="venueDisciplineFilterOptions.length === 0"
                        class="text-xs opacity-70"
                      >
                        Enable tournament disciplines to filter venue types.
                      </span>
                    </div>
                  </div>

                  <p class="text-xs font-semibold uppercase tracking-wide opacity-70">
                    Actions
                  </p>

                  <div class="flex flex-wrap items-center gap-2">
                    <div class="flex items-center gap-2">
                      <select
                        v-model="selectedExistingVenueId"
                        class="select select-bordered select-sm min-w-65 bg-base-100 text-base-content border-base-300 hover:border-base-content/40 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                      >
                        <option value="">
                          Use existing venue
                        </option>
                        <option
                          v-for="existing in filteredAvailableVenues"
                          :key="existing.id"
                          :value="String(existing.id)"
                        >
                          {{ existing.name }} ({{ existing.lat.toFixed(3) }}, {{ existing.long.toFixed(3) }})
                        </option>
                      </select>
                      <button
                        class="btn btn-sm btn-outline"
                        type="button"
                        :disabled="!selectedExistingVenueId"
                        @click="addExistingVenue"
                      >
                        Add existing
                      </button>
                    </div>
                    <button
                      class="btn btn-sm btn-primary"
                      type="button"
                      @click="openAddVenueModal()"
                    >
                      Create new venue
                    </button>
                  </div>
                </div>
              </div>
            </template>

            <template #venue-list>
              <div class="space-y-4">
                <div v-if="venues.length === 0" class="alert">
                  <span>No venues yet.</span>
                </div>

                <div v-else class="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div
                    v-for="(venue, index) in venues"
                    :key="venue.key"
                    class="card bg-base-100 border border-base-300 h-full"
                  >
                    <div class="card-body p-4">
                      <div class="flex justify-between items-start">
                        <h3 class="text-lg font-semibold leading-tight">
                          Venue {{ index + 1 }}
                        </h3>
                        <div class="flex items-center gap-2">
                          <button
                            class="btn btn-sm btn-outline"
                            type="button"
                            @click="openEditVenueModal(index)"
                          >
                            Edit
                          </button>
                          <button
                            class="btn btn-sm btn-outline"
                            type="button"
                            @click="removeVenue(index)"
                          >
                            Remove
                          </button>
                          <button
                            v-if="venue.id"
                            class="btn btn-sm btn-error btn-outline"
                            type="button"
                            :disabled="deletingVenueId === venue.id"
                            @click="requestDeleteVenue(index)"
                          >
                            <span
                              v-if="deletingVenueId === venue.id"
                              class="loading loading-spinner loading-xs"
                            />
                            <span v-else>Delete Venue</span>
                          </button>
                        </div>
                      </div>
                      <div class="grid grid-cols-1 xl:grid-cols-3 gap-4 mt-2">
                        <div class="xl:col-span-2">
                          <VenueListItem
                            :venue="venue"
                            :title="venue.name || `Venue ${index + 1}`"
                            title-class="text-base font-semibold leading-tight"
                          >
                            <div class="flex flex-wrap gap-2 mt-2">
                              <span v-if="venue.hasGolf" class="badge badge-outline">Disc golf</span>
                              <span v-if="venue.hasAccuracy" class="badge badge-outline">Accuracy</span>
                              <span v-if="venue.hasDistance" class="badge badge-outline">Distance</span>
                              <span v-if="venue.hasSCF" class="badge badge-outline">SCF</span>
                              <span v-if="venue.hasDiscathon" class="badge badge-outline">Discathon</span>
                              <span v-if="venue.hasDDC" class="badge badge-outline">DDC</span>
                              <span v-if="venue.hasFreestyle" class="badge badge-outline">Freestyle</span>
                              <span
                                v-if="!venue.hasGolf && !venue.hasAccuracy && !venue.hasDistance && !venue.hasSCF && !venue.hasDiscathon && !venue.hasDDC && !venue.hasFreestyle"
                                class="badge badge-ghost"
                              >
                                No disciplines selected
                              </span>
                            </div>
                          </VenueListItem>
                        </div>

                        <div class="xl:col-span-1">
                          <ClientOnly>
                            <VenueMap
                              :lat="venue.lat"
                              :long="venue.long"
                              :title="venue.name || `Venue ${index + 1}`"
                              :has-golf="venue.hasGolf"
                              :has-accuracy="venue.hasAccuracy"
                              :has-distance="venue.hasDistance"
                              :has-scf="venue.hasSCF"
                              :has-discathon="venue.hasDiscathon"
                              :has-ddc="venue.hasDDC"
                              :has-freestyle="venue.hasFreestyle"
                              :fallback-center="tournamentCenter"
                              height="160px"
                              :numbered-marker="true"
                              :marker-index="index"
                            />
                          </ClientOnly>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </template>
          </VerticalTabsLayout>
        </div>
      </div>

      <div class="flex justify-end gap-2">
        <button
          class="btn btn-error btn-outline"
          :disabled="saving || deletingTournament"
          @click="requestDeleteTournament"
        >
          <span
            v-if="deletingTournament"
            class="loading loading-spinner loading-sm"
          />
          <span v-else>Delete Tournament</span>
        </button>
        <button
          v-if="!isTournamentClosed"
          class="btn btn-warning btn-outline"
          :disabled="saving || !canCloseTournament"
          @click="requestCloseTournament"
        >
          Close Tournament
        </button>
        <button
          type="button"
          class="btn btn-ghost"
          @click="cancelEdit"
        >
          Cancel
        </button>
        <button
          class="btn btn-primary"
          :disabled="saving"
          @click="saveTournament(false)"
        >
          <span
            v-if="saving"
            class="loading loading-spinner loading-sm"
          />
          <span v-else>Save Tournament</span>
        </button>
      </div>

      <dialog
        class="modal"
        :class="{ 'modal-open': showCloneTournamentModal }"
      >
        <div class="modal-box max-w-xl py-4">
          <FormHeader
            title="Clone Tournament"
            description="Create a new recurring tournament using this one as a template."
            title-tag="h3"
            title-class="text-lg font-bold"
            description-class="text-xs opacity-70"
            description-max-width-class="md:max-w-sm"
            wrapper-class="mb-1"
          />

          <div
            v-if="cloneTournamentError"
            class="alert alert-error mb-3"
          >
            <span>{{ cloneTournamentError }}</span>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <FormField
              label="New tournament name"
              required
              wrapper-class="md:col-span-2"
            >
              <input
                ref="cloneNameInput"
                v-model="cloneDraft.name"
                class="input input-bordered w-full"
                type="text"
                required
              >
            </FormField>

            <FormField
              label="Start Date"
              required
            >
              <input
                v-model="cloneDraft.startDate"
                class="input input-bordered w-full"
                type="date"
                required
              >
            </FormField>

            <FormField
              label="End Date"
              required
            >
              <input
                v-model="cloneDraft.endDate"
                class="input input-bordered w-full"
                type="date"
                required
              >
            </FormField>

            <div class="md:col-span-2 rounded-box border border-base-300/50 p-3">
              <ToggleField
                v-model="cloneDraft.includeVenues"
                label="Use venues from source tournament (disciplines are cloned too)"
                :stacked="false"
              />
            </div>
          </div>

          <div class="modal-action">
            <button
              class="btn btn-ghost"
              type="button"
              :disabled="cloningTournament"
              @click="cancelCloneTournament"
            >
              Cancel
            </button>
            <button
              class="btn btn-primary"
              type="button"
              :disabled="cloningTournament"
              @click="confirmCloneTournament"
            >
              <span
                v-if="cloningTournament"
                class="loading loading-spinner loading-sm"
              />
              <span v-else>Create Clone</span>
            </button>
          </div>
        </div>
        <div
          class="modal-backdrop"
          @click="cancelCloneTournament"
        />
      </dialog>

      <dialog
        class="modal"
        :class="{ 'modal-open': isVenueModalOpen }"
      >
        <div class="modal-box w-full max-w-6xl py-4">
          <FormHeader
            :title="venueModalTitle"
            :description="venueModalDescription"
            title-tag="h3"
            title-class="text-lg font-bold"
            description-class="text-xs opacity-70"
            description-max-width-class="md:max-w-md"
            wrapper-class="mb-1"
          />

          <div
            v-if="canToggleVenueEditScope"
            class="rounded-box border border-base-300/60 p-3 mb-3"
          >
            <p class="label-text mb-2">
              Edit scope
            </p>
            <div class="join w-full md:w-auto">
              <button
                class="btn join-item"
                :class="isTournamentVenueScope ? 'btn-primary' : 'btn-ghost'"
                type="button"
                @click="venueEditScope = 'tournament'"
              >
                This tournament
              </button>
              <button
                class="btn join-item"
                :class="!isTournamentVenueScope ? 'btn-primary' : 'btn-ghost'"
                type="button"
                @click="venueEditScope = 'global'"
              >
                Global record
              </button>
            </div>
          </div>

          <div
            v-if="canToggleVenueEditScope && isTournamentVenueScope"
            class="alert alert-info mb-3"
          >
            <span>
              Tournament mode: changes apply only to disciplines for this tournament. Global venue fields are read-only.
            </span>
          </div>

          <div
            v-else-if="canToggleVenueEditScope"
            class="alert alert-warning mb-3"
          >
            <span>
              Global mode: changing global venue fields updates all tournaments using this venue record.
            </span>
          </div>

          <div
            v-else-if="isAddingExistingVenue"
            class="alert alert-info mb-3"
          >
            <span>
              You are linking a reusable venue. Review details and select disciplines for this tournament.
            </span>
          </div>

          <div
            v-if="venueModalError"
            class="alert alert-error mb-3"
          >
            <span>{{ venueModalError }}</span>
          </div>

          <div
            v-if="venueDraft"
            class="grid grid-cols-1 md:grid-cols-2 gap-3"
          >
            <FormField
              label="Venue name"
              required
            >
              <input
                v-model="venueDraft.name"
                class="input input-bordered w-full"
                type="text"
                :disabled="shouldLockGlobalVenueFields"
                required
              >
            </FormField>
            <FormField
              label="Facilities"
            >
              <input
                v-model="venueDraft.facilities"
                class="input input-bordered w-full"
                type="text"
                :disabled="shouldLockGlobalVenueFields"
              >
            </FormField>
            <FormField
              label="Description"
              wrapper-class="md:col-span-2"
            >
              <textarea
                v-model="venueDraft.description"
                class="textarea textarea-bordered w-full"
                rows="2"
                :disabled="shouldLockGlobalVenueFields"
              />
            </FormField>

            <div class="md:col-span-2">
              <p class="label-text mb-1">
                Disciplines at this venue
              </p>
              <div class="rounded-box bg-base-100 p-2 md:p-3 grid grid-cols-3 md:grid-cols-4 gap-2 md:gap-3 border border-base-300/50">
                <ToggleField
                  v-model="venueDraft.hasGolf"
                  :label="disciplineByKey.hasGolf.label"
                  :icon="disciplineByKey.hasGolf.icon"
                  :desktop-inline="true"
                  :disabled="!form.hasGolf"
                  :tooltip="!form.hasGolf ? `Enable ${disciplineByKey.hasGolf.label} at tournament level first.` : ''"
                />
                <ToggleField
                  v-model="venueDraft.hasAccuracy"
                  :label="disciplineByKey.hasAccuracy.label"
                  :icon="disciplineByKey.hasAccuracy.icon"
                  :desktop-inline="true"
                  :disabled="!form.hasAccuracy"
                  :tooltip="!form.hasAccuracy ? `Enable ${disciplineByKey.hasAccuracy.label} at tournament level first.` : ''"
                />
                <ToggleField
                  v-model="venueDraft.hasDistance"
                  :label="disciplineByKey.hasDistance.label"
                  :icon="disciplineByKey.hasDistance.icon"
                  :desktop-inline="true"
                  :disabled="!form.hasDistance"
                  :tooltip="!form.hasDistance ? `Enable ${disciplineByKey.hasDistance.label} at tournament level first.` : ''"
                />
                <ToggleField
                  v-model="venueDraft.hasSCF"
                  :label="disciplineByKey.hasSCF.label"
                  :icon="disciplineByKey.hasSCF.icon"
                  :desktop-inline="true"
                  :disabled="!form.hasSCF"
                  :tooltip="!form.hasSCF ? `Enable ${disciplineByKey.hasSCF.label} at tournament level first.` : ''"
                />
                <ToggleField
                  v-model="venueDraft.hasDiscathon"
                  :label="disciplineByKey.hasDiscathon.label"
                  :icon="disciplineByKey.hasDiscathon.icon"
                  :desktop-inline="true"
                  :disabled="!form.hasDiscathon"
                  :tooltip="!form.hasDiscathon ? `Enable ${disciplineByKey.hasDiscathon.label} at tournament level first.` : ''"
                />
                <ToggleField
                  v-model="venueDraft.hasDDC"
                  :label="disciplineByKey.hasDDC.label"
                  :icon="disciplineByKey.hasDDC.icon"
                  :desktop-inline="true"
                  :disabled="!form.hasDDC"
                  :tooltip="!form.hasDDC ? `Enable ${disciplineByKey.hasDDC.label} at tournament level first.` : ''"
                />
                <ToggleField
                  v-model="venueDraft.hasFreestyle"
                  :label="disciplineByKey.hasFreestyle.label"
                  :icon="disciplineByKey.hasFreestyle.icon"
                  :desktop-inline="true"
                  :disabled="!form.hasFreestyle"
                  :tooltip="!form.hasFreestyle ? `Enable ${disciplineByKey.hasFreestyle.label} at tournament level first.` : ''"
                />
              </div>
            </div>

            <FormField label="Latitude" required>
              <input
                v-model.number="venueDraft.lat"
                class="input input-bordered w-full"
                type="number"
                step="0.000001"
                :disabled="shouldLockGlobalVenueFields"
                required
              >
            </FormField>
            <FormField label="Longitude" required>
              <input
                v-model.number="venueDraft.long"
                class="input input-bordered w-full"
                type="number"
                step="0.000001"
                :disabled="shouldLockGlobalVenueFields"
                required
              >
            </FormField>

            <div class="md:col-span-2">
              <p class="text-sm opacity-70 mb-1">
                {{ shouldLockGlobalVenueFields ? 'Location is managed in global mode.' : 'Click map to set this venue location' }}
              </p>
              <ClientOnly>
                <VenueMap
                  :lat="venueDraft.lat"
                  :long="venueDraft.long"
                  :title="venueDraft.name || 'Venue'"
                  :has-golf="venueDraft.hasGolf"
                  :has-accuracy="venueDraft.hasAccuracy"
                  :has-distance="venueDraft.hasDistance"
                  :has-scf="venueDraft.hasSCF"
                  :has-discathon="venueDraft.hasDiscathon"
                  :has-ddc="venueDraft.hasDDC"
                  :has-freestyle="venueDraft.hasFreestyle"
                  :fallback-center="tournamentCenter"
                  height="220px"
                  :clickable="true"
                  @map-click="onVenueModalMapClick"
                />
              </ClientOnly>
            </div>
          </div>

          <div class="modal-action">
            <button
              class="btn btn-ghost"
              type="button"
              @click="closeVenueModal"
            >
              Discard
            </button>
            <button
              class="btn btn-ghost"
              type="button"
              @click="closeVenueModalWithSave"
            >
              Close
            </button>
            <button
              class="btn btn-primary"
              type="button"
              @click="saveVenueFromModal"
            >
              {{ venueModalPrimaryActionLabel }}
            </button>
          </div>
        </div>
        <div
          class="modal-backdrop"
          @click="closeVenueModalWithSave"
        />
      </dialog>

      <ConfirmationModal
        :open="showLeaveConfirmModal"
        :title="modalTitle"
        :message="modalMessage"
        :confirm-text="modalConfirmText"
        :cancel-text="modalCancelText"
        :is-dangerous="true"
        @confirm="confirmLeavePage"
        @cancel="cancelLeavePage"
      />

      <ConfirmationModal
        :open="showDisciplineDisableModal"
        title="Disable discipline?"
        :message="`You already have ${pendingDisableVenueCount} venue${pendingDisableVenueCount === 1 ? '' : 's'} using ${pendingDisableDiscipline?.label || 'this discipline'}. Continue? This will remove it from those venue settings.`"
        confirm-text="Continue"
        cancel-text="Cancel"
        :is-dangerous="true"
        @confirm="confirmDisableDiscipline"
        @cancel="cancelDisableDiscipline"
      />

      <ConfirmationModal
        :open="showCloseTournamentModal"
        title="Close tournament?"
        message="Closing a tournament marks it as closed for normal management operations. This does not change the end date."
        confirm-text="Close Tournament"
        cancel-text="Cancel"
        :is-dangerous="true"
        @confirm="confirmCloseTournament"
        @cancel="cancelCloseTournament"
      />

      <ConfirmationModal
        :open="showDeleteVenueModal"
        title="Delete venue?"
        :message="`Delete ${pendingDeleteVenue?.name || 'this venue'} permanently? This cannot be undone.`"
        confirm-text="Delete Venue"
        cancel-text="Cancel"
        :is-dangerous="true"
        @confirm="confirmDeleteVenue"
        @cancel="cancelDeleteVenue"
      />

      <ConfirmationModal
        :open="showDeleteTournamentModal"
        title="Delete tournament?"
        message="This permanently deletes the tournament and all its links. This action cannot be undone."
        confirm-text="Delete Tournament"
        cancel-text="Cancel"
        :is-dangerous="true"
        @confirm="confirmDeleteTournament"
        @cancel="cancelDeleteTournament"
      />
    </div>
  </div>
</template>
