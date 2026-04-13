# Anna.js

Et presentasjonsrammeverk for web. Skriv slides i Markdown eller HTML, velg blant 12 temaer, og presenter direkte i nettleseren.

## Kom i gang

```bash
npm install
```

### Markdown (anbefalt)

Skriv presentasjonen i en `.md`-fil:

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

Bruk `--` for vertikale slides

---

# Takk!
```

Generer og åpne i nettleseren:

```bash
npx anna generate presentasjon.md
npx anna generate presentasjon.md --watch   # regenerer ved endringer
```

### HTML

Rediger `index.html` direkte og åpne i nettleseren, eller start utviklingsserveren:

```bash
npm start
```

## Markdown-format

| Syntaks | Funksjon |
|---|---|
| `---` | Horisontal slide-separator |
| `--` | Vertikal slide-separator |
| `<!-- .fragments -->` | Animerer hvert listepunkt ett om gangen |
| `<!-- .fragment -->` | Gjør foregående paragraf til fragment |
| `<!-- .slide: data-background="#hex" -->` | Slide-attributter (bakgrunn, transition, etc.) |
| `Note:` | Speaker notes (synlig kun for presentatør med **S**) |

### Frontmatter-opsjoner

```yaml
---
title: Presentasjonstittel
author: Navn
theme: moon            # standard: league
transition: slide      # slide, fade, convex, concave, zoom, none
controls: true         # vis navigasjonspiler
progress: true         # vis fremdriftslinje
center: true           # sentrer innhold
hash: true             # URL-hashing per slide
autoSlide: 0           # auto-avansering i ms (0 = av)
loop: false            # loop tilbake til start
---
```

## Temaer

Anna.js kommer med 12 innebygde temaer:

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
npm run build          # kompiler SCSS + minifiser CSS/JS
npm start              # utviklingsserver med livereload
npm run lint           # ESLint-sjekk
npm run generate -- slides.md   # generer presentasjon fra markdown
```

### Byggesystem

- **Dart Sass** — SCSS-kompilering
- **PostCSS + Autoprefixer** — vendor-prefikser
- **clean-css** — CSS-minifisering
- **Terser** — JS-minifisering
- **ESLint** — kodekvalitet
- **BrowserSync** — utviklingsserver

## Plugins

- **markdown** — Markdown i HTML-slides
- **highlight** — Syntax highlighting for kodeblokker
- **notes** — Speaker notes
- **math** — LaTeX-formler
- **search** — Søk i slides
- **zoom** — Zoom inn på elementer
- **multiplex** — Synkroniser presentasjon til publikum

## Lisens

MIT — Knut W. Horne ([kwhorne.com](https://kwhorne.com))
