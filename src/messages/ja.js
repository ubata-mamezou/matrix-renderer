// 循環参照を避けるため、ここではerror.jsは参照しない
export default {
  general: "{message}",
  fail: {
    application: "アプリケーションエラー: {option}",
    unSupportOps: "サポートされていない操作です: {option}",
  },
  biz: {
    default: "業務エラー: {option}",
    unknownOption: "不明なオプションです: {arg}\n{usage}",
    warnInputOption: "入力YAMLを1件指定してください。\n{usage}",
    inputNotFound: "入力ファイルが見つかりません: {input}",
    warnOutOption: "--outの後に出力先を指定してください。",
    warnOutTypeOption: "--out-typeの後にファイルタイプを指定してください。",
    warnOutTypeOptionValues: "--out-typeはsvgまたはpngを指定してください。",
  },
  validation: {
    general: "{message}",
    default: "検証エラー: {option}",
    anyMatch: "{label} が指定された条件を満たしていません: {value}",
    type: {
      valid: "{label} が不正です: {value}",
      invalid: "{label} は null または undefined である必要があります: {value}",
      string: "{label} が文字列ではありません: {value}",
      object: "{label} がオブジェクトではありません: {value}",
      array: "{label} が配列ではありません: {value}",
    },
    number: {
      inRange: "{label} は {min} から {max} の範囲で指定してください",
    },
    array: {
      uniqueBy: "{label} に重複したキーがあります: {value}",
    },
    empty: "{label} が空ではありません: {value}",
    notEmpty: "{label} が空です: {value}",
    format: {
      rgb: "{label} が #RGB または #RRGGBB 形式ではありません: {value}",
    },
    hasAttribute: "{label} 属性が存在しません",
    duplicate: "{label} が重複しています: {value}",
    notInList: "{label} が一覧に存在しません: {value}",
    order:
      '"from" には "to" より前の値を指定してください: {from}, {to}',
  },
  url: {
    badValue: "URLに変換できない値です。",
    badProtocol: "HTTP(S)のURLを指定してください。",
  },
  cli: {
    usage: [
      "使い方:",
      "  matrix-renderer render -- <input.yaml> [オプション]",
      "",
      "オプション:",
      "  --out <prefix>    拡張子を除いた出力先パス",
      "  --out-type <type> 出力形式 (png, svg) [省略時は両方を出力]",
      "  --lang <lang>     メッセージの言語 (en, ja) [既定: en]",
      "  -h, --help        ヘルプを表示",
    ].join("\n"),
    step: {
      inputLoaded: "入力データを読み込みました",
      svgRendered: "SVGを描画しました",
      pngRendered: "PNGを描画しました",
      svgWritten: "SVGファイルを出力しました",
      pngWritten: "PNGファイルを出力しました",
    },
    generated: "出力しました: {path} ({width}x{height})",
  },
};
