export interface Profile {
  id: string;
  email: string;
  displayName: string | null;
  timezone: string;
  emailNotifications: boolean;
  createdAt: Date;
  updatedAt: Date;
}
