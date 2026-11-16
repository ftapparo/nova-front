import { useEffect, useRef, useState } from "react";
import { useQueries, useQuery, useQueryClient, type QueryKey } from "@tanstack/react-query";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import EditOutlined from "@mui/icons-material/EditOutlined";
import { errorMessage } from "@/core/api/http";
import { useRealtimeEvent, useRealtimeFallbackInterval } from "@/core/realtime/useRealtime";
import { useSetting } from "@/core/settings/userSettings";
import EmptyState from "@/core/ui/components/EmptyState";
import SectionCard from "@/core/ui/components/SectionCard";
import StatusChip from "@/core/ui/components/StatusChip";
import { useNotify } from "@/core/ui/components/useNotify";
import PageContainer from "@/core/ui/layout/PageContainer";
import PageHeader from "@/core/ui/layout/PageHeader";
import { erpDateTimeKey, formatErpDateTime, recentAccessQuery, sentidoLabel, unitLabel } from "@/features/access/accessApi";
import { commandActor, commandLabel, commandLogsQuery, commandSucceeded, commandTarget } from "@/features/commandLog/commandLogApi";
import { exhaustsQuery, groupExhaustModules } from "@/features/exhaust/exhaustApi";
import { panelQuery, SEVERITY_TONE } from "@/features/fire/fireApi";
import { doorsListQuery, doorsStatusQuery, gatesListQuery, gatesStatusQuery } from "@/features/gates/gatesApi";
import ActivityCard, { type ActivityItem } from "./components/ActivityCard";
import EditShortcutsDialog, { type Equipment } from "./components/EditShortcutsDialog";
import PushReminder from "./components/PushReminder";
import ShortcutButton from "./components/ShortcutButton";
import SummaryTiles, { type Tile } from "./components/SummaryTiles";
import { sanitizeShortcuts, SHORTCUTS_SETTING, type Shortcut } from "./shortcuts";

const FALLBACK_REFRESH_MS = 30_000;
const RECENT_REFRESH_MS = 15_000;
const INVALIDATE_DEBOUNCE_MS = 500;
const ITEMS_SHOWN = 8;
const COMMANDS_LIMIT = 50;
const timeFormat = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "medium" });

export default function DashboardPage() {
  const queryClient = useQueryClient();
  const notify = useNotify();
  const [editing, setEditing] = useState(false);
  const refetchInterval = useRealtimeFallbackInterval(FALLBACK_REFRESH_MS);

  const panel = useQuery({ ...panelQuery, refetchInterval });
  const gates = useQuery(gatesListQuery);
  const gatesStatus = useQuery({ ...gatesStatusQuery, refetchInterval });
  const doors = useQuery(doorsListQuery);
  const doorsStatus = useQuery({ ...doorsStatusQuery, refetchInterval });
  const exhausts = useQuery({ ...exhaustsQuery, refetchInterval });
  const commands = useQuery({ ...commandLogsQuery(COMMANDS_LIMIT), refetchInterval });
  const activeGates = (gates.data ?? []).filter((gate) => gate.ativo);
  const recent = useQueries({
    queries: activeGates.map((gate) => ({ ...recentAccessQuery(gate.numeroDispositivo), refetchInterval: RECENT_REFRESH_MS })),
  });

  // Cada aviso do tempo real recarrega o que ele afeta; a rajada vira uma recarga só.
  const pending = useRef(new Map<string, QueryKey>());
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const refresh = (...keys: QueryKey[]) => {
    for (const key of keys) pending.current.set(JSON.stringify(key), key);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      for (const key of pending.current.values()) void queryClient.invalidateQueries({ queryKey: key });
      pending.current.clear();
    }, INVALIDATE_DEBOUNCE_MS);
  };
  const refreshFire = () => refresh(panelQuery.queryKey);
  useRealtimeEvent("devices.status.changed", () => refresh(gatesStatusQuery.queryKey, doorsStatusQuery.queryKey));
  useRealtimeEvent("exhaust.changed", () => refresh(exhaustsQuery.queryKey));
  useRealtimeEvent("command.logged", () => refresh(["commands", "logs"]));
  useRealtimeEvent("tag.read", () => refresh(["access", "recent"]));
  useRealtimeEvent("cie.status.updated", refreshFire);
  useRealtimeEvent("cie.alarm.triggered", refreshFire);
  useRealtimeEvent("cie.failure.triggered", refreshFire);
  useRealtimeEvent("cie.active.updated", refreshFire);
  useRealtimeEvent("cie.connection.changed", refreshFire);

  const shortcutsSetting = useSetting<unknown>(SHORTCUTS_SETTING, []);
  const shortcuts = sanitizeShortcuts(shortcutsSetting.value);
  const equipment: Equipment[] = [
    ...activeGates.map((gate) => ({ key: `gate-${gate.numeroDispositivo}`, kind: "gate" as const, target: gate.numeroDispositivo, name: gate.nome })),
    ...(doors.data ?? [])
      .filter((door) => door.ativo)
      .map((door) => ({ key: `door-${door.id}`, kind: "door" as const, target: door.id, name: door.nome })),
  ];
  const equipmentName = (shortcut: Shortcut) =>
    equipment.find((item) => item.kind === shortcut.kind && item.target === shortcut.target)?.name ?? null;

  // Resumo
  const gatesOffline = (gatesStatus.data?.gates ?? []).filter((gate) => !gate.online).length;
  const doorsOffline = (doorsStatus.data?.doors ?? []).filter((door) => !door.online).length;
  const modulesOffline = groupExhaustModules(exhausts.data ?? []).filter((module) => !module.online).length;
  const fireOffline = panel.data ? (panel.data.online && panel.data.connected ? 0 : 1) : 0;
  const offline = gatesOffline + doorsOffline + modulesOffline + fireOffline;
  const statusReady = gatesStatus.isSuccess && doorsStatus.isSuccess && exhausts.isSuccess && panel.isSuccess;
  const exhaustsOn = (exhausts.data ?? []).filter((exhaust) => exhaust.on).length;
  const counters = panel.data?.counters;

  const tiles: Tile[] = [
    {
      title: "Central de incêndio",
      value: panel.data?.situation.label ?? (panel.isError ? "Sem leitura" : null),
      detail: counters ? `Alarme ${counters.alarme} · Falha ${counters.falha} · Supervisão ${counters.supervisao}` : "Situação da central",
      tone: panel.data ? SEVERITY_TONE[panel.data.situation.severity] : panel.isError ? "error" : "neutral",
      to: "/incendio",
    },
    {
      title: "Equipamentos",
      value: statusReady ? (offline === 0 ? "Todos com comunicação" : `${offline} fora do ar`) : null,
      detail: "Portões, portas, módulos de exaustor e central",
      tone: statusReady ? (offline === 0 ? "success" : "error") : "neutral",
      to: "/equipamentos",
    },
    {
      title: "Exaustores",
      value: exhausts.isSuccess ? `${exhaustsOn} ligado${exhaustsOn === 1 ? "" : "s"}` : null,
      detail: exhausts.isSuccess ? `de ${exhausts.data.length} exaustores` : "Exaustores das churrasqueiras",
      tone: exhaustsOn > 0 ? "info" : "neutral",
      to: "/exaustores",
    },
  ];

  const passages: ActivityItem[] = recent
    .flatMap((result, index) =>
      (result.data ?? []).map((row, position) => ({ row, gate: activeGates[index]?.nome ?? "", position, gateIndex: index })),
    )
    .sort((a, b) => erpDateTimeKey(b.row.DATAHORA).localeCompare(erpDateTimeKey(a.row.DATAHORA)))
    .slice(0, ITEMS_SHOWN)
    .map(({ row, gate, position, gateIndex }) => ({
      key: `${gateIndex}-${position}-${row.DATAHORA ?? ""}`,
      primary: `${row.NOME || "Sem nome"} · ${unitLabel(row.TORRE, row.APARTAMENTO)}`,
      secondary: `${formatErpDateTime(row.DATAHORA)} · ${gate} · ${sentidoLabel(row.SENTIDO)}`,
    }));

  const commandItems: ActivityItem[] = (commands.data ?? []).slice(0, ITEMS_SHOWN).map((log) => {
    const target = commandTarget(log);
    const date = new Date(log.timestamp);
    return {
      key: log.id,
      primary: `${commandLabel(log)}${target ? ` · ${target}` : ""}`,
      secondary: `${Number.isNaN(date.getTime()) ? log.timestamp : timeFormat.format(date)} · ${commandActor(log)}`,
      end: commandSucceeded(log) ? undefined : <StatusChip label="Falhou" tone="error" />,
    };
  });

  return (
    <PageContainer>
      <PageHeader title="Painel Operacional" subtitle="Situação do condomínio e acesso rápido aos equipamentos." />
      <PushReminder />
      <SummaryTiles tiles={tiles} />

      <SectionCard
        title="Atalhos"
        subtitle="Portas abrem direto; portões vão para a conferência do CPF."
        action={
          <Button startIcon={<EditOutlined />} onClick={() => setEditing(true)} disabled={shortcutsSetting.loading}>
            Editar
          </Button>
        }
      >
        {shortcutsSetting.error ? (
          <Typography variant="body2" color="error">
            Não foi possível carregar os atalhos: {errorMessage(shortcutsSetting.error)}
          </Typography>
        ) : shortcuts.length === 0 ? (
          <EmptyState title="Nenhum atalho" description="Use Editar para escolher as portas e portões que você mais usa." />
        ) : (
          <Box sx={{ display: "grid", gap: 1.5, gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", lg: "repeat(4, minmax(0, 1fr))" } }}>
            {shortcuts.map((shortcut) => (
              <ShortcutButton key={shortcut.id} shortcut={shortcut} equipmentName={equipmentName(shortcut)} />
            ))}
          </Box>
        )}
      </SectionCard>

      <Box sx={{ display: "grid", gap: 3, gridTemplateColumns: { xs: "1fr", lg: "repeat(2, minmax(0, 1fr))" } }}>
        <ActivityCard
          title="Últimas passagens"
          items={passages}
          pending={gates.isPending || recent.some((result) => result.isPending)}
          error={gates.error ?? recent.find((result) => result.isError)?.error ?? null}
          onRetry={() => recent.forEach((result) => void result.refetch())}
          emptyTitle="Nenhuma passagem recente"
          moreTo="/acessos"
        />
        <ActivityCard
          title="Últimos comandos"
          items={commandItems}
          pending={commands.isPending}
          error={commands.error}
          onRetry={() => void commands.refetch()}
          emptyTitle="Nenhum comando registrado"
          moreTo="/comandos"
        />
      </Box>

      {editing && (
        <EditShortcutsDialog
          current={shortcuts}
          equipment={equipment}
          saving={shortcutsSetting.save.isPending}
          saveError={shortcutsSetting.save.error}
          onSave={(next) =>
            shortcutsSetting.save.mutate(next, {
              onSuccess: () => {
                notify.success("Atalhos salvos.");
                setEditing(false);
              },
            })
          }
          onClose={() => {
            shortcutsSetting.save.reset();
            setEditing(false);
          }}
        />
      )}
    </PageContainer>
  );
}
