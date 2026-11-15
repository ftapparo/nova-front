# Nova Residence — Painel Administrativo v3

Painel web da equipe do condomínio (portaria, síndico, administração) sobre a `nova-api` v3, com Material UI.

Projeto independente do painel atual (`FRONT/`), que continua em produção até o corte.

## Stack

- Vite + React 19 + TypeScript
- Material UI 9
- React Router 7
- Vitest + Testing Library

## Execução local

```bash
npm install
cp .env.example .env   # ajuste V3_PROXY_TARGET
npm run dev            # http://localhost:8081
```

O painel fala sempre com a própria origem (`/v3/api`, `/v3/ws`). Em desenvolvimento o Vite repassa `/v3` para `V3_PROXY_TARGET`.

**Atenção:** com o proxy configurado o painel fala com a API real — comandos acionam portões, portas, exaustores e a central de incêndio de verdade.

## Validação

```bash
npm run lint
npm test
npm run build
```

## Documentação

- `CLAUDE.md` — contexto do projeto, regras e estado atual.
- `AGENTS.md` — arquitetura e processo.
- `CHANGELOG.md` — histórico.

## Licença

Proprietária — todos os direitos reservados, uso exclusivo do Condomínio Nova Residence.
