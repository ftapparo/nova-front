import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

interface BrandLogoProps {
  className?: string;
  fallbackClassName?: string;
  forceWhite?: boolean;
}

export default function BrandLogo({ className, fallbackClassName, forceWhite = false }: BrandLogoProps) {
  const { resolvedTheme } = useTheme();
  const [hasError, setHasError] = useState(false);
  const logoSrc = forceWhite || resolvedTheme === "dark"
    ? "/logo-nova-residence-branco.png"
    : "/logo-nova-residence.png";

  useEffect(() => {
    setHasError(false);
  }, [logoSrc]);

  if (hasError) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground",
          fallbackClassName || className,
        )}
      >
        NR
      </div>
    );
  }

  return (
    <img
      src={logoSrc}
      alt="Nova Residence"
      onError={() => setHasError(true)}
      className={cn("rounded-lg object-contain", className)}
    />
  );
}
