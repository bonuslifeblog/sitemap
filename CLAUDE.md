# Fábrica de vídeos (Reels/Shorts) — Sérgio Carvalho

Este repositório é uma **fábrica de vídeos verticais 1080×1920 em português do Brasil** para **vários canais distintos**. A fábrica (motor, sons, mapa, QA) é **compartilhada**; cada canal tem sua pasta, sua identidade e suas regras.

```
video-factory/
  engine/                 ← a fábrica (compartilhada por todos os canais)
  channels/
    afiliados/            ← @osergiocarvalho · afiliados e Google Ads na gringa
    gta6/                 ← página nova sobre GTA 6
    canal-3/              ← a definir
      channel.json        ← identidade do canal (cores, @, nome, tema) — aplicada em todo episódio
      CLAUDE.md           ← regras e tom do canal (leia antes de produzir)
      episodes/<slug>/    ← episode.json + audio/voice.mp3
  out/<canal>/            ← vídeos prontos (não vão para o git)
```

## Qual conversa faz o quê
- **Conversa "Fábrica"** (aberta em `~/sitemap`): melhorias no motor, nos sons, no mapa e no QA, ou seja, o que vale para todos os canais. Toda mudança no `engine/` acontece aqui e deve ser testada renderizando pelo menos um episódio de **cada** canal.
- **Conversa de canal** (aberta em `~/sitemap/video-factory/channels/<canal>`): só roteiros, episódios e identidade daquele canal. **Não alterar `engine/`** a partir de uma conversa de canal. Se precisar de algo novo no motor, anote em `channels/<canal>/PEDIDOS-FABRICA.md` para a conversa da Fábrica.

## Fluxo de um episódio (qualquer canal)
1. Roteiro em `channels/<canal>/episodes/<slug>/episode.json` (texto falado em `scenes[].vo`, visual em `scenes[].beats`). Guia: `video-factory/ROTEIRO.md`.
2. Voz única e **intacta** em `audio/voice.mp3` (`"voice": "audio/voice.mp3"`). Nunca cortar nem acelerar: a imagem se ajusta à voz.
3. `node engine/render.js channels/<canal>/episodes/<slug> --stills` (a partir de `video-factory/`): folha de quadros para conferir.
4. `node engine/render.js channels/<canal>/episodes/<slug>`: alinha, renderiza, mixa e roda o QA. Sai em `out/<canal>/`.

## Regras da fábrica (valem para todos os canais)
- **Partículas contínuas:** os pontos nunca somem nem aparecem do nada; sempre viajam de forma em forma. Nada fica parado por mais de 4 quadros (o QA verifica).
- **Ritmo:** o visual muda a cada 2–3 s. As batidas se prendem à palavra (`word`, `impactWord`) e entram 2 quadros antes dela.
- **Grave:** `engine/sfx/bass.wav` (nota limpa 100→45 Hz, sustentada ~0,8 s). Usar só nas revelações importantes, com o mais forte no clímax. O Sérgio **rejeitou**: estrondo com estalo seco, baque de transição (whoosh + sub-boom) e graves distorcidos.
- **Legendas karaokê** sempre. **Formato pt-BR:** `US$ 1.000`, `R$ 49,90`, `30%`.
- **Fatos:** todo número apresentado como real tem fonte (etiqueta `source`). O que não for comprovado é "rumor" ou "exemplo ilustrativo".
- **Originalidade:** modelar ideia e tema de vídeos virais é ok; **copiar** (traduzir roteiro palavra por palavra, refazer cena por cena, repostar vídeo de outro) **não**. Nada de cenas, logos ou artes de terceiros.
- **Claude não ouve áudio:** o Sérgio confere o som de cada vídeo antes de postar.

## Pendências gerais
- **Voz:** os créditos do vidIQ acabam (renovam todo dia 20). O plano é usar o ElevenLabs, de preferência com o endpoint que dá o tempo de cada palavra.
