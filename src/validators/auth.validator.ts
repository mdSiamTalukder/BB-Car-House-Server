import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("A valid email address is required.")),
  password: z.string().min(1, "Password is required.").max(128)
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required.").max(128),
    newPassword: z
      .string()
      .min(8, "New password must be at least 8 characters long.")
      .max(128, "New password must be at most 128 characters long.")
      .regex(/[a-z]/, "New password must contain a lowercase letter.")
      .regex(/[A-Z]/, "New password must contain an uppercase letter.")
      .regex(/[0-9]/, "New password must contain a number.")
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: "New password must be different from the current password.",
    path: ["newPassword"]
  });

export const updateProfileSchema = z
  .object({
    name: z.string().trim().min(2, "Name must be at least 2 characters.").max(120)
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided."
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;