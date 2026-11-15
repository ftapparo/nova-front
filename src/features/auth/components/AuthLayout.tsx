import type { ReactNode } from "react";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import BrandLogo from "@/core/ui/components/BrandLogo";

interface AuthLayoutProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
}

/** Moldura das telas fora do painel: login e senha. */
export default function AuthLayout({ title, subtitle, children }: AuthLayoutProps) {
  return (
    <Box
      sx={{
        position: "relative",
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        p: { xs: 0, sm: 3 },
        overflow: "hidden",
        bgcolor: "background.paper",
      }}
    >
      {/* A foto do condomínio só entra de sm para cima; no celular o cartão ocupa a tela. */}
      <Box
        aria-hidden
        sx={{
          display: { xs: "none", sm: "block" },
          position: "absolute",
          inset: -24,
          backgroundImage: "linear-gradient(rgba(20, 8, 32, 0.55), rgba(20, 8, 32, 0.55)), url(/background-nova-residence.png)",
          backgroundSize: "cover",
          backgroundPosition: "center",
          filter: "blur(10px)",
        }}
      />
      <Paper
        component="main"
        elevation={0}
        sx={{
          position: "relative",
          width: "100%",
          maxWidth: 440,
          p: { xs: 3, sm: 4 },
          borderRadius: { xs: 0, sm: 4 },
          boxShadow: { sm: 24 },
        }}
      >
        <Stack spacing={0.5} sx={{ alignItems: "center", textAlign: "center", mb: 3 }}>
          <BrandLogo size={88} />
          <Typography variant="h2" component="h1">
            {title}
          </Typography>
          {subtitle && (
            <Typography variant="body2" color="textSecondary">
              {subtitle}
            </Typography>
          )}
        </Stack>
        {children}
      </Paper>
    </Box>
  );
}
