/**
 * Anna.js Markdown-to-Presentation Generator
 *
 * Markdown format:
 *   - YAML frontmatter for configuration (theme, transition, title, etc.)
 *   - `---` separates horizontal slides
 *   - `--` separates vertical slides within a horizontal section
 *   - `Note:` starts speaker notes (until end of slide)
 *   - `<!-- .slide: data-background="#hex" -->` for per-slide attributes
 *   - `<!-- .fragments -->` before a list to animate items one by one
 *   - `![alt](image.jpg)` for images (auto-sized to fit slides)
 */

const fs = require("fs");
const path = require("path");
const https = require("https");
const matter = require("gray-matter");
const { marked } = require("marked");

const { processComponents } = require("./components");

const MERMAID_CDN_URL =
  "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js";
const MERMAID_LOCAL_PATH = path.resolve(
  __dirname,
  "..",
  "lib",
  "js",
  "mermaid.min.js",
);

// --- Public API ---

function run(args) {
  if (args.includes("--help") || args.includes("-h") || args.length === 0) {
    console.log(`
  Anna.js Markdown Generator

  Usage:
    anna generate <input.md> [output.html]

  Options:
    --watch, -w    Watch for changes and regenerate
    --offline      Download mermaid.js locally for offline use
    --pwa          Generate PWA files (manifest.json, sw.js)
    --help, -h     Show this help

  Markdown format:
    ---            Horizontal slide separator
    --             Vertical slide separator
    Note:          Speaker notes (until end of slide)

  Fragment syntax:
    <!-- .fragments -->     Before a list: each item appears one by one
    <!-- .fragment -->      After a paragraph: that paragraph is a fragment

  Slide attributes:
    <!-- .slide: data-background="#4d7e65" -->
    <!-- .slide: data-background-image="img.jpg" -->

  Frontmatter options:
    title          Presentation title
    theme          Theme name (default: league)
    transition     Transition effect (default: slide)
    controls       Show navigation controls (default: true)
    progress       Show progress bar (default: true)
    center         Center slide content (default: true)
    hash           Enable URL hashing (default: true)
		`);
    process.exit(0);
  }

  const watchMode = args.includes("--watch") || args.includes("-w");
  const offlineMode = args.includes("--offline");
  const pwaMode = args.includes("--pwa");
  const fileArgs = args.filter((a) => !a.startsWith("-"));
  const inputFile = fileArgs[0];
  const outputFile = fileArgs[1] || inputFile.replace(/\.md$/, ".html");

  if (!fs.existsSync(inputFile)) {
    console.error(`  Error: File not found: ${inputFile}`);
    process.exit(1);
  }

  const annaRoot = resolveAnnaRoot(outputFile);

  function doBuild() {
    const html = build(inputFile, {
      annaRoot,
      offline: offlineMode,
      pwa: pwaMode,
    });
    fs.writeFileSync(outputFile, html, "utf-8");
    console.log(`  \u2713 ${inputFile} \u2192 ${outputFile}`);

    if (pwaMode) {
      const raw = fs.readFileSync(inputFile, "utf-8");
      const { data: config } = matter(raw);
      const outputDir = path.dirname(path.resolve(outputFile));
      const theme = config.theme || "league";

      const manifest = generateManifest(config, theme);
      fs.writeFileSync(
        path.join(outputDir, "manifest.json"),
        manifest,
        "utf-8",
      );
      console.log(`  \u2713 manifest.json`);

      const sw = generateServiceWorker(annaRoot, {
        theme,
        offline: offlineMode,
        useTerminal: html.includes("plugin/terminal/"),
        usePlayground: html.includes("plugin/playground/"),
        useMermaid: html.includes("mermaid"),
      });
      fs.writeFileSync(path.join(outputDir, "sw.js"), sw, "utf-8");
      console.log(`  \u2713 sw.js`);
    }
  }

  if (offlineMode) {
    downloadMermaid(() => {
      doBuild();
      if (watchMode) {
        startWatch(inputFile, doBuild);
      }
    });
  } else {
    doBuild();
    if (watchMode) {
      startWatch(inputFile, doBuild);
    }
  }
}

function startWatch(inputFile, doBuild) {
  console.log(`  Watching ${inputFile} for changes...`);
  let timeout;
  fs.watch(inputFile, () => {
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      try {
        doBuild();
      } catch (e) {
        console.error(`  Error: ${e.message}`);
      }
    }, 100);
  });
}

/**
 * Download the Mermaid UMD library to the local cache if not already present.
 */
function downloadMermaid(callback) {
  if (fs.existsSync(MERMAID_LOCAL_PATH)) {
    console.log("  \u2713 Mermaid library already cached");
    return callback();
  }

  const dir = path.dirname(MERMAID_LOCAL_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  console.log("  Downloading mermaid.min.js...");

  function doDownload(url) {
    https
      .get(url, (res) => {
        // Follow redirects
        if (
          res.statusCode >= 300 &&
          res.statusCode < 400 &&
          res.headers.location
        ) {
          return doDownload(res.headers.location);
        }
        if (res.statusCode !== 200) {
          console.error(
            `  Error: Failed to download mermaid (HTTP ${res.statusCode})`,
          );
          process.exit(1);
        }
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          fs.writeFileSync(MERMAID_LOCAL_PATH, Buffer.concat(chunks));
          console.log("  \u2713 Mermaid library downloaded");
          callback();
        });
      })
      .on("error", (err) => {
        console.error(`  Error: Failed to download mermaid: ${err.message}`);
        process.exit(1);
      });
  }

  doDownload(MERMAID_CDN_URL);
}

/**
 * Build HTML from a markdown file. Returns the HTML string.
 */
function build(inputFile, opts = {}) {
  const annaRoot =
    opts.annaRoot || resolveAnnaRoot(inputFile.replace(/\.md$/, ".html"));
  const raw = fs.readFileSync(inputFile, "utf-8");
  const { data: config, content } = matter(raw);
  const expanded = processComponents(content);
  const slides = parseSlides(expanded);
  return generateHTML(slides, config, annaRoot, {
    offline: opts.offline,
    pwa: opts.pwa,
  });
}

function resolveAnnaRoot(outputFile) {
  const rel = path.relative(
    path.dirname(path.resolve(outputFile)),
    path.resolve(__dirname, ".."),
  );
  return rel === "" ? "." : rel;
}

// --- Parser ---

function protectCodeBlocks(text) {
  const blocks = [];
  const protected_ = text.replace(/```[\s\S]*?```/g, (match) => {
    blocks.push(match);
    return `\x00CODEBLOCK_${blocks.length - 1}\x00`;
  });
  const restore = (str) =>
    str.replace(/\x00CODEBLOCK_(\d+)\x00/g, (_, i) => blocks[i]);
  return { text: protected_, restore };
}

function parseSlides(content) {
  const { text, restore } = protectCodeBlocks(content);

  const horizontalSections = text.split(/\n---\n/);

  return horizontalSections.map((section) => {
    const verticalParts = section.split(/\n--\n/);

    if (verticalParts.length === 1) {
      return parseSlide(restore(verticalParts[0]));
    }

    return { vertical: verticalParts.map((s) => parseSlide(restore(s))) };
  });
}

function parseSlide(md) {
  const slide = { content: "", notes: null, attrs: {} };

  // Extract slide-level attributes: <!-- .slide: key="value" key2=value2 -->
  const attrMatch = md.match(/<!--\s*\.slide:\s*(.*?)\s*-->/);
  if (attrMatch) {
    md = md.replace(attrMatch[0], "");
    const attrRegex = /([\w-]+)=["']?([^"'\s]+)["']?/g;
    let m;
    while ((m = attrRegex.exec(attrMatch[1])) !== null) {
      slide.attrs[m[1]] = m[2];
    }
  }

  // Extract speaker notes: everything after `Note:` on its own line
  const noteParts = md.split(/\nNote:\s*\n/i);
  const slideMarkdown = noteParts[0].trim();
  if (noteParts.length > 1) {
    slide.notes = marked(noteParts[1].trim());
  }

  // Process ```terminal code blocks into terminal widgets
  let processed = slideMarkdown.replace(
    /```terminal\n([\s\S]*?)```/g,
    (_, content) => {
      return `<div class="terminal" data-title="Terminal">\n${content.trim()}\n</div>`;
    },
  );

  // Process ```mermaid code blocks into mermaid diagrams
  processed = processed.replace(/```mermaid\n([\s\S]*?)```/g, (_, content) => {
    return `<pre class="mermaid">\n${content.trim()}\n</pre>`;
  });

  // Process ```playground multi code blocks (multi-file: JS + HTML + CSS)
  processed = processed.replace(
    /```playground\s+multi\n([\s\S]*?)```/g,
    (_, content) => {
      // Parse sections separated by --- or language markers
      const sections = { js: "", html: "", css: "" };
      let current = "js";
      for (const line of content.trim().split("\n")) {
        if (/^===\s*js\s*$/i.test(line)) {
          current = "js";
          continue;
        }
        if (/^===\s*html\s*$/i.test(line)) {
          current = "html";
          continue;
        }
        if (/^===\s*css\s*$/i.test(line)) {
          current = "css";
          continue;
        }
        sections[current] += line + "\n";
      }
      const jsContent = esc(sections.js.trim());
      const htmlContent = esc(sections.html.trim());
      const cssContent = esc(sections.css.trim());
      return `<div class="playground" data-lang="multi" data-js="${jsContent}" data-html="${htmlContent}" data-css="${cssContent}"></div>`;
    },
  );

  // Process ```playground step code blocks (step-by-step diff)
  processed = processed.replace(
    /```playground\s+step\s*(\d+)?(?:\s+(\S+))?\n([\s\S]*?)```/g,
    (_, step, group, content) => {
      const stepNum = step || "1";
      const groupAttr = group ? ` data-step-group="${group}"` : "";
      return `<div class="playground" data-lang="javascript" data-step="${stepNum}"${groupAttr}>\n${content.trim()}\n</div>`;
    },
  );

  // Process ```playground code blocks into live editors
  processed = processed.replace(
    /```playground\s*(html|css|javascript)?\n([\s\S]*?)```/g,
    (_, lang, content) => {
      const language = lang || "javascript";
      return `<div class="playground" data-lang="${language}">\n${content.trim()}\n</div>`;
    },
  );

  // Process ```poll code blocks into live poll widgets
  processed = processed.replace(
    /```poll(?:\s+([^\n]*?))?\n([\s\S]*?)```/g,
    (_, question, content) => {
      const pollId = "poll-" + Math.random().toString(36).slice(2, 8);
      const q = (question || "").trim();
      const options = content
        .trim()
        .split("\n")
        .map((l) => l.replace(/^[-*]\s*/, "").trim())
        .filter((l) => l.length > 0);
      const optionsHTML = options
        .map(
          (o) =>
            `<div class="live-poll-option" data-option="${esc(o)}">${esc(o)}</div>`,
        )
        .join("\n");
      return `<div class="live-poll" data-poll-id="${pollId}" data-question="${esc(q)}">\n${optionsHTML}\n</div>`;
    },
  );

  // Process ```qa code blocks into live Q&A widgets
  processed = processed.replace(/```qa(?:\s+([^\n]*?))?\n?```/g, (_, label) => {
    const qaId = "qa-" + Math.random().toString(36).slice(2, 8);
    const labelAttr = (label || "").trim()
      ? ` data-label="${esc(label.trim())}"`
      : "";
    return `<div class="live-qa" data-qa-id="${qaId}"${labelAttr}></div>`;
  });

  // Process <!-- .fragments --> directive
  processed = processed.replace(
    /<!--\s*\.fragments(?:\s+([\w-]+))?\s*-->\n([\s\S]*?)(?=\n\n|$)/g,
    (_, effect, listBlock) => {
      const html = marked(listBlock.trim());
      const cls = effect ? `fragment ${effect}` : "fragment";
      return html.replace(/<li>/g, `<li class="${cls}">`);
    },
  );

  // Process <!-- .fragment --> after a paragraph
  processed = processed.replace(
    /^(.+)\n<!--\s*\.fragment(?:\s+([\w-]+))?\s*-->/gm,
    (_, line, effect) => {
      const cls = effect ? `fragment ${effect}` : "fragment";
      return `<p class="${cls}">${line.trim()}</p>`;
    },
  );

  slide.content = marked(processed);

  return slide;
}

// --- HTML Generation ---

function hasTerminalBlocks(slides) {
  return slides.some((s) => {
    if (s.vertical)
      return s.vertical.some((v) => v.content.includes('class="terminal"'));
    return s.content.includes('class="terminal"');
  });
}

function hasPlaygroundBlocks(slides) {
  return slides.some((s) => {
    if (s.vertical)
      return s.vertical.some((v) => v.content.includes('class="playground"'));
    return s.content.includes('class="playground"');
  });
}

function hasComponentBlocks(slides) {
  return slides.some((s) => {
    if (s.vertical)
      return s.vertical.some((v) => v.content.includes('class="anna-'));
    return s.content.includes('class="anna-');
  });
}

function hasLiveBlocks(slides) {
  return slides.some((s) => {
    if (s.vertical)
      return s.vertical.some(
        (v) =>
          v.content.includes('class="live-poll"') ||
          v.content.includes('class="live-qa"'),
      );
    return (
      s.content.includes('class="live-poll"') ||
      s.content.includes('class="live-qa"')
    );
  });
}

function hasMermaidBlocks(slides) {
  return slides.some((s) => {
    if (s.vertical)
      return s.vertical.some((v) => v.content.includes('class="mermaid"'));
    return s.content.includes('class="mermaid"');
  });
}

const DARK_THEMES = ["black", "night", "moon", "blood", "league"];

const THEME_COLORS = {
  black: "#191919",
  white: "#fff",
  league: "#2b5b84",
  beige: "#f7f3de",
  night: "#111",
  moon: "#002b36",
  blood: "#222",
  serif: "#f0edde",
  simple: "#fff",
  solarized: "#fdf6e3",
  sky: "#f7fbfc",
};

function generateHTML(slides, config, annaRoot, extraOpts) {
  const opts = extraOpts || {};
  const offline = opts.offline || false;
  const pwa = opts.pwa || false;

  const theme = config.theme || "league";
  const transition = config.transition || "slide";
  const title = config.title || "Anna.js Presentation";
  const author = config.author || "";

  const initOptions = {
    controls: config.controls !== false,
    progress: config.progress !== false,
    center: config.center !== false,
    hash: config.hash !== false,
    transition: transition,
  };

  if (config.autoSlide) initOptions.autoSlide = config.autoSlide;
  if (config.loop) initOptions.loop = true;

  const useTerminal = hasTerminalBlocks(slides);
  const useMermaid = hasMermaidBlocks(slides);
  const usePlayground = hasPlaygroundBlocks(slides);
  const useLive = hasLiveBlocks(slides);
  const useComponents = hasComponentBlocks(slides);
  const mermaidTheme = DARK_THEMES.includes(theme) ? "dark" : "default";
  const themeColor = THEME_COLORS[theme] || "#222";

  const slidesHTML = slides
    .map((slide) => {
      if (slide.vertical) {
        const inner = slide.vertical.map((s) => renderSlide(s)).join("\n");
        return `\t\t\t\t<section>\n${inner}\n\t\t\t\t</section>`;
      }
      return renderSlide(slide);
    })
    .join("\n\n");

  const p = annaRoot;

  // Mermaid script block
  let mermaidBlock = "";
  if (useMermaid) {
    if (offline) {
      mermaidBlock = `\t\t<script src="${p}/lib/js/mermaid.min.js"></script>\n\t\t<script>mermaid.initialize({ startOnLoad: true, theme: '${mermaidTheme}' });</script>\n`;
    } else {
      mermaidBlock = `\t\t<script type="module">\n\t\t\timport mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs';\n\t\t\tmermaid.initialize({ startOnLoad: true, theme: '${mermaidTheme}' });\n\t\t</script>\n`;
    }
  }

  // PWA head tags
  let pwaHead = "";
  if (pwa) {
    pwaHead = `\t\t<meta name="theme-color" content="${themeColor}">\n\t\t<link rel="manifest" href="manifest.json">\n`;
  }

  // PWA service worker registration script
  let pwaScript = "";
  if (pwa) {
    pwaScript = `\n\t\t<script>\n\t\t\tif ('serviceWorker' in navigator) {\n\t\t\t\tnavigator.serviceWorker.register('sw.js');\n\t\t\t}\n\t\t</script>`;
  }

  return `<!doctype html>
<html>
\t<head>
\t\t<meta charset="utf-8">
\t\t<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">

\t\t<title>${esc(title)}</title>
${author ? `\t\t<meta name="author" content="${esc(author)}">\n` : ""}${pwaHead}
\t\t<link rel="stylesheet" href="${p}/css/reset.css">
\t\t<link rel="stylesheet" href="${p}/css/anna.css">
\t\t<link rel="stylesheet" href="${p}/css/theme/${theme}.css">
\t\t<link rel="stylesheet" href="${p}/lib/css/monokai.css">
${useTerminal ? `\t\t<link rel="stylesheet" href="${p}/plugin/terminal/terminal.css">\n` : ""}${useMermaid ? `\t\t<link rel="stylesheet" href="${p}/plugin/mermaid/mermaid.css">\n` : ""}${usePlayground ? `\t\t<link rel="stylesheet" href="${p}/plugin/playground/playground.css">\n` : ""}${useLive ? `\t\t<link rel="stylesheet" href="${p}/plugin/live/live.css">\n` : ""}${useComponents ? `\t\t<link rel="stylesheet" href="${p}/plugin/components/components.css">\n` : ""}\t</head>
\t<body>
\t\t<div class="anna">
\t\t\t<div class="slides">
${slidesHTML}
\t\t\t</div>
\t\t</div>

\t\t<script src="${p}/js/anna.js"></script>
${useTerminal ? `\t\t<script src="${p}/plugin/terminal/terminal.js"></script>\n` : ""}${usePlayground ? `\t\t<script src="${p}/plugin/playground/playground.js"></script>\n` : ""}${useLive ? `\t\t<script src="${p}/plugin/live/live.js"></script>\n` : ""}${mermaidBlock}
\t\t<script>
\t\t\tAnna.initialize({
${Object.entries(initOptions)
  .map(([k, v]) => `\t\t\t\t${k}: ${JSON.stringify(v)}`)
  .join(",\n")},
\t\t\t\tdependencies: [
\t\t\t\t\t{ src: '${p}/plugin/markdown/marked.js' },
\t\t\t\t\t{ src: '${p}/plugin/markdown/markdown.js' },
\t\t\t\t\t{ src: '${p}/plugin/notes/notes.js', async: true },
\t\t\t\t\t{ src: '${p}/plugin/highlight/highlight.js', async: true }
\t\t\t\t]
\t\t\t});
\t\t</script>${pwaScript}
\t</body>
</html>
`;
}

// --- PWA Generation ---

function generateManifest(config, theme) {
  const title = config.title || "Anna.js Presentation";
  const themeColor = THEME_COLORS[theme] || "#222";

  const manifest = {
    name: title,
    short_name: title.length > 12 ? title.substring(0, 12) + "..." : title,
    start_url: "./",
    display: "standalone",
    background_color: themeColor,
    theme_color: themeColor,
    description: config.description || title,
  };

  return JSON.stringify(manifest, null, "\t");
}

function generateServiceWorker(annaRoot, options) {
  const p = annaRoot;
  const cacheFiles = [
    "'./'",
    `'${p}/css/reset.css'`,
    `'${p}/css/anna.css'`,
    `'${p}/css/theme/${options.theme}.css'`,
    `'${p}/lib/css/monokai.css'`,
    `'${p}/js/anna.js'`,
    `'${p}/plugin/markdown/marked.js'`,
    `'${p}/plugin/markdown/markdown.js'`,
    `'${p}/plugin/notes/notes.js'`,
    `'${p}/plugin/highlight/highlight.js'`,
  ];

  if (options.useTerminal) {
    cacheFiles.push(`'${p}/plugin/terminal/terminal.css'`);
    cacheFiles.push(`'${p}/plugin/terminal/terminal.js'`);
  }

  if (options.usePlayground) {
    cacheFiles.push(`'${p}/plugin/playground/playground.css'`);
    cacheFiles.push(`'${p}/plugin/playground/playground.js'`);
  }

  if (options.useMermaid) {
    cacheFiles.push(`'${p}/plugin/mermaid/mermaid.css'`);
    if (options.offline) {
      cacheFiles.push(`'${p}/lib/js/mermaid.min.js'`);
    }
  }

  return `// Anna.js Presentation Service Worker
const CACHE_NAME = 'anna-presentation-v1';
const ASSETS = [
\t${cacheFiles.join(",\n\t")}
];

self.addEventListener('install', (event) => {
\tevent.waitUntil(
\t\tcaches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
\t);
});

self.addEventListener('activate', (event) => {
\tevent.waitUntil(
\t\tcaches.keys().then((keys) =>
\t\t\tPromise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
\t\t)
\t);
});

self.addEventListener('fetch', (event) => {
\tevent.respondWith(
\t\tcaches.match(event.request).then((cached) => cached || fetch(event.request))
\t);
});
`;
}

function renderSlide(slide) {
  const attrs = Object.entries(slide.attrs)
    .map(([k, v]) => ` ${k}="${esc(v)}"`)
    .join("");

  const notes = slide.notes
    ? `\t\t\t\t\t\t<aside class="notes">${slide.notes}</aside>\n`
    : "";

  return `\t\t\t\t\t<section${attrs}>
${slide.content}
${notes}\t\t\t\t\t</section>`;
}

function esc(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// --- Exports ---

module.exports = { run, build };
