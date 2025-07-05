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

1. Last ned Anna.js
2. Åpne `index.html` i nettleseren din
3. Begynn å redigere slides!

## 💻 Utvikling

### Krav
- Node.js >= 16.0.0
- npm eller yarn

### Installasjon
```bash
# Installer avhengigheter
npm install

# Start utviklingsserver
npm start

# Bygg for produksjon
npm run build

# Kompiler CSS fra SCSS
sass css/anna.scss css/anna.css
```

### Moderne teknologi
- **Dart Sass** - Moderne CSS-kompiler
- **ES2020+** - Moderne JavaScript-støtte
- **Responsive design** - Mobile-first tilnærming

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

### Markdown støtte
```html
<section data-markdown="slides.md"></section>
```

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