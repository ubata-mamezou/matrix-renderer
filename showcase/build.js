import { copyFile, mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const escapeHtml = (value) => value.replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[char]);

export async function buildShowcase(examplesDir, siteDir, version) {
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
    throw new Error(`Invalid matrix-renderer version: ${version}`);
  }
  const files = (await readdir(examplesDir))
    .filter((name) => /\.(?:yaml|yml)$/.test(name))
    .sort();
  if (files.length === 0) throw new Error("No example YAML files found");

  const names = new Set();
  const cards = [];
  await mkdir(join(siteDir, "examples"), { recursive: true });
  for (const file of files) {
    const name = basename(file, extname(file));
    if (names.has(name)) throw new Error(`Duplicate example name: ${name}`);
    names.add(name);
    for (const format of ["png", "svg"]) {
      const path = join(siteDir, "images", `${name}.${format}`);
      if (!(await stat(path)).isFile()) throw new Error(`Not a file: ${path}`);
    }
    const yaml = await readFile(join(examplesDir, file), "utf8");
    await copyFile(join(examplesDir, file), join(siteDir, "examples", file));
    const path = encodeURIComponent(name);
    const yamlPath = encodeURIComponent(file);
    const label = escapeHtml(name);
    cards.push(`
      <article class="card">
        <div class="card-heading">
          <div><span class="number">${String(cards.length + 1).padStart(2, "0")} / EXAMPLE</span><h2>${label}</h2></div>
          <div class="links"><a href="examples/${yamlPath}">YAML ↗</a><a href="images/${path}.png">PNG ↗</a><a href="images/${path}.svg">SVG ↗</a></div>
        </div>
        <div class="panels">
          <section class="panel source"><div class="panel-label">YAML <span>THE INPUT</span></div><pre><code>${escapeHtml(yaml)}</code></pre></section>
          <section class="panel"><div class="panel-label">PNG <span>THE IMAGE</span></div><a class="preview" href="images/${path}.png"><img loading="lazy" src="images/${path}.png" alt="${label} の PNG プレビュー"></a></section>
          <section class="panel"><div class="panel-label">SVG <span>THE VECTOR</span></div><a class="preview" href="images/${path}.svg"><img loading="lazy" src="images/${path}.svg" alt="${label} の SVG プレビュー"></a></section>
        </div>
      </article>`);
  }

  const safeVersion = escapeHtml(version);
  const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="YAML からマトリクス図を生成する matrix-renderer のサンプル集">
  <title>Showcase | matrix-renderer</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <header class="hero">
    <div class="wrap">
      <nav><a class="brand" href="https://github.com/ubata-mamezou/matrix-renderer"><span class="brand-mark">▦</span> matrix-renderer</a><a class="github" href="https://github.com/ubata-mamezou/matrix-renderer">GitHub ↗</a></nav>
      <div class="intro"><span class="eyebrow">YAML IN, IDEAS OUT ✨</span><h1>ちょっと便利な、<br><em>マトリクス図</em>のサンプル集。</h1><p>YAMLから、わかりやすい図を。<br>入力と、できあがった PNG・SVG を見比べてみよう。</p>
        <div class="meta"><span class="version">● matrix-renderer v${safeVersion}</span><span>${cards.length} examples</span></div>
      </div>
    </div>
  </header>
  <main class="wrap">
    <div class="section-heading"><div><span class="eyebrow">THE SHOWCASE</span><h2>つくってみました。</h2></div><p>画像をクリックすると原寸で開きます ↗</p></div>
    ${cards.join("\n")}
  </main>
  <footer class="wrap">Made with YAML &amp; <a href="https://www.npmjs.com/package/matrix-renderer">matrix-renderer v${safeVersion}</a> ✨</footer>
</body>
</html>
`;
  await copyFile(fileURLToPath(new URL("./style.css", import.meta.url)), join(siteDir, "style.css"));
  await writeFile(join(siteDir, "index.html"), html);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [examplesDir, siteDir, version] = process.argv.slice(2);
  if (!examplesDir || !siteDir || !version) {
    throw new Error("Usage: node build.js <examples-dir> <site-dir> <version>");
  }
  await buildShowcase(examplesDir, siteDir, version);
}
