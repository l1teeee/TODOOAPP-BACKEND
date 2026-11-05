import type {
  ActivitiesExtensionPoints,
  ActivityFilterExtension,
  ActivityViewExtension,
  ActivityWriteExtension,
} from "./public.js";

const coreNames = [
  "id",
  "userId",
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
  "from",
  "to",
  "unscheduled",
  "q",
  "limit",
  "cursor",
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
  const names = new Set(coreNames);
  let frozen = false;

  function register(name: string): void {
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
      register(e.field);
      views.push(e);
    },
    addFilter(e) {
      register(e.param);
      filters.push(e);
    },
    addWrite(e) {
      register(e.field);
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
