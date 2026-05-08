/**
 * Playground 2.0 plugin for Anna.js
 *
 * Live code editors with syntax highlighting, multi-file support,
 * step-by-step diffs, and an enhanced console.
 *
 * Supports: JavaScript, HTML, CSS, and multi-file (JS + HTML + CSS).
 *
 * Usage in HTML:
 *   <div class="playground" data-lang="javascript">
 *     const x = 42;
 *     console.log("Answer:", x);
 *   </div>
 *
 *   <div class="playground" data-lang="multi"
 *        data-js="console.log('hello')"
 *        data-html="&lt;h1&gt;Hello&lt;/h1&gt;"
 *        data-css="h1 { color: red; }">
 *   </div>
 *
 *   <!-- Or with script elements for multi-file: -->
 *   <div class="playground" data-lang="multi">
 *     <script type="text/playground-js">console.log('hello');</script>
 *     <script type="text/playground-html"><h1>Hello</h1></script>
 *     <script type="text/playground-css">h1 { color: red; }</script>
 *   </div>
 *
 * Step-by-step diffs:
 *   <div class="playground" data-lang="javascript" data-step="1">
 *     const arr = [1, 2, 3];
 *   </div>
 *   <div class="playground" data-lang="javascript" data-step="2">
 *     const arr = [1, 2, 3];
 *     arr.push(4);
 *     console.log(arr);
 *   </div>
 *
 * Usage in Markdown (via generator):
 *   ```playground
 *   const x = 42;
 *   console.log("Answer:", x);
 *   ```
 *
 *   ```playground html
 *   <h1 style="color: coral">Hello!</h1>
 *   <p>Edit me and click Run.</p>
 *   ```
 */
(function () {
  "use strict";

  // ================================================================
  //  Utilities
  // ================================================================

  var IS_MAC =
    typeof navigator !== "undefined" && /Mac/.test(navigator.platform);

  function escapeHTML(str) {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function repeatStr(str, n) {
    var out = "";
    for (var i = 0; i < n; i++) out += str;
    return out;
  }

  function padRight(str, len) {
    str = String(str);
    while (str.length < len) str += " ";
    return str;
  }

  // ================================================================
  //  Syntax Highlighting — Tokenizers
  // ================================================================

  var JS_KEYWORDS = {};
  var JS_KW_LIST = [
    "const",
    "let",
    "var",
    "function",
    "return",
    "if",
    "else",
    "for",
    "while",
    "do",
    "switch",
    "case",
    "break",
    "continue",
    "default",
    "class",
    "import",
    "export",
    "from",
    "async",
    "await",
    "new",
    "try",
    "catch",
    "throw",
    "finally",
    "typeof",
    "instanceof",
    "in",
    "of",
    "this",
    "true",
    "false",
    "null",
    "undefined",
    "void",
    "delete",
    "yield",
    "extends",
    "super",
    "static",
    "get",
    "set",
    "with",
    "debugger",
  ];
  for (var _k = 0; _k < JS_KW_LIST.length; _k++)
    JS_KEYWORDS[JS_KW_LIST[_k]] = true;

  /** Tokenize JavaScript source into {type, value} tokens. */
  function tokenizeJS(code) {
    var tokens = [];
    var i = 0,
      len = code.length,
      s,
      ch,
      next;

    while (i < len) {
      ch = code[i];
      next = i + 1 < len ? code[i + 1] : "";

      // Single-line comment
      if (ch === "/" && next === "/") {
        s = i;
        i += 2;
        while (i < len && code[i] !== "\n") i++;
        tokens.push({ type: "comment", value: code.slice(s, i) });
        continue;
      }

      // Multi-line comment
      if (ch === "/" && next === "*") {
        s = i;
        i += 2;
        while (i < len && !(code[i] === "*" && code[i + 1] === "/")) i++;
        if (i < len) i += 2;
        tokens.push({ type: "comment", value: code.slice(s, i) });
        continue;
      }

      // Template literal
      if (ch === "`") {
        s = i;
        i++;
        while (i < len && code[i] !== "`") {
          if (code[i] === "\\") i++;
          i++;
        }
        if (i < len) i++;
        tokens.push({ type: "string", value: code.slice(s, i) });
        continue;
      }

      // Strings
      if (ch === '"' || ch === "'") {
        s = i;
        i++;
        while (i < len && code[i] !== ch) {
          if (code[i] === "\\") i++;
          i++;
        }
        if (i < len) i++;
        tokens.push({ type: "string", value: code.slice(s, i) });
        continue;
      }

      // Numbers
      if (ch >= "0" && ch <= "9") {
        s = i;
        if (
          ch === "0" &&
          (next === "x" ||
            next === "X" ||
            next === "b" ||
            next === "B" ||
            next === "o" ||
            next === "O")
        ) {
          i += 2;
          while (i < len && /[0-9a-fA-F_]/.test(code[i])) i++;
        } else {
          while (i < len && /[0-9._eE]/.test(code[i])) {
            if (
              (code[i] === "e" || code[i] === "E") &&
              i + 1 < len &&
              (code[i + 1] === "+" || code[i + 1] === "-")
            )
              i++;
            i++;
          }
        }
        if (i < len && code[i] === "n") i++; // BigInt
        tokens.push({ type: "number", value: code.slice(s, i) });
        continue;
      }

      // Identifiers & keywords
      if (
        (ch >= "a" && ch <= "z") ||
        (ch >= "A" && ch <= "Z") ||
        ch === "_" ||
        ch === "$"
      ) {
        s = i;
        while (i < len && /[\w$]/.test(code[i])) i++;
        var word = code.slice(s, i);
        tokens.push({
          type: JS_KEYWORDS[word] ? "keyword" : "plain",
          value: word,
        });
        continue;
      }

      // Operators & punctuation
      if ("+-*/%=<>!&|^~?:;,.()[]{}@#".indexOf(ch) !== -1) {
        tokens.push({ type: "operator", value: ch });
        i++;
        continue;
      }

      // Whitespace & anything else
      tokens.push({ type: "plain", value: ch });
      i++;
    }
    return tokens;
  }

  /** Tokenize HTML source. */
  function tokenizeHTML(code) {
    var tokens = [];
    var i = 0,
      len = code.length,
      s;

    while (i < len) {
      // HTML comment
      if (
        code[i] === "<" &&
        code[i + 1] === "!" &&
        code[i + 2] === "-" &&
        code[i + 3] === "-"
      ) {
        var end = code.indexOf("-->", i + 4);
        var endIdx = end === -1 ? len : end + 3;
        tokens.push({ type: "comment", value: code.slice(i, endIdx) });
        i = endIdx;
        continue;
      }

      // DOCTYPE / other <! declarations
      if (code[i] === "<" && code[i + 1] === "!") {
        s = i;
        while (i < len && code[i] !== ">") i++;
        if (i < len) i++;
        tokens.push({ type: "tag", value: code.slice(s, i) });
        continue;
      }

      // Tags
      if (code[i] === "<") {
        s = i;
        i++;
        if (i < len && code[i] === "/") i++;
        tokens.push({ type: "tag", value: code.slice(s, i) });

        // Tag name
        s = i;
        while (i < len && /[a-zA-Z0-9\-]/.test(code[i])) i++;
        if (i > s) tokens.push({ type: "tag", value: code.slice(s, i) });

        // Attributes
        while (i < len && code[i] !== ">") {
          if (code[i] === "/" && i + 1 < len && code[i + 1] === ">") break;

          // Whitespace
          if (/\s/.test(code[i])) {
            s = i;
            while (i < len && /\s/.test(code[i])) i++;
            tokens.push({ type: "plain", value: code.slice(s, i) });
            continue;
          }

          // Attribute name
          s = i;
          while (i < len && /[a-zA-Z0-9\-_:@.]/.test(code[i])) i++;
          if (i > s) {
            tokens.push({ type: "attr-name", value: code.slice(s, i) });

            // Whitespace around =
            while (i < len && /\s/.test(code[i])) {
              tokens.push({ type: "plain", value: code[i] });
              i++;
            }

            if (i < len && code[i] === "=") {
              tokens.push({ type: "operator", value: "=" });
              i++;
              while (i < len && /\s/.test(code[i])) {
                tokens.push({ type: "plain", value: code[i] });
                i++;
              }

              // Quoted attribute value
              if (i < len && (code[i] === '"' || code[i] === "'")) {
                var q = code[i];
                s = i;
                i++;
                while (i < len && code[i] !== q) i++;
                if (i < len) i++;
                tokens.push({ type: "attr-value", value: code.slice(s, i) });
              } else {
                // Unquoted value
                s = i;
                while (i < len && !/[\s>]/.test(code[i])) i++;
                if (i > s)
                  tokens.push({ type: "attr-value", value: code.slice(s, i) });
              }
            }
            continue;
          }

          // Safety advance
          tokens.push({ type: "plain", value: code[i] });
          i++;
        }

        // Closing bracket
        if (i < len) {
          if (code[i] === "/" && i + 1 < len && code[i + 1] === ">") {
            tokens.push({ type: "tag", value: "/>" });
            i += 2;
          } else if (code[i] === ">") {
            tokens.push({ type: "tag", value: ">" });
            i++;
          }
        }
        continue;
      }

      // Text content
      s = i;
      while (i < len && code[i] !== "<") i++;
      if (i > s) tokens.push({ type: "plain", value: code.slice(s, i) });
    }
    return tokens;
  }

  /** Tokenize CSS source. */
  function tokenizeCSS(code) {
    var tokens = [];
    var i = 0,
      len = code.length,
      s,
      ch;
    var inBlock = 0,
      afterColon = false;

    while (i < len) {
      ch = code[i];

      // Block comment
      if (ch === "/" && i + 1 < len && code[i + 1] === "*") {
        s = i;
        i += 2;
        while (i < len && !(code[i] === "*" && code[i + 1] === "/")) i++;
        if (i < len) i += 2;
        tokens.push({ type: "comment", value: code.slice(s, i) });
        continue;
      }

      // Strings
      if (ch === '"' || ch === "'") {
        s = i;
        i++;
        while (i < len && code[i] !== ch) {
          if (code[i] === "\\") i++;
          i++;
        }
        if (i < len) i++;
        tokens.push({ type: "string", value: code.slice(s, i) });
        continue;
      }

      // At-rules
      if (ch === "@") {
        s = i;
        i++;
        while (i < len && /[a-zA-Z\-]/.test(code[i])) i++;
        tokens.push({ type: "at-rule", value: code.slice(s, i) });
        continue;
      }

      // Braces
      if (ch === "{") {
        inBlock++;
        afterColon = false;
        tokens.push({ type: "operator", value: ch });
        i++;
        continue;
      }
      if (ch === "}") {
        inBlock = Math.max(0, inBlock - 1);
        afterColon = false;
        tokens.push({ type: "operator", value: ch });
        i++;
        continue;
      }

      // Colon inside declarations
      if (ch === ":" && inBlock > 0 && !afterColon) {
        afterColon = true;
        tokens.push({ type: "operator", value: ch });
        i++;
        continue;
      }

      // Semicolon
      if (ch === ";") {
        afterColon = false;
        tokens.push({ type: "operator", value: ch });
        i++;
        continue;
      }

      // Numbers with units (e.g. 16px, 1.5em, 50%)
      if (
        (ch >= "0" && ch <= "9") ||
        (ch === "." && i + 1 < len && code[i + 1] >= "0" && code[i + 1] <= "9")
      ) {
        s = i;
        while (i < len && /[0-9.]/.test(code[i])) i++;
        while (i < len && /[a-zA-Z%]/.test(code[i])) i++;
        tokens.push({ type: "number", value: code.slice(s, i) });
        continue;
      }

      // Words: selectors (outside blocks), properties, or values
      if (/[a-zA-Z_#.\-]/.test(ch) || (ch === ":" && inBlock === 0)) {
        // Handle pseudo-selector colons outside blocks
        if (ch === ":") {
          tokens.push({ type: "operator", value: ":" });
          i++;
          s = i;
        } else {
          s = i;
        }
        while (i < len && /[a-zA-Z0-9_#.\-]/.test(code[i])) i++;
        if (i > s) {
          var word = code.slice(s, i);
          if (inBlock === 0) {
            tokens.push({ type: "selector", value: word });
          } else if (afterColon) {
            tokens.push({ type: "value", value: word });
          } else {
            tokens.push({ type: "property", value: word });
          }
        }
        continue;
      }

      // Everything else (whitespace, parentheses, commas, etc.)
      tokens.push({ type: "plain", value: ch });
      i++;
    }
    return tokens;
  }

  /** Route to the correct tokenizer. */
  function tokenize(code, lang) {
    if (lang === "javascript") return tokenizeJS(code);
    if (lang === "html") return tokenizeHTML(code);
    if (lang === "css") return tokenizeCSS(code);
    return [{ type: "plain", value: code }];
  }

  // ================================================================
  //  Syntax Highlighting — Rendering
  // ================================================================

  /**
   * Build highlighted HTML as a series of <div class="sh-line"> elements.
   * @param {string} code        Source code.
   * @param {string} lang        Language identifier.
   * @param {Object} addedLines  Optional map: line-index → true for diff highlights.
   * @returns {string} HTML string.
   */
  function buildHighlight(code, lang, addedLines) {
    var tokens = tokenize(code, lang);

    // Split tokens into logical lines (handle multi-line tokens like comments)
    var lines = [[]];
    for (var i = 0; i < tokens.length; i++) {
      var parts = tokens[i].value.split("\n");
      for (var j = 0; j < parts.length; j++) {
        if (j > 0) lines.push([]);
        if (parts[j].length > 0) {
          lines[lines.length - 1].push({
            type: tokens[i].type,
            text: parts[j],
          });
        }
      }
    }

    // Render each line into a div
    var html = "";
    for (var i = 0; i < lines.length; i++) {
      var cls = "sh-line";
      if (addedLines && addedLines[i]) cls += " diff-added";

      var lineHTML = "";
      for (var j = 0; j < lines[i].length; j++) {
        var t = lines[i][j];
        var escaped = escapeHTML(t.text);
        if (t.type === "plain") {
          lineHTML += escaped;
        } else {
          lineHTML +=
            '<span class="token-' + t.type + '">' + escaped + "</span>";
        }
      }
      // Empty lines need at least a space to maintain height
      html += '<div class="' + cls + '">' + (lineHTML || " ") + "</div>";
    }
    return html;
  }

  // ================================================================
  //  Diff Engine (for step-by-step mode)
  // ================================================================

  /**
   * Compute which lines in newCode are "added" relative to oldCode.
   * Returns a map: lineIndex → true for each added line in newCode.
   * Uses LCS (Longest Common Subsequence) for accurate results.
   */
  function computeDiff(oldCode, newCode) {
    if (!oldCode && !newCode) return null;
    var oldLines = oldCode ? oldCode.split("\n") : [];
    var newLines = newCode ? newCode.split("\n") : [];
    var m = oldLines.length,
      n = newLines.length;

    // Build LCS table
    var dp = [];
    for (var i = 0; i <= m; i++) {
      dp[i] = new Array(n + 1);
      for (var j = 0; j <= n; j++) {
        if (i === 0 || j === 0) dp[i][j] = 0;
        else if (oldLines[i - 1] === newLines[j - 1])
          dp[i][j] = dp[i - 1][j - 1] + 1;
        else dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }

    // Backtrack to identify added lines in newCode
    var addedLines = {};
    var i = m,
      j = n;
    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
        i--;
        j--;
      } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
        addedLines[j - 1] = true;
        j--;
      } else {
        i--;
      }
    }

    return addedLines;
  }

  // ================================================================
  //  Console Formatting (Enhanced)
  // ================================================================

  /** Format a single value for console display. */
  function formatValue(val) {
    if (val === null) return "null";
    if (val === undefined) return "undefined";
    if (typeof val === "string") return val;
    if (typeof val === "object") {
      try {
        return JSON.stringify(val, null, 2);
      } catch (e) {
        return String(val);
      }
    }
    return String(val);
  }

  /** Render console.table() data as a box-drawing ASCII table. */
  function formatTable(data) {
    if (!data || typeof data !== "object") return String(data);

    var isArr = Array.isArray(data);
    var rows = [],
      cols;

    if (isArr) {
      if (data.length === 0) return "(empty array)";
      cols = ["(index)"];
      if (typeof data[0] === "object" && data[0] !== null) {
        var keys = Object.keys(data[0]);
        for (var k = 0; k < keys.length; k++) cols.push(keys[k]);
      } else {
        cols.push("Value");
      }
      for (var i = 0; i < data.length; i++) {
        var row = [String(i)];
        if (typeof data[i] === "object" && data[i] !== null) {
          for (var c = 1; c < cols.length; c++) {
            var v = data[i][cols[c]];
            row.push(v !== undefined ? String(v) : "");
          }
        } else {
          row.push(String(data[i]));
        }
        rows.push(row);
      }
    } else {
      // Plain object → key / value table
      cols = ["(key)", "(value)"];
      var objKeys = Object.keys(data);
      for (var i = 0; i < objKeys.length; i++) {
        rows.push([objKeys[i], String(data[objKeys[i]])]);
      }
    }

    // Column widths
    var widths = [];
    for (var c = 0; c < cols.length; c++) {
      var w = cols[c].length;
      for (var r = 0; r < rows.length; r++) {
        if (rows[r][c] && rows[r][c].length > w) w = rows[r][c].length;
      }
      widths.push(w);
    }

    // Build box-drawing table
    var border = function (left, mid, right) {
      var parts = [];
      for (var c = 0; c < widths.length; c++)
        parts.push(repeatStr("\u2500", widths[c] + 2));
      return left + parts.join(mid) + right;
    };
    var fmtRow = function (cells) {
      var parts = [];
      for (var c = 0; c < cells.length; c++) {
        parts.push(" " + padRight(cells[c] || "", widths[c]) + " ");
      }
      return "\u2502" + parts.join("\u2502") + "\u2502";
    };

    var out = [
      border("\u250C", "\u252C", "\u2510"),
      fmtRow(cols),
      border("\u251C", "\u253C", "\u2524"),
    ];
    for (var i = 0; i < rows.length; i++) out.push(fmtRow(rows[i]));
    out.push(border("\u2514", "\u2534", "\u2518"));
    return out.join("\n");
  }

  /** Render the result of a sandboxed JS run into the console element. */
  function renderConsoleOutput(result, consoleEl) {
    consoleEl.innerHTML = "";
    var logs = result.logs || [];
    var returnVal = result.result;

    for (var i = 0; i < logs.length; i++) {
      var entry = logs[i];
      var indent = (entry.depth || 0) * 16;

      if (entry.type === "table") {
        var div = document.createElement("div");
        div.className = "log console-table";
        if (indent) div.style.paddingLeft = indent + "px";
        div.textContent = formatTable(entry.data);
        consoleEl.appendChild(div);
        continue;
      }

      if (entry.type === "group") {
        var div = document.createElement("div");
        div.className = "info console-group-label";
        if (indent) div.style.paddingLeft = indent + "px";
        div.textContent = "\u25B8 " + (entry.label || "group");
        consoleEl.appendChild(div);
        continue;
      }

      if (entry.type === "groupEnd") continue;

      var div = document.createElement("div");
      div.className = entry.type;
      if (indent) div.style.paddingLeft = indent + "px";
      div.textContent = entry.args.map(formatValue).join(" ");
      consoleEl.appendChild(div);
    }

    // Show return value of the last expression
    if (returnVal !== undefined) {
      var div = document.createElement("div");
      div.className = "console-return";
      div.textContent = formatValue(returnVal);
      consoleEl.appendChild(div);
    }

    if (logs.length === 0 && returnVal === undefined) {
      var div = document.createElement("div");
      div.className = "info";
      div.textContent = "(no output)";
      consoleEl.appendChild(div);
    }
  }

  // ================================================================
  //  Editor Creation (Mirror Approach)
  // ================================================================

  /**
   * Create a mirror-style editor: a transparent <textarea> on top of a
   * syntax-highlighted <div> backdrop. Both share identical typography
   * so the caret aligns with the coloured text behind it.
   *
   * @param {Element}  container  Parent element to append into.
   * @param {string}   code       Initial source code.
   * @param {string}   lang       Language for highlighting.
   * @param {Object}   diffLines  Optional diff-added-line map.
   * @param {Function} onRun      Callback when Ctrl/Cmd+Enter is pressed.
   * @returns {Object}  { wrap, textarea, sync, setLang, getValue, setValue, onRun }
   */
  function createEditor(container, code, lang, diffLines, onRun) {
    var currentLang = lang;
    var currentDiff = diffLines || null;
    var edited = false;

    // Wrapper
    var wrap = document.createElement("div");
    wrap.className = "playground-editor";

    // Highlighted backdrop
    var highlight = document.createElement("div");
    highlight.className = "playground-highlight";
    highlight.setAttribute("aria-hidden", "true");

    // Transparent textarea (captures input)
    var textarea = document.createElement("textarea");
    textarea.value = code;
    textarea.spellcheck = false;
    textarea.setAttribute("autocorrect", "off");
    textarea.setAttribute("autocapitalize", "off");
    textarea.setAttribute("autocomplete", "off");
    textarea.setAttribute("wrap", "off");

    wrap.appendChild(highlight);
    wrap.appendChild(textarea);
    container.appendChild(wrap);

    // --- Sync highlight with textarea content ---
    function sync() {
      var dl = edited ? null : currentDiff;
      highlight.innerHTML = buildHighlight(textarea.value, currentLang, dl);
      // Keep scroll positions in sync
      highlight.scrollTop = textarea.scrollTop;
      highlight.scrollLeft = textarea.scrollLeft;
    }

    textarea.addEventListener("input", function () {
      if (!edited && currentDiff) edited = true;
      sync();
    });

    textarea.addEventListener("scroll", function () {
      highlight.scrollTop = textarea.scrollTop;
      highlight.scrollLeft = textarea.scrollLeft;
    });

    // --- Keyboard handling ---
    textarea.addEventListener("keydown", function (e) {
      // Ctrl/Cmd + Enter → run
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        if (api.onRun) api.onRun();
        e.stopPropagation();
        return;
      }

      // Tab / Shift+Tab → indent / dedent
      if (e.key === "Tab") {
        e.preventDefault();
        var val = this.value;
        var start = this.selectionStart;
        var end = this.selectionEnd;

        if (start === end && !e.shiftKey) {
          // Single cursor — insert two spaces
          this.value = val.slice(0, start) + "  " + val.slice(end);
          this.selectionStart = this.selectionEnd = start + 2;
        } else {
          // Multi-line indent / dedent
          var lineStart = val.lastIndexOf("\n", start - 1) + 1;
          var lineEnd = val.indexOf("\n", end);
          if (lineEnd === -1) lineEnd = val.length;

          var block = val.slice(lineStart, lineEnd);
          var lines = block.split("\n");

          if (e.shiftKey) {
            for (var li = 0; li < lines.length; li++) {
              if (lines[li].indexOf("  ") === 0) lines[li] = lines[li].slice(2);
              else if (lines[li].charAt(0) === "\t")
                lines[li] = lines[li].slice(1);
            }
          } else {
            for (var li = 0; li < lines.length; li++)
              lines[li] = "  " + lines[li];
          }

          var newBlock = lines.join("\n");
          this.value = val.slice(0, lineStart) + newBlock + val.slice(lineEnd);
          this.selectionStart = lineStart;
          this.selectionEnd = lineStart + newBlock.length;
        }
        sync();
      }

      // Stop keyboard events from reaching Anna.js
      e.stopPropagation();
    });

    // Prevent Anna.js navigation from editor clicks/focus
    textarea.addEventListener("click", function (e) {
      e.stopPropagation();
    });
    textarea.addEventListener("focus", function (e) {
      e.stopPropagation();
    });

    // Initial render
    sync();

    // Public API
    var api = {
      wrap: wrap,
      textarea: textarea,
      sync: sync,
      onRun: onRun || null,
      setLang: function (l) {
        currentLang = l;
      },
      getValue: function () {
        return textarea.value;
      },
      setValue: function (val) {
        textarea.value = val;
        textarea.scrollTop = 0;
        textarea.scrollLeft = 0;
        sync();
      },
    };
    return api;
  }

  // ================================================================
  //  Multi-file Content Extraction
  // ================================================================

  /**
   * Extract JS / HTML / CSS content from a multi-file playground element.
   * Supports two source formats:
   *   1. <script type="text/playground-{lang}"> child elements
   *   2. data-js / data-html / data-css attributes
   */
  function extractMultiContent(el) {
    var content = { js: "", html: "", css: "" };

    // Try <script> elements first (preserves newlines & special chars)
    var scripts = el.querySelectorAll('script[type^="text/playground-"]');
    if (scripts.length > 0) {
      for (var i = 0; i < scripts.length; i++) {
        var lang = scripts[i]
          .getAttribute("type")
          .replace("text/playground-", "");
        if (content.hasOwnProperty(lang)) {
          content[lang] = scripts[i].textContent.trim();
        }
      }
      return content;
    }

    // Fall back to data attributes (decode escaped newlines)
    content.js = (el.getAttribute("data-js") || "")
      .replace(/\\n/g, "\n")
      .trim();
    content.html = (el.getAttribute("data-html") || "")
      .replace(/\\n/g, "\n")
      .trim();
    content.css = (el.getAttribute("data-css") || "")
      .replace(/\\n/g, "\n")
      .trim();
    return content;
  }

  // ================================================================
  //  Runners
  // ================================================================

  /** Build the console-override preamble injected into sandboxed JS. */
  function buildConsoleSandbox() {
    return (
      "var __logs = [], __groupDepth = 0;\n" +
      "var console = {\n" +
      '  log: function() { __logs.push({ type: "log", args: [].slice.call(arguments), depth: __groupDepth }); },\n' +
      '  error: function() { __logs.push({ type: "error", args: [].slice.call(arguments), depth: __groupDepth }); },\n' +
      '  warn: function() { __logs.push({ type: "warn", args: [].slice.call(arguments), depth: __groupDepth }); },\n' +
      '  info: function() { __logs.push({ type: "info", args: [].slice.call(arguments), depth: __groupDepth }); },\n' +
      '  table: function(d) { __logs.push({ type: "table", data: d, depth: __groupDepth }); },\n' +
      "  clear: function() { __logs.length = 0; },\n" +
      '  group: function(l) { __logs.push({ type: "group", label: l || "", depth: __groupDepth }); __groupDepth++; },\n' +
      "  groupEnd: function() { if (__groupDepth > 0) __groupDepth--; }\n" +
      "};\n"
    );
  }

  /** Run JavaScript in a sandboxed Function with enhanced console capture. */
  function runJS(consoleEl, code) {
    var sandbox = buildConsoleSandbox();
    var result;

    // Primary path: use eval() to capture the return value of the last expression
    try {
      var evalCode =
        sandbox +
        "var __result;\n" +
        "try { __result = eval(" +
        JSON.stringify(code) +
        "); }\n" +
        'catch(__e) { __logs.push({ type: "error", args: [__e.toString()], depth: __groupDepth }); }\n' +
        "return { logs: __logs, result: __result };";
      result = new Function(evalCode)();
    } catch (e) {
      // Fallback: direct execution (handles top-level 'return', etc.)
      try {
        var directCode =
          sandbox +
          "try {\n" +
          code +
          "\n}\n" +
          'catch(__e) { __logs.push({ type: "error", args: [__e.toString()], depth: __groupDepth }); }\n' +
          "return { logs: __logs, result: void 0 };";
        result = new Function(directCode)();
      } catch (e2) {
        result = {
          logs: [{ type: "error", args: [e2.toString()], depth: 0 }],
          result: undefined,
        };
      }
    }

    renderConsoleOutput(result, consoleEl);
  }

  /** Run HTML in an iframe. */
  function runHTML(iframe, code) {
    var doc = iframe.contentDocument || iframe.contentWindow.document;
    doc.open();
    doc.write(
      '<!doctype html><html><head><meta charset="utf-8">' +
        "<style>body{font-family:system-ui,sans-serif;margin:16px;}</style>" +
        "</head><body>" +
        code +
        "</body></html>",
    );
    doc.close();
  }

  /** Run CSS in an iframe with sample HTML. */
  function runCSS(iframe, code) {
    var doc = iframe.contentDocument || iframe.contentWindow.document;
    doc.open();
    doc.write(
      '<!doctype html><html><head><meta charset="utf-8">' +
        "<style>" +
        code +
        "</style></head><body>" +
        "<h1>Heading</h1>" +
        '<p>Paragraph with <a href="#">a link</a> and <strong>bold text</strong>.</p>' +
        "<ul><li>Item one</li><li>Item two</li><li>Item three</li></ul>" +
        "<button>Button</button>" +
        "</body></html>",
    );
    doc.close();
  }

  /** Run a multi-file playground (JS + HTML + CSS) in an iframe. */
  function runMulti(iframe, js, html, css) {
    var doc = iframe.contentDocument || iframe.contentWindow.document;
    // Escape </script> inside user JS so the HTML parser doesn't close prematurely
    var safeJS = js.replace(/<\/script/gi, "<\\/script");
    doc.open();
    doc.write(
      '<!doctype html><html><head><meta charset="utf-8">' +
        "<style>body{font-family:system-ui,sans-serif;margin:16px;}" +
        css +
        "</style>" +
        "</head><body>" +
        html +
        "<script>" +
        safeJS +
        "<\/script>" +
        "</body></html>",
    );
    doc.close();
  }

  // ================================================================
  //  Playground Setup
  // ================================================================

  function init() {
    var elements = document.querySelectorAll(".playground");
    var playgrounds = [];
    var stepGroups = {};

    // ── First pass: extract content before any DOM mutations ──
    for (var i = 0; i < elements.length; i++) {
      var el = elements[i];
      var lang = (el.getAttribute("data-lang") || "javascript").toLowerCase();
      var code, multiContent;

      if (lang === "multi") {
        multiContent = extractMultiContent(el);
        code = "";
      } else {
        code = el.textContent.trim();
        multiContent = null;
      }

      playgrounds.push({
        el: el,
        lang: lang,
        code: code,
        multiContent: multiContent,
      });

      // Build step map for diff mode
      var step = el.getAttribute("data-step");
      if (step) {
        var group = el.getAttribute("data-step-group") || "_default";
        if (!stepGroups[group]) stepGroups[group] = {};
        stepGroups[group][step] = code;
      }
    }

    // ── Second pass: build each playground ──
    for (var i = 0; i < playgrounds.length; i++) {
      var pg = playgrounds[i];
      var diffLines = null;

      // Compute diff for step > 1
      var step = pg.el.getAttribute("data-step");
      if (step && parseInt(step, 10) > 1) {
        var group = pg.el.getAttribute("data-step-group") || "_default";
        var prevStep = String(parseInt(step, 10) - 1);
        if (stepGroups[group] && stepGroups[group][prevStep] !== undefined) {
          diffLines = computeDiff(stepGroups[group][prevStep], pg.code);
        }
      }

      setupPlayground(pg.el, pg.lang, pg.code, pg.multiContent, diffLines);
    }
  }

  /** Dispatch to single-file or multi-file setup. */
  function setupPlayground(el, lang, code, multiContent, diffLines) {
    var autorun = el.getAttribute("data-autorun") !== "false";

    el.textContent = "";
    el.classList.add("playground-widget");
    el.setAttribute("data-lang", lang);

    if (lang === "multi") {
      setupMultiPlayground(el, multiContent, autorun);
    } else {
      setupSinglePlayground(el, lang, code, autorun, diffLines);
    }
  }

  // ================================================================
  //  Single-file Playground
  // ================================================================

  function setupSinglePlayground(el, lang, code, autorun, diffLines) {
    // ── Header ──
    var header = document.createElement("div");
    header.className = "playground-header";
    header.innerHTML =
      '<span class="playground-dot playground-dot-red"></span>' +
      '<span class="playground-dot playground-dot-yellow"></span>' +
      '<span class="playground-dot playground-dot-green"></span>';

    var tabs = document.createElement("div");
    tabs.className = "playground-tabs";
    var tab = document.createElement("button");
    tab.className = "playground-tab active";
    tab.textContent =
      lang === "html" ? "HTML" : lang === "css" ? "CSS" : "JavaScript";
    tabs.appendChild(tab);
    header.appendChild(tabs);

    var runBtn = document.createElement("button");
    runBtn.className = "playground-run";
    runBtn.textContent = "\u25B6 Run";
    header.appendChild(runBtn);

    el.appendChild(header);

    // ── Editor (mirror approach) ──
    var run; // forward-declared so the editor callback can reference it
    var editor = createEditor(el, code, lang, diffLines, function () {
      run();
    });

    // ── Output ──
    var outputWrap = document.createElement("div");
    outputWrap.className = "playground-output";

    var outputLabel = document.createElement("span");
    outputLabel.className = "playground-output-label";
    outputLabel.textContent = "Output";
    outputWrap.appendChild(outputLabel);

    var outputEl;
    if (lang === "html" || lang === "css") {
      outputEl = document.createElement("iframe");
      outputEl.className = "playground-iframe";
      outputEl.setAttribute("sandbox", "allow-scripts");
    } else {
      outputEl = document.createElement("pre");
      outputEl.className = "playground-console";
    }
    outputWrap.appendChild(outputEl);
    el.appendChild(outputWrap);

    // ── Status bar ──
    var status = document.createElement("div");
    status.className = "playground-status";
    var shortcutKey = IS_MAC ? "\u2318" : "Ctrl";
    status.innerHTML =
      "<span>" +
      shortcutKey +
      "+Enter to run</span>" +
      '<span class="playground-time"></span>';
    el.appendChild(status);
    var timeEl = status.querySelector(".playground-time");

    // ── Run logic ──
    run = function () {
      var src = editor.getValue();
      var start = performance.now();

      if (lang === "html") runHTML(outputEl, src);
      else if (lang === "css") runCSS(outputEl, src);
      else runJS(outputEl, src);

      timeEl.textContent = (performance.now() - start).toFixed(1) + " ms";
    };

    runBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      run();
    });

    if (autorun) setTimeout(run, 100);
  }

  // ================================================================
  //  Multi-file Playground
  // ================================================================

  function setupMultiPlayground(el, content, autorun) {
    var LANGS = ["javascript", "html", "css"];
    var LABELS = { javascript: "JS", html: "HTML", css: "CSS" };
    var codes = {
      javascript: content.js,
      html: content.html,
      css: content.css,
    };
    var activeLang = "javascript";

    // ── Header ──
    var header = document.createElement("div");
    header.className = "playground-header";
    header.innerHTML =
      '<span class="playground-dot playground-dot-red"></span>' +
      '<span class="playground-dot playground-dot-yellow"></span>' +
      '<span class="playground-dot playground-dot-green"></span>';

    var tabsWrap = document.createElement("div");
    tabsWrap.className = "playground-tabs";
    var tabButtons = {};

    for (var t = 0; t < LANGS.length; t++) {
      (function (lang) {
        var btn = document.createElement("button");
        btn.className =
          "playground-tab" + (lang === activeLang ? " active" : "");
        btn.textContent = LABELS[lang];
        tabsWrap.appendChild(btn);
        tabButtons[lang] = btn;

        btn.addEventListener("click", function (e) {
          e.stopPropagation();
          if (lang === activeLang) return;

          // Save current editor contents
          codes[activeLang] = editor.getValue();

          // Switch
          activeLang = lang;
          editor.setLang(lang);
          editor.setValue(codes[lang]);

          // Update tab active states
          for (var l in tabButtons) {
            if (tabButtons.hasOwnProperty(l)) {
              if (l === lang) tabButtons[l].classList.add("active");
              else tabButtons[l].classList.remove("active");
            }
          }
        });
      })(LANGS[t]);
    }

    header.appendChild(tabsWrap);

    var runBtn = document.createElement("button");
    runBtn.className = "playground-run";
    runBtn.textContent = "\u25B6 Run";
    header.appendChild(runBtn);

    el.appendChild(header);

    // ── Editor (single mirror, contents swapped on tab switch) ──
    var run;
    var editor = createEditor(
      el,
      codes[activeLang],
      activeLang,
      null,
      function () {
        run();
      },
    );

    // ── Output (always iframe for multi-file) ──
    var outputWrap = document.createElement("div");
    outputWrap.className = "playground-output";

    var outputLabel = document.createElement("span");
    outputLabel.className = "playground-output-label";
    outputLabel.textContent = "Output";
    outputWrap.appendChild(outputLabel);

    var iframe = document.createElement("iframe");
    iframe.className = "playground-iframe";
    iframe.setAttribute("sandbox", "allow-scripts");
    outputWrap.appendChild(iframe);
    el.appendChild(outputWrap);

    // ── Status bar ──
    var status = document.createElement("div");
    status.className = "playground-status";
    var shortcutKey = IS_MAC ? "\u2318" : "Ctrl";
    status.innerHTML =
      "<span>" +
      shortcutKey +
      "+Enter to run</span>" +
      '<span class="playground-time"></span>';
    el.appendChild(status);
    var timeEl = status.querySelector(".playground-time");

    // ── Run logic (combines all three tabs) ──
    run = function () {
      // Always save the currently-visible tab first
      codes[activeLang] = editor.getValue();
      var start = performance.now();
      runMulti(iframe, codes.javascript, codes.html, codes.css);
      timeEl.textContent = (performance.now() - start).toFixed(1) + " ms";
    };

    runBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      run();
    });

    if (autorun) setTimeout(run, 100);
  }

  // ================================================================
  //  Anna.js Integration
  // ================================================================

  if (typeof Anna !== "undefined") {
    Anna.addEventListener("ready", function () {
      init();
    });
  } else {
    document.addEventListener("DOMContentLoaded", function () {
      if (typeof Anna !== "undefined") {
        Anna.addEventListener("ready", init);
      } else {
        init();
      }
    });
  }
})();
