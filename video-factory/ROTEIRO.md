# Guia de roteiro e ideias

## Tamanho do roteiro

Velocidade medida com a voz atual (Daniel, vidIQ): **≈ 2,1 palavras/s**, já contando as pausas.

| Duração | Palavras (voz atual) | Palavras (narrador brasileiro natural, ≈ 2,7/s) |
|---|---|---|
| 20 s | ~42 | ~55 |
| 30 s | ~63 | ~80 |
| 45 s | ~95 | ~120 |
| 60 s | ~125 | ~160 |

Com a sua voz, a velocidade muda. Depois do primeiro vídeo, eu meço a velocidade real (`timing.json`) e atualizo esta tabela.

## Fórmula (cada frase vira 1–2 batidas visuais)

1. **Gancho (1ª frase, sem introdução):** o fato que parece absurdo, dito como fato.
   *"Ele pagou menos da metade por clique e ainda ficou acima de você."*
2. **Cenário (1–2 frases):** quem, onde, um detalhe concreto, de preferência um número.
3. **Escalada (2–4 batidas, cada uma maior):** o número cresce, a comparação piora, o mapa abre.
4. **Virada:** "Só que…", "Mas…", "Acontece que…". Aqui entra o mecanismo real, com uma analogia do dia a dia.
5. **Desfecho:** frase curta e irônica, que também é a lição. Ela recebe o **grave mais forte** do vídeo.
6. **Chamada para seguir:** uma frase curta ("Segue pra mais.").

**Escrita:** português falado, frases de 8 a 15 palavras e números por extenso no texto da voz ("mil e trezentos"). Nunca descreva o que a tela já mostra. O texto da voz e o da tela se complementam.

## Regras de conteúdo

- Todo fato apresentado como verdadeiro é **checado antes**: documentação oficial (Google Ads, plataformas), notícia com data ou dado próprio seu. A fonte vai na etiqueta `source` da batida.
- O que não dá para confirmar vira "dizem que…" ou "exemplo ilustrativo", nunca fato.
- Nada de expor pessoas reais vivas como piada, nem marcas de terceiros como vilãs. Concorrente é "um afiliado", não um nome.
- Ideias, roteiros e cenas são **originais**. Referências servem para entender o formato, nunca para copiar um vídeo cena por cena.

## Pedido de ideias (10 por vez)

Peça "10 ideias" e eu devolvo exatamente 10, numeradas, cada uma com:
- **Título** (5 a 8 palavras, que dê curiosidade);
- **Gancho** (a primeira frase falada);
- **Virada** (a frase final, numa linha);
- **Por que anima bem** (2–3 momentos visuais: barras, mapa, contador, grade de ícones);
- **Status do fato:** comprovado (com a fonte), disputado ou exemplo ilustrativo.

Para escolher, responda com o número da ideia (ou "mais").

## Ligando o roteiro às imagens

Cada batida do `episode.json` pode se prender a uma palavra da narração:
- `"word": "Brasília"`: o visual muda 2 quadros antes de "Brasília" ser dito.
- `"impactWord": "trinta"`: o grave toca na palavra.
- Nos pinos do mapa, `"word": "seis"` faz o cartão aparecer na palavra.
- Para a 2ª ocorrência da mesma palavra na cena, use `"lucro#2"`.
