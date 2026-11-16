import { useState } from "react";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Button from "@mui/material/Button";
import LinearProgress from "@mui/material/LinearProgress";
import Stack from "@mui/material/Stack";
import AddOutlined from "@mui/icons-material/AddOutlined";
import { errorMessage } from "@/core/api/http";
import { useSession } from "@/core/session/useSession";
import ConfirmDialog from "@/core/ui/components/ConfirmDialog";
import EmptyState from "@/core/ui/components/EmptyState";
import ErrorState from "@/core/ui/components/ErrorState";
import { useNotify } from "@/core/ui/components/useNotify";
import PageContainer from "@/core/ui/layout/PageContainer";
import PageHeader from "@/core/ui/layout/PageHeader";
import CarouselTtlDialog from "./components/CarouselTtlDialog";
import MessageCard, { type MessageAction } from "./components/MessageCard";
import NewMessageDialog from "./components/NewMessageDialog";
import {
  archiveMessage,
  fetchMessages,
  MESSAGES_PAGE_SIZE,
  setMessageCarouselTtl,
  setMessagePinned,
  type CondoMessage,
} from "./messagesApi";

const MESSAGES_KEY = ["messages"] as const;

type OpenDialog = { kind: "new" } | { kind: "ttl" | "archive"; message: CondoMessage } | null;

export default function MessagesPage() {
  const notify = useNotify();
  const queryClient = useQueryClient();
  const role = useSession()?.user.role;
  const canManage = role === "sindico" || role === "admin";
  const [dialog, setDialog] = useState<OpenDialog>(null);

  const messages = useInfiniteQuery({
    queryKey: MESSAGES_KEY,
    queryFn: ({ pageParam, signal }) => fetchMessages(pageParam, signal),
    initialPageParam: 0,
    // A API não informa o total no data: página cheia indica que pode haver mais.
    getNextPageParam: (last, pages) =>
      last.items.length === MESSAGES_PAGE_SIZE ? pages.length * MESSAGES_PAGE_SIZE : undefined,
  });
  const items = messages.data?.pages.flatMap((page) => page.items) ?? [];
  const refresh = () => void queryClient.invalidateQueries({ queryKey: MESSAGES_KEY });

  const update = useMutation({
    mutationFn: ({ message, action, hours }: { message: CondoMessage; action: "pin" | "unpin" | "ttl"; hours?: number }) =>
      action === "ttl" ? setMessageCarouselTtl(message.id, hours ?? 0) : setMessagePinned(message.id, action === "pin"),
    onSuccess: (_data, { action }) => {
      notify.success(action === "pin" ? "Fixado no carrossel." : action === "unpin" ? "Desafixado do carrossel." : "Tempo no carrossel alterado.");
      refresh();
      setDialog(null);
    },
    onError: (error) => notify.error(errorMessage(error)),
  });
  const archive = useMutation({
    mutationFn: (message: CondoMessage) => archiveMessage(message.id),
    onSuccess: () => {
      notify.success("Comunicado arquivado.");
      refresh();
      setDialog(null);
    },
    onError: (error) => notify.error(errorMessage(error)),
  });

  const onAction = (message: CondoMessage, action: MessageAction) => {
    if (action === "pin" || action === "unpin") update.mutate({ message, action });
    else setDialog({ kind: action, message });
  };

  return (
    <PageContainer>
      <PageHeader
        title="Comunicados"
        subtitle="Avisos do condomínio exibidos no aplicativo dos moradores."
        actions={
          canManage && (
            <Button variant="contained" startIcon={<AddOutlined />} onClick={() => setDialog({ kind: "new" })}>
              Novo comunicado
            </Button>
          )
        }
      />

      {messages.isPending && <LinearProgress aria-label="Carregando os comunicados" />}
      {messages.isError && <ErrorState description={errorMessage(messages.error)} onRetry={() => void messages.refetch()} />}
      {messages.isSuccess && items.length === 0 && (
        <EmptyState title="Nenhum comunicado publicado" description="Agendados aparecem aqui quando chegar a data de publicação." />
      )}

      <Stack spacing={2}>
        {items.map((message) => (
          <MessageCard key={message.id} message={message} canManage={canManage} onAction={(action) => onAction(message, action)} />
        ))}
      </Stack>
      {messages.hasNextPage && (
        <Stack sx={{ alignItems: "center" }}>
          <Button onClick={() => void messages.fetchNextPage()} loading={messages.isFetchingNextPage}>
            Carregar mais
          </Button>
        </Stack>
      )}

      {dialog?.kind === "new" && <NewMessageDialog onPublished={refresh} onClose={() => setDialog(null)} />}
      {dialog?.kind === "ttl" && (
        <CarouselTtlDialog
          message={dialog.message}
          saving={update.isPending}
          onSave={(hours) => update.mutate({ message: dialog.message, action: "ttl", hours })}
          onClose={() => setDialog(null)}
        />
      )}
      <ConfirmDialog
        open={dialog?.kind === "archive"}
        tone="danger"
        title="Arquivar comunicado"
        description={
          dialog?.kind === "archive"
            ? `"${dialog.message.title}" some da lista e do aplicativo dos moradores. O registro fica guardado.`
            : ""
        }
        confirmLabel="Arquivar"
        loading={archive.isPending}
        onConfirm={() => dialog?.kind === "archive" && archive.mutate(dialog.message)}
        onClose={() => setDialog(null)}
      />
    </PageContainer>
  );
}
