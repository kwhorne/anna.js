# Anna.js

Et presentasjonsrammeverk for web. Skriv slides i Markdown, velg blant 12 temaer, og presenter direkte i nettleseren.

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
# Opprett nytt prosjekt med alle filer
anna init my-presentation

# Eller bare generer fra en .md-fil
anna generate slides.md
anna generate slides.md --watch

# Eksporter til PDF (krever puppeteer)
anna export slides.md
```

## Markdown-format

```markdown
---
title: Min presentasjon
theme: moon
transition: slide
---

# Velkommen

Første slide

---

## Andre slide

<!-- .fragments -->
- Punkt 1
- Punkt 2
- Punkt 3

--

### Vertikal sub-slide

---

![Bilde](foto.jpg)

---

<!-- .slide: data-background-image="hero.jpg" -->

## Fullskjerm-bakgrunn

---

# Takk!
```

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
| ` ```terminal ` | Animert terminal med typing-effekt |

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

## CLI-kommandoer

```bash
anna init [name]              # Opprett nytt prosjekt
anna generate <file.md>       # Generer HTML fra Markdown
anna generate <file.md> -w    # Watch-modus
anna export <file.md>         # Eksporter til PDF
anna --help                   # Vis hjelp
```

## Terminal-slides

Vis kommandoer med animert typing-effekt — perfekt for tech-talks:

````markdown
```terminal
$ npm install anna.js
added 42 packages in 2.3s

$ anna generate slides.md
✓ slides.md → slides.html
```
````

Hvert kommando-par er et fragment-steg. Trykk piltaster for neste kommando.

## Temaer

**Mørke:** black, night, moon, blood, league (standard)
**Lyse:** white, beige, sky, serif, simple, solarized

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
npm run build          # kompiler SCSS + minifiser CSS/JS
npm start              # utviklingsserver med livereload
npm test               # lint + tester
```

## Plugins

markdown, highlight, notes, math, search, zoom, multiplex, terminal

## Lisens

MIT — Knut W. Horne ([kwhorne.com](https://kwhorne.com))
