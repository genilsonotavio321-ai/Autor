import { z } from "zod";

export const projectFormSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Informe um título")
    .max(200, "Máximo de 200 caracteres"),
  subtitle: z.string().trim().max(300, "Máximo de 300 caracteres").optional(),
  author: z.string().trim().max(120, "Máximo de 120 caracteres").optional(),
  description: z
    .string()
    .trim()
    .max(5000, "Máximo de 5000 caracteres")
    .optional(),
  status: z.enum(["draft", "active", "completed", "archived"]),
});

export type ProjectFormValues = z.infer<typeof projectFormSchema>;
