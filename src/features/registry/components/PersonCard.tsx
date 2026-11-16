import Alert from "@mui/material/Alert";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { formatCpf } from "@/core/format/documents";
import { erpText, joinErpText } from "@/core/format/erpText";
import StatusChip from "@/core/ui/components/StatusChip";
import { isFlagSet, photoSrc, relationLabel, type Person, type PersonLink } from "../queriesApi";

/** Dados de uma pessoa do cadastro, com as unidades a que está ligada. */
export default function PersonCard({ person, links }: { person: Person; links?: PersonLink[] }) {
  // Todo texto do ERP passa por erpText: campo longo chega como bytes, não como texto.
  const cpf = erpText(person.cpf);
  const phone = erpText(person.telCelular);
  const details = [
    cpf && `CPF ${formatCpf(cpf)}`,
    phone && `Celular ${phone}`,
    erpText(person.email),
    joinErpText([person.tipo, person.categoria, person.classificacao], " · "),
    joinErpText([person.empresa, person.funcao], " · "),
  ].filter((line): line is string => Boolean(line));
  const alert = erpText(person.alertaPortaria);
  const notes = erpText(person.observacoes);
  const photo = erpText(person.foto);
  const name = erpText(person.nome);

  return (
    <Stack spacing={1.5}>
      <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
        <Avatar src={photo ? photoSrc(photo) : undefined} alt={name ?? "Pessoa"} sx={{ width: 72, height: 72 }} />
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h3" component="p">
            {name ?? "Sem nome no cadastro"}
          </Typography>
          {details.map((line) => (
            <Typography key={line} variant="body2" color="textSecondary">
              {line}
            </Typography>
          ))}
        </Box>
      </Stack>

      {alert && <Alert severity="warning">Aviso para a portaria: {alert}</Alert>}
      {notes && (
        <Typography variant="body2" color="textSecondary" sx={{ whiteSpace: "pre-line" }}>
          Observações: {notes}
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
              <Typography sx={{ fontWeight: 600, minWidth: 64 }}>
                {joinErpText([link.unidade.quadra, link.unidade.lote], "-") || "—"}
              </Typography>
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
