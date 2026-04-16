import { z } from "zod";

export const contactSchema = z.object({
  name: z.string().trim().min(2, "Ingresa un nombre valido.").max(80),
  email: z.string().trim().email("Ingresa un email valido."),
  company: z.string().trim().max(120).optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  teamSize: z.string().trim().max(40).optional().or(z.literal("")),
  challenge: z.string().trim().min(20, "Contanos un poco mas de tu necesidad.").max(1000),
  interest: z.enum(["demo", "diagnostico", "implementacion"])
});

export type ContactPayload = z.infer<typeof contactSchema>;
