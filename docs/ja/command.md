# CLIコマンド

イメージファイルを生成するコマンドです。  
`npx`で実行します。  
プロジェクトにインストール済みの場合は、`npx matrix-renderer` の代わりに `npm run renderer`コマンドも使用できます。

* `--out`: 拡張子を含めない出力ファイル名を指定します。
  * 相対パスの場合は現在の作業ディレクトリからの相対位置です。
* `--out-type`: 出力イメージタイプを指定します。
  * 指定可能な値: `svg`, `png`
  * 無指定の場合: 両方出力します
* `--lang`: CLIで表示するエラー、進捗、ヘルプの表示言語を切り替えます。
  * 指定可能な値: `en`, `ja`
  * 無指定および未対応の値を指定した場合: `en`
  * 切り替えるのはCLIメッセージのみです。YAML内のタイトルやラベルの翻訳はしません。

## 入力ファイルのみ指定

入力ファイルと同名のイメージファイルを生成します。  
生成先は入力ファイルと同じフォルダーになります。

```sh
npx matrix-renderer render -- example.yaml
```
* 📁
  * example.yaml
  * example.png
  * example.svg

## 入力ファイル、出力ファイル名指定

指定されたファイル名のイメージファイルを生成します。
生成先は入力ファイルと同じフォルダーになります。

```sh
npx matrix-renderer render -- example.yaml --out rename
```
* 📁
  * example.yaml
  * rename.png
  * rename.svg

## 入力ファイル、出力ディレクトリ+ファイル名指定

指定されたディレクトリ配下に、指定されたファイル名のイメージファイルを生成します。  
出力先ディレクトリがなければ作成します。

```sh
npx matrix-renderer render -- example.yaml --out output/rename
```
* 📁
  * example.yaml
  * 📁output
    * rename.png
    * rename.svg

## 出力タイプ指定

指定されたファイルタイプを生成します。  
pngまたはsvgを指定できます。  
出力タイプ無指定の場合は両方出力します。

```sh
npx matrix-renderer render -- example.yaml --out output/rename --out-type svg
```
* 📁
  * example.yaml
  * 📁output
    * rename.svg

## CLIメッセージの言語指定

エラー、進捗、ヘルプの言語を切り替えます。  
enまたはjaを指定できます。無指定や未対応の値の場合はenです。

```sh
npx matrix-renderer render -- example.yaml --lang ja
```

## ヘルプ

CLIのヘルプ表示。

```sh
npx matrix-renderer render -- --help

Usage:
  matrix-renderer render -- <input.yaml> [Options]

Options:
  --out <prefix>    Output path without an extension
  --out-type <type> Output file type (png, svg) [generates both if omitted]
  --lang <lang>     Message language (en, ja) [default: en]
  -h, --help        Show this help
```
