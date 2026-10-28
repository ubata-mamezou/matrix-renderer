// 循環参照を避けるため、ここではerror.jsは参照しない
export default {
  general: "{message}",
  fail: {
    application: "application error: {option}",
    unSupportOps: "un supported operation: {option}",
  },
  biz: {
    default: "business error: {option}",
    unknownOption: "Unknown option: {arg}\n{usage}",
    warnInputOption: "Please specify exactly one input YAML file.\n{usage}",
    inputNotFound: "Input file not found: {input}",
    warnOutOption: "Please specify an output path after --out.",
    warnOutTypeOption: "Please specify a file type after --out-type.",
    warnOutTypeOptionValues: "--out-type must be svg or png.",
  },
  validation: {
    general: "{message}",
    default: "validation error: {option}",
    anyMatch: "{label} does not meet the specified check: {value}",
    type: {
      valid: "{label} is invalid: {value}",
      invalid: "{label} must be null or undefined: {value}",
      string: "{label} is not string: {value}",
      object: "{label} is not object: {value}",
      array: "{label} is not array: {value}",
    },
    number: {
      inRange: "{label} between {min} and {max}",
    },
    array: {
      uniqueBy: "Duplicate keys in the {label}: {value}",
    },
    empty: "{label} is not empty: {value}",
    notEmpty: "{label} is empty: {value}",
    format: {
      rgb: "{label} is not #RGB or #RRGGBB style: {value}",
    },
    hasAttribute: "{label} attribute does not exist",
    duplicate: "{label} is duplicated: {value}",
    notInList: "{label} is not in list: {value}",
    order:
      'Please specify a value for "from" that precedes the value for "to": {from}, {to}',
  },
  url: {
    badValue: "The value to be converted is not a URL.",
    badProtocol: "Please specify a URL using HTTP(S).",
  },
  cli: {
    usage: [
      "Usage:",
      "  matrix-renderer render -- <input.yaml> [Options]",
      "",
      "Options:",
      "  --out <prefix>    Output path without an extension",
      "  --out-type <type> Output file type (png, svg) [generates both if omitted]",
      "  --lang <lang>     Message language (en, ja) [default: en]",
      "  -h, --help        Show this help",
    ].join("\n"),
    step: {
      inputLoaded: "Input data loaded",
      svgRendered: "SVG rendered",
      pngRendered: "PNG rendered",
      svgWritten: "SVG file written",
      pngWritten: "PNG file written",
    },
    generated: "Generated {path} ({width}x{height})",
  },
};
