import { Link } from "react-router";
import Button from "@mui/material/Button";
import EmptyState from "@/core/ui/components/EmptyState";
import PageContainer from "@/core/ui/layout/PageContainer";

export default function NotFoundPage() {
  return (
    <PageContainer>
      <EmptyState
        title="Página não encontrada"
        description="O endereço não existe ou foi movido."
        action={
          <Button component={Link} to="/" variant="contained" sx={{ mt: 1 }}>
            Ir para o Painel Operacional
          </Button>
        }
      />
    </PageContainer>
  );
}
