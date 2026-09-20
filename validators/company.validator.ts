import { z } from "zod";
import { GSTIN_REGEX, GSTIN_ERROR_MESSAGE } from "@/lib/gstin";

export const updateCompanySchema = z.object({
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(150, "Name must be at most 150 characters")
    .optional(),

  email: z.string().email("Invalid email address").optional(),

  phone: z
    .string()
    .min(10, "Phone must be at least 10 characters")
    .max(15, "Phone must be at most 15 characters")
    .optional(),

  logo: z
    .string()
    .max(500, "Logo URL must be at most 500 characters")
    .nullable()
    .optional(),

  gstin: z
    .string()
    .length(15)
    .regex(GSTIN_REGEX, GSTIN_ERROR_MESSAGE)
    .nullable()
    .optional(),
});

export type UpdateCompanyInput = z.infer<typeof updateCompanySchema>;
