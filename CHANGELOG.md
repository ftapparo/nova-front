# Changelog

## [Unreleased]

### Corrigido
- Consultas e Veículos quebravam a tela ("person.alertaPortaria?.trim is not a function") ao mostrar uma pessoa: aviso para a portaria e observações são campos de texto longo do ERP e chegam da API como bytes, não como texto. Todo texto do ERP nessas telas passa a ser lido por `erpText`, que aceita texto, número ou bytes (UTF-8 ou Windows-1252).
- Erro inesperado numa tela mostrava a página técnica do React Router; agora cada tela mostra uma mensagem do painel com "Recarregar", mantendo o menu, e o detalhe vai só para o console.

### Alterado
- Portões e Portas: fechamento automático padrão passa a 5 s (decisão de 16/11/2026).
- Testes esperam até 5 s pela tela (`asyncUtilTimeout`) e até 20 s por teste: com a suíte em paralelo, a primeira tela carregada sob demanda em cada arquivo passava do prazo padrão de 1 s e o teste falhava de forma intermitente.
- Painel reescrito do zero na branch `nova-versao`, sobre a `nova-api` v3 e com Material UI no lugar de Tailwind/shadcn. Os arquivos do painel anterior (v2) saem desta branch e seguem na `main`, em produção, até o corte. As memórias de projeto e a skill de commit (`.claude/`) continuam. O histórico do painel anterior está no fim deste arquivo.

### Adicionado
- Central de Incêndio: bloquear e desbloquear dispositivo, zona ou regra e ativar e desativar saída (sirene, saída, atuador), só para admin (decisão de 16/11/2026). O alvo é escolhido pelo nome no cadastro da central, cada envio pede confirmação e nunca se repete sozinho.
- Portões e Portas: cada pessoa pode dar nome próprio às portas de pedestre (o cadastro continua visível ao lado). O nome fica nas preferências da conta, no banco, vale em qualquer computador e aparece também nos atalhos do Painel Operacional.
- Entrega (Fase 5): Dockerfile (Node 22, `npm install`, sem variáveis de build), `docker-compose.yml` com o container `nova-front-v3` na `nova-network` (porta `FRONT_V3_PORT`, padrão 8081) e nginx que repassa `/v3/` e `/v3/ws` (WebSocket) para `nova-api:3031`, resolvendo o nome a cada requisição para subir mesmo com a API fora do ar. CSP e cabeçalhos de segurança em todas as respostas, inclusive nos locations com cache próprio. Passo a passo de implantação no README.
- Manifesto do PWA: o painel pode ser instalado, com ícones, cor da marca e atalhos para Portões e Portas, Central de Incêndio e Acessos (com o cookie do Cloudflare Access no pedido do manifesto).
- **Equipamentos** ganha o cache de TAGs de cada antena (TAG, liberada ou recusada, quando foi conferida e de quem é, com o tempo de guarda; síndico/admin removem uma TAG ou limpam o cache, com confirmação) e, para admin, o envio de comando direto a um módulo de exaustor (Tasmota), com confirmação e a resposta do módulo. Fecha a Fase 4.
- Tela **Minha conta** (Fase 4, toda a equipe): e-mail e perfil, trocar senha, sair, tema deste navegador, alertas neste navegador e as preferências das notificações do aplicativo da própria conta (alertas da central além do alarme, comunicado novo, avisos do exaustor). "Minha conta" também no menu do usuário.
- Painel Operacional lembra de ativar os alertas de incêndio quando estão desativados ou bloqueados neste navegador.
- Tela **Notificações** (Fase 4, síndico/admin): alertas neste navegador (ativar e desativar o Web Push que recebe alarme e falha da central e os avisos à equipe), aviso para a equipe com confirmação e o resultado da entrega, e teste nos aparelhos do aplicativo da própria conta.
- Service worker (`src/sw/sw.ts`, `vite-plugin-pwa`) com precache do build e Web Push, antecipado da Fase 5 porque os alertas dependem dele. Clicar na notificação abre o painel na tela indicada (Central de Incêndio por padrão), convertendo os endereços antigos que a central ainda envia.
- Os alertas do navegador seguem a conta: saem no logout e voltam sozinhos no login quando a permissão já foi dada, como no painel anterior.
- Tela **Reset de senha** (Fase 4, toda a equipe): busca o morador pelo CPF e gera a senha provisória da conta vinculada a ele, mostrada uma única vez. Avisa quando a pessoa não tem conta no aplicativo ou quando o perfil não pode resetar aquela conta. O diálogo de reset passa a ser o mesmo da tela Contas.
- Tela **Vínculos** (Fase 4, síndico/admin): contas de morador sem vínculo (para vincular) e contas vinculadas, com o número do cadastro, quem fez o vínculo (o próprio morador ou a equipe) e quando. Vincular busca a pessoa pelo CPF e mostra nome e unidades para conferir antes de gravar; remover pede confirmação. Busca por e-mail.
- Tela **Comunicados** (Fase 4): comunicados do condomínio com categoria, etiqueta, datas e situação no carrossel do aplicativo, com "Ler tudo" e "Carregar mais". Síndico/admin publicam (categoria, etiqueta, título, texto, agendamento, validade, fixar ou horas no carrossel, aviso pelo aplicativo), fixam e desafixam, mudam o tempo no carrossel e arquivam, com confirmação.
- **Painel Operacional** (Fase 3), a tela inicial: resumo da central de incêndio, dos equipamentos fora do ar e dos exaustores ligados (cada bloco leva à tela do assunto); atalhos por conta, gravados nas preferências da conta sem apagar as do aplicativo (porta abre direto, portão leva à conferência do CPF com ele já escolhido); últimas passagens e últimos comandos. Atualiza pelo tempo real.
- Preferências da conta (`/me/settings`) em `core/settings/userSettings.ts` (`useSetting`), com as chaves do painel no prefixo `painel.`.
- Portões e Portas aceita `?portao=N` para abrir com o portão já escolhido.
- Tela **Equipamentos** (Fase 3): comunicação com a API de portões, portas, módulos de exaustor (agrupados por torre e finais 1 a 4 / 5 a 8) e central de incêndio, com quantos estão fora do ar e quando a API verificou. Recarrega com os avisos do tempo real.
- Consultas de portões, portas, exaustores e central expostas como `queryOptions` nos `*Api.ts`, para as telas que mostram o mesmo dado dividirem o cache.
- Tela **Histórico de comandos** (Fase 3): últimos 50, 100 ou 200 comandos enviados a portões, portas, exaustores e à central (pelo painel anterior, pelo novo e pelo aplicativo), com a ação em português e o equipamento quando o caminho indica, quem enviou e o resultado. Filtro "Só falhas"; comando novo entra no topo pelo tempo real.
- Telas **Consultas** e **Veículos** (Fase 3). Consultas: cadastro do condomínio por CPF (pessoa, foto, aviso para a portaria, unidades e vínculo), placa ou TAG (veículo, unidade, proprietário e credenciais de acesso). Veículos, no fluxo do painel anterior: busca do proprietário por CPF com conferência do vínculo, lista dos veículos, cadastro de placa (recusa placa de outro proprietário, busca marca/modelo/cor nas fontes externas ou deixa digitar), vincular ou trocar TAG (troca só com confirmação), remover TAG e desvincular do proprietário, com confirmação.
- Formatação de CPF, placa e TAG compartilhada em `core/format/documents.ts`.
- Tela **Central de Incêndio** (Fase 3): situação geral da central como manchete (cor pela gravidade, silenciada, reiniciando, reconectando, regras temporizando, último erro) e contadores; eventos ativos agora por tipo (alarme, falha, supervisão; bloqueios pelos contadores, já que a central não lista quais são); histórico por tipo com "Só ocorrências" e "Carregar mais"; instalação com busca de dispositivo sem diferenciar acento. Comandos do painel anterior: silenciar bip, silenciar/reativar sirenes conforme o LED da central, disparar alarme geral e reiniciar a central, os dois últimos com confirmação. Atualiza a cada evento da central pelo tempo real.
- Tela **Exaustores** (Fase 3): os 24 exaustores agrupados por torre, com situação ao vivo (ligado, desligado, ligando, desligando, falha no último comando, módulo offline, em manutenção) e a hora em que desliga sozinho. Ligar com tempo padrão de 3 h ou outro tempo (de 30 min a 24 h), reiniciar o tempo de quem já está ligado e desligar com confirmação. Filtro "Só ligados". Síndico/admin marcam e liberam manutenção.
- Tela **Acessos** (Fase 3): últimas passagens de todos os portões juntas (as 30 mais recentes, com filtro por portão e data e hora do ERP sem conversão de fuso), conferência de credencial por CPF, placa, TAG ou ID (só consulta, não abre nem registra) e leituras de TAG ao vivo pelo tempo real, inclusive as recusadas, com o motivo.
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
