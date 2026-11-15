import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import ErrorOutlineOutlined from "@mui/icons-material/ErrorOutlineOutlined";

interface ErrorStateProps {
  title?: string;
  description?: string;
  /** Sem onRetry o botão não aparece: nem todo erro se resolve tentando de novo. */
  onRetry?: () => void;
}

export default function ErrorState({ title = "Não foi possível carregar", description, onRetry }: ErrorStateProps) {
  return (
    <Stack role="alert" spacing={1} sx={{ alignItems: "center", textAlign: "center", py: 6, px: 2 }}>
      <ErrorOutlineOutlined fontSize="large" color="error" />
      <Typography variant="h3" component="p">
        {title}
      </Typography>
      {description && (
        <Typography variant="body2" color="textSecondary">
          {description}
        </Typography>
      )}
      {onRetry && (
        <Button variant="outlined" onClick={onRetry} sx={{ mt: 1 }}>
          Tentar novamente
        </Button>
      )}
    </Stack>
  );
}
