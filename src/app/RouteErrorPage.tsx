import { useEffect } from "react";
import { useRouteError } from "react-router";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import ErrorState from "@/core/ui/components/ErrorState";
import PageContainer from "@/core/ui/layout/PageContainer";

/**
 * Erro inesperado ao montar uma tela. O menu continua disponível; o detalhe
 * técnico vai só para o console, nunca para a tela do operador.
 */
export default function RouteErrorPage() {
  const error = useRouteError();

  useEffect(() => {
    console.error("[tela] Erro inesperado:", error);
  }, [error]);

  return (
    <PageContainer>
      <ErrorState
        title="Algo deu errado nesta tela"
        description="Recarregue a página. Se o erro continuar, avise a administração do painel."
      />
      <Stack sx={{ alignItems: "center" }}>
        <Button variant="contained" onClick={() => window.location.reload()}>
          Recarregar
        </Button>
      </Stack>
    </PageContainer>
  );
}
