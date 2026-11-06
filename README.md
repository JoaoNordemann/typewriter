# Typewriter

Uma pequena máquina de escrever pixelada para acompanhar planos em Markdown. Interface em português, janela transparente sempre visível e registros locais.

## Executável Windows

O pacote pronto fica em `dist/Typewriter-1.2.0-Windows.zip`. Extraia-o e execute `Typewriter-1.2.0-portatil.exe`. Não é necessário instalar Node.js ou Electron para usar o executável. O pacote inclui:

- `GUIA-DE-USO.md`: instruções de abertura, importação, progresso, conclusão, interrupção e backup.
- `template-plano.md`: modelo editável de plano.
- `template-obsidian.md`: modelo com variáveis do plugin nativo Modelos.
- `OBSIDIAN.md`: configuração de cofre, templates e links para notas.

O executável é portátil e não tem assinatura digital de editor. Os registros ficam em `C:\Typewriter` por padrão; não são gravados junto ao executável. A configuração fica no diretório padrão de dados do usuário do Electron, em `config.json`.

## Executar pelo código-fonte

```sh
npm install
npm start
```

## Gerar uma nova distribuição

No Windows, com Node.js instalado:

```sh
npm install
npm run package:win
```

O processo gera o executável portátil Windows x64, uma pasta de distribuição com os materiais e um ZIP dessa pasta. `npm run build:win` gera apenas o executável. Os guias e templates também são incluídos em `resources/materiais` na aplicação empacotada. A primeira compilação pode baixar ferramentas do empacotador.

## Registros

Cada plano tem um arquivo `<nome>.md.progress.json` ao lado do Markdown. O progresso válido desse JSON é autoritativo. Arquivos ausentes, inválidos ou com contagens diferentes são reconstruídos a partir do Markdown. O aplicativo grava o progresso antes de atualizar o Markdown; reabrir permite reparar um Markdown cuja gravação tenha falhado.

Arquivos importados são copiados, nunca editados no local original. Colisões geram sufixos com timestamp. Notas de sessão são anexadas ao Markdown. Interrupções registradas vão para `aborted-plans.jsonl`. Descartar remove apenas a cópia armazenada e seu sidecar. Planos que apontam para fora da pasta por links simbólicos são rejeitados.

Para alterar o local de armazenamento e usar com o Obsidian, consulte [o guia](materiais/GUIA-DE-USO.md) e [as instruções do Obsidian](materiais/OBSIDIAN.md). Não há sincronização bidirecional com notas externas.

## Testes

```sh
npm test
npm run test:electron
```

A suíte de arquivos valida parsing, timestamps, preservação do Markdown, sidecars, colisões, notas e limites de exclusão. A suíte Electron usa registros e configuração isolados em `test/.runtime`, testa os fluxos da interface e salva capturas em `test/`.

Para verificar uma compilação, defina `TYPEWRITER_EXECUTABLE` com o caminho absoluto de `dist/win-unpacked/Typewriter.exe` antes de rodar `npm run test:electron`.

A validação de desktop foi feita no Windows. O comportamento nativo do macOS e a saída audível precisam ser conferidos em um desktop macOS.

A área de interação acompanha apenas a máquina, o papel visível e as mensagens. No Windows/Linux, as áreas transparentes ficam fora da região nativa da janela e permitem clicar nos aplicativos atrás. No macOS, há um tratamento específico de passagem do mouse, ainda não validado em um desktop macOS. Execute npm run test:regions para validar as regiões enviadas ao Electron e o comportamento dos popups.

Para selecionar um arquivo Markdown existente, use o primeiro + ou Ctrl+O (Command+O no macOS). O segundo + cola texto. Um plano selecionado diretamente na pasta de registros é retomado com seu sidecar, sem duplicação; arquivos externos são copiados. Execute npm run test:open-file para validar seleção, cancelamento e restauração.

O cronômetro de cada tarefa permite iniciar/pausar e acumular intervalos, com apenas uma tarefa ativa por vez. Os relatórios Markdown em `tempos/` relacionam o plano e as datas no Obsidian. Dados de cronômetro são persistidos no sidecar; fechamentos normais, conclusão e suspensão pausam a contagem, e quedas inesperadas são recuperadas até o último checkpoint de 10 segundos. Execute `npm run test:timers` para validar os controles e a restauração no Electron.

O ícone Windows usa imagem_2026-11-05_212845945.ico como original. O script scripts/create-icon.ps1 preserva a imagem de 32 pixels e gera uma versão de 256 pixels sem suavização em build/icon.ico. O ícone é aplicado ao executável portátil, à aplicação empacotada e à janela. Para verificar os recursos incorporados após compilar, execute node test/release-icon.cjs.
