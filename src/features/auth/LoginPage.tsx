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
import { ApiError, errorMessage } from "@/core/api/http";
import { signIn } from "@/core/session/sessionActions";
import FormPasswordField from "@/core/ui/components/form/FormPasswordField";
import FormTextField from "@/core/ui/components/form/FormTextField";
import { useCooldown } from "@/core/ui/useCooldown";
import { emailSchema } from "./authSchemas";
import AuthLayout from "./components/AuthLayout";

const schema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Informe a senha."),
});

type LoginValues = z.infer<typeof schema>;

export default function LoginPage() {
  const { control, handleSubmit, setError } = useForm<LoginValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });
  const cooldown = useCooldown();

  // Sem navegação aqui: quando a sessão passa a existir, a guarda das rotas
  // públicas leva para o painel (ou para a troca de senha provisória).
  const login = useMutation({
    mutationFn: ({ email, password }: LoginValues) => signIn(email, password),
    onError: (error) => {
      applyValidationErrors(error, setError, ["email", "password"]);
      if (error instanceof ApiError && error.type === "rate-limited" && error.retryAfterSeconds) {
        cooldown.start(error.retryAfterSeconds);
      }
    },
  });

  const waiting = cooldown.remainingSeconds > 0;

  return (
    <AuthLayout title="Portal Administrativo" subtitle="Portaria e Zeladoria">
      <Stack component="form" spacing={2} noValidate onSubmit={handleSubmit((values) => login.mutate(values))}>
        <FormTextField control={control} name="email" label="E-mail" type="email" autoComplete="username" autoFocus />
        <FormPasswordField control={control} name="password" label="Senha" autoComplete="current-password" />

        {login.isError && <Alert severity="error">{errorMessage(login.error)}</Alert>}

        <Button type="submit" variant="contained" size="large" loading={login.isPending} disabled={waiting}>
          {waiting ? `Aguarde ${cooldown.remainingSeconds} s` : "Entrar"}
        </Button>

        <Link component={RouterLink} to="/recuperar-senha" variant="body2" sx={{ alignSelf: "center" }}>
          Esqueci minha senha
        </Link>
      </Stack>
    </AuthLayout>
  );
}
