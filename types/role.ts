export const Roles = {
  SUPER_ADMIN: "SUPER_ADMIN",
  OWNER: "OWNER",
  MANAGER: "MANAGER",
  STAFF: "STAFF",
} as const;

export type Role = (typeof Roles)[keyof typeof Roles];
