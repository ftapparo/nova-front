# nova-front

Frontend do condomínio Nova Residence. Vite + React + TypeScript + shadcn/ui + TanStack Query (PWA).

## Comandos
- `npm run dev` — Vite na porta 8080 (`vite.config.ts`).
- `npm run build`, `npm run lint`, `npm test` (vitest).
- URL da API: `VITE_API_BASE_URL` (padrão `http://192.168.0.250:3030/v2/api`; o `.env` aponta para o domínio de produção).

## Rodar local neste servidor
O container do front já ocupa a porta 8080. Para o dev local usar outra porta e apontar para a API local:
`VITE_API_BASE_URL=http://localhost:3030/v2/api npm run dev -- --port 5173 --strictPort`
Não alterar o `.env` para isso. A `nova-api` (:3030) tem CORS liberado.

## Central de Incêndio
- Página: `src/pages/dashboard/CentralIncendio.tsx`; chamadas em `cieApi` (`src/services/api.ts`).
- Fluxo: front → `nova-api` (`/v2/api/cie/*`) → API do CIE (`cie2500-api`, `/v1/api`) → central.
- O banner de destaque usa `counters` do `/cie/panel`: com `alarme > 0` mostra `latestAlarmEvent` em vermelho; alarme tem prioridade sobre falha (`latestFailureEvent`).
- O local é montado a partir do nome do dispositivo (`parseEventLocation`), padrão `"12 ANDAR B T-A"` → `TORRE A · 12º ANDAR · LADO B`; `"TERREO T-B"` → `TORRE B · TÉRREO`. Fora do padrão, mostra zona/nome.
- Horários são formatados no fuso do navegador; a API envia `occurredAt` em UTC (hora da central em UTC-3). Se aparecer 3 h a menos, o problema é na API.

## Cuidados
- Disparos/falhas de teste geram push real para moradores.
- `package-lock.json` costuma ficar modificado após `npm install`; não commitar por engano.
- Commits em português no estilo `feat:` / `fix:`; push direto na `main`.
