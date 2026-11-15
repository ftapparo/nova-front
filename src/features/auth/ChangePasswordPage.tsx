import { useNavigate } from "react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import { applyValidationErrors } from "@/core/api/formErrors";
import { errorMessage } from "@/core/api/http";
import { startSession } from "@/core/session/sessionStore";
import { useSession } from "@/core/session/useSession";
import FormPasswordField from "@/core/ui/components/form/FormPasswordField";
import { useNotify } from "@/core/ui/components/useNotify";
import { changePassword } from "./authApi";
import { newPasswordFields, PASSWORDS_MISMATCH, passwordsMatch } from "./authSchemas";
import AuthLayout from "./components/AuthLayout";
import SignOutButton from "./components/SignOutButton";

const schema = z
  .object({ currentPassword: z.string().min(1, "Informe a senha atual."), ...newPasswordFields })
  .refine(passwordsMatch, PASSWORDS_MISMATCH);

type ChangePasswordValues = z.infer<typeof schema>;

export default function ChangePasswordPage() {
  const session = useSession();
  const navigate = useNavigate();
  const notify = useNotify();
  // Senha provisória (reset feito pela equipe): a troca é obrigatória e a
  // "senha atual" é a provisória que a pessoa recebeu.
  const forced = session?.user.mustChangePassword ?? false;

  const { control, handleSubmit, setError } = useForm<ChangePasswordValues>({
    resolver: zodResolver(schema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });

  const change = useMutation({
    mutationFn: (values: ChangePasswordValues) => changePassword(values.currentPassword, values.newPassword),
    onSuccess: (data) => {
      // A resposta é uma sessão nova, já sem a pendência de troca.
      startSession(data);
      notify.success("Senha alterada.");
      void navigate("/", { replace: true });
    },
    onError: (error) => {
      applyValidationErrors(error, setError, ["currentPassword", "newPassword"]);
    },
  });

  return (
    <AuthLayout
      title={forced ? "Defina uma nova senha" : "Trocar senha"}
      subtitle={session?.user.email ?? undefined}
    >
      <Stack component="form" spacing={2} noValidate onSubmit={handleSubmit((values) => change.mutate(values))}>
        {forced && (
          <Alert severity="info">
            Sua senha é provisória. Informe a senha provisória que você recebeu e escolha uma nova para continuar.
          </Alert>
        )}

        <FormPasswordField
          control={control}
          name="currentPassword"
          label={forced ? "Senha provisória" : "Senha atual"}
          autoComplete="current-password"
          autoFocus
        />
        <FormPasswordField
          control={control}
          name="newPassword"
          label="Nova senha"
          autoComplete="new-password"
          helperText="Pelo menos 8 caracteres."
        />
        <FormPasswordField
          control={control}
          name="confirmPassword"
          label="Repita a nova senha"
          autoComplete="new-password"
        />

        {change.isError && <Alert severity="error">{errorMessage(change.error)}</Alert>}

        <Button type="submit" variant="contained" size="large" loading={change.isPending}>
          Salvar nova senha
        </Button>
        <Stack direction="row" sx={{ justifyContent: "center" }}>
          {forced ? (
            <SignOutButton />
          ) : (
            <Button color="inherit" onClick={() => void navigate(-1)}>
              Voltar
            </Button>
          )}
        </Stack>
      </Stack>
    </AuthLayout>
  );
}
