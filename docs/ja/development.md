# 開発者向けガイド

matrix-rendererの変更・検証を行う開発者と、リリースを管理するメンテナー向けのガイドです。現在の設定は[package.json](../../package.json)と[ワークフロー](../../.github/workflows/)を参照してください。

## 開発環境

* Node.js 24以上。通常のCIではNode.js 24を使用します。
* npm。
* Bash。テストとサンプル描画にシェルスクリプトを使用するため、WindowsではGit BashなどBashを実行できる環境が必要です。

リポジトリを取得後、ルートディレクトリで依存関係をインストールします。CIと同様にlockfileを使い、依存パッケージのライフサイクルスクリプトは実行しません。

```sh
npm ci --ignore-scripts
```

## 変更時の検証

必要な検証を個別に実行できます。

| コマンド | 内容 |
|---|---|
| `npm run lint` | ソースとテストをBiomeで静的解析する |
| `npm test` | テスト用SVGを生成し、Node.jsのテストとCLIの振る舞いテストを実行する |
| `npm run test:coverage` | カバレッジを計測しながらテストを実行する |
| `npm run render:examples` | サンプルの画像を生成する |
| `npm audit signatures` | npmパッケージの署名とprovenanceを検証する |
| `npm audit --audit-level=high` | 依存関係の既知脆弱性を確認し、high以上で失敗させる |
| `npm pack --dry-run` | パッケージに含まれるファイルを確認する |

テストやサンプル描画は生成ファイルを書き換える場合があります。実行後は差分を確認してください。

`npm run build:dev` は検証だけでなく `npm audit fix` も実行し、依存関係を変更する可能性があります。変更を伴わず検証したい場合は、上記のコマンドを個別に使います。

## PRでのCI

[build.yaml](../../.github/workflows/build.yaml)は、ブランチ名を問わずmain向けのPRで起動します。PRのCIからリリース処理は呼び出しません。

* バージョン取得とビルド検証は、独立した再利用可能ワークフローとして実行します。
* ビルド検証では静的解析、テスト、依存監査、サンプル描画、パッケージ内容確認を行い、別ジョブでCodeQL解析を行います。
* 失敗時はPRのChecksまたはActionsの実行ログから該当ジョブ・ステップを確認します。

## メンテナー向け：ワークフロー構成

起動用ワークフローと区別するため、再利用可能ワークフローのファイル名は `_` で始めます。

| ファイル | 起動条件・役割 |
|---|---|
| [build.yaml](../../.github/workflows/build.yaml) | main向けの全PRで、共通のバージョン取得とビルド検証を呼び出す |
| [publish.yaml](../../.github/workflows/publish.yaml) | mainへのpushまたは手動実行で、共通処理と条件付きのリリースを実行する |
| [showcase.yaml](../../.github/workflows/showcase.yaml) | サンプル画像とショーケースを生成し、GitHub Pagesに公開する |
| [scorecard.yaml](../../.github/workflows/scorecard.yaml) | OpenSSF Scorecardでサプライチェーンのセキュリティを定期・随時に評価する |
| [_build.yaml](../../.github/workflows/_build.yaml) | `workflow_call`で起動し、検証処理とCodeQL、任意のNode.js互換性検証を実行する。バージョンは返さない |
| [_version-resolver.yaml](../../.github/workflows/_version-resolver.yaml) | `workflow_call`で起動し、現在のバージョンとpush前からの変更有無を返す |

バージョン判定はpushイベントの変更前コミットと現在の `package.json` を比較します。PR・手動実行では変更有無はfalseです。初回pushなどで比較元のバージョンを取得できない場合もfalseになります。

### リリースの条件と処理

mainへのpushでバージョンが変わり、バージョン取得とビルド検証が両方成功した場合だけreleaseジョブが実行されます。

1. `npm pack` でGitHub Releaseに添付するnpmパッケージ（`.tgz`）を生成します。
2. GitHub提供の `actions/attest` でパッケージのSLSA provenanceを作成し、GitHub Attestationsに登録します。GitHub CLIで検証してから、Sigstoreバンドル（`.sigstore.json`）を添付用に用意します。
3. `v<version>` のGitHub Releaseがなければ、対象コミットを指定してリリースノート付きで作成し、パッケージとバンドルを添付します。既存のReleaseには両ファイルをアップロードし、同名のアセットがあれば置き換えます。
4. `npm stage publish` を実行し、パッケージをレビュー用にステージングします。

ステージングは最終公開と区別してください。このワークフローには、ステージング後の承認・最終公開を行う処理は含まれていません。また、バージョンを変えないpushや手動実行ではreleaseジョブは実行されません。

### リリース成果物の署名検証

GitHub Releaseから同じバージョンの `.tgz` と `.sigstore.json` をダウンロードし、GitHub CLIで検証します。

```sh
# 検証するリリースのバージョンに置き換えてください。
PACKAGE=matrix-renderer-0.4.0.tgz
gh attestation verify "$PACKAGE" \
  --bundle "${PACKAGE}.sigstore.json" \
  --repo ubata-mamezou/matrix-renderer \
  --signer-workflow github.com/ubata-mamezou/matrix-renderer/.github/workflows/publish.yaml
```

### ショーケースの公開

リポジトリの **Settings > Pages** で公開元（Source）を **GitHub Actions** に設定してください。公開前に、公開対象に機密情報が含まれていないことを確認してください。[showcase.yaml](../../.github/workflows/showcase.yaml)は、`examples/`、`showcase/`または自身のワークフローの変更がmainにpushされたとき、または手動実行時にショーケースを更新します。実行時にnpmの公開最新版を取得し、そのバージョンを使ってサンプルを生成します。`Test showcase generation` と `Build showcase page` はショーケース固有のステップです。

npmへの新バージョン公開だけでは自動更新されないため、必要に応じて「Publish showcase」ワークフローを手動実行してください。

### OpenSSF Scorecardによる評価

[scorecard.yaml](../../.github/workflows/scorecard.yaml)は、mainへのpush、ブランチ保護ルールの変更、毎週月曜01:30 UTC（日本時間10:30）の定期実行、またはActionsからの手動実行で起動します。PRを直接の起動条件にはしていません。

評価結果はSARIF形式で `scorecard-results` アーティファクトに5日間保存し、GitHubのCode Scanningにもアップロードします。`publish_results: true` によりScorecardの結果を公開する設定です。結果や失敗時の詳細はActionsの実行ログ、アーティファクト、またはGitHubのSecurityタブで確認してください。Code Scanningの利用にはリポジトリ側の対応・設定が必要です。評価項目の詳細は[OpenSSF Scorecard Action](https://github.com/ossf/scorecard-action)を参照してください。

### 任意のNode.js互換性検証

Actionsで「CI and Publish」を手動実行し、`run_node_matrix` を有効にすると、Node.js 24と26でテストとサンプル描画を追加実行します。通常のPR・pushではこの追加検証はスキップされます。

### ブランチ保護

ワークフローファイルを追加するだけでは、CI成功がマージ条件になるわけではありません。PRを実行した後、GitHubのブランチ保護またはRulesetで、実行結果に表示される次のチェックを必須に指定します。

* `build / Verify`
* `build / CodeQL analysis`

GitHub上の実際のチェック名を確認して選択してください。任意実行のNode.js互換性検証は必須チェックにしません。PR必須化やレビュー承認も、プロジェクトの運用方針に合わせてGitHub側で設定します。
