import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      richColors={true}
      visibleToasts={3}
      expand={true}
      position="bottom-right"
      offset={16}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast rounded-xl group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          title: "group-[.toast]:text-inherit",
          description: "group-[.toast]:text-inherit/80",
          icon: "group-[.toast]:text-inherit",
          info: "!bg-slate-100 !text-slate-900 !border-slate-300 dark:!bg-slate-800 dark:!text-slate-100 dark:!border-slate-600",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
