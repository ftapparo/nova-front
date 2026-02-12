import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type PageHeaderProps = {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
  titleClassName?: string;
  descriptionClassName?: string;
  actionsClassName?: string;
};

export default function PageHeader({
  title,
  description,
  actions,
  className,
  titleClassName,
  descriptionClassName,
  actionsClassName,
}: PageHeaderProps) {
  return (
    <div className={cn("flex items-start justify-between gap-4", className)}>
      <div>
        <h1 className={cn("typo-page-title", titleClassName)}>{title}</h1>
        {description ? <p className={cn("typo-page-subtitle", descriptionClassName)}>{description}</p> : null}
      </div>
      {actions ? <div className={cn("shrink-0", actionsClassName)}>{actions}</div> : null}
    </div>
  );
}
