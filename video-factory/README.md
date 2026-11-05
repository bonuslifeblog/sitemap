# Fábrica de vídeos — estilo "Anatomia"

Fábrica de Reels/Shorts 9:16 com **visualização de dados em partículas** (fundo preto, partículas brancas e douradas, mira vermelha, números grandes e narração calma e investigativa), feita para o nicho de **afiliados + tráfego pago (Google Ads, gringa)**.

Referência: reel "Binance · Anatomía del golpe" (85 s, 8 cenas). O que faz esse formato funcionar:

| Elemento | No vídeo de referência | Como a fábrica reproduz |
|---|---|---|
| Gancho em 3 s | rosto de partículas + mira + "¿QUIÉN FUE?" | cena `hook`: símbolo em partículas + título + mira travando |
| Número que choca | 6.300 M$ vs. 1.000 M$ (Saddam) | cena `bars`: barras que se enchem + contador |
| Mecanismo explicado | 50 permissões → carteira → 4 varreduras | cenas `equation` / `price`: fórmula animada |
| Contexto ("pra quê?") | % do PIB, programa de armas | `headline` + `chips` de dados |
| Final em aberto | "Esperando." + espiral | cena `outro`: frase de efeito → espiral → @perfil |
| Credibilidade | "DADOS · FBI · ELLIPTIC…" | campo `sources` no rodapé de todo quadro |

## Como produzir um episódio

```bash
# 1. roteiro: copie um episódio e edite o episode.json (texto da narração em "vo", 1 por cena)
cp -r episodes/001-leilao-google episodes/002-meu-tema

# 2. narração: gere 1 MP3 por cena (vidIQ → vidiq_voiceover_generate, voz em "voice")
#    salve como episodes/002-meu-tema/audio/raw-01.mp3, raw-02.mp3 ...
#    trilha: audio/music.mp3 (vidiq_generate_music, ou reutilize uma do banco)

# 3. limpar o áudio (corta silêncios, acelera 8 %, 48 kHz)
engine/prep-audio.sh episodes/002-meu-tema

# 4. conferir o visual (1 quadro a cada 1,5 s em out/stills, sem gerar vídeo)
node engine/render.js episodes/002-meu-tema --stills

# 5. render final → out/002-meu-tema.mp4 + out/002-meu-tema-capa.jpg
node engine/render.js episodes/002-meu-tema
```

A duração de cada cena sai **da duração real da narração**, então trocar o texto já ajusta o tempo. Os tempos internos (`at`, `winnerAt`, `compareAt`, `spiralAt`, `chipsAt`) são em segundos desde o início da cena. Use-os para fazer o visual "bater" com a palavra falada.

## Tipos de cena (`engine/lib.js`)

| `type` | Campos | Uso |
|---|---|---|
| `hook` | `kicker`, `title[2]`, `glyph`, `lock{x,y,at,label}`, `tags[]` | abertura |
| `headline` | `top`, `big`, `bottom`, `chips[]` | uma afirmação forte |
| `bars` | `caption`, `headline`, `items[{label,sub,value,dec,suffix,color,at}]`, `winner`, `winnerAt`, `winnerLabel`, `chips[]` | comparações e rankings |
| `equation` | `caption`, `terms[5]`, `dial{max,label,at,sweep}`, `chips[]` | fórmula + nota/medidor |
| `price` | `caption`, `formula`, `result`, `compareAt`, `compare{from,to,labelFrom,labelTo,delta}` | cálculo → antes × depois |
| `outro` | `lines[2]`, `cta`, `spiralAt` | frase final + @perfil |

## Custos (vidIQ, plano atual: 1.621 créditos, renovação em 20/11)

| Item | Custo | Episódio de ~60 s |
|---|---|---|
| Narração | 28 créditos a cada 1.000 caracteres **por chamada**, arredondado para cima | 7 chamadas = 196 (do jeito que o piloto foi feito) |
| Narração em 1 chamada só | — | **28** (ver próximos passos) |
| Trilha | 25 por faixa | 0 se reutilizar o banco |
| Assistir a referências | 10 por vídeo | opcional |

O render é local e gratuito (cerca de 3 min por vídeo de 60 s neste ambiente).

## O que já existe

- [x] Motor de partículas determinístico (Chromium + canvas → ffmpeg), 1080×1920 a 30 fps
- [x] 6 tipos de cena reutilizáveis + HUD (série, coordenadas, nº da cena, @perfil, fontes)
- [x] Legendas automáticas (para quem assiste sem som)
- [x] Mixagem: narração + trilha com *ducking* + loudness −14 LUFS (padrão de Reels/Shorts)
- [x] Capa automática (`-capa.jpg`)
- [x] Episódio piloto: `001-leilao-google`

## O que falta para escalar (em ordem)

1. **Sua voz.** Clonar a voz do Sérgio no ElevenLabs. Vozes clonadas aparecem no vidIQ com `isCustom=true`. O piloto usa uma voz pronta (Daniel), que funciona, mas a sua voz cria marca.
2. **Narração em 1 chamada por episódio.** Gerar o roteiro inteiro de uma vez e cortar por silêncio (`silencedetect`). Reduz o custo de voz em cerca de 7×.
3. **Conectar o Instagram no vidIQ** (`vidiq_connect_instagram_account`) para publicar Reels direto daqui. O YouTube (@osergiocarvalho) já está conectado.
4. **Banco de trilhas.** 4 ou 5 faixas (tensa, épica, misteriosa, otimista) reutilizáveis.
5. **Pauta com dados verificáveis.** Ver `PAUTA.md`. O formato depende de números reais e com fonte. Número inventado destrói a credibilidade do canal.
6. **Mais tipos de cena:** mapa-múndi (CPC por país), linha do tempo, rede de nós (funil e redirecionamentos) e grade de ícones (contas suspensas).

## Rede deste ambiente na nuvem

O ambiente `sitemap (video-factory)` libera `assets.vidiq.com` para baixar as narrações. O Instagram é bloqueado aqui, então baixar vídeos de referência precisa ser feito na sua máquina. Para **analisar** referências, use o `vidiq_watch_shortform_content`, que funciona daqui.
