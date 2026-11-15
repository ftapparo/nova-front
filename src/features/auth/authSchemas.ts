import { z } from "zod";

export const emailSchema = z.email("Informe um e-mail válido.");

// Mínimo exigido pela API. As demais regras de senha são do servidor, que
// responde com a mensagem quando recusa.
const newPasswordSchema = z.string().min(8, "A senha precisa ter pelo menos 8 caracteres.");

/** Nova senha + confirmação, para troca e para recuperação. */
export const newPasswordFields = {
  newPassword: newPasswordSchema,
  confirmPassword: z.string().min(1, "Repita a nova senha."),
};

export const passwordsMatch = (values: { newPassword: string; confirmPassword: string }) =>
  values.newPassword === values.confirmPassword;

export const PASSWORDS_MISMATCH = { message: "As senhas não conferem.", path: ["confirmPassword"] };
