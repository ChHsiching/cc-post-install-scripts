#!/usr/bin/env node
"use strict";

const { execFileSync, execFile } = require("child_process");
const { promisify } = require("util");
const fs = require("fs");
const path = require("path");
const os = require("os");

const execFileAsync = promisify(execFile);

const CONFIG_PATH = path.join(__dirname, "config.json");
const DRY_RUN = process.argv.includes("--dry-run");
const IS_WIN = process.platform === "win32";
const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

// --- Spinner & Timer ---

let spinnerInterval = null;
let spinnerFrame = 0;

function startSpinner(label) {
  spinnerFrame = 0;
  const startTime = Date.now();

  spinnerInterval = setInterval(() => {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
    const frame = SPINNER_FRAMES[spinnerFrame % SPINNER_FRAMES.length];
    spinnerFrame++;
    process.stdout.write(`\r  \x1b[36m${frame}\x1b[0m ${label} \x1b[2m${elapsed}s\x1b[0m`);
  }, 80);

  return startTime;
}

function stopSpinner(startTime) {
  if (spinnerInterval) {
    clearInterval(spinnerInterval);
    spinnerInterval = null;
  }
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  process.stdout.write("\r\x1b[2K");
  return elapsed;
}

// --- Logging ---

function logStep(msg) {
  console.log(`\n\x1b[1m>> ${msg}\x1b[0m`);
}

function logOk(msg) {
  console.log(`  \x1b[32m✔\x1b[0m ${msg}`);
}

function logWarn(msg) {
  console.log(`  \x1b[33m✘\x1b[0m ${msg}`);
}

function logErr(msg) {
  console.log(`  \x1b[31m✘\x1b[0m ${msg}`);
}

function logDry(msg) {
  console.log(`  \x1b[36m[DRY]\x1b[0m ${msg}`);
}

function logTime(elapsed) {
  console.log(`  \x1b[2m${elapsed}s\x1b[0m`);
}

function lastLine(text) {
  const lines = text.split("\n").filter(Boolean);
  return lines[lines.length - 1] || "";
}

// --- Execution (sync, for quick ops) ---

function run(file, args) {
  const opts = { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] };
  if (IS_WIN) opts.shell = true;
  try {
    return {
      ok: true,
      stdout: execFileSync(file, args, opts).trim(),
    };
  } catch (e) {
    return { ok: false, stderr: (e.stderr || "").trim(), stdout: (e.stdout || "").trim(), error: e.message };
  }
}

function dryRun(file, args) {
  logDry(`${file} ${args.map((a) => (a.includes(" ") ? `"${a}"` : a)).join(" ")}`);
  return { ok: true, stdout: "" };
}

function exec(file, args) {
  return DRY_RUN ? dryRun(file, args) : run(file, args);
}

// --- Execution (async, for slow ops with spinner) ---

async function runAsync(file, args) {
  const opts = { encoding: "utf-8" };
  if (IS_WIN) opts.shell = true;
  try {
    const { stdout } = await execFileAsync(file, args, opts);
    return { ok: true, stdout: stdout.trim() };
  } catch (e) {
    return { ok: false, stderr: (e.stderr || "").trim(), stdout: (e.stdout || "").trim(), error: e.message };
  }
}

async function runWithSpinner(label, file, args) {
  const startTime = startSpinner(label);
  const result = await runAsync(file, args);
  const elapsed = stopSpinner(startTime);
  return { result, elapsed };
}

// --- Steps (sync, quick) ---

function checkPrerequisites() {
  logStep("Checking prerequisites");
  const t = Date.now();

  if (DRY_RUN) {
    logDry("Would check: claude --version");
    logDry("Would check: node --version");
    logDry("Would check: ~/.claude/settings.json exists");
    return;
  }

  const claudeResult = run("claude", ["--version"]);
  if (!claudeResult.ok) {
    logErr("claude CLI not found. Please install Claude Code first.");
    process.exit(1);
  }
  logOk(`claude CLI: ${claudeResult.stdout.split("\n")[0]}`);

  const nodeResult = run("node", ["--version"]);
  if (!nodeResult.ok) {
    logErr("node not found. Please install Node.js first.");
    process.exit(1);
  }
  logOk(`node: ${nodeResult.stdout}`);

  const settingsPath = path.join(os.homedir(), ".claude", "settings.json");
  if (fs.existsSync(settingsPath)) {
    logOk("settings.json exists");
  } else {
    logErr("settings.json not found. Please run cc-switch first.");
    process.exit(1);
  }

  logTime(((Date.now() - t) / 1000).toFixed(1));
}

async function addMarketplaces(config) {
  const entries = Object.entries(config.marketplaces);
  logStep(`Adding marketplaces (${entries.length})`);
  if (DRY_RUN) {
    for (const [, repo] of entries) dryRun("claude", ["plugin", "marketplace", "add", repo]);
    return;
  }

  const t = Date.now();

  for (const [name, repo] of entries) {
    const { result } = await runWithSpinner(`adding ${name}...`, "claude", ["plugin", "marketplace", "add", repo]);

    if (result.ok) {
      logOk(`${name}: added (${repo})`);
    } else {
      const combined = result.stderr + result.stdout;
      if (combined.includes("already")) {
        logOk(`${name}: already exists`);
      } else {
        logErr(`${name}: ${lastLine(combined)}`);
      }
    }
  }

  logTime(((Date.now() - t) / 1000).toFixed(1));
}

// --- Steps (async, slow, with spinner) ---

async function updateMarketplaces() {
  logStep("Updating marketplace caches");

  if (DRY_RUN) {
    dryRun("claude", ["plugin", "marketplace", "update"]);
    return;
  }

  const { elapsed } = await runWithSpinner("updating...", "claude", ["plugin", "marketplace", "update"]);
  logOk("All marketplaces updated");
  logTime(elapsed);
}

async function tryInstallAsync(plugin) {
  if (DRY_RUN) {
    dryRun("claude", ["plugin", "install", plugin]);
    return { ok: true, already: false };
  }

  const result = await runAsync("claude", ["plugin", "install", plugin]);
  if (result.ok) {
    return { ok: true, already: false };
  }
  const combined = result.stderr + result.stdout;
  if (combined.includes("already installed")) {
    return { ok: true, already: true };
  }
  return { ok: false, reason: lastLine(combined) };
}

async function installPlugins(config) {
  const plugins = config.plugins;
  logStep(`Installing plugins (${plugins.length})`);
  if (DRY_RUN) {
    for (const plugin of plugins) dryRun("claude", ["plugin", "install", plugin]);
    return { succeeded: plugins, failed: [] };
  }

  const t = Date.now();
  const succeeded = [];
  const failed = [];

  let startTime = startSpinner(`0/${plugins.length}`);

  for (let i = 0; i < plugins.length; i++) {
    const plugin = plugins[i];

    // Update spinner label with progress
    if (spinnerInterval) clearInterval(spinnerInterval);
    spinnerInterval = setInterval(() => {
      const elapsed = ((Date.now() - t) / 1000).toFixed(0);
      const frame = SPINNER_FRAMES[spinnerFrame++ % SPINNER_FRAMES.length];
      process.stdout.write(`\r  \x1b[36m${frame}\x1b[0m ${i + 1}/${plugins.length} ${plugin} \x1b[2m${elapsed}s\x1b[0m`);
    }, 80);

    const first = await tryInstallAsync(plugin);
    stopSpinner(startTime);

    if (first.ok) {
      logOk(`${plugin}${first.already ? ": already installed" : ""}`);
      succeeded.push(plugin);
    } else {
      logWarn(`${plugin}: 1st attempt failed, retrying...`);
      startTime = startSpinner(`${i + 1}/${plugins.length}`);
      const retry = await tryInstallAsync(plugin);
      stopSpinner(startTime);

      if (retry.ok) {
        logOk(`${plugin}: installed on retry`);
        succeeded.push(plugin);
      } else {
        const reason = retry.reason || "unknown error";
        logErr(`${plugin}: ${reason}`);
        failed.push({ plugin, reason });
      }
    }

    if (i < plugins.length - 1) startTime = startSpinner(`${i + 1}/${plugins.length}`);
  }

  logTime(((Date.now() - t) / 1000).toFixed(1));
  return { succeeded, failed };
}

async function deployEccRules(config) {
  logStep("Deploying ECC rules");

  const { pluginRef, rulesProfile: profile } = config.ecc;
  const [pluginName, marketplaceName] = pluginRef.split("@");

  if (DRY_RUN) {
    logDry(`Would locate: ~/.claude/plugins/cache/${marketplaceName}/${pluginName}/<version>/scripts/install-apply.js`);
    logDry(`Would execute: node install-apply.js ${profile}`);
    return true;
  }

  const t = Date.now();
  const cacheBase = path.join(os.homedir(), ".claude", "plugins", "cache", marketplaceName, pluginName);
  if (!fs.existsSync(cacheBase)) {
    logErr(`ECC cache directory not found: ${cacheBase}`);
    logErr("Make sure the ecc plugin is installed before deploying rules.");
    logTime(((Date.now() - t) / 1000).toFixed(1));
    return false;
  }

  const versions = fs.readdirSync(cacheBase).filter((v) => {
    const p = path.join(cacheBase, v);
    return fs.statSync(p).isDirectory();
  }).sort((a, b) => {
    const pa = a.split(".").map(Number);
    const pb = b.split(".").map(Number);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
      const na = pa[i] || 0;
      const nb = pb[i] || 0;
      if (na !== nb) return na - nb;
    }
    return 0;
  });

  if (versions.length === 0) {
    logErr("No ECC versions found in cache");
    logTime(((Date.now() - t) / 1000).toFixed(1));
    return false;
  }

  const latestDir = path.join(cacheBase, versions[versions.length - 1]);
  const installScript = path.join(latestDir, "scripts", "install-apply.js");

  if (!fs.existsSync(installScript)) {
    logErr(`ECC install script not found: ${installScript}`);
    logTime(((Date.now() - t) / 1000).toFixed(1));
    return false;
  }

  const { result, elapsed } = await runWithSpinner("deploying rules...", "node", [installScript, profile]);

  if (result.ok) {
    logOk(`ECC rules deployed (${profile} profile)`);
    logTime(elapsed);
    return true;
  }
  logErr(`ECC rules deployment failed: ${lastLine(result.stderr || result.stdout)}`);
  logTime(elapsed);
  return false;
}

function mergeSettings(config) {
  logStep("Merging settings into ~/.claude/settings.json");
  const t = Date.now();

  const settingsPath = path.join(os.homedir(), ".claude", "settings.json");
  let existing = {};

  if (!DRY_RUN) {
    try {
      existing = JSON.parse(fs.readFileSync(settingsPath, "utf-8"));
    } catch {
      logWarn("Could not parse existing settings.json, starting fresh");
    }
  }

  const merged = { ...existing };
  const additions = [];

  for (const [key, value] of Object.entries(config.settings)) {
    if (key === "env") {
      merged.env = merged.env || {};
      for (const [envKey, envValue] of Object.entries(value)) {
        if (merged.env[envKey] !== envValue) {
          additions.push(`env.${envKey} = ${JSON.stringify(envValue)}`);
          merged.env[envKey] = envValue;
        }
      }
    } else if (!(key in merged)) {
      additions.push(`${key} = ${JSON.stringify(value)}`);
      merged[key] = value;
    } else {
      if (!DRY_RUN) logOk(`${key}: already set, skipping`);
    }
  }

  if (DRY_RUN) {
    if (additions.length === 0) {
      logDry("No changes needed for settings.json");
    } else {
      logDry("Would write to settings.json:");
      for (const a of additions) {
        logDry(`  + ${a}`);
      }
    }
    return;
  }

  if (additions.length > 0) {
    for (const a of additions) {
      logOk(`+ ${a}`);
    }
  }

  fs.writeFileSync(settingsPath, JSON.stringify(merged, null, 2) + "\n");
  logOk("settings.json updated");
  logTime(((Date.now() - t) / 1000).toFixed(1));
}

function printReport(pluginResults, totalTime) {
  console.log("\n" + "=".repeat(50));
  console.log(`\x1b[1m ${DRY_RUN ? "Dry-Run" : "Installation"} Report \x1b[0m`);
  console.log("=".repeat(50));
  console.log(`  Plugins to install: ${pluginResults.succeeded.length + pluginResults.failed.length}`);
  console.log(`  Plugins succeeded:  \x1b[32m${pluginResults.succeeded.length}\x1b[0m`);
  console.log(`  Plugins failed:     \x1b[31m${pluginResults.failed.length}\x1b[0m`);

  if (pluginResults.failed.length > 0) {
    console.log("\n  \x1b[31mFailed plugins:\x1b[0m");
    for (const { plugin, reason } of pluginResults.failed) {
      console.log(`    • ${plugin}`);
      console.log(`      Reason: ${reason}`);
    }
  }

  console.log("=".repeat(50));
  console.log(`  Total: ${totalTime}s`);

  if (DRY_RUN) {
    console.log("\n\x1b[36mDry run complete. No changes were made.\x1b[0m\n");
  } else if (pluginResults.failed.length > 0) {
    console.log("\n\x1b[31mSome plugins failed. Re-run the script to retry.\x1b[0m\n");
  } else {
    console.log("\n\x1b[32mAll done!\x1b[0m\n");
  }
}

// --- Main ---

async function main() {
  const totalStart = Date.now();
  console.log(`\x1b[1mClaude Code Post-Install Script\x1b[0m${DRY_RUN ? " \x1b[36m(dry-run)\x1b[0m" : ""}`);
  console.log("-".repeat(35));

  let config;
  try {
    config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
  } catch (e) {
    logErr(`Failed to read config.json: ${e.message}`);
    process.exit(1);
  }

  checkPrerequisites();
  addMarketplaces(config);
  await updateMarketplaces();
  const pluginResults = installPlugins(config);
  await deployEccRules(config);
  mergeSettings(config);

  const totalTime = ((Date.now() - totalStart) / 1000).toFixed(1);
  printReport(pluginResults, totalTime);
}

main();
