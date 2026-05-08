#!/usr/bin/env node

/**
 * Anna.js CLI
 *
 * Commands:
 *   anna init [name]              Create a new presentation project
 *   anna generate <file.md>       Generate HTML from Markdown
 *   anna serve <file.md>          Dev server with live reload
 *   anna live <file.md>           Live server with audience interaction
 *   anna export <file.md> [--pdf] Export presentation to PDF
 *   anna ai <outline.txt|"topic"> Generate slides with AI
 *   anna ai refine <file.md>      Improve an existing presentation
 *   anna ai translate <file.md>   Translate a presentation
 */

const command = process.argv[2];
const args = process.argv.slice(3);

switch (command) {
  case "init":
    require("./init").run(args);
    break;

  case "generate":
    require("./generate").run(args);
    break;

  case "serve":
    require("./serve").run(args);
    break;

  case "live":
    require("./live").run(args);
    break;

  case "export":
    require("./export").run(args);
    break;

  case "ai":
    require("./ai").run(args);
    break;

  case "--help":
  case "-h":
  case undefined:
    showHelp();
    break;

  case "--version":
  case "-v":
    console.log(require("../package.json").version);
    break;

  default:
    // Assume a .md file means generate
    if (command.endsWith(".md")) {
      require("./generate").run([command, ...args]);
    } else {
      console.error(`  Unknown command: ${command}\n`);
      showHelp();
      process.exit(1);
    }
}

function showHelp() {
  console.log(`
  Anna.js — The HTML Presentation Framework

  Usage:
    anna init [name]                Create a new presentation project
    anna generate <file.md> [opts]  Generate HTML from Markdown
    anna serve <file.md> [opts]     Dev server with live reload
    anna live <file.md> [opts]      Live server with polls, Q&A, reactions
    anna export <file.md> [--pdf]   Export presentation to PDF
    anna ai <outline|"topic">       Generate slides with AI (Claude)
    anna ai refine <file.md>        Improve an existing presentation
    anna ai translate <file.md>     Translate a presentation
    anna <file.md>                  Shorthand for generate

  Generate options:
    --watch, -w      Watch for changes and regenerate
    --offline        Bundle mermaid.js for offline use
    --pwa            Generate PWA files for installable presentations

  Serve options:
    --port, -p       Port number (default: 3000)
    --open, -o       Auto-open browser

  Live options:
    --port, -p       Port number (default: 4000)
    --open, -o       Auto-open browser

  General:
    -h, --help       Show this help
    -v, --version    Show version

  Run anna <command> --help for command-specific help.
	`);
}
