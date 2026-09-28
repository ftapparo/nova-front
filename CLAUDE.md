# FRONT — Painel Administrativo Nova Residence

Painel web usado pela portaria/administração do Condomínio Nova Residence. Consome a `nova-api` para controle de acesso, portões, exaustores, central de incêndio, notificações push e configurações de usuário.

Veja `CHANGELOG.md` para o histórico de versões.

## Commits

Este projeto usa um fluxo de commit específico — ver skill `commit` (`.claude/skills/commit/SKILL.md`). Resumo: separar commits por grupo lógico de mudança, mensagem com subject curto + corpo completo, atualizar `CHANGELOG.md` (seção `[Unreleased]`) antes do commit, apresentar para aprovação antes de commitar, perguntar antes de dar push. Nunca criar versão numerada nem tocar no `package.json` sem pedido explícito de "versionar".

## Stack

- **React 18 + TypeScript + Vite**
- **React Router** (`react-router-dom`) para navegação
- **TanStack Query** (`@tanstack/react-query` v5) para data fetching/cache — ver `src/queries/`
- **Tailwind CSS v4** + **shadcn/ui** (Radix UI primitives em `src/components/ui/`)
- **React Hook Form + Zod** para formulários e validação
- **next-themes** para dark/light mode
- **Vitest + Testing Library** para testes

## Estrutura

```
src/
  components/
    ui/          # shadcn/ui — componentes gerados, evitar editar à mão sem necessidade
    dashboard/   # componentes específicos do painel
    layout/      # shell da aplicação
    theme/       # ThemeProvider (next-themes)
  contexts/      # AuthContext, DashboardContext
  hooks/
  lib/           # utilitários (cn(), etc.)
  pages/
    dashboard/   # páginas do painel (Controle de Acesso, Exaustores, etc.)
  queries/       # hooks TanStack Query por domínio (dashboardQueries, exhaustQueries, ...)
  services/      # cliente HTTP para a nova-api (api.ts)
  theme/         # tokens de tema
  test/          # setup de testes
```

## Comandos

```bash
npm run dev         # Vite dev server
npm run build        # build de produção
npm run build:dev    # build em modo development (debug)
npm run lint          # ESLint
npm test              # vitest run
npm run test:watch    # vitest watch
```

Rode `npm run lint` e `npm test` antes de considerar uma mudança pronta — ambos rodam rápido e pegam a maioria dos problemas de tipo/regressão de comportamento.

## Autenticação atual não é segurança real

`VITE_AUTH_USER`/`VITE_AUTH_PASS` (ver `.env.example`, `src/contexts/AuthContext.tsx`) são só um seletor de operador — **tudo com prefixo `VITE_` é embutido no bundle JS e visível no DevTools**, nunca colocar segredo real aí. A proteção de fato é o **Cloudflare Access** na borda, que autentica antes da aplicação carregar. Isso está planejado para virar login real contra a API (Supabase Auth) numa etapa futura — não tratar o estado atual como definitivo nem reforçar a ilusão de segurança no código.

## Domínio da API em transição

`VITE_API_BASE_URL` pode apontar para `api.novaresidence.com.br` (novo) ou `api.condominionovaresidence.com` (antigo, legado). Ao mexer em URLs hardcoded ou CORS, checar `.env.example` para o estado atual da migração antes de assumir qual domínio é o ativo.

## Convenções

- Toda chamada à API passa por `src/services/api.ts` — não fazer `fetch`/`axios` direto em componentes ou hooks de query.
- Hooks de polling (dashboard, exaustores) usam `refetchInterval`/`refetchIntervalInBackground` do TanStack Query — ao escrever teste que inspeciona essas opções via `queryCache.find()`, o tipo genérico do v5 não expõe esses campos sem cast (ver `src/queries/*.test.tsx` para o padrão já usado).
- `ThemeProviderProps` não é exportado publicamente por `next-themes@0.3.0` — usar `React.ComponentProps<typeof NextThemesProvider>` em vez de importar o tipo diretamente (ver `src/components/theme/ThemeProvider.tsx`).
- Componentes em `components/ui/` seguem o padrão shadcn/ui — ao precisar de um componente novo da mesma família, preferir gerar via CLI do shadcn em vez de escrever à mão, para manter consistência de estilo/acessibilidade.

## Outros serviços do ecossistema

- `nova-api`: backend principal, único consumido diretamente por este painel.
- `nova-tag`, `nova-cie`: não consumidos diretamente — sempre via gateway da `nova-api`.
