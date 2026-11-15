import { useMutation } from "@tanstack/react-query";
import Button from "@mui/material/Button";
import { signOut } from "@/core/session/sessionActions";

/** "Sair" das telas de pendência (troca de senha, conta sem acesso). */
export default function SignOutButton() {
  const logout = useMutation({ mutationFn: signOut });

  return (
    <Button color="inherit" loading={logout.isPending} onClick={() => logout.mutate()}>
      Sair
    </Button>
  );
}
