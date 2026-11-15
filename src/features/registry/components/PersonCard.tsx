import Alert from "@mui/material/Alert";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { formatCpf } from "@/core/format/documents";
import StatusChip from "@/core/ui/components/StatusChip";
import { isFlagSet, photoSrc, relationLabel, type Person, type PersonLink } from "../queriesApi";

const unitLabel = (unit: { quadra: string | null; lote: string | null }) =>
  [unit.quadra, unit.lote].filter(Boolean).join("-") || "—";

/** Dados de uma pessoa do cadastro, com as unidades a que está ligada. */
export default function PersonCard({ person, links }: { person: Person; links?: PersonLink[] }) {
  const details = [
    person.cpf && `CPF ${formatCpf(person.cpf)}`,
    person.telCelular && `Celular ${person.telCelular}`,
    person.email,
    [person.tipo, person.categoria, person.classificacao].filter(Boolean).join(" · "),
    [person.empresa, person.funcao].filter(Boolean).join(" · "),
  ].filter(Boolean);

  return (
    <Stack spacing={1.5}>
      <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
        <Avatar
          src={person.foto ? photoSrc(person.foto) : undefined}
          alt={person.nome ?? "Pessoa"}
          sx={{ width: 72, height: 72 }}
        />
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h3" component="p">
            {person.nome || "Sem nome no cadastro"}
          </Typography>
          {details.map((line) => (
            <Typography key={line as string} variant="body2" color="textSecondary">
              {line}
            </Typography>
          ))}
        </Box>
      </Stack>

      {person.alertaPortaria?.trim() && <Alert severity="warning">Aviso para a portaria: {person.alertaPortaria}</Alert>}
      {person.observacoes?.trim() && (
        <Typography variant="body2" color="textSecondary">
          Observações: {person.observacoes}
        </Typography>
      )}

      {links && (
        <Stack spacing={1}>
          <Typography variant="overline" color="textSecondary">
            Unidades
          </Typography>
          {links.length === 0 && <Typography variant="body2">Nenhuma unidade vinculada.</Typography>}
          {links.map((link) => (
            <Stack key={link.pessoaVinculo.sequencia} direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }}>
              <Typography sx={{ fontWeight: 600, minWidth: 64 }}>{unitLabel(link.unidade)}</Typography>
              <Typography variant="body2" color="textSecondary">
                {relationLabel(link.pessoaVinculo)}
              </Typography>
              {isFlagSet(link.unidade.bloquear) && <StatusChip label="Unidade bloqueada" tone="error" />}
            </Stack>
          ))}
        </Stack>
      )}
    </Stack>
  );
}
