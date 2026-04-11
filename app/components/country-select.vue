<script setup lang="ts">
import { countryCoordinates } from "~/utils/country-coordinates";

type CountryOption = {
  code: string;
  name: string;
};

type Props = {
  modelValue: string;
  placeholder?: string;
  disabled?: boolean;
};

const props = withDefaults(defineProps<Props>(), {
  placeholder: "Select country",
  disabled: false,
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

const optionNames = computed(() => new Set(countryOptions.value.map(option => option.name)));
const hasCustomValue = computed(() => !!props.modelValue && !optionNames.value.has(props.modelValue));

function onChange(event: Event) {
  emit("update:modelValue", (event.target as HTMLSelectElement).value);
}
</script>

<template>
  <select
    class="select select-bordered w-full bg-base-100 text-base-content border-base-300 hover:border-base-content/40 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
    :value="modelValue"
    :disabled="disabled"
    @change="onChange"
  >
    <option value="">
      {{ placeholder }}
    </option>
    <option
      v-if="hasCustomValue"
      :value="modelValue"
    >
      {{ modelValue }}
    </option>
    <option
      v-for="country in countryOptions"
      :key="country.code"
      :value="country.name"
    >
      {{ country.name }}
    </option>
  </select>
</template>
