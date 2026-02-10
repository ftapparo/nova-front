import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
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
          success:
            "group-[.toaster]:bg-emerald-50 group-[.toaster]:text-emerald-900 group-[.toaster]:border-emerald-200",
          error:
            "group-[.toaster]:bg-rose-50 group-[.toaster]:text-rose-900 group-[.toaster]:border-rose-200",
          warning:
            "group-[.toaster]:bg-orange-50 group-[.toaster]:text-orange-900 group-[.toaster]:border-orange-200",
          info:
            "group-[.toaster]:bg-slate-100 group-[.toaster]:text-slate-900 group-[.toaster]:border-slate-300",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
