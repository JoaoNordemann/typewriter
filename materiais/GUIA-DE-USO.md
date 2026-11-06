# Typewriter — guia de uso

## Abrir o aplicativo

1. Extraia todo o conteúdo do pacote ZIP para uma pasta de sua preferência.
2. Abra `Typewriter-1.2.0-portatil.exe`. Não é necessário instalar Node.js ou Electron.
3. Arraste a carcaça vermelha ou o rolo para posicionar a janela. Ela permanece sobre as demais janelas.
4. Para fechar, use Alt+F4 com a janela em foco.

O executável é portátil, mas os registros e as configurações ficam no computador: os planos em `C:\Typewriter` e a configuração na pasta de dados do usuário. O aplicativo não tem assinatura digital de um editor; o Windows pode identificar o editor como desconhecido.

A interface está ampliada para 125% do tamanho original. A janela tem 525 px de largura; a altura se adapta à área útil do monitor para manter os controles visíveis. A lista usa rolagem quando necessário.

## Criar e carregar um plano

1. Faça uma cópia de `template-plano.md` e renomeie-a, por exemplo, `estudo-de-hoje.md`.
2. Abra a cópia em um editor de texto ou no Obsidian.
3. Edite o título, as seções e as tarefas, mantendo a sintaxe do modelo.
4. Salve e clique no primeiro `+` para selecionar o arquivo `.md` no computador, ou use Ctrl+O. Você também pode arrastá-lo para a máquina. Para colar texto, use Ctrl+V ou o segundo `+`.

É obrigatório ter um título `# Meu plano` e pelo menos uma tarefa `- [ ] Minha tarefa`. Seções `## Minha seção` são opcionais. Tarefas já concluídas podem usar `- [x]` ou `- [X]`. Outros textos Markdown são preservados no arquivo, mas não aparecem na máquina.

Ao selecionar pelo primeiro `+` um plano que já está diretamente na pasta de registros, o aplicativo reabre esse mesmo plano e restaura seu progresso, sem duplicá-lo. Arquivos selecionados em outras pastas são importados como cópias.

Ao arrastar um arquivo ou colar texto, o aplicativo cria uma cópia na pasta de registros. O arquivo que você arrastou permanece intacto. Importar novamente um nome já existente cria outra cópia com um sufixo; não substitui o plano anterior. Conclua ou interrompa o plano atual antes de carregar outro.

## Acompanhar o progresso

- Clique na tarefa para marcar ou desmarcar.
- No modo foco, a próxima tarefa pendente aparece após a animação.
- Clique em `≡` para mostrar a lista completa e em `●` para voltar ao foco.
- Use a lista completa para desmarcar tarefas anteriores.
- O contador informa quantas tarefas foram concluídas. Seções finalizadas recebem o carimbo “feito!”.
- Clique em `♪` para silenciar e em `✕` para ativar o som.

Cada alteração é salva imediatamente. Ao abrir o aplicativo novamente, o plano ativo é restaurado, desde que seus arquivos ainda existam na pasta configurada.

## Concluir ou interromper

Ao concluir todas as tarefas, o aplicativo celebra e oferece uma nota da sessão:

- **salvar + novo plano:** anexa a nota ao Markdown e volta à tela inicial.
- **pular:** mantém o plano concluído e volta à tela inicial sem nota.

Para interromper, pressione **Ctrl+C** fora da caixa de texto:

- **registrar:** mantém o plano e seu progresso e acrescenta uma entrada ao histórico de interrupções.
- **descartar:** exclui a cópia armazenada e seu arquivo de progresso. O original importado permanece intacto.
- **cancelar:** continua o plano sem alterações.

## Onde os dados ficam

A pasta inicial de registros é `C:\Typewriter`. Ela contém:

- Os planos `.md`, com os horários de conclusão e as notas de sessão.
- Um arquivo `.md.progress.json` ao lado de cada plano, com o progresso autoritativo.
- `aborted-plans.jsonl`, criado quando você escolhe registrar uma interrupção.

Guarde o Markdown e o arquivo de progresso juntos ao fazer backup. Com um plano ativo, evite editar suas tarefas em outro programa: o Typewriter não faz sincronização bidirecional e pode sobrescrever essas edições. O progresso válido do arquivo JSON tem prioridade ao reabrir.

Para localizar a configuração no Windows, abra o Explorador de Arquivos e cole `%APPDATA%\typewriter` na barra de endereços. O arquivo se chama `config.json`. Se a pasta não estiver ali, procure também `%APPDATA%\Typewriter`, conforme a identificação da versão empacotada.

Para mudar a pasta de registros:

1. Conclua ou interrompa o plano e feche o Typewriter.
2. Faça backup de `config.json`.
3. Edite somente `recordsDirectory`, mantendo os demais campos e o JSON válido. Exemplo: `"recordsDirectory": "D:\\MeuCofre\\Typewriter"`.
4. Abra o aplicativo novamente. Os registros antigos não são movidos automaticamente; copie-os manualmente se precisar.

## Usar com o Obsidian

Leia `OBSIDIAN.md` neste pacote. O template básico funciona em qualquer editor; o template específico do Obsidian usa variáveis do plugin nativo Modelos.

## Cronômetro por tarefa

Cada tarefa mostra seu tempo acumulado no formato `HH:MM:SS` e um botão:

- **▶ iniciar:** inicia ou continua a contagem daquela tarefa.
- **Ⅱ pausar:** encerra o intervalo atual e preserva o tempo já medido.

As pausas não são somadas. Só uma tarefa pode estar em contagem por vez; iniciar outra encerra o intervalo anterior como “troca de tarefa”. Na lista completa, cada tarefa tem seus próprios controles e total. Para medir novamente uma tarefa concluída, desmarque-a primeiro; o tempo anterior é preservado.

Marcar a tarefa como concluída, interromper o plano, fechar o aplicativo ou suspender o computador pausa a contagem. Ao reabrir, o cronômetro fica pausado até você iniciar novamente. Cancelar o diálogo de interrupção mantém a contagem como estava.

O aplicativo salva um ponto de recuperação a cada 10 segundos. Em uma queda inesperada ou encerramento forçado, o intervalo aberto termina no último ponto salvo e recebe a indicação “sessão recuperada após interrupção”. Assim, o tempo com o aplicativo fechado não é somado; até os últimos 10 segundos não salvos podem ser perdidos. Use a pausa ou feche normalmente para registrar o encerramento exato.

### Relatório de tempos

Após o primeiro início, é criado um relatório por plano dentro de `C:\Typewriter\tempos` (ou na subpasta `tempos` do diretório configurado). Exemplo: `meu-plano.md.tempos.md`.

O relatório contém:

- Link para o plano armazenado.
- Resumo por tarefa, com seção e total acumulado.
- Cada intervalo: tarefa, dia, data e hora inicial/final com segundos e deslocamento UTC, duração e motivo do encerramento.
- Links para os dias no formato `[[AAAA-MM-DD]]`, úteis no Obsidian.

Enquanto o cronômetro roda, o intervalo aparece como “em andamento”. O resumo do relatório soma os intervalos encerrados; a tela do aplicativo mostra também a contagem ao vivo. O Markdown é atualizado ao iniciar, pausar e nos pontos de recuperação. Os dados usados para reconstruí-lo ficam no arquivo de progresso do plano.

O relatório é gerado automaticamente: mantenha suas próprias anotações em outra nota. Faça backup de toda a pasta de registros, incluindo os sidecars e a subpasta `tempos`. Se você descartar um plano, seu relatório de tempos é preservado como histórico; o link para o plano excluído poderá ficar sem destino.
