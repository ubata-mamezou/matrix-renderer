import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { buildShowcase } from "../showcase/build.js";

test("YAML と両形式の画像を安全に並べ、生成バージョンを表示する", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "matrix-showcase-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const examples = join(root, "examples");
  const site = join(root, "site");
  await mkdir(examples);
  await mkdir(join(site, "images"), { recursive: true });
  await writeFile(join(examples, "example & one.yaml"), "title: <script>alert('x')</script>\n");
  for (const ext of ["png", "svg"]) {
    await writeFile(join(site, "images", `example & one.${ext}`), ext);
  }

  await buildShowcase(examples, site, "0.4.0");
  const html = await readFile(join(site, "index.html"), "utf8");
  assert.match(html, /matrix-renderer v0\.4\.0/);
  assert.match(html, /examples\/example%20%26%20one\.yaml/);
  assert.match(html, /images\/example%20%26%20one\.png/);
  assert.match(html, /images\/example%20%26%20one\.svg/);
  assert.match(html, /&lt;script&gt;alert\(&#39;x&#39;\)&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<script>/);
  assert.equal(await readFile(join(site, "examples", "example & one.yaml"), "utf8"), "title: <script>alert('x')</script>\n");
});

test("画像が不足している場合は生成に失敗する", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "matrix-showcase-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const examples = join(root, "examples");
  const site = join(root, "site");
  await mkdir(examples);
  await mkdir(join(site, "images"), { recursive: true });
  await writeFile(join(examples, "example.yaml"), "title: example\n");
  await writeFile(join(site, "images", "example.png"), "png");
  await assert.rejects(buildShowcase(examples, site, "0.4.0"), /example\.svg/);
});
