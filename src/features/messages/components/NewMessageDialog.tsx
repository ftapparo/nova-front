import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControlLabel from "@mui/material/FormControlLabel";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import { Controller } from "react-hook-form";
import { applyValidationErrors } from "@/core/api/formErrors";
import { errorMessage } from "@/core/api/http";
import FormTextField from "@/core/ui/components/form/FormTextField";
import { useNotify } from "@/core/ui/components/useNotify";
import {
  BODY_MAX,
  CATEGORY,
  DEFAULT_CAROUSEL_TTL_HOURS,
  LABEL_MAX,
  MAX_CAROUSEL_TTL_HOURS,
  publishMessage,
  TITLE_MAX,
  type MessageCategory,
} from "../messagesApi";

// datetime-local não tem fuso: é o horário deste computador, convertido
// para ISO (UTC) antes de enviar.
const toIso = (local: string) => (local ? new Date(local).toISOString() : undefined);

const schema = z
  .object({
    category: z.enum(["urgente", "aviso", "manutencao", "comunicado"]),
    label: z.string().max(LABEL_MAX, `Até ${LABEL_MAX} caracteres.`),
    title: z.string().trim().min(1, "Informe o título.").max(TITLE_MAX, `Até ${TITLE_MAX} caracteres.`),
    body: z.string().trim().min(1, "Escreva o comunicado.").max(BODY_MAX, `Até ${BODY_MAX} caracteres.`),
    publishedAt: z.string(),
    expiresAt: z.string(),
    pinned: z.boolean(),
    carouselTtlHours: z.coerce.number<string | number>().int("Use horas inteiras.").min(0).max(MAX_CAROUSEL_TTL_HOURS, `Até ${MAX_CAROUSEL_TTL_HOURS} h.`),
    notify: z.boolean(),
  })
  .refine((values) => !values.expiresAt || new Date(values.expiresAt) > new Date(values.publishedAt || Date.now()), {
    message: "A validade precisa ser depois da publicação.",
    path: ["expiresAt"],
  });

type FormValues = z.input<typeof schema>;

interface NewMessageDialogProps {
  onPublished: () => void;
  onClose: () => void;
}

/** Montado só enquanto aberto: cada abertura começa com o formulário limpo. */
export default function NewMessageDialog({ onPublished, onClose }: NewMessageDialogProps) {
  const notify = useNotify();
  const { control, handleSubmit, setError } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      category: "comunicado",
      label: "",
      title: "",
      body: "",
      publishedAt: "",
      expiresAt: "",
      pinned: false,
      carouselTtlHours: DEFAULT_CAROUSEL_TTL_HOURS,
      notify: true,
    },
  });
  const pinned = useWatch({ control, name: "pinned" });
  const scheduled = useWatch({ control, name: "publishedAt" });

  const publish = useMutation({
    mutationFn: (values: FormValues) =>
      publishMessage({
        category: values.category as MessageCategory,
        label: values.label.trim() || undefined,
        title: values.title.trim(),
        body: values.body.trim(),
        publishedAt: toIso(values.publishedAt),
        expiresAt: toIso(values.expiresAt),
        pinned: values.pinned,
        carouselTtlHours: values.pinned ? 0 : Number(values.carouselTtlHours),
        notify: values.notify,
      }),
    onSuccess: (message) => {
      const future = new Date(message.publishedAt).getTime() > Date.now();
      notify.success(future ? "Comunicado agendado. Aparece na lista quando chegar a data." : "Comunicado publicado.");
      onPublished();
      onClose();
    },
    onError: (error) => {
      applyValidationErrors(error, setError, ["category", "label", "title", "body", "publishedAt", "expiresAt", "carouselTtlHours"]);
    },
  });

  return (
    <Dialog open onClose={publish.isPending ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Novo comunicado</DialogTitle>
      <DialogContent>
        <Stack component="form" id="new-message" spacing={2} noValidate onSubmit={handleSubmit((values) => publish.mutate(values))} sx={{ pt: 1 }}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <FormTextField control={control} name="category" label="Categoria" select sx={{ minWidth: 180 }}>
              {(Object.keys(CATEGORY) as MessageCategory[]).map((key) => (
                <MenuItem key={key} value={key}>
                  {CATEGORY[key].label}
                </MenuItem>
              ))}
            </FormTextField>
            <FormTextField control={control} name="label" label="Etiqueta (opcional)" helperText="Ex.: Manutenção programada" />
          </Stack>
          <FormTextField control={control} name="title" label="Título" />
          <FormTextField control={control} name="body" label="Texto" multiline minRows={5} />
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <FormTextField
              control={control}
              name="publishedAt"
              label="Publicar em (opcional)"
              type="datetime-local"
              helperText="Vazio = agora."
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <FormTextField
              control={control}
              name="expiresAt"
              label="Válido até (opcional)"
              type="datetime-local"
              helperText="Vazio = sem validade."
              slotProps={{ inputLabel: { shrink: true } }}
            />
          </Stack>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ alignItems: { sm: "center" } }}>
            <Controller
              control={control}
              name="pinned"
              render={({ field }) => (
                <FormControlLabel
                  control={<Switch checked={field.value} onChange={(event) => field.onChange(event.target.checked)} />}
                  label="Fixar no carrossel"
                />
              )}
            />
            {!pinned && (
              <FormTextField
                control={control}
                name="carouselTtlHours"
                label="Horas no carrossel"
                type="number"
                helperText="0 = sai do carrossel de cada morador quando ele ler."
                slotProps={{ htmlInput: { min: 0, max: MAX_CAROUSEL_TTL_HOURS } }}
              />
            )}
          </Stack>
          <Controller
            control={control}
            name="notify"
            render={({ field }) => (
              <FormControlLabel
                control={<Switch checked={field.value} onChange={(event) => field.onChange(event.target.checked)} />}
                label={scheduled ? "Avisar os moradores pelo aplicativo quando for publicado" : "Avisar os moradores pelo aplicativo"}
              />
            )}
          />
          {publish.isError && <Alert severity="error">{errorMessage(publish.error)}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={publish.isPending}>
          Cancelar
        </Button>
        <Button type="submit" form="new-message" variant="contained" loading={publish.isPending}>
          {scheduled ? "Agendar" : "Publicar"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
