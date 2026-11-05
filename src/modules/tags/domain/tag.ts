export const tagColors = ["purple", "blue", "pink", "orange", "green", "gray"] as const;
export type TagColor = (typeof tagColors)[number];

export interface Tag {
  id: string;
  userId: string;
  name: string;
  color: TagColor;
  createdAt: Date;
  updatedAt: Date;
}
