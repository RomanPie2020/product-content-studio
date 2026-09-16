import { z } from "zod";

export const loginSchema = z.object({
  email: z.email({ message: "Введіть коректну електронну адресу" }),
  password: z.string().min(1, { message: "Введіть пароль" }),
});

export type LoginInput = z.infer<typeof loginSchema>;
