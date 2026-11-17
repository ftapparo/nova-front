import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import Autocomplete from "@mui/material/Autocomplete";
import Box from "@mui/material/Box";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import TextField from "@mui/material/TextField";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import CommandButton from "@/core/ui/components/CommandButton";
import ConfirmDialog from "@/core/ui/components/ConfirmDialog";
import SectionCard from "@/core/ui/components/SectionCard";
import { useCommand } from "@/core/ui/useCommand";
import { placeLabel, sendBlockCommand, sendOutputCommand, type BlockTarget, type Installation } from "../fireApi";
import { fireKeys } from "../fireQueries";

interface Option {
  key: string;
  label: string;
  laco: number;
  numero: number;
}

const TARGET_LABEL: Record<BlockTarget, string> = { dispositivo: "Dispositivo", zona: "Zona", regra: "Regra" };

// Opções montadas do cadastro da central: o admin escolhe pelo nome, sem
// digitar laço e endereço.
function optionsFor(target: BlockTarget, installation: Installation): Option[] {
  if (target === "dispositivo") {
    return (installation.devices ?? [])
      .filter((device) => device.loop !== undefined && device.address !== undefined)
      .map((device) => ({
        key: `${device.loop}.${device.address}`,
        label: [`${device.loop}.${device.address}`, device.name, device.device, placeLabel(device.place)].filter(Boolean).join(" · "),
        laco: device.loop!,
        numero: device.address!,
      }));
  }
  const items = target === "zona" ? (installation.zones ?? []) : (installation.rules ?? []);
  return items
    .filter((item) => item.id !== undefined)
    .map((item) => ({
      key: String(item.id),
      label: [`${TARGET_LABEL[target]} ${item.id}`, item.name].filter(Boolean).join(" · "),
      laco: 0,
      numero: item.id!,
    }));
}

type Pending = { kind: "block"; target: BlockTarget; option: Option; on: boolean } | { kind: "output"; option: Option; on: boolean };

/**
 * Bloqueio de dispositivo, zona ou regra e acionamento de saída na central.
 * Só admin (decisão de 16/11/2026). Equipamento de segurança contra
 * incêndio: confirmação explícita e nunca repetir sozinho.
 */
export default function AdminDeviceCommandsCard({ installation }: { installation: Installation }) {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"block" | "output">("block");
  const [target, setTarget] = useState<BlockTarget>("dispositivo");
  const [option, setOption] = useState<Option | null>(null);
  const [on, setOn] = useState(true);
  const [pending, setPending] = useState<Pending | null>(null);

  const command = useCommand({
    mutationFn: (action: Pending) =>
      action.kind === "block"
        ? sendBlockCommand({ target: action.target, laco: action.option.laco, numero: action.option.numero, bloquear: action.on })
        : sendOutputCommand({ laco: action.option.laco, numero: action.option.numero, ativo: action.on }),
    successMessage: (_data, action) =>
      action.kind === "block"
        ? `${action.on ? "Bloqueado" : "Desbloqueado"}: ${action.option.label}.`
        : `Saída ${action.on ? "ativada" : "desativada"}: ${action.option.label}.`,
    onSuccess: () => {
      setPending(null);
      void queryClient.invalidateQueries({ queryKey: fireKeys.all });
    },
  });

  const options = optionsFor(tab === "block" ? target : "dispositivo", installation);
  const onLabel = tab === "block" ? "Bloquear" : "Ativar";
  const offLabel = tab === "block" ? "Desbloquear" : "Desativar";

  const reset = () => {
    setOption(null);
    setOn(true);
  };

  const describe = (action: Pending) => {
    if (action.kind === "block") {
      return action.on
        ? `${action.option.label} deixa de gerar alarme e falha enquanto estiver bloqueado. Use só em manutenção.`
        : `${action.option.label} volta a ser monitorado pela central.`;
    }
    return action.on ? `${action.option.label} é acionado agora (sirene, saída ou atuador).` : `${action.option.label} é desligado agora.`;
  };

  return (
    <SectionCard title="Bloqueios e saídas" subtitle="Só administrador. Agem na central de incêndio de verdade.">
      <Tabs
        value={tab}
        onChange={(_event, next: "block" | "output") => {
          setTab(next);
          reset();
        }}
        sx={{ mb: 2 }}
      >
        <Tab value="block" label="Bloquear" />
        <Tab value="output" label="Acionar saída" />
      </Tabs>

      <Stack spacing={2}>
        {tab === "block" && (
          <TextField
            select
            label="O que bloquear"
            value={target}
            onChange={(event) => {
              setTarget(event.target.value as BlockTarget);
              reset();
            }}
            sx={{ maxWidth: 240 }}
          >
            {(Object.keys(TARGET_LABEL) as BlockTarget[]).map((key) => (
              <MenuItem key={key} value={key}>
                {TARGET_LABEL[key]}
              </MenuItem>
            ))}
          </TextField>
        )}
        <Autocomplete
          options={options}
          value={option}
          onChange={(_event, value) => setOption(value)}
          getOptionLabel={(item) => item.label}
          isOptionEqualToValue={(a, b) => a.key === b.key}
          noOptionsText="Nada encontrado no cadastro da central"
          renderInput={(params) => (
            <TextField {...params} label={tab === "block" ? TARGET_LABEL[target] : "Dispositivo de saída"} placeholder="Buscar pelo nome ou laço.endereço" />
          )}
        />
        <Stack direction="row" spacing={2} sx={{ alignItems: "center", flexWrap: "wrap", rowGap: 1 }}>
          <ToggleButtonGroup exclusive value={on} onChange={(_event, value: boolean | null) => value !== null && setOn(value)} aria-label="Ação">
            <ToggleButton value={true}>{onLabel}</ToggleButton>
            <ToggleButton value={false}>{offLabel}</ToggleButton>
          </ToggleButtonGroup>
          <Box>
            <CommandButton
              command={command}
              variant="contained"
              color="warning"
              disabled={!option}
              onClick={() =>
                option && setPending(tab === "block" ? { kind: "block", target, option, on } : { kind: "output", option, on })
              }
            >
              Enviar à central
            </CommandButton>
          </Box>
        </Stack>
      </Stack>

      <ConfirmDialog
        open={pending !== null}
        tone="danger"
        title={pending ? `${pending.kind === "block" ? (pending.on ? "Bloquear" : "Desbloquear") : pending.on ? "Ativar saída" : "Desativar saída"}?` : ""}
        description={pending ? describe(pending) : ""}
        confirmLabel="Confirmar"
        loading={command.pending}
        onConfirm={() => pending && command.run(pending)}
        onClose={() => setPending(null)}
      />
    </SectionCard>
  );
}
