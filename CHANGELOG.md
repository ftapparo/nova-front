# Changelog

## [1.1.0] - 2026-03-24

### Adicionado
- Menu de opções (⋮) no card de Portões na tela de Controle de Acesso
- Opção **Reiniciar Antena** no menu, que abre modal de confirmação com seleção da antena e autenticação por senha do sistema
- Versão exibida dinamicamente na sidebar a partir do `package.json`
- Hash do build (commit git) exibido ao lado da versão na sidebar (`v1.1.0 (abc1234)`)
- Suporte a notificações Web Push com gerenciamento de subscriptions e eventos de alarme

### Corrigido
- PWA: service worker não ativava automaticamente após novo deploy — adicionado listener `SKIP_WAITING` para que atualizações sejam aplicadas sem fechar o navegador
- Login: estado de autenticação agora persiste corretamente entre sessões (opção "lembrar usuário")

### Alterado
- Fonte do rodapé "Desenvolvido por" na sidebar reduzida para melhor hierarquia visual

---

## [1.0.0] - 2026-02-01

### Adicionado
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
