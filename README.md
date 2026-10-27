<div align="center">

# <img src="./assets/logo.jpg" width="32" height="32" valign="middle" alt="logo" /> matrix-renderer

<!-- バージョン & パッケージ情報 -->
[![npm version](https://img.shields.io/npm/v/matrix-renderer.svg)](https://www.npmjs.com/package/matrix-renderer)
[![npm unpack size](https://img.shields.io/npm/unpacked-size/matrix-renderer)](https://www.npmjs.com/package/matrix-renderer)
[![npm license](https://img.shields.io/npm/l/matrix-renderer.svg)](https://www.npmjs.com/package/matrix-renderer)
[![npm downloads](https://img.shields.io/npm/dm/matrix-renderer.svg)](https://www.npmjs.com/package/matrix-renderer)

<!-- テスト & カバレッジ -->
[![CI and Publish](https://github.com/ubata-mamezou/matrix-renderer/actions/workflows/publish.yaml/badge.svg)](https://github.com/ubata-mamezou/matrix-renderer/actions/workflows/publish.yaml)
[![Coverage](https://img.shields.io/badge/coverage-95%25-brightgreen.svg)](https://github.com/ubata-mamezou/matrix-renderer)

<!-- セキュリティ -->
[![Socket Badge](https://socket.dev/api/badge/npm/package/matrix-renderer)](https://socket.dev/npm/package/matrix-renderer)
[![Known Vulnerabilities](https://snyk.io/test/npm/matrix-renderer/badge.svg)](https://snyk.io/test/npm/matrix-renderer)
[![npm provenance](https://img.shields.io/badge/provenance-verified-blue.svg)](https://www.npmjs.com/package/matrix-renderer)

</div>

## Overview / 概要

**A tool that generates matrix image files (PNG/SVG) from YAML.**

**Tired of updating matrix diagrams (feature matrices, roadmaps, dependency tables) in Excel or drawing tools? They easily get outdated and are impossible to track via Git diffs.**
**matrix-renderer allows you to manage your matrix data in plain YAML and automatically renders structured images (PNG/SVG). Keep your documentation close to your code and fully automated.**

YAMLからマトリクスイメージファイル（png/svg）を生成するCLIツールです。  

マトリクス図（カバレッジ表、機能一覧、ロードマップなど）をExcelやDraw.ioで管理していませんか？それ、すぐに古くなり、Gitでの差分管理もできません。
matrix-rendererは、プレーンなYAMLテキストをGitで管理するだけで、構造化されたマトリクス画像（PNG/SVG）を自動生成します。コードとドキュメントの乖離をなくし、ドキュメンテーションを自動化（Doc as Code）するための軽量ツールです。

![sample](output/landscape.png)

**指定可能な値**
* タイトル
* イメージ幅
* X軸のラベル、テキスト、色
* Y軸のラベル、テキスト、色
* プロットするアイテムのテキスト、配置行、X軸に対応した幅指定、色、URL

## ✨ Key Features / 主な特徴

* Git-Friendly (Doc as Code): マトリクス構造をYAMLで記述するため、差分（diff）が明確で、レビューやバージョン管理が容易です。
<!--
* CI/CD Integration Ready: GitHub ActionsなどのCIワークフローに組み込むことで、YAMLの変更を検知してイメージファイルを自動で再帰的にアップデート可能です。
-->
* Interactive SVG: 生成されたSVG内のアイテムにはハイパーリンクを埋め込み可能。ドキュメントから詳細ページへの動線を作れます。

## Effective Usage and Important Considerations / 効果的な使い方と注意点

* **YAMLをマスターにする**: 変更はYAMLへ反映し、画像はいつでも再生成できる成果物として扱ってください。
* **出力形式を使い分ける**: 拡大しても鮮明でリンクも利用できるSVGと、SVGを許可しない環境でも表示しやすいPNGを用途に応じて選択してください。
* **リンクの公開範囲を確認する**: SVGのリンク先が、図を見る利用者がアクセスできるURLか確認します。SVGの表示環境によってはリンクが制限される場合があります。
* **図の適正な大きさを保つ**: 項目や軸ラベルを増やしすぎると、画像が読みにくくなるため、情報量が多い場合は複数のマトリクスへ分割してください。
* **生成物の管理方針を決める**: 画像をGitへコミットする方法と、CI/CDで生成して公開成果物に含める方法があります。YAMLと画像の不整合を避けるため、どちらを正とするかチームで統一します。

## Environment / 動作環境

* Node.js 24+

## 🚀 How to use / 利用手順

1. マトリクス設定ファイルを作成する
   マトリクスを作成するための設定値を定義したファイルを作成します。
      * テンプレートは[こちら](#️-yaml-template--yaml設定テンプレート)
      * サンプルは[こちら](#️-sample--サンプル)
2. イメージファイルを生成する
   用途に合う[コマンド](#-command--コマンド)を使用してイメージファイルを生成します。

## ⌘ Command / コマンド

イメージファイルを生成するコマンド例です。

### 入力ファイルのみ指定

入力ファイルと同名のイメージファイルを生成します。  
生成先は入力ファイルと同じフォルダーになります。

```sh
npx matrix-renderer render -- example.yaml
```
* 📁
  * example.yaml
  * example.png
  * example.svg

### 入力ファイル、出力ファイル名指定

指定されたファイル名のイメージファイルを生成します。
生成先は入力ファイルと同じフォルダーになります。

```sh
npx matrix-renderer render -- example.yaml --out rename
```
* 📁
  * example.yaml
  * rename.png
  * rename.svg

### 入力ファイル、出力ディレクトリ+ファイル名指定

指定されたディレクトリ配下に、指定されたファイル名のイメージファイルを生成します。

```sh
npx matrix-renderer render -- example.yaml --out output/rename
```
* 📁
  * example.yaml
  * 📁output
    * rename.png
    * rename.svg

### 出力タイプ指定

指定されたファイルタイプを生成します。  
pngまたはsvgを指定できます。  
出力タイプ無指定の場合は両方出力します。

```sh
npx matrix-renderer render -- example.yaml --out output/rename -out-type svg
```
* 📁
  * example.yaml
  * 📁output
    * rename.svg

### ヘルプ

CLIのヘルプ表示。

```sh
npx matrix-renderer render -- --help

Usage:
  matrix-renderer render -- <input.yaml> [Options]

Options:
  --out <prefix>  Output path without an extension
  --out-type <type> Output file type (png, svg) [generates both if omitted]
  -h, --help      Show this help
```

## 🛠️ YAML template / YAML設定テンプレート

```yaml
title: テンプレートです # マトリクスタイトル
width: 800 # マトリクスの幅　※任意（デフォルト1400）
xAxis: # X軸
  label: X軸の説明 # x軸のラベル
  values: # X軸の設定
    - label: 列１ # X軸のラベル
      color: "#d6eaf8" # 列の色（RGBまたはRRGGBB形式）　※任意
    - label: 列２ # X軸のラベル（色指定なし）
    - label: 列３ # X軸のラベル（色指定なし、属性名あり）
yAxis: # Y軸
  label: Y軸の説明 # Y軸のラベル
  values: # Y軸の設定
    - label: 行１ # Y軸のラベル
      color: "#c5e4ec" # 行の色（RGBまたはRRGGBB形式）　※任意
    - label: 行２ # Y軸のラベル（色指定なし）
    - label: 行３ # Y軸のラベル（色指定なし、属性名あり）
items: # プロットするアイテムの設定
  - id: item1 # アイテムのID
    label: アイテム１ # アイテムのラベル
    lane: 行１ # アイテムを配置する行（Y軸のラベルを指定）
    from: 列１ # アイテムを配置する開始列（X軸のラベルを指定）
    to: 列１ # アイテムを配置する終了列（X軸のラベルを指定）
    url: https://example.com/guide # アイテムのリンク　※任意
    color: "#245080" # アイテムの色（RGBまたはRRGGBB形式）　※任意
```
* X軸
  * 描画順: xAxis.valuesに定義された順に描画します
* Y軸
  * 描画順: yAxis.valuesに定義された順に描画します
* アイテム
  * from, to: アイテムの描画範囲。fromはtoより左にあたるラベルまたは同値でなければいけません。
  * URL: アイテムに埋め込みます。クリックすると新しいタブで開きます。（HTTPまたはHTTPS）※SVGのみ

## 🛠️ Sample / サンプル

[`examples/`](examples/)に入力ファイル、  
[`output/`](output/)に生成したイメージファイルを格納しています。
