import Button, { type ButtonProps } from "@mui/material/Button";
import type { Command } from "../useCommand";

type CommandButtonProps<TVariables> = Omit<ButtonProps, "onClick" | "loading"> & {
  command: Command<TVariables>;
  onClick: () => void;
};

/** Botão de comando físico: carregando durante o envio e travado na espera do 429. */
export default function CommandButton<TVariables>({
  command,
  onClick,
  disabled,
  children,
  ...buttonProps
}: CommandButtonProps<TVariables>) {
  return (
    <Button {...buttonProps} loading={command.pending} disabled={disabled || command.busy} onClick={onClick}>
      {command.cooldownSeconds > 0 ? `Aguarde ${command.cooldownSeconds} s` : children}
    </Button>
  );
}
