#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import { basename, dirname, extname, resolve } from "node:path";
import process from "node:process";
import { throwErr } from "./errors/error.js";
import { loadInput } from "./input.js";
import { renderPng } from "./png.js";
import { renderSvg } from "./svg.js";

/**
 * @typedef {Object} CliOptions
 * @property {string} input 入力YAMLファイルの絶対パス
 * @property {string} prefix 出力ファイルの拡張子を除いた絶対パス
 */

/**
 * CLI引数を解析する。ヘルプ表示時はnullを返す。
 *
 * @param {string[]} args
 * @returns {CliOptions | null}
 */
function parseArguments(args) {
  const usage = [
    "Usage:",
    "  matrix-renderer render -- <input.yaml> [Options]",
    "",
    "Options:",
    "  --out <prefix>  Output path without an extension",
    "  --out-type <type> Output file type (png, svg) [generates both if omitted]",
    "  -h, --help      Show this help",
  ].join("\n");

  // ヘルプ表示（`--`なし）
  if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
    process.stdout.write(`${usage}\n`);
    return null;
  }

  // サポート外のオプション通知
  let commandArgs = args;
  if (args[0] === "render") {
    commandArgs = args.slice(1);
  } else if (args[0] !== "--" && args[0].startsWith("-")) {
    throwErr.biz("biz.unknownOption", { arg: args[0], usage });
  } else if (!args[0].endsWith(".yaml") && !args[0].endsWith(".yml")) {
    throwErr.biz("biz.unknownOption", { arg: args[0], usage });
  }

  const positional = [];
  let output;
  let outputType;
  for (let index = 0; index < commandArgs.length; index += 1) {
    if (commandArgs[index] === "--") continue;

    // ヘルプ表示
    if (commandArgs[index] === "--help" || commandArgs[index] === "-h") {
      process.stdout.write(`${usage}\n`);
      return null;
    }

    if (commandArgs[index] === "--out") {
      // outオプション
      output = commandArgs[index + 1];
      if (!output) throwErr.biz("biz.warnOutOption");
      index += 1;
    } else if (commandArgs[index] === "--out-type") {
      // out-typeオプション（出力タイプ）
      outputType = commandArgs[index + 1];
      if (!outputType) throwErr.biz("biz.warnOutTypeOption");
      if (!["svg", "png"].includes(outputType))
        throwErr.biz("biz.warnOutTypeOptionValues");
      index += 1;
    } else if (commandArgs[index].startsWith("-")) {
      throwErr.biz("biz.unknownOption", { arg: commandArgs[index], usage });
    } else {
      // 入力データファイル
      positional.push(commandArgs[index]);
    }
  }
  if (positional.length !== 1) throwErr.biz("warnInputOption", { usage });
  const input = resolve(positional[0]);
  const prefix = resolve(
    output ?? `${dirname(input)}/${basename(input, extname(input))}`,
  );
  return { input, prefix, outputType };
}

try {
  const options = parseArguments(process.argv.slice(3));
  if (options) {
    const { input, prefix, outputType } = options;
    await mkdir(dirname(prefix), { recursive: true });
    const outputSvg = !outputType || outputType === "svg";
    const outputPng = !outputType || outputType === "png";
    const pTotal = 1 + (outputSvg ? 2 : 0) + (outputPng ? 2 : 0);
    let pCurrent = 1;

    const data = await loadInput(input);
    process.stderr.write(`[${pCurrent}/${pTotal}] Input data loaded\n`);
    pCurrent++;

    const svgPath = `${prefix}.svg`;
    const { svg, width, height } = renderSvg(data);
    if (outputSvg) {
      process.stderr.write(`[${pCurrent}/${pTotal}] SVG rendered\n`);
      pCurrent++;
    }

    const pngPath = `${prefix}.png`;
    let png;
    if (outputPng) {
      png = await renderPng(svg);
      process.stderr.write(`[${pCurrent}/${pTotal}] PNG rendered\n`);
      pCurrent++;
    }

    if (outputSvg) {
      await Promise.all([writeFile(svgPath, svg, "utf8")]);
      process.stderr.write(`[${pCurrent}/${pTotal}] SVG file written\n`);
      process.stdout.write(`Generated ${svgPath} (${width}x${height})\n`);
      pCurrent++;
    }

    if (outputPng) {
      await Promise.all([writeFile(pngPath, png)]);
      process.stderr.write(`[${pCurrent}/${pTotal}] PNG file written\n`);
      process.stdout.write(`Generated ${pngPath} (${width}x${height})\n`);
    }
  }
} catch (error) {
  if (error.messageId) {
    process.stderr.write(`[${error.messageId}] ${error.message}\n`);
    process.stderr.write(`${error.stack?.split("\n").slice(1).join("\n")}\n`);
  } else {
    process.stderr.write(`${error.stack ?? error}\n`);
  }
  process.exitCode = 1;
}
