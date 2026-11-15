import Box from "@mui/material/Box";

interface BrandLogoProps {
  /** Lado do logo em pixels. */
  size?: number;
}

// As duas versões ficam no DOM e o CSS escolhe qual aparece: assim o logo
// acompanha o tema sem depender de JavaScript nem piscar na troca.
export default function BrandLogo({ size = 72 }: BrandLogoProps) {
  return (
    <>
      <Box
        component="img"
        src="/logo-nova-residence.png"
        alt="Nova Residence"
        sx={(theme) => ({
          width: size,
          height: size,
          objectFit: "contain",
          display: "block",
          ...theme.applyStyles("dark", { display: "none" }),
        })}
      />
      <Box
        component="img"
        src="/logo-nova-residence-branco.png"
        alt="Nova Residence"
        sx={(theme) => ({
          width: size,
          height: size,
          objectFit: "contain",
          display: "none",
          ...theme.applyStyles("dark", { display: "block" }),
        })}
      />
    </>
  );
}
