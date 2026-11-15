# Changelog

## [Unreleased]

### Alterado
- Painel reescrito do zero na branch `nova-versao`, sobre a `nova-api` v3 e com Material UI no lugar de Tailwind/shadcn. Os arquivos do painel anterior (v2) saem desta branch e seguem na `main`, em produção, até o corte. As memórias de projeto e a skill de commit (`.claude/`) continuam. O histórico do painel anterior está no fim deste arquivo.

### Adicionado
- Tela **Portões e Portas** (Fase 3): portões ativos com situação ao vivo (fechado, abrindo, aberto, fechando, sem comunicação, mantido aberto, antena desconectada) e portas de pedestre com situação online. Abertura de portão só depois de conferir o CPF no cadastro do condomínio, com o tempo de fechamento automático (1 a 120 s, padrão 15) e registro da passagem no ERP logo depois de abrir, como no painel anterior. "Fechar" para toda a equipe; "Manter aberto" e "Reiniciar serviço do portão" para síndico/admin, com confirmação. Abrir porta direto da lista.
- Padrão de comando físico em `core/ui`: `useCommand` e `CommandButton` (travado durante o envio e na espera do `Retry-After`, aviso com a recusa do servidor, nunca repete sozinho).
- Tempo real pela `/v3/ws`: uma conexão por aba enquanto há sessão, com ticket de uso único, reconexão com espera de 1 s dobrando até 30 s, renovação da sessão e reconexão imediata no fechamento 4001, e recarga das consultas visíveis a cada conexão. Aba em segundo plano solta o socket depois de 60 s (cada conta tem até 3) e reconecta ao voltar. Indicador na barra superior: "Tempo real", "Conectando…"/"Reconectando…" ou "Dados podem estar desatualizados" quando a central de incêndio ou um portão perde a comunicação com a API. Base para as telas da Fase 3: `useRealtimeEvent` e `useRealtimeFallbackInterval` (polling só enquanto o socket está fora).
- Tela **Contas** (síndico/admin): lista as contas com perfil e marca de senha provisória, cria conta de equipe, reseta a senha (a provisória aparece uma única vez, só na tela), troca o perfil e exclui a conta, sempre com confirmação. Não oferece ação sobre a própria conta nem sobre conta de nível igual ou maior, e só admin concede o perfil de administrador. Trocar perfil e excluir dependem das rotas `PATCH`/`DELETE /auth/users/{accountId}` da API.
- Login real contra a `nova-api` v3 (`POST /auth/login`), com validação dos campos, mensagem de recusa do servidor e botão travado pelo tempo do `Retry-After` quando há excesso de tentativas.
- Sessão com access token de 15 min e refresh token de uso único: renovação pouco antes de expirar e no 401 (uma renovação, uma repetição), serializada dentro da aba e entre abas (Web Locks); login e logout acompanham as outras abas.
- Troca obrigatória de senha provisória e recuperação de senha por código de 6 dígitos. O painel não pede aceite do Termo de Uso nem mostra a Política de Privacidade: os dois são do aplicativo dos moradores, e o painel é interno da equipe.
- Guardas de rota: sem sessão vai para o login e volta para a tela pedida; conta sem papel de equipe vê "Painel de uso da equipe"; tela de síndico/admin responde "Acesso negado" ao porteiro. O menu passa a seguir o papel da conta.
- Menu do usuário na barra superior (e-mail, perfil e "Sair"); o logout limpa a sessão local mesmo se a chamada falhar.
- Cliente HTTP da v3 (`core/api`): envelope, `ApiError` por `error.type`, `Retry-After`, erros de campo e tipos gerados do OpenAPI (`npm run gen:api`).
- TanStack Query, React Hook Form e Zod; campos de formulário `FormTextField` e `FormPasswordField`.
- Projeto criado do zero (Vite + React 19 + TypeScript estrito + Material UI 9 + React Router 7), independente do painel atual (`FRONT/`).
- Tema Material UI com a identidade do Nova Residence (roxo e dourado da marca, cores de status, fonte Geist), nos modos claro, escuro e sistema, com seletor na barra superior.
- Layout base: `AppShell` com menu lateral recolhível no desktop e em gaveta no celular, barra superior, `PageContainer` e `PageHeader`.
- Componentes base em `core/ui`: `SectionCard`, `StatusChip`, `EmptyState`, `ErrorState`, `ConfirmDialog`, `BrandLogo` e avisos (`NotifyProvider`/`useNotify`).
- Menu declarativo por papel (`porteiro`, `sindico`, `admin`) em `src/app/navigation.ts`, com os grupos Operação, Comunicação, Administração e Conta; cada item tem rota com tela de placeholder.
- Proxy de desenvolvimento `/v3` → `V3_PROXY_TARGET` (a v3 da API não tem CORS; o painel fala sempre com a própria origem).
- ESLint, Vitest + Testing Library e documentação (`CLAUDE.md`, `AGENTS.md`, `README.md`).

---

# Histórico do painel anterior (v2)

Entradas do painel Tailwind/shadcn que falava com a `/v2/api`, substituído pelo painel v3 nesta branch.

### Últimas mudanças não versionadas

#### Alterado
- Licença: de MIT para proprietária (todos os direitos reservados, uso exclusivo do Condomínio Nova Residence). Arquivo `LICENSE` criado; README e `package.json` (`UNLICENSED`) atualizados.

#### Corrigido
- CSP do `nginx.conf` libera o Cloudflare Web Analytics (`static.cloudflareinsights.com` em `script-src`, `cloudflareinsights.com` em `connect-src`): o script injetado pela Cloudflare era bloqueado e gerava erro no console.
- `manifest.json` bloqueado por CORS atrás do Cloudflare Access: o navegador buscava o manifest sem cookies, o Access redirecionava para o login (outro domínio) e a resposta era barrada. `<link rel="manifest">` agora usa `crossorigin="use-credentials"`, enviando o cookie de sessão do Access.

#### Adicionado
- `AGENTS.md` com regras genéricas de processo/arquitetura para agentes de IA, baseado em `AI-Friendly Architecture Specification.md` (raiz do workspace).

### [1.1.0] - 2026-03-24

#### Adicionado
- Menu de opções (⋮) no card de Portões na tela de Controle de Acesso
- Opção **Reiniciar Antena** no menu, que abre modal de confirmação com seleção da antena e autenticação por senha do sistema
- Versão exibida dinamicamente na sidebar a partir do `package.json`
- Hash do build (commit git) exibido ao lado da versão na sidebar (`v1.1.0 (abc1234)`)
- Suporte a notificações Web Push com gerenciamento de subscriptions e eventos de alarme

#### Corrigido
- PWA: service worker não ativava automaticamente após novo deploy — adicionado listener `SKIP_WAITING` para que atualizações sejam aplicadas sem fechar o navegador
- Login: estado de autenticação agora persiste corretamente entre sessões (opção "lembrar usuário")

#### Alterado
- Fonte do rodapé "Desenvolvido por" na sidebar reduzida para melhor hierarquia visual

---

### [1.0.0] - 2026-02-01

#### Adicionado
- Tela de Controle de Acesso com abertura de portas e portões
- Validação de acesso por CPF antes de abrir portão
- Nomes personalizados para portas (editável por usuário)
- Tela Central de Incêndio com estado em tempo real, logs e comandos
- Confirmação de disparo de alarme geral
- Sincronização de altura entre cartões na Central de Incêndio
- Tela de Controle de Exaustão
- Tela de Veículos com cadastro, vínculo de TAG e proprietário
- Autenticação com controle de sessão
- Tema claro/escuro com persistência e sincronização de meta de cor
- PWA com suporte a instalação e notificações push
- Sidebar com navegação entre módulos
