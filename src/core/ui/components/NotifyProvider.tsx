import { useMemo, useState, type ReactNode } from "react";
import Alert from "@mui/material/Alert";
import Snackbar from "@mui/material/Snackbar";
import { NotifyContext, type NoticeSeverity, type Notify } from "./useNotify";

interface Notice {
  id: number;
  severity: NoticeSeverity;
  message: string;
}

const VISIBLE_MS = 5000;
// Com mais avisos esperando, o atual sai mais cedo para a fila não atrasar.
const VISIBLE_WITH_QUEUE_MS = 2000;

export default function NotifyProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<Notice[]>([]);
  const [closing, setClosing] = useState(false);

  const notify = useMemo<Notify>(() => {
    const push = (severity: NoticeSeverity) => (message: string) => {
      // O id só precisa ser único entre os avisos pendentes: ele é a key que
      // faz o Snackbar reabrir a cada aviso novo.
      setQueue((pending) => [...pending, { id: (pending.at(-1)?.id ?? 0) + 1, severity, message }]);
    };
    return { success: push("success"), error: push("error"), warning: push("warning"), info: push("info") };
  }, []);

  const current = queue[0];

  return (
    <NotifyContext.Provider value={notify}>
      {children}
      <Snackbar
        key={current?.id}
        open={Boolean(current) && !closing}
        autoHideDuration={queue.length > 1 ? VISIBLE_WITH_QUEUE_MS : VISIBLE_MS}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        onClose={(_event, reason) => {
          // Clique fora não deve engolir um aviso que o operador ainda não leu.
          if (reason !== "clickaway") setClosing(true);
        }}
        slotProps={{
          transition: {
            onExited: () => {
              setQueue((pending) => pending.slice(1));
              setClosing(false);
            },
          },
        }}
      >
        {current && (
          <Alert severity={current.severity} variant="filled" onClose={() => setClosing(true)} sx={{ width: "100%" }}>
            {current.message}
          </Alert>
        )}
      </Snackbar>
    </NotifyContext.Provider>
  );
}
