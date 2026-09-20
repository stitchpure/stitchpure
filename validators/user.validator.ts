import { z } from "zod";

import { Roles } from "@/types/role";

export const createUserSchema = z.object({
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(120, "Name must be at most 120 characters"),

  email: z.string().email("Invalid email address"),

  password: z.string().min(8, "Password must be at least 8 characters"),

  role: z
    .enum([Roles.OWNER, Roles.MANAGER, Roles.STAFF])
    .default(Roles.STAFF),
});

export const updateUserSchema = z.object({
  name: z.string().optional(),

  role: z.enum([Roles.OWNER, Roles.MANAGER, Roles.STAFF]).optional(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
