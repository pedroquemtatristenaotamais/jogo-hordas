# Retomada da expansão — pausa solicitada pelo usuário em 03/11/2026

**Estado: checkpoint de trabalho, não uma versão final aprovada.** O usuário
pediu para parar imediatamente por limite da sessão e salvar tudo no Git.
A implementação e os testes atuais foram preservados na `main`. O agente
`expansion_final_fixes` foi interrompido; não há testes de expansão rodando.

## Projeto e execução

- Pasta: `/home/escola/Downloads/jogo-hordas`.
- Phaser 3.80.1 local, JavaScript sem build, servidor Python stdlib/SQLite.
- Servidor local atualizado em `http://127.0.0.1:5501/` (também pode iniciar
  com `./INICIAR-JOGO.sh`). A URL normal abre a Intro. Não usar `?nointro`
  como endereço normal enviado ao usuário.
- Contas/banco externos: `~/.local/share/a-ultima-muralha/`. Senhas e dados
  não estão no Git. A migração preservou contas, hashes de senha e resultados;
  a API de produção confirmou `bossTime:900`.
- Não há remoto Git configurado; o checkpoint é um commit local na `main`.
- Usuário autoriza trabalhar/commitar na main e pediu para não solicitar
  permissão repetidamente. Nesta pausa, não continuar implementação.

## Snapshot anterior, antes das mudanças

- Commit anterior: `ec950d0` (correção do foco após conta/ranking).
- Tag anotada: `snapshot/pre-expansao-20261103-100040`.
- Código: `/home/escola/Downloads/backups-jogo-hordas/jogo-hordas-20261103-100040.tar.gz`.
- Banco/credencial: `~/.local/share/a-ultima-muralha/backups/20261103-100040/`.
- Integridade gzip conferida; contas e hashes comparados com a cópia privada.

## Já implementado nesta expansão

- Duração padrão 900 segundos. Minibosses únicos aos 300/600 segundos com
  250/600 XP × dificuldade e baú; chefe final aos 900.
- Fácil, Médio, Difícil e Hardcore, tela de escolha após o herói, escalas
  de inimigos/chefe/XP/cura/pontos. Limite real de 240 inimigos.
- API vincula dificuldade à partida e filtra ranking por dificuldade;
  migra resultados antigos para Médio e só altera as regras antigas de fábrica.
- Armas novas: machados, gelo e veneno (8 níveis). Seis evoluções e duas
  uniões com requisitos, destruição de órbitas/efeitos antigos e bloqueio
  dos ingredientes consumidos. Uniões liberam um espaço; passivas permanecem.
- Baús físicos, suprimentos 180/420/720 e menus de recompensa.
- Grimório em G/botão, com receitas e progresso. Evoluções após 5 minutos
  são adaptação para esta fase de 15 minutos.
- Dash em Shift/Espaço/toque, três níveis; evolução de fumaça exige dash3,
  Passos Leves e baú após300. Imunidade apenas durante o movimento.
- Quatro inimigos comuns novos: raio, veneno, gelo/lentidão e investida;
  dois minibosses com padrões próprios. Arte procedural e efeitos limitados.
- Preservados Intro, cenário escuro, luzes alaranjadas, contas/admin e foco
  do teclado ao fechar janelas. Barra do chefe acima da barra de contas.
- Detalhes/receitas/fontes: [EXPANSAO.md](EXPANSAO.md).

## Verificações concluídas antes da última correção

- Backend: 19 testes passaram (`python3 -m unittest discover -s tests -v`).
- Navegador contas/admin: sete fluxos passaram, sem erros JS.
- Regressão de controles/diálogos: oito cenários passaram, sem erros JS.
- Expansão anterior à regressão de dois dedos: nove grupos passaram,
  incluindo nove receitas, dano de onze armas, baú/teclado, dash/colisão/
  imunidade, grimório, inimigos/minis, toque simples e simulação de 18 mil
  quadros/900,05 segundos em Hardcore (pico240, chefe12600HP).
- URL normal de produção abre a Intro sem erros JS; imagens em
  `/tmp/muralha-expansao/` (fora do Git).
- A simulação usa invencibilidade, armas evoluídas e escolhas automáticas;
  verifica integração, não equilíbrio humano nem FPS.

## Revisão final e ponto exato pendente

A revisão integral (`retomada-expansao/whole-review.md`) encontrou:

1. Segundo toque para dash enquanto segura joystick não era recebido.
2. Baú suplementar poderia nascer fora da muralha e ficar inacessível.
3. Eventos podiam ocupar as vagas reservadas dos minibosses e atrasá-los.
4. Limites customizados1/2 impediam spawn comum.
5. Dificuldade no resultado estava atrás dos painéis.

A última rodada aplicou correções nos cinco caminhos. O agente confirmou
que as novas regressões **não relacionadas ao toque passaram**: baús nos
cantos, centro de obstáculo, arena, limite8/retry, população saturada nos
prazos, limites pequenos, 900 segundos Hardcore e texto HARDCORE visível
na tela de resultado. Essas alterações ainda precisam da re-revisão final.

**Pendência bloqueadora: regressão real de dois dedos ainda falha.**
`js/main.js` já usa `input.activePointers:2`. O CDP segura/move o primeiro
contato e tenta pressionar DASH com o segundo; o joystick move, mas o dash
não dispara. Último diagnóstico em `retomada-expansao/touch-probe.log`:
`joy.active:true`, `joy.x:0.8333`, pointer1 em250/550 pressionado;
pointer2 continua0/0, `down:false`; botão DASH existe e dispositivo é touch.
Ainda não foi isolado se é sequência do CDP ou tratamento de entrada do jogo.
Não afirmar que a suíte atual está toda verde.

Os arquivos de diagnóstico `/tmp/touch-probe.cjs`, runner e log foram
copiados para `docs/retomada-expansao/`. São cópias de investigação, não um
segundo conjunto oficial de testes. O runner copiado aponta para `/tmp`;
para reutilizá-lo, ajustar esse caminho ou usar o runner oficial abaixo.
Briefs, relatórios e ledger também estão preservados nessa pasta. O agente
foi interrompido antes de escrever `whole-fix-report.md`/diff final da rodada.
O diff completo permanece recuperável pelo Git contra `ec950d0`.

## Para continuar quando o usuário pedir

1. Ler este arquivo e `retomada-expansao/whole-review.md` + `whole-fix-brief.md`.
2. Isolar/corrigir o toque simultâneo; manter joystick ativo ao soltar só DASH.
   A regressão está no fim de `tests/browser_expansion.cjs` e usa CDP
   `Input.dispatchTouchEvent`. Preservar o teste que detecta a falha.
3. Executar:

```sh
PLAYWRIGHT_MODULE=/home/escola/.cache/ms-playwright-go/1.57.0/package python3 tests/browser_accounts.py --expansion
python3 -m unittest discover -s tests -v
PLAYWRIGHT_MODULE=/home/escola/.cache/ms-playwright-go/1.57.0/package python3 tests/browser_accounts.py
PLAYWRIGHT_MODULE=/home/escola/.cache/ms-playwright-go/1.57.0/package python3 tests/browser_accounts.py --controls
```

4. Re-revisar apenas a última rodada de correções, conferir capturas e
   atualizar o checkpoint. Na capacidade administrativa extrema de apenas
   uma entidade, preservar miniboss vivo e tentar o segundo após vaga;
   o padrão240 deve garantir os dois no horário.
5. Fazer commit final depois de confirmar os testes. Não recomeçar pesquisa
   nem reconstruir as funcionalidades já implementadas.
