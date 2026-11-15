import ConstructionOutlined from "@mui/icons-material/ConstructionOutlined";
import EmptyState from "@/core/ui/components/EmptyState";
import PageContainer from "@/core/ui/layout/PageContainer";
import PageHeader from "@/core/ui/layout/PageHeader";

/** Ocupa a rota de um menu cuja tela ainda não foi construída. */
export default function PlaceholderPage({ title }: { title: string }) {
  return (
    <PageContainer>
      <PageHeader title={title} />
      <EmptyState
        icon={<ConstructionOutlined fontSize="large" />}
        title="Tela em construção"
        description="Esta área do painel ainda não está disponível."
      />
    </PageContainer>
  );
}
