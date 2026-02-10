import { toast } from "@/components/ui/sonner";

type NotifyOptions = {
  description?: string;
};

export const notify = {
  success: (title: string, options?: NotifyOptions) => toast.success(title, options),
  error: (title: string, options?: NotifyOptions) => toast.error(title, options),
  warning: (title: string, options?: NotifyOptions) => toast.warning(title, options),
  info: (title: string, options?: NotifyOptions) => toast.info(title, options),
};
