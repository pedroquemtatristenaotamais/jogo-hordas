# Checkpoint — 30/10/2026

Checkpoint solicitado pelo usuário antes de sair. Branch: `main`.

## Já implementado

- Logo correto da escola embutido em Base64 e escala proporcional na Intro.
- Menu com ciclo de dia/noite, vila com igreja, árvores detalhadas e castelo externo.
- Aldeões variados de dia; à noite, esqueletos, combates, perseguições e um lampião por aldeão, alinhado à mão e com oclusão.
- Arte refinada da partida: heróis, inimigos, objetos, efeitos e iluminação.
- Interior escuro, sem árvores, tochas amarelo-alaranjadas; o castelo em miniatura foi substituído por um portão de salão.
- Arena com o círculo ritual vermelho original restaurado.
- Chance de drop de cura de 5% por inimigo, inclusive nas primeiras hordas.

## Contas/ranking/admin — código adicionado, integração final em andamento

- `server.py`: API Python/SQLite com cadastro e login, senhas protegidas, sessões HttpOnly, CSRF, rate limit, ranking persistente, validação de resultados e prevenção de reenvio.
- Conta inicial `admin` gerada na primeira inicialização; credencial em `.private/admin-inicial.json`, nunca no Git.
- Banimento/desbanimento, revogação de sessões, auditoria e regras globais.
- `js/portal.js` + `portal.css`: login opcional, visitante, nomes de 3 a 20 caracteres, ranking por pontos/abates/dano, troca de senha e restauração de sessão.
- `js/admin.js` + `admin.css`: atributos, criação de inimigos, habilidades, XP/nível, invencibilidade, chefe, teletransporte, moderação e regras globais. Comandos exigem autorização do servidor.
- Integração em index/cenas/Intro/jogo/HUD: dano efetivo, pontuação, envio de resultados, opção de login e identificação de treino.
- Partidas de admin, de teste ou com regras alteradas não participam do ranking.
- `INICIAR-JOGO.sh`: inicia o servidor em `http://127.0.0.1:5501/`; o Live Server na porta 5500 também pode usar essa API.

## Evidência já disponível

- Visuais, arena e cura foram conferidos no navegador durante as etapas anteriores.
- Backend: 11 testes HTTP reais passaram (autenticação, autorização, CSRF, banimento, ranking, persistência, replay, limites e proteção de arquivos privados).
- Portal: sintaxe e harness isolado em Chrome passaram, incluindo diálogos, pausa/input e modo offline.
- Arquivos JS modificados: sintaxe verificada.

## Próximos passos ao retomar

1. Iniciar o servidor completo e conferir os fluxos reais no Phaser: visitante → login/cadastro → partida → resultado → ranking.
2. Conferir o painel admin real, perda de sessão/banimento, regras e o bloqueio de usuários comuns.
3. Revisar mudanças integradas e ajustar os problemas encontrados antes de considerar contas/ranking/admin concluídos.
4. Atualizar este documento com os resultados da integração.

O servidor de contas ainda não foi publicado na internet. O ranking valida valores enviados pelo navegador; não é um sistema completo de proteção contra trapaça. Banco, senhas, sessões e arquivos privados são excluídos do versionamento.
