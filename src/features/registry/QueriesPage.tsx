import { useState, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import TextField from "@mui/material/TextField";
import { errorMessage } from "@/core/api/http";
import { formatCpf, normalizePlate, onlyDigits, TAG_LENGTH } from "@/core/format/documents";
import EmptyState from "@/core/ui/components/EmptyState";
import PageContainer from "@/core/ui/layout/PageContainer";
import PageHeader from "@/core/ui/layout/PageHeader";
import PersonCard from "./components/PersonCard";
import VehicleQueryResult from "./components/VehicleQueryResult";
import { queryCpf, queryPlate, queryTag, type CpfQuery, type VehicleQuery } from "./queriesApi";

type Kind = "cpf" | "plate" | "tag";

const KINDS: Record<Kind, { label: string; field: string; ready: (value: string) => boolean; clean: (value: string) => string }> = {
  cpf: { label: "CPF", field: "CPF", ready: (value) => value.length === 11, clean: (value) => onlyDigits(value).slice(0, 11) },
  plate: { label: "Placa", field: "Placa", ready: (value) => value.length === 7, clean: normalizePlate },
  tag: {
    label: "TAG",
    field: "TAG (10 dígitos)",
    ready: (value) => value.length === TAG_LENGTH,
    clean: (value) => onlyDigits(value).slice(0, TAG_LENGTH),
  },
};

type Result = { kind: "cpf"; data: CpfQuery } | { kind: "plate" | "tag"; data: VehicleQuery };

/**
 * Consulta no cadastro do condomínio por CPF, placa ou TAG. O resultado tem
 * dado pessoal e fica só no estado desta tela: some ao trocar de consulta ou
 * sair dela.
 */
export default function QueriesPage() {
  const [kind, setKind] = useState<Kind>("cpf");
  const [value, setValue] = useState("");
  const config = KINDS[kind];

  const search = useMutation({
    mutationFn: async ({ kind: target, term }: { kind: Kind; term: string }): Promise<Result> => {
      if (target === "cpf") return { kind: "cpf", data: await queryCpf(term) };
      return { kind: target, data: await (target === "plate" ? queryPlate(term) : queryTag(term)) };
    },
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (config.ready(value)) search.mutate({ kind, term: value });
  };

  const result = search.data;

  return (
    <PageContainer>
      <PageHeader title="Consultas" subtitle="Cadastro do condomínio por CPF, placa ou TAG." />

      <Card>
        <CardContent>
          <Tabs
            value={kind}
            onChange={(_event, next: Kind) => {
              setKind(next);
              setValue("");
              search.reset();
            }}
            sx={{ mb: 2 }}
          >
            {(Object.keys(KINDS) as Kind[]).map((key) => (
              <Tab key={key} value={key} label={KINDS[key].label} />
            ))}
          </Tabs>
          <Stack component="form" direction="row" spacing={1} onSubmit={submit} noValidate>
            <TextField
              label={config.field}
              value={kind === "cpf" ? formatCpf(value) : value}
              onChange={(event) => {
                setValue(config.clean(event.target.value));
                search.reset();
              }}
              slotProps={{ htmlInput: { autoComplete: "off", inputMode: kind === "plate" ? "text" : "numeric" } }}
              sx={{ flexGrow: 1, maxWidth: 360 }}
              autoFocus
            />
            <Button type="submit" variant="contained" loading={search.isPending} disabled={!config.ready(value)}>
              Consultar
            </Button>
          </Stack>
        </CardContent>
      </Card>

      {search.isError && <Alert severity="error">{errorMessage(search.error)}</Alert>}

      {result && (
        <Card>
          <CardContent>
            {result.kind === "cpf" ? (
              result.data.exists && result.data.person ? (
                <PersonCard person={result.data.person} links={result.data.links} />
              ) : (
                <EmptyState title="Nenhuma pessoa com este CPF" />
              )
            ) : (
              <VehicleQueryResult result={result.data} />
            )}
          </CardContent>
        </Card>
      )}
    </PageContainer>
  );
}
