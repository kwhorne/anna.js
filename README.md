# Anna.js

Et presentasjonsrammeverk for web med Markdown-first workflow. Skriv slides i Markdown med innebygd støtte for diagrammer, animerte terminaler, fragmenter og 12 temaer.

## Installasjon

```bash
npm install -g anna.js
```

Eller bruk direkte med `npx`:

```bash
npx anna init my-presentation
```

## Kom i gang

```bash
anna init my-presentation          # nytt prosjekt med alle filer
anna generate slides.md            # generer HTML fra Markdown
anna generate slides.md --watch    # regenerer ved endringer
anna export slides.md              # eksporter til PDF (krever puppeteer)
```

## Eksempel

`````markdown
---
title: Min presentasjon
theme: moon
transition: slide
---

# Velkommen

Første slide

---

## Fragmenter

<!-- .fragments -->
- Punkt som vises ett om gangen
- Med piltaster eller mellomrom
- Perfekt for lister

--

### Vertikal sub-slide

Bruk `--` for vertikale slides

---

## Diagrammer

```mermaid
graph LR
    A[Idé] --> B[Markdown] --> C[Presentasjon]
```

---

## Terminal

```terminal
$ anna init demo
  ✓ Created slides.md
  ✓ Generated slides.html

$ anna generate slides.md --watch
  ✓ slides.md → slides.html
  Watching slides.md for changes...
```

---

<!-- .slide: data-background="#4d7e65" -->

## Bakgrunner

Farger, bilder og gradienter via slide-attributter

---

![Bilde](foto.jpg)

---

## Speaker Notes

Trykk **S** for speaker-vindu.

Note:
Disse notatene ser bare presentatøren.

---

# Takk!
`````

## Syntaks

| Syntaks | Funksjon |
|---|---|
| `---` | Horisontal slide-separator |
| `--` | Vertikal slide-separator |
| `<!-- .fragments -->` | Animerer hvert listepunkt |
| `<!-- .fragment -->` | Gjør paragraf til fragment |
| `<!-- .slide: data-background="#hex" -->` | Bakgrunnsfarge |
| `<!-- .slide: data-background-image="img.jpg" -->` | Bakgrunnsbilde |
| `![alt](bilde.jpg)` | Bilde (auto-skalert til slide) |
| `Note:` | Speaker notes (synlig med **S**) |
| ````terminal ` | Animert terminal med typing-effekt |
| ````mermaid ` | Diagrammer (flowchart, sekvens, gantt, etc.) |
| ````playground ` | Live kodeeditor med output (JS, HTML, CSS) |

## Frontmatter

```yaml
---
title: Tittel
author: Navn
theme: league        # 12 temaer tilgjengelig
transition: slide    # slide, fade, convex, concave, zoom, none
controls: true
progress: true
center: true
hash: true
autoSlide: 0
loop: false
---
```

## AI-generering

Generer en komplett presentasjon fra en outline eller et emne:

```bash
anna ai outline.txt                       # fra en fil
anna ai "Introduction to Kubernetes"      # fra et emne
anna ai outline.txt --theme moon -o k8s.md
```

Bruker Claude API. Krever `ANTHROPIC_API_KEY` og `npm install @anthropic-ai/sdk`.

## Terminal-slides

Kommandoer types ut karakter for karakter. Output vises etter typing. Hvert kommando-par er et fragment-steg.

## Live Code Playground

Kjørbar kode direkte i slides — perfekt for workshops og kurs:

````markdown
```playground
const name = "Anna";
console.log(`Hello, ${name}!`);
```

```playground html
<h1 style="color: coral">Hello!</h1>
<p>Edit me and click Run.</p>
```
````

Støtter JavaScript, HTML og CSS. Koden kjøres i sandkasse. Ctrl+Enter for å kjøre, Tab for innrykk.

## Terminal-slides

````markdown
```terminal
$ npm install anna.js
added 42 packages in 2.3s

$ anna generate slides.md
✓ slides.md → slides.html
```
````

## Mermaid-diagrammer

Flowcharts, sekvensdiagrammer, gantt-charts og mer. Tema tilpasses automatisk til mørke/lyse Anna.js-temaer. Krever internett (lastes fra CDN).

````markdown
```mermaid
sequenceDiagram
    Bruker->>CLI: slides.md
    CLI->>Parser: Parse markdown
    Parser->>HTML: Generer slides
    HTML-->>Bruker: slides.html
```
````

## Speaker View

Trykk **S** under presentasjonen for utvidet speaker-view med:

- **Nedtellingstimer** — klikk for å sette varighet, fargekodes grønn/gul/rød
- **Tidsbruk per slide** — sporer tid på hver slide i sanntid
- **Neste-slide forhåndsvisning** — se hva som kommer
- **Fremdriftslinje** — slide X av Y med visuell progress
- **Klokke og elapsed timer** — holdes i sync
- **Speaker notes** — vises stort og lesbart
- **Tre layouts** — Default, Wide, Notes-only

Timer og layout huskes mellom sesjoner via localStorage.

## Embed-modus

Legg inn slides i bloggposter, dokumentasjon eller README med en enkel `<script>`-tag:

```html
<script src="https://unpkg.com/anna.js/js/anna-embed.js"></script>

<!-- Enkelt slide -->
<anna-slide theme="moon">
  ## Hello World
  - Punkt 1
  - Punkt 2
</anna-slide>

<!-- Interaktivt deck med navigasjon -->
<anna-deck theme="night">
  <anna-slide>
    # Slide 1
  </anna-slide>
  <anna-slide>
    # Slide 2
  </anna-slide>
</anna-deck>
```

Selvstendige web components med Shadow DOM — ingen konflikter med sidestiler. Inkluderer alle 11 temaer, markdown-parsing, fragmenter og tastaturnavigasjon.

## Temaer

**Mørke:** black, night, moon, blood, league (standard)
**Lyse:** white, beige, sky, serif, simple, solarized

I Markdown — sett `theme` i frontmatter. I HTML:

```html
<link rel="stylesheet" href="css/theme/moon.css">
```

## Keyboard shortcuts

| Tast | Funksjon |
|---|---|
| Piltaster | Naviger mellom slides |
| Space / N | Neste slide |
| P | Forrige slide |
| ESC / O | Slide-oversikt |
| S | Speaker notes |
| F | Fullskjerm |
| B / . | Pause (svart skjerm) |

## Utvikling

```bash
npm install
npm run build     # kompiler SCSS + minifiser CSS/JS
npm start         # utviklingsserver med livereload
npm test          # lint + 24 tester
```

## Plugins

markdown, highlight, notes, math, search, zoom, multiplex, terminal, mermaid, playground

## Lisens

MIT — Knut W. Horne ([kwhorne.com](https://kwhorne.com))
