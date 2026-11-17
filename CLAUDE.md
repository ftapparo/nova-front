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
- `vite-plugin-pwa` com service worker próprio (`src/sw/sw.ts`, `injectManifest`): precache do build e Web Push. Tipado à parte em `tsconfig.sw.json` (lib WebWorker). O manifesto do app instalável fica para a Fase 5.
- A entrar só quando forem usados: MUI X (Data Grid, Date Pickers).

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

Nos testes, `findBy*`/`waitFor` esperam até 5 s (`src/test/setup.ts`): com a suíte em paralelo, a primeira tela carregada com `lazy()` em cada arquivo passa de 1 s.

`npm run dev` com `V3_PROXY_TARGET` configurado fala com a **API real**. Não usar para "testar" comandos.

## Estado atual

Fases 0 a 5 concluídas: fundação, API e sessão, tempo real, paridade com o painel atual, menus novos e entrega (Docker, nginx, PWA). Todas as telas do menu estão prontas: Painel Operacional, Portões e Portas, Acessos, Consultas, Veículos, Exaustores, Central de Incêndio, Comunicados, Notificações, Contas, Vínculos, Reset de senha, Histórico de comandos, Equipamentos (com cache de TAGs e configuração de módulo) e Minha conta. Tela pronta entra no mapa `pages` de `src/app/router.tsx`, com `lazy()`; cada tela tem `errorElement` próprio (`RouteErrorPage`), então um erro inesperado mantém o menu e mostra "Recarregar".

Publicado em https://portal.novaresidence.com.br desde 16/11/2026 (stack `nova-front-v3` no Portainer, branch `nova-versao`, porta 8088), ao lado do painel atual; passo a passo no `README.md`. Itens abertos e decisões pendentes ficam em `../CHECKLIST-FRONT-V3.md`.

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

## Comandos físicos — como usar

- Todo comando em equipamento (portão, porta, exaustor, central) usa `useCommand` + `CommandButton` (`core/ui`): botão carregando durante o envio, travado com "Aguarde N s" no 429, aviso com o `detail` do servidor no erro e **nunca repete sozinho** (vários comandos alternam estado).
- Ação destrutiva ou de exceção (manter portão aberto, reiniciar serviço, alarme geral) passa antes por `ConfirmDialog`.
- Se a resposta do comando traz o estado do equipamento, aplicar no cache (`setQueryData`) em vez de esperar o evento do tempo real.

## Portões e Portas — regras da portaria

- O portão só abre depois de conferir o CPF (`GET /access/verify`): cadastro liberado (`PERMITIDO = S`) e pessoa proprietária, locatária ou moradora. Regra herdada do painel anterior.
- Depois de abrir, a passagem é registrada no ERP (`POST /access/register`, `formaAcesso: "TAG"`, como no painel anterior). Se o registro falhar, o aviso diz que o portão abriu mas a passagem não foi registrada.
- Fechamento automático padrão de **5 s** (decisão de 16/11/2026); a API aceita de 1 a 120 s.
- "Fechar" vale para toda a equipe; "Manter aberto" e "Reiniciar serviço" só para síndico/admin, com confirmação.
- Nome de porta é por pessoa: preferência `painel.nomes-portas` (`{ idDaPorta: nome }`) em `/me/settings`, lida com `doorDisplayName`. Vale também nos atalhos do Painel Operacional.
- O estado das antenas só vem por evento (`antenna.connection.changed`); não há rota REST para ele.

## Acessos — regras

- Últimas passagens: `GET /access/recent` por portão (20 de cada), juntas e ordenadas; mostra as 30 mais recentes. São consultadas a cada 15 s mesmo com o tempo real conectado: o TAG grava a passagem segundos depois de o portão fechar e não há evento dessa gravação. Cada `tag.read` antecipa a consulta do portão.
- `DATAHORA` do ERP vem sem fuso, já no horário do condomínio: formatar o texto (`formatErpDateTime`), nunca passar por `new Date()`.
- Conferir acesso só consulta (`GET /access/verify`); não abre nem registra.
- Leituras ao vivo (`tag.read`, inclusive recusadas) ficam só em memória, enquanto a tela está aberta.
- Registro manual de passagem (sem abrir portão) ainda não existe: falta definir a `formaAcesso` gravada no ERP para esse caso.

## Exaustores — regras

- A lista vem do servidor já filtrada (a equipe vê os 24); o painel não calcula acesso.
- Tempo padrão de 3 h e mínimo de 30 min (herdados do painel anterior); teto de 24 h (API). A equipe não envia localização.
- Ligar com o exaustor já ligado reinicia o tempo sem desligar.
- "Ligando…"/"Desligando…" vêm de `processStatus = iniciando` + `command`. Desligar continua disponível com "Ligando…", para um comando travado não prender o relé ligado.
- Manutenção (síndico/admin) só bloqueia ligar (409); não desliga quem já está ligado.
- `expiresAt` do exaustor é epoch em **milissegundos**.

## Central de Incêndio — regras

- O backend interpreta cada evento: nunca ler `eventType` nem desmontar `deviceName`. Usar `event` (rótulo, natureza, gravidade) e `display` (cada dado no seu campo); local por `placeLabel`, que só junta os rótulos prontos.
- A manchete é `situation` (`/cie/panel`). Cor por `severity`.
- Ativos agora: `/cie/events/active`. Bloqueio não tem lista (a central não fornece): mostrar `/cie/counters/blocks`.
- Histórico paginado por cursor (`nextCursor` dentro de `data`); "Só ocorrências" = `kind=ativacao`.
- Qualquer evento `cie.*` recarrega painel, ativos e histórico pela REST (com espera de 500 ms para juntar a rajada), em vez de aplicar cada evento.
- Comandos: os quatro do painel anterior (silenciar bip, silenciar/reativar sirenes pelo LED `sireneSilenciada`, alarme geral, reiniciar). Alarme geral e reinício passam por confirmação e mandam `confirm: true`. Bloqueio e saída por dispositivo não estão no painel.
- Bloqueio (dispositivo, zona, regra) e acionamento de saída: **só admin** na tela (decisão de 16/11/2026), com o alvo escolhido no cadastro da central e confirmação. `tipoBloqueio`: 0 dispositivo (inclui sirene, saída, atuador), 1 zona, 2 regra (protocolo Intelbras); zona e regra vão com `laco: 0`. A API também exige admin nessas rotas desde 16/11/2026.
- `dataHora.timestamp` do painel é epoch em milissegundos.

## Consultas e Veículos — regras

- As duas telas ficam em `features/registry` (cadastro do condomínio no ERP) porque Veículos reaproveita a consulta de CPF e o cartão de pessoa.
- Resultados têm dado pessoal (CPF, telefone, foto): ficam no estado da tela (mutation) ou em consulta com `gcTime: 0`, nunca em storage.
- Veículos segue o painel anterior: busca o proprietário pelo CPF e confere o vínculo (`/access/verify` no primeiro portão de entrada ativo); sem vínculo liberado, não cadastra veículo.
- Placa já ligada a outro proprietário ou unidade é recusada antes da busca externa (`plateOwnedByOther`). A busca externa (`/vehicles/plate/lookup`) é lenta e limitada a 5 por minuto; se falhar, a portaria digita marca, modelo e cor.
- TAG: 10 dígitos, validada no portão de entrada, com o CPF do proprietário. 409 com título "Confirmação necessária" pede confirmação e reenvia com `forceSwap: true`.
- CPF, placa e TAG: formatação em `core/format/documents.ts`.
- **Campos de texto longo do ERP chegam como bytes** (`{ type: "Buffer", data: [...] }`), não como texto: observações, aviso para a portaria e afins. Todo texto do ERP exibido passa por `erpText`/`joinErpText` (`core/format/erpText.ts`), que lê texto, número ou bytes (UTF-8, ou Windows-1252 se não for UTF-8 válido). Nunca chamar `.trim()` ou renderizar campo do ERP sem passar por ele.

## Painel Operacional — regras

- Resumo da central, equipamentos fora do ar e exaustores ligados, com as mesmas consultas (`queryOptions`) das telas de cada assunto.
- Atalhos por conta em `/me/settings`, chave `painel.atalhos` (JSON), via `useSetting` (`core/settings/userSettings.ts`). O PUT substitui todas as preferências: `useSetting` relê do servidor e mescla antes de gravar, para não apagar as do aplicativo.
- Atalho de porta abre direto; atalho de portão leva a `/portoes-portas?portao=N`, porque a abertura exige a conferência do CPF.

## Comunicados — regras

- São os mesmos comunicados do aplicativo dos moradores. Toda a equipe lê; publicar, fixar, mudar o tempo no carrossel e arquivar são de síndico/admin.
- A lista (`GET /messages`) só traz os visíveis agora: agendado aparece quando chegar a data, e arquivado ou vencido some. A tela avisa isso ao agendar.
- Fixado tem sempre tempo 0 no carrossel; para mudar o tempo, desafixar antes.
- Datas do formulário (`datetime-local`) são no horário do computador e vão para a API em ISO.

## Vínculos — regras

- Vínculo = conta do aplicativo ligada a `PESSOAS.SEQUENCIA` do ERP; é o que dá acesso de morador. Uma pessoa, uma conta (409 se já tiver outra).
- A API não informa o nome da pessoa no vínculo nem tem busca por número: a lista mostra o número do cadastro, e o nome aparece só ao vincular (busca por CPF).
- "Sem vínculo" = contas sem vínculo e sem papel de equipe. O e-mail vem de `allAccountsQuery` (todas as páginas de `/auth/users`).
- Autovínculo: `linkedBy` igual ao `accountId`.

## Reset de senha — regras

- Parte do CPF do morador (`/queries/cpf` → `POST /auth/password/staff-reset { personSequencia }`), porque o porteiro não lista contas. 404 = pessoa sem conta vinculada.
- Hierarquia da API: porteiro reseta morador; síndico, morador e porteiro; admin, qualquer conta. 403 vira "Seu perfil não pode resetar a senha desta conta".
- A senha provisória aparece uma vez, só no diálogo (`ResetPasswordDialog`, o mesmo da tela Contas), e some ao fechar.

## Notificações e Web Push — regras

- Web Push é dos navegadores do painel (equipe): a central de incêndio avisa alarme e falha por `/push/send`. Moradores recebem pelo aplicativo (FCM), não por aqui.
- `core/push/webPush.ts`: a inscrição é da conta logada. `signOut` tira o navegador **antes** do `/auth/logout` (precisa do token); no login, `useResumePush` reinscreve sem perguntar se a permissão já foi dada. Pedir permissão só a partir de clique (`PushBrowserCard`).
- O service worker converte os endereços antigos que a central manda (`/dashboard/incendio`) para os do painel novo (`/incendio`).
- "Aviso para a equipe" (síndico/admin) usa `/push/send`; "Teste no aplicativo" usa `/notifications/test` (aparelhos da própria conta). O teste do alarme por aparelho (`/notifications/test/fire-alarm`) não está no painel: exige o identificador da instalação do app.

## Equipamentos — cache de TAGs e módulos

- Cache de TAGs (`/tag/cache`, por antena): toda a equipe consulta; síndico/admin removem uma TAG ou limpam (com confirmação). Tem dado de morador: consulta com `gcTime: 0`. Tempos de guarda vêm em ms no `stats` (liberada 5 min, recusada 1 min).
- Configuração de módulo (`/exhausts/modules/{modulo}/config`): só admin, comando backlog do Tasmota já codificado para URL, com confirmação; a resposta do módulo é mostrada como veio.

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
- Consulta usada por mais de uma tela fica como `queryOptions` no `*Api.ts` da feature dona (ex.: `gatesListQuery`, `exhaustsQuery`, `panelQuery`): mesma chave = mesmo cache para todas as telas.
- Menu: `src/app/navigation.ts` é a lista única de telas e papéis. Tela nova = entrada ali + rota em `src/app/router.tsx`.
- Papel: `user.role` pode ser `porteiro`, `sindico`, `admin`, `morador` ou `null`. Só os três primeiros entram no painel (`staffRoleOf`); os demais veem a tela "Painel de uso da equipe".
- Texto para o usuário em português do Brasil, com acentuação.
- Termo de Uso e Política de Privacidade são do aplicativo dos moradores (Google Play). O painel é interno da equipe: não pede aceite e ignora `mustAcceptTerms` (decisão de 15/11/2026).
- Dockerfile: usar `npm install`, não `npm ci` — o `npm ci` falha no build do Portainer do servidor.
- nginx: todo `location` com `add_header` próprio precisa de `include /etc/nginx/snippets/security-headers.conf;` — um `add_header` no location descarta os do server, e a CSP sumiria.
