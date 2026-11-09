# Fábrica de vídeos (Reels/Shorts) — @osergiocarvalho

O trabalho principal deste repositório está em `video-factory/`. São vídeos verticais 1080×1920 sobre **afiliados e Google Ads na gringa**, em **português do Brasil**: dados em partículas e mapa, narração, legenda karaokê e desenho de som. Leia `video-factory/README.md` (como produzir) e `video-factory/ROTEIRO.md` (como escrever) antes de mexer.

## Fluxo
1. Roteiro em `episodes/<slug>/episode.json` (texto falado em `scenes[].vo`, visual em `scenes[].beats`).
2. Voz única e **intacta** em `episodes/<slug>/audio/voice.mp3`. Nunca cortar nem acelerar: a imagem se ajusta à voz.
3. `node engine/render.js episodes/<slug> --stills`: folha de quadros para conferir antes.
4. `node engine/render.js episodes/<slug>`: alinha roteiro × voz (`align.js`), renderiza, mixa e roda o QA (`qa.sh`).

## Decisões já tomadas com o Sérgio (não reverter sem perguntar)
- **Partículas contínuas:** os pontos nunca somem nem aparecem do nada; sempre viajam de forma em forma (morph). Nada fica parado por mais de 4 quadros.
- **Ritmo:** o visual muda a cada 2–3 s. As batidas se prendem à palavra (`word`, `impactWord`) e entram 2 quadros antes dela.
- **Grave:** `engine/sfx/bass.wav` (versão "6-forte": nota limpa 100→45 Hz, sustentada ~0,8 s, sem distorção). Usar só nas revelações importantes, ~1 a cada 7–10 s, com o mais forte no clímax. Ele **rejeitou**: estrondo com estalo seco, baque de transição (whoosh + sub-boom) e graves distorcidos.
- **Cores:** dourado `#f0b90b` sobre preto. O irmão (@oguscarvalho) usa verde-limão; manter diferente.
- **Legendas karaokê:** ficam (o vídeo de referência e o público pedem).
- **Formato pt-BR:** `US$ 1.000`, `30%` (sem espaço), datas e números brasileiros.
- **Fatos:** todo número apresentado como real precisa de fonte (etiqueta `source`). O que não for comprovado é "exemplo ilustrativo". Nunca recriar vídeo de outro criador cena por cena.

## Pendências conhecidas
- Voz: os créditos do vidIQ acabam com frequência. O plano é usar o ElevenLabs (de preferência a voz clonada do Sérgio). Com a API, usar o endpoint com timestamps para ter o tempo exato de cada palavra.
- O episódio 001 (leilão do Google, 58 s) ainda está no formato antigo e precisa ser reescrito em batidas.
