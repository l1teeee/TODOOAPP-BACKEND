import type {
  ActivitiesExtensionPoints,
  ActivityFilterExtension,
  ActivityViewExtension,
  ActivityWriteExtension,
} from "./public.js";

const coreViewFields = [
  "id",
  "kind",
  "title",
  "description",
  "status",
  "scheduledDate",
  "startTime",
  "endTime",
  "location",
  "icon",
  "completedAt",
  "deletedAt",
  "createdAt",
  "updatedAt",
];
const coreFilterParams = ["from", "to", "unscheduled", "kind", "status", "q", "limit", "cursor"];
const coreWriteFields = [
  "kind",
  "title",
  "description",
  "status",
  "scheduledDate",
  "startTime",
  "endTime",
  "location",
  "icon",
];

export interface ExtensionRegistry extends ActivitiesExtensionPoints {
  views(): readonly ActivityViewExtension<unknown>[];
  filters(): readonly ActivityFilterExtension[];
  writes(): readonly ActivityWriteExtension<unknown>[];
  freeze(): void;
}

export function createExtensionPoints(): ExtensionRegistry {
  const views: ActivityViewExtension<unknown>[] = [];
  const filters: ActivityFilterExtension[] = [];
  const writes: ActivityWriteExtension<unknown>[] = [];
  const viewFields = new Set(coreViewFields);
  const filterParams = new Set(coreFilterParams);
  const writeFields = new Set(coreWriteFields);
  let frozen = false;

  function register(names: Set<string>, name: string): void {
    if (frozen) {
      throw new Error("Activity extensions must be registered before routes");
    }
    if (names.has(name)) {
      throw new Error(`Activity extension name already registered or reserved: ${name}`);
    }
    names.add(name);
  }

  return {
    addView(e) {
      register(viewFields, e.field);
      views.push(e);
    },
    addFilter(e) {
      register(filterParams, e.param);
      filters.push(e);
    },
    addWrite(e) {
      register(writeFields, e.field);
      writes.push(e);
    },
    views() {
      return views;
    },
    filters() {
      return filters;
    },
    writes() {
      return writes;
    },
    freeze() {
      frozen = true;
    },
  };
}
