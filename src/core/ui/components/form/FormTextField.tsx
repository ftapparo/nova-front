import TextField, { type TextFieldProps } from "@mui/material/TextField";
import { useController, type Control, type FieldValues, type Path } from "react-hook-form";

export type FormTextFieldProps<T extends FieldValues> = Omit<TextFieldProps, "name" | "value" | "error" | "inputRef"> & {
  control: Control<T>;
  name: Path<T>;
};

/** TextField ligado a um campo do React Hook Form, já mostrando o erro dele. */
export default function FormTextField<T extends FieldValues>({
  control,
  name,
  helperText,
  ...textFieldProps
}: FormTextFieldProps<T>) {
  const { field, fieldState } = useController({ control, name });
  // O ref do campo vai para o <input> (inputRef), não para o contêiner do
  // TextField: é nele que o React Hook Form dá foco quando a validação falha.
  const { ref, ...fieldProps } = field;

  return (
    <TextField
      fullWidth
      {...textFieldProps}
      {...fieldProps}
      inputRef={ref}
      error={Boolean(fieldState.error)}
      helperText={fieldState.error?.message ?? helperText}
    />
  );
}
