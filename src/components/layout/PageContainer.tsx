import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type PageContainerProps = HTMLAttributes<HTMLDivElement> & {
  density?: "default" | "wide";
};

export default function PageContainer({ density = "default", className, ...props }: PageContainerProps) {
  return (
    <div
      className={cn(
        "mx-auto w-full space-y-6 px-4 sm:px-6 lg:px-8",
        density === "wide" ? "max-w-6xl" : "max-w-5xl",
        className,
      )}
      {...props}
    />
  );
}
