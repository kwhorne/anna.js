# Anna.js - The HTML Presentation Framework

🎪 **Anna.js** er et moderne, kraftfullt presentasjonsrammeverk bygget for web. Opprett vakre, interaktive presentasjoner med HTML, CSS og JavaScript.

## ✨ Funksjoner

- 📱 **Responsivt design** - Fungerer perfekt på alle enheter
- 🎨 **Anpassbare temaer** - Flere innebygde temaer + mulighet for egne
- ⚡ **Høy ytelse** - Optimert for rask lasting og smooth animasjoner
- 🔧 **Plugin-støtte** - Utvid funksjonaliteten med plugins
- 📄 **Markdown-støtte** - Skriv slides i Markdown
- 🎯 **Touch-støtte** - Swipe-navigasjon på mobile enheter

## 🚀 Kom i gang

### Markdown (anbefalt)

Skriv presentasjonen din i en enkelt Markdown-fil:

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

---

## Vertikale slides

--

### Detaljer under

--

### Enda mer

---

# Takk!
```

Generer HTML:

```bash
npx anna generate presentasjon.md
npx anna generate presentasjon.md --watch   # Regenerer ved endringer
```

### HTML

1. Åpne `index.html` i nettleseren din
2. Rediger slides direkte i HTML

## 💻 Utvikling

### Krav
- Node.js >= 16.0.0
- npm eller yarn

### Installasjon
```bash
# Installer avhengigheter
npm install

# Start utviklingsserver med livereload
npm start

# Bygg for produksjon
npm run build

# Lint JavaScript
npm run lint
```

### Moderne teknologi
- **Dart Sass** - Moderne CSS-kompiler
- **PostCSS + Autoprefixer** - Automatiske vendor-prefikser
- **Terser** - JavaScript-minifisering
- **ESLint** - Kodekvalitet
- **BrowserSync** - Utviklingsserver med livereload

## 🎨 Temaer

Anna.js kommer med 12 innebygde temaer:
- **Black** - Elegant mørk design
- **White** - Ren, minimal stil
- **League** - Moderne og fargerik (standard)
- **Beige** - Varm og behagelig
- **Sky** - Luftig og lett
- **Night** - Sofistikert mørk
- **Serif** - Klassisk og tidløs
- **Simple** - Minimalistisk
- **Solarized** - Utviklervennlig
- **Blood** - Dramatisk rød
- **Moon** - Mystisk blå

### Endre tema
```html
<link rel="stylesheet" href="css/theme/black.css">
```

## 📆 Dokumentasjon

Se `demo.html` for eksempler på bruk og funksjoner.

## ⌨️ Keyboard Shortcuts

- **Piltaster** - Naviger mellom slides
- **Space/N** - Neste slide
- **P** - Forrige slide
- **ESC/O** - Slide overview
- **S** - Speaker notes
- **F** - Fullscreen
- **B/.** - Pause (black screen)

## 🔌 Avanserte funksjoner

### Fragmenter
```html
<p class="fragment">Vises først</p>
<p class="fragment fade-in">Fades inn</p>
<p class="fragment highlight-red">Highlightes rød</p>
```

### Vertikale slides
```html
<section>
  <section>Horisontal slide</section>
  <section>Vertikal slide</section>
</section>
```

### Markdown-generator

```bash
npx anna generate slides.md              # Generer slides.html
npx anna generate slides.md output.html  # Spesifiser output
npx anna generate slides.md --watch      # Watch-modus
```

Markdown-funksjoner:
- `---` separerer horisontale slides
- `--` separerer vertikale slides
- `<!-- .fragments -->` før en liste animerer hvert punkt
- `<!-- .slide: data-background="#hex" -->` for slide-attributter
- `Note:` for speaker notes

## 🤝 Bidrag

Bidrag er velkomne! Opprett en issue eller send inn en pull request.

## 📄 Lisens

MIT License - Copyright (C) 2025 Knut W. Horne

## 🔗 Links

- **Utvikler**: [Knut W. Horne](https://kwhorne.com)
- **Repository**: [github.com/kwhorne/anna.js](https://github.com/kwhorne/anna.js)
- **Demo**: Åpne `demo.html` for live demo

---

*Bygget med ❤️ av kwhorne*