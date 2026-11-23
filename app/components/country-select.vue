<script setup lang="ts">
import { countryCoordinates } from "~/utils/country-coordinates";

type CountryOption = {
  code: string;
  name: string;
};

type Props = {
  modelValue: string;
  id?: string;
  placeholder?: string;
  disabled?: boolean;
  size?: "sm" | "md";
};

withDefaults(defineProps<Props>(), {
  placeholder: "Select country",
  disabled: false,
  size: "md",
});

const emit = defineEmits<{
  (event: "update:modelValue", value: string): void;
}>();

const fallbackCountryCodes = Object.keys(countryCoordinates);
const alpha2Candidates = (() => {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const values: string[] = [];

  for (const first of letters) {
    for (const second of letters) {
      values.push(`${first}${second}`);
    }
  }

  return values;
})();

const countryOptions = computed<CountryOption[]>(() => {
  if (typeof Intl.DisplayNames !== "function") {
    return fallbackCountryCodes
      .map(code => ({ code, name: code }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  const displayNames = new Intl.DisplayNames(["en"], { type: "region" });

  const options = alpha2Candidates
    .filter((code): code is string => /^[A-Z]{2}$/.test(code))
    .map((code) => {
      const name = displayNames.of(code);
      return {
        code,
        name: name && name !== code ? name : "",
      };
    })
    .filter(option => !/^Unknown Region/i.test(option.name))
    .filter(option => option.name.length > 0)
    .sort((a, b) => a.name.localeCompare(b.name));

  if (options.length > 0) {
    return options;
  }

  return fallbackCountryCodes
    .map((code) => {
      const name = displayNames.of(code);
      return {
        code,
        name: name && name !== code ? name : code,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
});

const selectOptions = computed(() =>
  countryOptions.value.map(country => ({
    value: country.name,
    label: country.name,
  })),
);
</script>

<template>
  <SearchableSelect
    :id="id"
    :model-value="modelValue"
    :options="selectOptions"
    :placeholder="placeholder"
    :disabled="disabled"
    :size="size"
    autocomplete="country-name"
    empty-text="No matching country"
    @update:model-value="emit('update:modelValue', $event)"
  />
</template>
