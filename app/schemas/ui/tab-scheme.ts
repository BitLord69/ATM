import type { VerticalTabConfig } from "~/components/vertical-tabs-layout.vue";

export type TabDefinition = VerticalTabConfig;

export type BuiltTabScheme = {
  tabs: VerticalTabConfig[];
  fieldToTab: Record<string, string>;
  fieldsByTab: Record<string, string[]>;
};

type BuildTabSchemeOptions = {
  tabs: TabDefinition[];
  fields: string[];
  fieldOverrides?: Record<string, string>;
};

const CONTACT_HINTS = ["contact", "director", "email", "phone"];
const DISCIPLINE_HINTS = ["discipline", "hasgolf", "hasaccuracy", "hasdistance", "hasscf", "hasdiscathon", "hasddc", "hasfreestyle"];
const SCOPE_HINTS = ["organization", "organizations", "tournament", "tournaments", "selectedorganizations"];

function hasAnyHint(value: string, hints: string[]) {
  return hints.some(hint => value.includes(hint));
}

function findTabByHint(tabs: TabDefinition[], hints: string[]) {
  return tabs.find((tab) => {
    const label = tab.label.toLowerCase();
    const id = tab.id.toLowerCase();
    return hints.some(hint => label.includes(hint) || id.includes(hint));
  });
}

function pickDefaultTab(field: string, tabs: TabDefinition[]) {
  const normalized = field.replace(/[^a-z0-9]/gi, "").toLowerCase();

  if (hasAnyHint(normalized, CONTACT_HINTS)) {
    const contactTab = findTabByHint(tabs, ["contact", "contacts"]);
    if (contactTab) {
      return contactTab.id;
    }
  }

  if (hasAnyHint(normalized, DISCIPLINE_HINTS) || normalized.startsWith("has")) {
    const disciplineTab = findTabByHint(tabs, ["discipline", "disciplines"]);
    if (disciplineTab) {
      return disciplineTab.id;
    }
  }

  if (hasAnyHint(normalized, SCOPE_HINTS)) {
    const scopeTab = findTabByHint(tabs, ["scope", "tournament", "tournaments"]);
    if (scopeTab) {
      return scopeTab.id;
    }
  }

  return tabs[0]?.id || "general";
}

export function buildTabScheme(options: BuildTabSchemeOptions): BuiltTabScheme {
  const fieldToTab: Record<string, string> = {};
  const fieldsByTab: Record<string, string[]> = {};

  for (const tab of options.tabs) {
    fieldsByTab[tab.id] = [];
  }

  for (const field of options.fields) {
    const overriddenTabId = options.fieldOverrides?.[field];
    const tabId = overriddenTabId || pickDefaultTab(field, options.tabs);

    fieldToTab[field] = tabId;

    if (!fieldsByTab[tabId]) {
      fieldsByTab[tabId] = [];
    }
    fieldsByTab[tabId].push(field);
  }

  return {
    tabs: options.tabs,
    fieldToTab,
    fieldsByTab,
  };
}
