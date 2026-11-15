import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import LinearProgress from "@mui/material/LinearProgress";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import AddOutlined from "@mui/icons-material/AddOutlined";
import { errorMessage } from "@/core/api/http";
import { formatCpf, onlyDigits } from "@/core/format/documents";
import ConfirmDialog from "@/core/ui/components/ConfirmDialog";
import EmptyState from "@/core/ui/components/EmptyState";
import ErrorState from "@/core/ui/components/ErrorState";
import SectionCard from "@/core/ui/components/SectionCard";
import StatusChip from "@/core/ui/components/StatusChip";
import { useNotify } from "@/core/ui/components/useNotify";
import PageContainer from "@/core/ui/layout/PageContainer";
import PageHeader from "@/core/ui/layout/PageHeader";
import { isAccessAllowed, verifyAccess } from "@/features/access/accessApi";
import { gatesListQuery, gateSentido } from "@/features/gates/gatesApi";
import PersonCard from "./components/PersonCard";
import { queryCpf, type CpfQuery } from "./queriesApi";
import AddVehicleDialog from "./components/AddVehicleDialog";
import TagDialog from "./components/TagDialog";
import VehiclesTable, { type VehicleAction } from "./components/VehiclesTable";
import { listVehicles, removeTag, unlinkOwner, type Vehicle } from "./vehiclesApi";

interface Owner {
  cpf: string;
  query: CpfQuery;
  /** Vínculo permite cadastrar veículo (mesma conferência da abertura de portão). */
  allowed: boolean;
}

type OpenDialog = { kind: "add" } | { kind: VehicleAction; vehicle: Vehicle } | null;

export default function VehiclesPage() {
  const notify = useNotify();
  const queryClient = useQueryClient();
  const [cpf, setCpf] = useState("");
  const [dialog, setDialog] = useState<OpenDialog>(null);

  // Portão de entrada usado na conferência e na validação da TAG, como no painel anterior.
  const gates = useQuery(gatesListQuery);
  const entryGate = gates.data?.find((gate) => gate.ativo && gateSentido(gate) === "E") ?? null;

  const search = useMutation({
    mutationFn: async (target: string): Promise<Owner> => {
      const query = await queryCpf(target);
      if (!query.exists || !query.person || !entryGate) return { cpf: target, query, allowed: false };
      const rows = await verifyAccess({ id: target, numeroDispositivo: entryGate.numeroDispositivo, sentido: "E" }).catch(() => []);
      return { cpf: target, query, allowed: rows[0] ? isAccessAllowed(rows[0]) : false };
    },
  });
  const owner = search.data;
  const person = owner?.query.person ?? null;

  const vehiclesKey = ["vehicles", person?.sequencia ?? 0] as const;
  const vehicles = useQuery({
    queryKey: vehiclesKey,
    queryFn: ({ signal }) => listVehicles(person!.sequencia, signal),
    enabled: Boolean(person),
    // Dado pessoal: sai da memória assim que a tela deixa de usá-lo.
    gcTime: 0,
  });
  const refreshVehicles = () => void queryClient.invalidateQueries({ queryKey: vehiclesKey });

  const removeTagMutation = useMutation({
    mutationFn: (vehicle: Vehicle) => removeTag(vehicle.SEQUENCIA),
    onSuccess: () => {
      notify.success("TAG removida.");
      refreshVehicles();
      setDialog(null);
    },
    onError: (error) => notify.error(errorMessage(error)),
  });
  const unlinkMutation = useMutation({
    mutationFn: (vehicle: Vehicle) => unlinkOwner(vehicle.SEQUENCIA),
    onSuccess: () => {
      notify.success("Veículo desvinculado do proprietário.");
      refreshVehicles();
      setDialog(null);
    },
    onError: (error) => notify.error(errorMessage(error)),
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (cpf.length === 11) search.mutate(cpf);
  };

  return (
    <PageContainer>
      <PageHeader title="Veículos" subtitle="Veículos e TAG veicular por proprietário." />

      <Card>
        <CardContent>
          <Stack component="form" direction="row" spacing={1} onSubmit={submit} noValidate>
            <TextField
              label="CPF do proprietário"
              value={formatCpf(cpf)}
              onChange={(event) => {
                setCpf(onlyDigits(event.target.value).slice(0, 11));
                search.reset();
              }}
              slotProps={{ htmlInput: { inputMode: "numeric", autoComplete: "off" } }}
              sx={{ flexGrow: 1, maxWidth: 360 }}
              autoFocus
            />
            <Button type="submit" variant="contained" loading={search.isPending} disabled={cpf.length !== 11}>
              Buscar
            </Button>
          </Stack>
          {gates.isSuccess && !entryGate && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              Nenhum portão de entrada ativo: não é possível conferir o vínculo nem validar TAG.
            </Alert>
          )}
        </CardContent>
      </Card>

      {search.isError && <Alert severity="error">{errorMessage(search.error)}</Alert>}
      {owner && !person && <EmptyState title="Nenhuma pessoa com este CPF" />}

      {owner && person && (
        <>
          <SectionCard
            title="Proprietário"
            action={
              <StatusChip
                label={owner.allowed ? "Pode cadastrar veículos" : "Vínculo não permite cadastrar veículos"}
                tone={owner.allowed ? "success" : "error"}
              />
            }
          >
            <PersonCard person={person} links={owner.query.links} />
          </SectionCard>

          <SectionCard
            title="Veículos"
            action={
              <Button
                variant="contained"
                startIcon={<AddOutlined />}
                disabled={!owner.allowed || owner.query.links.length === 0}
                onClick={() => setDialog({ kind: "add" })}
              >
                Adicionar veículo
              </Button>
            }
          >
            {vehicles.isPending && <LinearProgress aria-label="Carregando os veículos" />}
            {vehicles.isError && <ErrorState description={errorMessage(vehicles.error)} onRetry={() => void vehicles.refetch()} />}
            {vehicles.isSuccess && vehicles.data.length === 0 && <EmptyState title="Nenhum veículo cadastrado" />}
            {vehicles.isSuccess && vehicles.data.length > 0 && (
              <VehiclesTable vehicles={vehicles.data} onAction={(vehicle, kind) => setDialog({ kind, vehicle })} />
            )}
          </SectionCard>

          {dialog?.kind === "add" && (
            <AddVehicleDialog
              ownerSeq={person.sequencia}
              links={owner.query.links}
              onSaved={refreshVehicles}
              onClose={() => setDialog(null)}
            />
          )}
          {dialog?.kind === "tag" && entryGate && (
            <TagDialog
              vehicle={dialog.vehicle}
              ownerCpf={owner.cpf}
              numeroDispositivo={entryGate.numeroDispositivo}
              onSaved={refreshVehicles}
              onClose={() => setDialog(null)}
            />
          )}
          <ConfirmDialog
            open={dialog?.kind === "remove-tag"}
            tone="danger"
            title="Remover TAG"
            description={dialog?.kind === "remove-tag" ? `A TAG ${dialog.vehicle.TAGVEICULO ?? ""} do veículo ${dialog.vehicle.PLACA} deixa de abrir os portões.` : ""}
            confirmLabel="Remover TAG"
            loading={removeTagMutation.isPending}
            onConfirm={() => dialog?.kind === "remove-tag" && removeTagMutation.mutate(dialog.vehicle)}
            onClose={() => setDialog(null)}
          />
          <ConfirmDialog
            open={dialog?.kind === "unlink"}
            tone="danger"
            title="Desvincular veículo"
            description={dialog?.kind === "unlink" ? `O veículo ${dialog.vehicle.PLACA} sai do cadastro deste proprietário e a TAG dele é removida.` : ""}
            confirmLabel="Desvincular"
            loading={unlinkMutation.isPending}
            onConfirm={() => dialog?.kind === "unlink" && unlinkMutation.mutate(dialog.vehicle)}
            onClose={() => setDialog(null)}
          />
        </>
      )}
    </PageContainer>
  );
}
