import { useState } from "react";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import VisibilityOffOutlined from "@mui/icons-material/VisibilityOffOutlined";
import VisibilityOutlined from "@mui/icons-material/VisibilityOutlined";
import type { FieldValues } from "react-hook-form";
import FormTextField, { type FormTextFieldProps } from "./FormTextField";

/** Campo de senha com o botão de mostrar/ocultar. */
export default function FormPasswordField<T extends FieldValues>(props: Omit<FormTextFieldProps<T>, "type">) {
  const [visible, setVisible] = useState(false);

  return (
    <FormTextField
      {...props}
      type={visible ? "text" : "password"}
      slotProps={{
        input: {
          endAdornment: (
            <InputAdornment position="end">
              <IconButton
                edge="end"
                aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
                onClick={() => setVisible((shown) => !shown)}
              >
                {visible ? <VisibilityOffOutlined /> : <VisibilityOutlined />}
              </IconButton>
            </InputAdornment>
          ),
        },
      }}
    />
  );
}
