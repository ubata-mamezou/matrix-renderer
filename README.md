# Matrix Renderer

YAMLで定義したフェーズと分類のマトリクスをSVGおよびPNGに出力する小さなCLIです。

## 利用方法

```sh
npx matrix-renderer render -- example.yaml
npx matrix-renderer render -- example.yaml --out output/development-guide
```

Node.js 20.9.0以降が必要です。YAMLファイルは利用者側で用意します。`--out`は拡張子を含まない出力先で、省略すると入力ファイルと同じ場所、同じ名前でSVGとPNGを生成します。

GitHub Packagesのプライベートパッケージを利用するため、初回は`read:packages`権限を持つPATを`NODE_AUTH_TOKEN`環境変数へ設定し、利用側の`.npmrc`に次を記述します。

パッケージ開発時は、リポジトリ内で次のように実行できます。

```sh
npm install
npm run render -- example.yaml
```

## サンプル

[`examples/`](examples/)に用途の異なるサンプルを用意しています。出力先を分けて実行できます。

```sh
npm run render -- examples/incident-response.yaml --out output/incident-response
npm run render -- examples/seasonal-produce.yaml --out output/seasonal-produce
```

- [障害対応資料の適用範囲](examples/incident-response.yaml)
- [旬の食材カレンダー](examples/seasonal-produce.yaml): 旬は地域や品種によって異なる目安です。
- [花粉濃度の季節傾向](examples/pollen-seasons.yaml): 飛散傾向は地域や年によって異なる目安です。
- [年間イベントの開催時期](examples/annual-events.yaml): 開催月単位で示し、個別の日付は表しません。

## テスト

```sh
npm test
```

## YAML形式

```yaml
title: 開発プロセスにおけるガイド・ツール
width: 1440
xAxis:
  label: 開発フェーズ
  values:
    - label: 企画
      color: "#d6eaf8"
    - label: 要件定義
      color: "#c5e4ec"
yAxis:
  label: 分類
  values:
    - label: プロセス
      color: "#c5e4ec"
    - label: アプリケーション
      color: "#f6d4b8"
items:
  - id: aws-design
    label: AWSインフラ設計書
    lane: インフラ
    from: 外部設計
    to: テスト
    url: https://contoso.sharepoint.com/sites/dev-guide/aws-design
    color: "#b9dfc8"
```

  `xAxis.values`と`yAxis.values`が軸の表示順です。値は従来どおり文字列だけでも指定できます。個別に色を付ける場合は`label`と`color`を持つオブジェクトを使い、文字列とオブジェクトは混在できます。軸色には各フェーズ見出しまたは分類ラベルの背景色が反映され、文字色は背景とのコントラストに応じて自動で選ばれます。`from`と`to`は両端を含むフェーズ名を指定します。各項目はひとつの`lane`に属し、同じレーン内で期間が重なる項目は自動で縦方向にずらします。項目のラベルは帯の幅に合わせて折り返します。項目の`color`も任意で、`#RGB`または`#RRGGBB`形式で帯の色を指定します。

各項目の`url`は任意です。指定するとSVGでは帯全体がクリック可能になり、新しいタブでHTTPまたはHTTPSのURLを開きます。実際に使う際は例のURLをSharePoint上のドキュメントURLに置き換えてください。PNGは画像形式のためリンクを保持しません。また、SVG内リンクの動作はSharePointでの表示方法やテナント設定に依存します。

PNGはSVGをラスタライズして生成します。SharePointに掲載する際は、テナントでSVGが許可されない場合にPNGをご利用ください。