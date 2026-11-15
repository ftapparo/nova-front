import { useState } from "react";
import { Link as RouterLink } from "react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Link from "@mui/material/Link";
import Stack from "@mui/material/Stack";
import { applyValidationErrors } from "@/core/api/formErrors";
import { errorMessage } from "@/core/api/http";
import { startSession } from "@/core/session/sessionStore";
import FormPasswordField from "@/core/ui/components/form/FormPasswordField";
import FormTextField from "@/core/ui/components/form/FormTextField";
import { confirmPasswordRecovery, requestPasswordRecovery } from "./authApi";
import { emailSchema, newPasswordFields, PASSWORDS_MISMATCH, passwordsMatch } from "./authSchemas";
import AuthLayout from "./components/AuthLayout";

const requestSchema = z.object({ email: emailSchema });
type RequestValues = z.infer<typeof requestSchema>;

const confirmSchema = z
  .object({
    code: z.string().regex(/^\d{6}$/, "O código tem 6 dígitos."),
    ...newPasswordFields,
  })
  .refine(passwordsMatch, PASSWORDS_MISMATCH);
type ConfirmValues = z.infer<typeof confirmSchema>;

function RequestCodeForm({ onSent }: { onSent: (email: string) => void }) {
  const { control, handleSubmit, setError } = useForm<RequestValues>({
    resolver: zodResolver(requestSchema),
    defaultValues: { email: "" },
  });

  const request = useMutation({
    mutationFn: ({ email }: RequestValues) => requestPasswordRecovery(email),
    onSuccess: (_data, { email }) => onSent(email),
    onError: (error) => {
      applyValidationErrors(error, setError, ["email"]);
    },
  });

  return (
    <Stack component="form" spacing={2} noValidate onSubmit={handleSubmit((values) => request.mutate(values))}>
      <FormTextField control={control} name="email" label="E-mail" type="email" autoComplete="username" autoFocus />
      {request.isError && <Alert severity="error">{errorMessage(request.error)}</Alert>}
      <Button type="submit" variant="contained" size="large" loading={request.isPending}>
        Enviar código
      </Button>
    </Stack>
  );
}

function ConfirmCodeForm({ email }: { email: string }) {
  const { control, handleSubmit, setError } = useForm<ConfirmValues>({
    resolver: zodResolver(confirmSchema),
    defaultValues: { code: "", newPassword: "", confirmPassword: "" },
  });

  // A confirmação devolve uma sessão: com ela guardada, a guarda das rotas
  // públicas leva direto para o painel.
  const confirm = useMutation({
    mutationFn: ({ code, newPassword }: ConfirmValues) => confirmPasswordRecovery({ email, code, newPassword }),
    onSuccess: startSession,
    onError: (error) => {
      applyValidationErrors(error, setError, ["code", "newPassword"]);
    },
  });

  return (
    <Stack component="form" spacing={2} noValidate onSubmit={handleSubmit((values) => confirm.mutate(values))}>
      {/* O servidor responde igual exista ou não a conta; o texto não pode afirmar que o e-mail foi enviado. */}
      <Alert severity="info">
        Se houver uma conta com o e-mail {email}, enviamos um código de 6 dígitos, válido por 15 minutos.
      </Alert>
      <FormTextField
        control={control}
        name="code"
        label="Código"
        autoComplete="one-time-code"
        autoFocus
        slotProps={{ htmlInput: { inputMode: "numeric", maxLength: 6 } }}
      />
      <FormPasswordField
        control={control}
        name="newPassword"
        label="Nova senha"
        autoComplete="new-password"
        helperText="Pelo menos 8 caracteres."
      />
      <FormPasswordField control={control} name="confirmPassword" label="Repita a nova senha" autoComplete="new-password" />
      {confirm.isError && <Alert severity="error">{errorMessage(confirm.error)}</Alert>}
      <Button type="submit" variant="contained" size="large" loading={confirm.isPending}>
        Redefinir senha e entrar
      </Button>
    </Stack>
  );
}

export default function RecoverPasswordPage() {
  const [email, setEmail] = useState<string | null>(null);

  return (
    <AuthLayout
      title="Recuperar senha"
      subtitle={email ? undefined : "Informe o e-mail da sua conta para receber um código."}
    >
      <Stack spacing={2}>
        {email ? <ConfirmCodeForm email={email} /> : <RequestCodeForm onSent={setEmail} />}
        <Link component={RouterLink} to="/login" variant="body2" sx={{ alignSelf: "center" }}>
          Voltar para o login
        </Link>
      </Stack>
    </AuthLayout>
  );
}
