import { mkdir, writeFile } from "node:fs/promises";
import { basename, dirname, extname, resolve } from "node:path";
import process from "node:process";
import { BusinessError, throwErr } from "./errors/error.js";
import { loadInput } from "./input.js";
import { renderMessage, resolveLang } from "./messages/messageManager.js";
import { renderPng } from "./png.js";
import { renderSvg } from "./svg.js";

const OUTPUT_TYPES = ["svg", "png"];

/**
 * `--lang` の値から表示言語を決める。未指定や未対応の値は既定の言語とする。
 * エラーメッセージの言語を、引数の解析より前に決める必要があるため、解析とは別に行う。
 * @param {string[]} args
 * @returns {string}
 */
export function detectLang(args) {
  const index = args.lastIndexOf("--lang");
  return resolveLang(index === -1 ? undefined : args[index + 1]);
}

/** `--lang` とその値を取り除く。言語の指定を、他の引数の解釈から切り離すため。 */
function withoutLang(args) {
  const result = [];
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] !== "--lang") {
      result.push(args[index]);
    } else if (args[index + 1] && !args[index + 1].startsWith("-")) {
      index += 1;
    }
  }
  return result;
}

/**
 * @typedef {{ type: "help" }} HelpCommand
 * @typedef {Object} RenderCommand
 * @property {"render"} type
 * @property {string} input 入力YAMLファイルの絶対パス
 * @property {string} prefix 出力ファイルの拡張子を除いた絶対パス
 * @property {"svg" | "png" | undefined} outputType 出力形式。未指定の場合は両方出力する
 */

/**
 * オプションの値を取り出す。値が無い、または別のオプションの場合はエラーとする。
 * @param {string[]} args
 * @param {number} index オプション名の位置
 * @param {string} messageId 値が無い場合のメッセージID
 * @returns {string}
 */
function optionValue(args, index, messageId) {
  const value = args[index + 1];
  if (!value || value.startsWith("-")) throwErr.biz(messageId);
  return value;
}

/**
 * CLI引数を解析する。出力は行わない。
 * @param {string[]} args `process.argv.slice(2)` 相当
 * @returns {HelpCommand | RenderCommand}
 */
export function parseArguments(args) {
  const [command, ...rest] = withoutLang(args);
  const usage = renderMessage("cli.usage", {}, detectLang(args));

  if (command === undefined || command === "--help" || command === "-h")
    return { type: "help" };
  if (command !== "render")
    throwErr.biz("biz.unknownOption", { arg: command, usage });
  if (rest.length === 0) return { type: "help" };

  const positional = [];
  let output;
  let outputType;
  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];
    if (arg === "--") continue;
    if (arg === "--help" || arg === "-h") return { type: "help" };

    if (arg === "--out") {
      output = optionValue(rest, index, "biz.warnOutOption");
      index += 1;
    } else if (arg === "--out-type") {
      outputType = optionValue(rest, index, "biz.warnOutTypeOption");
      if (!OUTPUT_TYPES.includes(outputType))
        throwErr.biz("biz.warnOutTypeOptionValues");
      index += 1;
    } else if (arg.startsWith("-")) {
      throwErr.biz("biz.unknownOption", { arg, usage });
    } else {
      positional.push(arg);
    }
  }
  if (positional.length !== 1) throwErr.biz("biz.warnInputOption", { usage });

  const input = resolve(positional[0]);
  const prefix = resolve(
    output ?? `${dirname(input)}/${basename(input, extname(input))}`,
  );
  return { type: "render", input, prefix, outputType };
}

/**
 * 入力YAMLを読み込み、SVGおよびPNGをファイルへ出力する。
 * 出力先ディレクトリは、描画に成功してから作成する。
 * @param {RenderCommand} command
 * @param {Object} [reporter]
 * @param {(progress: { current: number, total: number, step: string }) => void} [reporter.onProgress] 進捗の通知。stepは `cli.step.*` のID
 * @param {(file: { path: string, width: number, height: number }) => void} [reporter.onGenerated] ファイル出力の通知
 */
export async function renderToFiles(
  { input, prefix, outputType },
  { onProgress = () => {}, onGenerated = () => {} } = {},
) {
  const outputSvg = !outputType || outputType === "svg";
  const outputPng = !outputType || outputType === "png";
  const steps = [
    "inputLoaded",
    ...(outputSvg ? ["svgRendered"] : []),
    ...(outputPng ? ["pngRendered"] : []),
    ...(outputSvg ? ["svgWritten"] : []),
    ...(outputPng ? ["pngWritten"] : []),
  ];
  let done = 0;
  const progress = () => {
    done += 1;
    onProgress({ current: done, total: steps.length, step: steps[done - 1] });
  };

  let data;
  try {
    data = await loadInput(input);
  } catch (error) {
    if (error.code === "ENOENT" || error.code === "EISDIR")
      throwErr.biz("biz.inputNotFound", { input });
    throw error;
  }
  progress();

  const { svg, width, height } = renderSvg(data);
  if (outputSvg) progress();
  const png = outputPng ? await renderPng(svg) : undefined;
  if (outputPng) progress();

  await mkdir(dirname(prefix), { recursive: true });
  if (outputSvg) {
    const path = `${prefix}.svg`;
    await writeFile(path, svg, "utf8");
    progress();
    onGenerated({ path, width, height });
  }
  if (outputPng) {
    const path = `${prefix}.png`;
    await writeFile(path, png);
    progress();
    onGenerated({ path, width, height });
  }
}

/**
 * エラーを標準エラー出力向けの文字列に整形する。
 * 業務エラーは利用者向けの1行のみ、それ以外は原因調査のためスタックトレースを含める。
 * @param {unknown} error
 * @param {string} [lang] 表示言語
 * @returns {string}
 */
export function formatError(error, lang) {
  if (error instanceof BusinessError)
    return `[${error.messageId}] ${renderMessage(error.messageId, error.params, lang)}`;
  return error?.stack ?? String(error);
}

/**
 * CLIを実行する。
 * @param {string[]} args `process.argv.slice(2)` 相当
 * @param {{ stdout: { write: (s: string) => unknown }, stderr: { write: (s: string) => unknown } }} [io]
 * @returns {Promise<number>} 終了コード
 */
export async function main(args, io = process) {
  const lang = detectLang(args);
  try {
    const command = parseArguments(args);
    if (command.type === "help") {
      io.stdout.write(`${renderMessage("cli.usage", {}, lang)}\n`);
      return 0;
    }
    await renderToFiles(command, {
      onProgress: ({ current, total, step }) =>
        io.stderr.write(
          `[${current}/${total}] ${renderMessage(`cli.step.${step}`, {}, lang)}\n`,
        ),
      onGenerated: (file) =>
        io.stdout.write(`${renderMessage("cli.generated", file, lang)}\n`),
    });
    return 0;
  } catch (error) {
    io.stderr.write(`${formatError(error, lang)}\n`);
    return 1;
  }
}
