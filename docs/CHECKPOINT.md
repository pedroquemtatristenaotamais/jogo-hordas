# Checkpoint — 30/10/2026; retomada em 03/11/2026

Checkpoint solicitado pelo usuário antes de sair. Branch: `main`.

## Já implementado

- Logo correto da escola embutido em Base64 e escala proporcional na Intro.
- Menu com ciclo de dia/noite, vila com igreja, árvores detalhadas e castelo externo.
- Aldeões variados de dia; à noite, esqueletos, combates, perseguições e um lampião por aldeão, alinhado à mão e com oclusão.
- Arte refinada da partida: heróis, inimigos, objetos, efeitos e iluminação.
- Interior escuro, sem árvores, tochas amarelo-alaranjadas; o castelo em miniatura foi substituído por um portão de salão.
- Arena com o círculo ritual vermelho original restaurado.
- Chance de drop de cura de 5% por inimigo, inclusive nas primeiras hordas.

## Contas/ranking/admin — integração concluída na retomada

- `server.py`: API Python/SQLite com cadastro e login, senhas protegidas, sessões HttpOnly, CSRF, rate limit, ranking persistente, validação de resultados e prevenção de reenvio.
- Conta inicial `admin` gerada na primeira inicialização; credencial em `~/.local/share/a-ultima-muralha/admin-inicial.json`, nunca no Git.
- Banimento/desbanimento, revogação de sessões, auditoria e regras globais.
- `js/portal.js` + `portal.css`: login opcional, visitante, nomes de 3 a 20 caracteres, ranking por pontos/abates/dano, troca de senha e restauração de sessão.
- `js/admin.js` + `admin.css`: atributos, criação de inimigos, habilidades, XP/nível, invencibilidade, chefe, teletransporte, moderação e regras globais. Comandos exigem autorização do servidor.
- Integração em index/cenas/Intro/jogo/HUD: dano efetivo, pontuação, envio de resultados, opção de login e identificação de treino.
- Partidas de admin, de teste ou com regras alteradas não participam do ranking.
- `INICIAR-JOGO.sh`: inicia o servidor em `http://127.0.0.1:5501/`; o Live Server na porta 5500 também pode usar essa API.

## Evidência já disponível

- Visuais, arena e cura foram conferidos no navegador durante as etapas anteriores.
- Backend: 17 testes HTTP reais passaram, incluindo autenticação, autorização, CSRF, banimento, ranking, persistência, replay, migração, vínculo à sessão e proteção de arquivos privados.
- Portal: sintaxe e harness isolado em Chrome passaram, incluindo diálogos, pausa/input e modo offline.
- Fluxo real no Phaser/Chrome: visitante, cadastro com 20 caracteres, restauração de sessão, resultado e ranking pelos três critérios, admin/F2/atributos/spawn/habilidade/nível/invencibilidade/chefe, banir/desbanir, regras oficiais, logout e regras atualizadas de visitantes passaram sem erros JavaScript.
- Arquivos JS modificados: sintaxe verificada.

## Correções e revisão concluídas

- Os dados privados foram transferidos para fora da raiz do Live Server; a credencial inicial foi renovada, e o servidor recusa dados dentro da pasta publicada.
- O logout envia JSON; logout e troca de conta invalidam partidas abertas, vinculadas também à sessão original.
- O jogo aguarda as regras oficiais antes de construir o mapa e indica corretamente partidas de treino.
- Os diálogos preservam pausa/input, inclusive durante inicialização assíncrona e reinício.
- A revisão final confirmou as quatro correções de segurança/integração e os ciclos de iniciar, cancelar, morrer e reiniciar.
- Testes portáveis estão em `tests/`; instruções em `docs/CONTAS-SERVIDOR.md`.

## Para usar e continuar depois

1. Inicie `./INICIAR-JOGO.sh` e abra `http://127.0.0.1:5501/`.
2. Jogue como convidado ou crie uma conta. Para admin, consulte a credencial inicial no diretório privado externo e abra o painel com F2.
3. Antes de publicar na internet, será preciso preparar hospedagem/HTTPS e decidir a proteção adicional contra trapaça; essa publicação não foi solicitada nem executada.

O servidor de contas ainda não foi publicado na internet. O ranking valida valores enviados pelo navegador; não é um sistema completo de proteção contra trapaça. Banco, senhas, sessões e arquivos privados são excluídos do versionamento.
