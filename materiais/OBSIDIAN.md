# Typewriter + Obsidian

A integração usa arquivos Markdown e links do próprio Obsidian. Não requer plugin comunitário, conta ou serviço de sincronização. O Typewriter importa uma cópia do plano; ele não controla as caixas de seleção da nota original do Obsidian.

## Opção 1 — abrir os registros atuais como um cofre

É a forma mais direta de consultar no Obsidian os planos atualizados pelo Typewriter, mantendo `C:\Typewriter` como pasta de registros.

1. Abra o Obsidian e o gerenciador de cofres.
2. Escolha a opção para **abrir uma pasta como cofre**.
3. Selecione `C:\Typewriter` (abra o Typewriter uma vez para criar a pasta, se necessário).
4. Abra os planos `.md` para consultar as tarefas, os horários e as notas de sessão.

O Obsidian cria suas configurações na subpasta `.obsidian`. Os arquivos `.progress.json` continuam sendo usados pelo Typewriter. Não é necessário abri-los no Obsidian.

Use o Obsidian para consultar o plano enquanto ele estiver ativo. Faça mudanças nas tarefas pelo Typewriter: não há leitura contínua de edições externas, e o progresso do JSON é autoritativo ao reabrir.

## Opção 2 — guardar os registros dentro de um cofre existente

1. Crie uma subpasta `Typewriter` dentro do seu cofre.
2. Conclua ou interrompa o plano atual e feche o Typewriter.
3. Localize `config.json` conforme o guia de uso.
4. Ajuste `recordsDirectory` para o caminho absoluto da subpasta. Exemplo de configuração parcial: `"recordsDirectory": "D:\\MeuCofre\\Typewriter"`. Preserve os outros campos do arquivo.
5. Se quiser levar os registros anteriores, copie os planos e os respectivos arquivos de progresso para a nova pasta. Como o progresso contém o caminho antigo, os sidecars antigos serão reconstruídos a partir do Markdown; preserve os backups se precisar dos timestamps ISO originais.
6. Abra novamente o Typewriter. Os próximos planos serão salvos nessa subpasta e aparecerão no cofre.

Não arraste uma nota esperando editá-la no lugar: mesmo quando o arquivo já está dentro do cofre, a importação cria uma cópia na pasta configurada. Se o nome já existir, a nova cópia recebe um sufixo. Para encontrar o registro correto, confira o arquivo criado mais recentemente.

## Templates no Obsidian

### Modelo simples

Copie `template-plano.md` para o cofre, duplique-o para cada sessão e edite a cópia. Depois salve e arraste a nota para o Typewriter ou copie seu conteúdo e cole no aplicativo.

### Modelo com título, data e hora automáticos

1. Crie uma pasta `Modelos` dentro do cofre e copie `template-obsidian.md` para ela.
2. Nas configurações do Obsidian, ative o plugin nativo **Modelos** (Templates).
3. Nas opções desse plugin, configure `Modelos` como pasta de modelos.
4. Crie uma nota vazia e dê a ela o nome do seu plano.
5. Execute o comando do plugin para inserir um modelo e selecione `template-obsidian`.
6. Edite as tarefas, salve e importe o texto ou arquivo para o Typewriter.

O Obsidian substitui `{{title}}`, `{{date:DD/MM/YYYY}}` e `{{time:HH:mm}}` ao inserir o modelo. Não importe o template com essas variáveis sem antes inseri-lo em uma nota, a menos que queira vê-las como texto literal.

## Criar um link para um plano

Depois de abrir o plano armazenado no Obsidian, use o comando **Copiar URL do Obsidian para o arquivo atual**, ou a opção equivalente em **Copiar caminho → como URL do Obsidian**. Cole a URL em outra nota ou aplicativo.

Exemplo de link Markdown para o cofre `Typewriter`:

```markdown
[Abrir meu plano](obsidian://open?vault=Typewriter&file=meu-plano.md)
```

Substitua o nome do cofre e do arquivo pelos reais. Espaços e outros caracteres especiais precisam de codificação de URL; copiar a URL pelo próprio Obsidian evita erros. Um espaço vira `%20` e uma barra de subpasta vira `%2F`.

Também é possível apontar para um caminho absoluto, desde que ele pertença a um cofre já aberto/cadastrado no Obsidian:

```markdown
[Abrir registro](obsidian://open?path=C%3A%5CTypewriter%5Cmeu-plano.md)
```

Esses links abrem a nota no Obsidian. Eles não importam nem ativam um plano no Typewriter. Para carregar um novo plano na máquina, use arrastar e soltar ou colar.

## Documentação oficial

- Cofres e abertura de pastas: https://help.obsidian.md/Files+and+folders/Manage+vaults
- Plugin nativo Modelos: https://help.obsidian.md/Plugins/Templates
- Links e protocolo URI: https://help.obsidian.md/Extending+Obsidian/Obsidian+URI

## Relacionar tempos, planos e dias

Os cronômetros geram um Markdown por plano na subpasta `tempos` dos registros. Se a pasta de registros estiver no seu cofre, os relatórios também aparecerão nele.

Abra o relatório `tempos/meu-plano.md.tempos.md` para consultar o resumo por tarefa e os intervalos com data, hora, segundos e deslocamento UTC. O link no início volta ao plano armazenado, e os links `[[AAAA-MM-DD]]` relacionam os intervalos às notas dos dias. Esses formatos de links são suportados pelo [Obsidian](https://help.obsidian.md/links).

Os links de dia não criam notas automaticamente. Se suas notas diárias usam o nome `AAAA-MM-DD`, eles permitem navegar até elas; se você usa outro padrão de nomes, crie uma nota com esse nome ou faça a ligação manual para sua nota diária. Se houver arquivos com o mesmo nome em pastas diferentes, confira o destino escolhido pelo Obsidian.

Você pode criar uma nota pessoal com `[[tempos/meu-plano.md.tempos|Tempo do meu plano]]`, ajustando o caminho a partir da raiz do cofre. Quando os registros estiverem numa subpasta `Typewriter`, por exemplo, use `[[Typewriter/tempos/meu-plano.md.tempos|Tempo do meu plano]]`.

Não edite o relatório gerado enquanto usa o aplicativo: ele é reconstruído a partir do progresso salvo. Mantenha comentários e interpretações em outra nota, ligada ao relatório. Ao mover registros para outro lugar, copie também os sidecars e a pasta `tempos`. Os sidecars contêm o caminho absoluto do plano; se esse caminho mudar, preserve os relatórios e o backup original, pois o progresso poderá ser reconstruído do Markdown sem recuperar os tempos do JSON antigo.
