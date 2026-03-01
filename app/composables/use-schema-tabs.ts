import type { VerticalTabConfig } from "~/components/vertical-tabs-layout.vue";

type UseSchemaTabsOptions<TTabId extends string> = {
  tabs: VerticalTabConfig[];
  defaultTab: TTabId;
  fieldToTab?: Record<string, TTabId>;
};

export function useSchemaTabs<TTabId extends string>(options: UseSchemaTabsOptions<TTabId>) {
  const activeTab = ref<TTabId>(options.defaultTab);

  function setActiveTab(tabId: TTabId) {
    if (!options.tabs.some(tab => tab.id === tabId)) {
      return;
    }
    activeTab.value = tabId;
  }

  function openTabForField(field: string | null | undefined) {
    if (!field || !options.fieldToTab) {
      return;
    }

    const tabId = options.fieldToTab[field];
    if (tabId) {
      setActiveTab(tabId);
    }
  }

  return {
    activeTab,
    setActiveTab,
    openTabForField,
  };
}
