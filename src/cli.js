#!/usr/bin/env node
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, basename, extname, resolve } from 'node:path';
import process from 'node:process';
import { loadInput } from './input.js';
import { renderSvg } from './svg.js';
import { renderPng } from './png.js';

/**
 * @typedef {Object} CliOptions
 * @property {string} input 入力YAMLファイルの絶対パス
 * @property {string} prefix 出力ファイルの拡張子を除いた絶対パス
 */

/** @param {string} message @returns {never} */
function fail(message) {
  throw new Error(message);
}

/**
 * CLI引数を解析する。ヘルプ表示時はnullを返す。
 * @param {string[]} args
 * @returns {CliOptions | null}
 */
function parseArguments(args) {
  const usage = [
    'Usage:',
    '  matrix-renderer render <input.yaml> [--out <output-prefix>]',
    '',
    'Options:',
    '  --out <prefix>  Output path without an extension (writes .svg and .png)',
    '  -h, --help      Show this help',
  ].join('\n');
  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    process.stdout.write(`${usage}\n`);
    return null;
  }

  let commandArgs = args;
  if (args[0] === 'render') {
    commandArgs = args.slice(1);
  } else if (args[0] !== '--' && args[0].startsWith('-')) {
    fail(`不明なオプションです: ${args[0]}\n${usage}`);
  } else if (!args[0].endsWith('.yaml') && !args[0].endsWith('.yml')) {
    fail(`不明なコマンドです: ${args[0]}\n${usage}`);
  }

  const positional = [];
  let output;
  for (let index = 0; index < commandArgs.length; index += 1) {
    if (commandArgs[index] === '--') continue;
    if (commandArgs[index] === '--help' || commandArgs[index] === '-h') {
      process.stdout.write(`${usage}\n`);
      return null;
    }
    if (commandArgs[index] === '--out') {
      output = commandArgs[index + 1];
      if (!output) fail('--outの後に出力先を指定してください。');
      index += 1;
    } else if (commandArgs[index].startsWith('-')) {
      fail(`不明なオプションです: ${commandArgs[index]}\n${usage}`);
    } else {
      positional.push(commandArgs[index]);
    }
  }
  if (positional.length !== 1) fail(`入力YAMLを1件指定してください。\n${usage}`);
  const input = resolve(positional[0]);
  const prefix = resolve(output ?? `${dirname(input)}/${basename(input, extname(input))}`);
  return { input, prefix };
}

try {
  const options = parseArguments(process.argv.slice(2));
  if (options) {
    const { input, prefix } = options;
    const data = await loadInput(input);
    const { svg, width, height } = renderSvg(data);
    const png = await renderPng(svg);
    const svgPath = `${prefix}.svg`;
    const pngPath = `${prefix}.png`;
    await mkdir(dirname(prefix), { recursive: true });
    await Promise.all([
      writeFile(svgPath, svg, 'utf8'),
      writeFile(pngPath, png),
    ]);
    process.stdout.write(`Generated ${svgPath} and ${pngPath} (${width}x${height})\n`);
  }
} catch (error) {
  process.stderr.write(`Error: ${error.message}\n`);
  process.exitCode = 1;
}
