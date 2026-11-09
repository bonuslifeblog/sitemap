# Fábrica de vídeos — estilo "Anatomia"

> Estrutura: `engine/` é a fábrica (compartilhada); cada canal fica em `channels/<canal>/` com `channel.json` (identidade: cores, @, nome, tema), `CLAUDE.md` (regras do canal) e `episodes/`. Os vídeos saem em `out/<canal>/`.

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
# 1. roteiro: channels/<canal>/episodes/<slug>/episode.json, com o texto falado de cada cena em "vo" (ver ROTEIRO.md)
# 2. voz: UM arquivo com a narração inteira em channels/<canal>/episodes/<slug>/audio/voice.mp3
#    ("voice": "audio/voice.mp3" no episode.json). A voz NUNCA é cortada nem acelerada.
#    Trilha opcional: audio/music.mp3

# 3. alinhamento roteiro × voz (roda sozinho no render; rode à mão para conferir)
node engine/align.js channels/<canal>/episodes/<slug>        # → timing.json com o tempo de cada frase e palavra

# 4. conferir o visual antes do render longo: 1 quadro por segundo + folha de quadros
node engine/render.js channels/<canal>/episodes/<slug> --stills   # → out/<slug>-folha.jpg

# 5. render final + controle de qualidade automático
node engine/render.js channels/<canal>/episodes/<slug>           # → out/<slug>.mp4, -capa.jpg, -qa.jpg
```

**Alinhamento:** sem reconhecimento de fala. O `align.js` detecta os trechos de fala e silêncio e, por programação dinâmica, decide onde termina cada frase do roteiro. Ele casa o número de sílabas com a duração da fala, prefere cortes em pausas longas e evita fim de frase no meio da fala. Os cortes dos episódios 000 e 002 bateram com a análise manual.

**Controle de qualidade (`engine/qa.sh`, roda no fim do render):** procura trechos congelados de 0,4 s ou mais e telas pretas no meio, mede o volume (LUFS e pico) e gera a folha `-qa.jpg`. Regra do motor: nada fica parado por mais de 4 quadros. Partículas "respiram", e a câmera do mapa avança devagar quando está parada.

**Sincronia:** use `"word"` nas batidas, `"impactWord"` nos graves e `"word"` nos pinos. O visual entra 2 quadros antes da palavra; o grave, 1 quadro antes.

O modo antigo (um arquivo de voz por cena, `audio/01.mp3`…) continua funcionando para o episódio 001.

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
