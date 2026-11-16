# Nova Residence — Painel Administrativo v3

Painel web da equipe do condomínio (portaria, síndico, administração) sobre a `nova-api` v3, com Material UI.

Fica no mesmo repositório do painel atual, na branch `nova-versao`. O painel atual (branch `main`) continua em produção até o corte.

## Stack

- Vite + React 19 + TypeScript
- Material UI 9
- React Router 7, TanStack Query, React Hook Form + Zod
- Service worker próprio (`vite-plugin-pwa`): instalável e com Web Push
- Vitest + Testing Library

## Execução local

```bash
npm install
cp .env.example .env   # ajuste V3_PROXY_TARGET
npm run dev            # http://localhost:8081
```

O painel fala sempre com a própria origem (`/v3/api`, `/v3/ws`). Em desenvolvimento o Vite repassa `/v3` para `V3_PROXY_TARGET`; em produção, o nginx do container repassa para `nova-api:3031`.

**Atenção:** com o proxy configurado o painel fala com a API real — comandos acionam portões, portas, exaustores e a central de incêndio de verdade.

## Validação

```bash
npm run lint
npm test
npm run build
```

## Implantação (Portainer)

O container `nova-front-v3` roda lado a lado com o painel atual (`nova-front`), na mesma rede `nova-network` da `nova-api`.

1. **Stack nova** no Portainer, a partir do Git:
   - repositório `nova-front`, referência `refs/heads/nova-versao`;
   - arquivo `docker-compose.yml`;
   - variável opcional `FRONT_V3_PORT` (padrão `8081`): porta no servidor.
   - Não há variável de build: nada de `VITE_*`, o painel não tem configuração no bundle.
2. **Rede:** a `nova-network` já existe (é a mesma da API). O nginx do painel encontra a API pelo nome `nova-api`.
3. **Cloudflare:** um hostname novo no túnel apontando para `http://<servidor>:<FRONT_V3_PORT>`, e a política do Cloudflare Access para esse hostname, se o painel novo continuar atrás dele.
4. **Conferir depois do deploy:**
   - abrir o endereço e entrar com uma conta da equipe;
   - a barra superior deve mostrar "Tempo real" (WebSocket passando pelo nginx);
   - `https://<endereço>/v3/api/health` deve responder pela própria origem;
   - em Minha conta, "Ativar alertas" e um aviso de teste em Notificações.

O que o nginx faz (`nginx.conf`):

- repassa `/v3/` e `/v3/ws` (com upgrade de WebSocket) para a API;
- serve o painel como SPA;
- aplica CSP e cabeçalhos de segurança em todas as respostas (`nginx-security-headers.conf`);
- não guarda em cache `sw.js` nem o manifesto.

## Documentação

- `CLAUDE.md` — contexto do projeto, regras e estado atual.
- `AGENTS.md` — arquitetura e processo.
- `CHANGELOG.md` — histórico.
- `../CHECKLIST-FRONT-V3.md` (raiz do workspace) — andamento, pendências e decisões.

## Licença

Proprietária — todos os direitos reservados, uso exclusivo do Condomínio Nova Residence.
