import type { ReactNode } from "react";
import Box from "@mui/material/Box";

export default function PageContainer({ children }: { children: ReactNode }) {
  return (
    <Box
      sx={{
        width: "100%",
        maxWidth: 1600,
        mx: "auto",
        px: { xs: 2, sm: 3, lg: 4 },
        py: 3,
        display: "flex",
        flexDirection: "column",
        gap: 3,
      }}
    >
      {children}
    </Box>
  );
}
