# Nova Residence Frontend

Frontend web do portal administrativo da portaria.

## Stack

- Vite
- React + TypeScript
- Tailwind CSS
- shadcn/ui

## Execucao local

```bash
npm i
npm run dev
```

## Build

```bash
npm run build
```

## Web Push

- O app registra Service Worker via `vite-plugin-pwa`.
- No login, tenta registrar subscription de push no endpoint `/v2/api/push/subscriptions`.
- No logout, remove a subscription via `/v2/api/push/subscriptions`.
- Em producao, Web Push exige HTTPS e permissao de notificacao concedida pelo navegador.

## UI/UX Guidelines (padrao global)

As paginas devem seguir o mesmo conceito visual da tela de veiculos.

### 1) Estrutura de pagina

- Use `PageContainer` (`@/components/layout/PageContainer`) como raiz da pagina.
- Use `size="default"` (`max-w-5xl`) por padrao.
- Use `size="wide"` (`max-w-6xl` e `2xl:max-w-7xl`) apenas para conteudo naturalmente denso (tabelas/relatorios).
- Espacamento vertical principal: `space-y-6`.

### 2) Cabecalho

- Use `PageHeader` (`@/components/layout/PageHeader`) com:
  - titulo: `text-2xl font-bold text-foreground`
  - descricao: `text-muted-foreground`
- Acoes globais da pagina devem entrar na prop `actions`.

### 3) Secoes em card

- Use `Card` + `SectionCardHeader` (`@/components/layout/SectionCardHeader`) para secoes principais.
- Titulos de secao devem usar `text-base`.
- Acoes da secao devem ficar ao lado direito no header do card.

### 4) Formularios e acoes

- Campos e selects com altura padrao `h-9`.
- Botoes principais de formulario com altura `h-9` (ou `h-11` quando semantica pedir CTA maior).
- Em buscas, manter input e botao juntos e evitar acao primaria somente por icone.

### 5) Cores e superficies

- Use tokens de tema (`bg-card`, `bg-muted`, `text-foreground`, `text-muted-foreground`, `border-*`).
- Evite hex inline em paginas (`#...`).
- Estados de feedback devem seguir tokens semanticos (`destructive`, tons `emerald/rose` quando aplicavel).

## Componentes de layout compartilhados

- `src/components/layout/PageContainer.tsx`
- `src/components/layout/PageHeader.tsx`
- `src/components/layout/SectionCardHeader.tsx`
