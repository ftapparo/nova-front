import { Link as RouterLink } from "react-router";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardActionArea from "@mui/material/CardActionArea";
import CardContent from "@mui/material/CardContent";
import Skeleton from "@mui/material/Skeleton";
import Typography from "@mui/material/Typography";
import type { SoftTone } from "@/core/ui/theme/tokens";

export interface Tile {
  title: string;
  value: string | null;
  detail: string;
  tone: Exclude<SoftTone, "brand"> | "neutral";
  to: string;
}

/** Resumo do condomínio, cada bloco levando para a tela do assunto. */
export default function SummaryTiles({ tiles }: { tiles: Tile[] }) {
  return (
    <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", lg: "repeat(3, minmax(0, 1fr))" } }}>
      {tiles.map((tile) => (
        <Card
          key={tile.title}
          sx={(theme) =>
            tile.tone === "neutral"
              ? {}
              : { borderColor: theme.vars.palette.soft[tile.tone].border, bgcolor: theme.vars.palette.soft[tile.tone].bg }
          }
        >
          <CardActionArea component={RouterLink} to={tile.to} sx={{ height: "100%" }}>
            <CardContent>
              <Typography variant="overline" color="textSecondary">
                {tile.title}
              </Typography>
              <Typography
                variant="h2"
                component="p"
                sx={(theme) => ({ color: tile.tone === "neutral" ? undefined : theme.vars.palette.soft[tile.tone].fg })}
              >
                {tile.value ?? <Skeleton width="60%" />}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                {tile.detail}
              </Typography>
            </CardContent>
          </CardActionArea>
        </Card>
      ))}
    </Box>
  );
}
