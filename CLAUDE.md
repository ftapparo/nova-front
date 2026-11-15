# FRONT_V3 — Painel Administrativo Nova Residence (v3)

Painel web da equipe do Condomínio Nova Residence (`porteiro`, `sindico`, `admin`), construído do zero sobre a `nova-api` **v3** com Material UI. Substituirá o painel atual (`FRONT/`, que fala com a v2) quando o corte for decidido; até lá os dois rodam lado a lado.

Este arquivo é o contexto do projeto; `AGENTS.md` tem as regras de arquitetura e processo. Leia os dois, começando por este. O histórico está em `CHANGELOG.md`.

## 🔴 Regras absolutas

- **Nunca editar `FRONT/`** (o painel em produção) nem `src/v2/` de qualquer backend. `FRONT/` serve só de referência de comportamento.

## Repositório e branches

O painel v3 vive no mesmo repositório do painel atual (`nova-front`), na branch **`nova-versao`**. No workspace são duas pastas do mesmo repositório (git worktree):

- `FRONT/` → branch `main`, painel em produção (v2);
- `FRONT_V3/` → branch `nova-versao`, este painel.

Commit e push feitos em `FRONT_V3/` vão para `nova-versao`. Não trocar de branch dentro das pastas (`git checkout`/`switch`): cada uma fica presa à sua. O corte para produção é juntar `nova-versao` na `main`, decisão do usuário. A stack do Portainer usa a `main`; `nova-versao` não tem Dockerfile até a Fase 5.
- **O painel fala só com `/v3/api` e `/v3/ws`, sempre na própria origem.** A v3 não tem CORS: em desenvolvimento o Vite repassa `/v3` (`V3_PROXY_TARGET` no `.env`), em produção o nginx do container. Não existe `VITE_API_BASE_URL` e não se chama a API por URL absoluta.
- **Comandos acionam equipamento físico** (portões, portas, exaustores, central de incêndio). Testes automatizados nunca apontam para a API real — usam `fetch` falso com respostas no formato do envelope da v3.

## Contrato da API

- Fonte de verdade: `../API/src/v3/openapi.json` (ao vivo em `/v3/apispec_1.json`). Guia de uso: `../API/src/v3/APP-GUIDE.md` — escrito para o app Android, mas o contrato é o mesmo.
- Envelope `{ success, data, meta }` / `{ success: false, error, meta }`; ramificar por `error.type` (conjunto fechado), nunca pelo texto de `detail`.
- Papéis: `user.role` é `porteiro`, `sindico`, `admin` ou `null` (morador). Este painel é da equipe; conta sem papel não usa o painel.

## Stack

- **React 19 + TypeScript estrito + Vite**
- **Material UI 9** (`@mui/material`, Emotion, `@mui/icons-material`) — sem Tailwind/shadcn
- **React Router 7** (`react-router`)
- **TanStack Query v5** para dados e mutations
- **React Hook Form + Zod 4** para formulários
- **Vitest + Testing Library**
- A entrar nas próximas fases, só quando forem usados: MUI X (Data Grid, Date Pickers), `vite-plugin-pwa`.

TypeScript fica em `~6.0` enquanto o `typescript-eslint` não aceitar a 7. O `openapi-typescript` exige TypeScript 5, por isso roda via `npx` (`npm run gen:api`) e não é dependência do projeto.

## Comandos

```bash
npm run dev      # Vite em http://localhost:8081 (proxy /v3 → V3_PROXY_TARGET)
npm run lint     # ESLint
npm test         # vitest run
npm run build    # tsc -b + build de produção
npm run gen:api  # regenera src/core/api/schema.gen.ts a partir de ../API/src/v3/openapi.json
```

Rodar `npm run gen:api` sempre que o contrato da v3 mudar; o arquivo gerado é versionado e nunca editado à mão.

Antes de dar uma mudança por pronta: `npm run lint`, `npm test` e `npm run build`.

`npm run dev` com `V3_PROXY_TARGET` configurado fala com a **API real**. Não usar para "testar" comandos.

## Estado atual

Fases 0 (fundação), 1 (API e sessão) e 2 (tempo real) concluídas: tema, layout, componentes base, cliente HTTP, sessão com refresh, login, troca de senha, recuperação de senha, guardas de rota, menu pelo papel da conta e conexão WebSocket com indicador na barra superior. Do menu, só **Contas** (`features/accounts`) está pronta, antecipada da Fase 4; as demais telas ainda são placeholders. Tela pronta entra no mapa `pages` de `src/app/router.tsx`, com `lazy()`.

Fases seguintes: 3 paridade com o painel atual · 4 menus novos (comunicados, contas, vínculos, notificações) · 5 entrega (PWA, Docker, nginx).

## API e sessão — como usar

- Chamada autenticada: `api.get/post/put/patch/delete` de `src/core/api/api.ts`, com caminho relativo a `/v3/api` e o tipo do `data` (`api.get<Exhaust[]>("/exhausts")`). Tipos vêm de `components["schemas"]` em `schema.gen.ts`.
- Chamada pública (login, recuperar senha, `/legal`): `sendRequest` de `src/core/api/http.ts`.
- Todo erro é um `ApiError`; a tela decide por `error.type` e mostra `errorMessage(error)`.
- 401 numa chamada autenticada renova a sessão uma vez e repete a chamada uma vez. Rota em que 401 é resposta de negócio (ex.: "Senha atual incorreta") passa `{ noRefreshOn401: true }`.
- Sessão: `useSession()` para ler; `signIn`/`signOut` em `core/session/sessionActions.ts`; rota que devolve `SessionData` (troca/recuperação de senha) entrega para `startSession`. Tokens ficam no `localStorage` e só `core/session/sessionStore.ts` os toca.
- O refresh token é de uso único: a renovação é serializada dentro da aba e, entre abas, por Web Lock. Não chamar `/auth/refresh` por fora do `sessionStore`.
- Mutations nunca repetem sozinhas (`queryClient.ts`): incluem comandos em equipamento físico.
- Formulário: `useForm` + `zodResolver`, campos com `FormTextField`/`FormPasswordField`, erros de campo do servidor com `applyValidationErrors`. As mensagens de validação da API vêm em inglês — validar no cliente com mensagem em português.
- Testes: `fakeApi({ "POST /auth/login": () => okResponse(...) })` de `src/test/fakeApi.ts`, `renderApp(path)` de `src/test/renderApp.tsx` e `installFakeWebSocket()`/`lastSocket()` de `src/test/fakeWebSocket.ts`.

## Tempo real — como usar

- Uma conexão por aba (`core/realtime/realtime.ts`), ligada pelo `AppLayout` enquanto há sessão. Telas não abrem socket.
- Receber evento: `useRealtimeEvent<Exhaust>("exhaust.changed", (data) => ...)`. Eventos são deltas: a tela carrega o estado pela REST e aplica o evento no cache (`queryClient.setQueryData`). O `data` não é validado: tratar como o formato da rota REST equivalente.
- A cada conexão aberta (inclusive reconexão) as consultas ativas são recarregadas: o que chegou com o socket fora se perdeu.
- Consulta que depende de eventos usa `refetchInterval: useRealtimeFallbackInterval(15_000)`: sem polling com o socket conectado, polling enquanto ele estiver fora.
- O navegador não informa por que o upgrade foi recusado (401, 429 com mais de 3 sockets por conta, 503): toda falha vira nova tentativa, de 1 s dobrando até 30 s. Fechamento 4001 (token do ticket expirou) renova a sessão e reconecta na hora.
- Aba em segundo plano solta o socket depois de 60 s e reconecta ao voltar, para abas esquecidas não ocuparem as 3 vagas da conta.
- `upstream.connection.changed` alimenta o aviso "Dados podem estar desatualizados"; esse estado é zerado a cada reconexão, e cada tela mostra a situação real do seu equipamento pela REST.

## Convenções

- Tema: cores e tipografia só em `src/core/ui/theme/`. Componentes usam a paleta (`primary.main`, `text.secondary`, `theme.vars.palette.soft.*`), nunca hex solto.
- No `Typography`, a prop `color` aceita `textPrimary`/`textSecondary`/`textDisabled`; caminho de paleta com ponto (`text.secondary`) só funciona dentro de `sx`.
- Menu: `src/app/navigation.ts` é a lista única de telas e papéis. Tela nova = entrada ali + rota em `src/app/router.tsx`.
- Papel: `user.role` pode ser `porteiro`, `sindico`, `admin`, `morador` ou `null`. Só os três primeiros entram no painel (`staffRoleOf`); os demais veem a tela "Painel de uso da equipe".
- Texto para o usuário em português do Brasil, com acentuação.
- Termo de Uso e Política de Privacidade são do aplicativo dos moradores (Google Play). O painel é interno da equipe: não pede aceite e ignora `mustAcceptTerms` (decisão de 15/11/2026).
- Dockerfile (Fase 5): usar `npm install`, não `npm ci` — o `npm ci` falha no build do Portainer do servidor.
