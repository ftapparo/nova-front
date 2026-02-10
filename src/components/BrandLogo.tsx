import { useState } from "react";
import { cn } from "@/lib/utils";

interface BrandLogoProps {
  className?: string;
  fallbackClassName?: string;
}

export default function BrandLogo({ className, fallbackClassName }: BrandLogoProps) {
  const [hasError, setHasError] = useState(false);

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
      src="/logo-nova-residence.png"
      alt="Nova Residence"
      onError={() => setHasError(true)}
      className={cn("rounded-lg object-contain", className)}
    />
  );
}

