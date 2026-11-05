import type { Activity } from "../../domain/activity.js";
import type { ExtensionRegistry } from "../../extension-points.js";

export function createActivityPresenter(extensions: ExtensionRegistry) {
  return async function presentActivities(userId: string, activities: readonly Activity[]) {
    const activityIds = activities.map((activity) => activity.id);
    const loaded = await Promise.all(
      extensions.views().map(async (extension) => ({
        extension,
        values: await extension.load({ userId, activityIds }),
      })),
    );
    return activities.map((activity) => {
      const viewFields: Record<string, unknown> = {};
      for (const { extension, values } of loaded) {
        viewFields[extension.field] = values.has(activity.id)
          ? values.get(activity.id)
          : extension.fallback;
      }
      return {
        ...activity,
        completedAt: activity.completedAt?.toISOString() ?? null,
        deletedAt: activity.deletedAt?.toISOString() ?? null,
        createdAt: activity.createdAt.toISOString(),
        updatedAt: activity.updatedAt.toISOString(),
        ...viewFields,
      };
    });
  };
}
