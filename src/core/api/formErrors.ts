import type { FieldValues, Path, UseFormSetError } from "react-hook-form";
import { ApiError } from "./http";

/**
 * Leva os `validationErrors` do servidor para os campos do formulário.
 * Devolve false quando nenhum erro caiu em campo conhecido — aí quem chamou
 * mostra a mensagem geral.
 */
export function applyValidationErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  fields: readonly Path<T>[],
): boolean {
  if (!(error instanceof ApiError) || error.type !== "validation-error") return false;

  let applied = false;
  for (const { path, message } of error.validationErrors) {
    // O servidor manda JSON Pointer ("/email"); os campos aqui não têm barra.
    const field = fields.find((name) => `/${name}` === path);
    if (!field) continue;
    setError(field, { type: "server", message });
    applied = true;
  }
  return applied;
}
