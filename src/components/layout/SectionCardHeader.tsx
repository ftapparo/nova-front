import type { ReactNode } from "react";
import { CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type SectionCardHeaderProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
  titleClassName?: string;
  descriptionClassName?: string;
  actionClassName?: string;
};

export default function SectionCardHeader({
  title,
  description,
  action,
  className,
  titleClassName,
  descriptionClassName,
  actionClassName,
}: SectionCardHeaderProps) {
  return (
    <CardHeader className={cn("flex flex-row items-start justify-between gap-4", className)}>
      <div>
        <CardTitle className={cn("typo-card-title", titleClassName)}>{title}</CardTitle>
        {description ? <CardDescription className={cn("typo-card-subtitle", descriptionClassName)}>{description}</CardDescription> : null}
      </div>
      {action ? <div className={cn("shrink-0", actionClassName)}>{action}</div> : null}
    </CardHeader>
  );
}
