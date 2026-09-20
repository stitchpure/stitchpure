import { z } from "zod";

export const registerSchema = z.object({
  // Single-company build: the `company` block is optional and ignored by the
  // server (new users always join the one seeded company). Kept optional so
  // any older client that still sends it does not break.
  company: z
    .object({
      name: z.string().max(150).optional(),
      slug: z.string().max(150).optional(),
      email: z.string().optional(),
      phone: z.string().optional(),
    })
    .optional(),

  owner: z.object({
    name: z
      .string()
      .min(2, "Owner name must be at least 2 characters")
      .max(120, "Owner name cannot exceed 120 characters"),

    email: z.string().email("Invalid owner email"),

    password: z
      .string()
      .min(8, "Password must be minimum 8 characters")
      .max(72, "Password cannot exceed 72 characters")
      .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
      .regex(/[a-z]/, "Password must contain at least one lowercase letter")
      .regex(/[0-9]/, "Password must contain at least one number")
      .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character"),
  }),
});

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),

  password: z.string().min(1, "Password is required"),
});

export type RegisterInput = z.infer<typeof registerSchema>;

export type LoginInput = z.infer<typeof loginSchema>;
