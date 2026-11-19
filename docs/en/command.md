# CLI Commands

Use the following commands to generate images with `npx`. If matrix-renderer is already installed in your project and you have defined a `renderer` npm script, you can use `npm run renderer` instead of `npx matrix-renderer`.

* `--out`: Specify an output path without a file extension.
  * Relative paths are resolved from the current working directory.
* `--out-type`: Specify the output image format.
  * Accepted values: `svg`, `png`.
  * If omitted, both formats are generated.
* `--lang`: Set the language of CLI errors, progress messages, and help.
  * Accepted values: `en`, `ja`.
  * The CLI uses `en` if the option is omitted or the value is unsupported.
  * This option only affects CLI messages. It does not translate titles or labels in the YAML file.

## Specify only the input file

The images use the input file's base name and are written to the same directory as the input file.

```sh
npx matrix-renderer render -- example.yaml
```

```text
.
├── example.yaml
├── example.png
└── example.svg
```

## Specify an output file name

The images use the specified base name. In this example, the input file and output images are in the current working directory.

```sh
npx matrix-renderer render -- example.yaml --out rename
```

```text
.
├── example.yaml
├── rename.png
└── rename.svg
```

## Specify an output directory and file name

The images are written to the specified directory using the given base name. The CLI creates the output directory if it does not exist.

```sh
npx matrix-renderer render -- example.yaml --out output/rename
```

```text
.
├── example.yaml
└── output/
    ├── rename.png
    └── rename.svg
```

## Specify the output format

Use `--out-type` with `png` or `svg` to generate only that format. If the option is omitted, both formats are generated.

```sh
npx matrix-renderer render -- example.yaml --out output/rename --out-type svg
```

```text
.
├── example.yaml
└── output/
    └── rename.svg
```

## Set the CLI message language

Use `--lang en` or `--lang ja` to change the language of errors, progress messages, and help. The default is `en`, including when the supplied value is unsupported.

```sh
npx matrix-renderer render -- example.yaml --lang ja
```

## Help

Display CLI help:

```sh
npx matrix-renderer render -- --help
```

```text
Usage:
  matrix-renderer render -- <input.yaml> [Options]

Options:
  --out <prefix>    Output path without an extension
  --out-type <type> Output file type (png, svg) [generates both if omitted]
  --lang <lang>     Message language (en, ja) [default: en]
  -h, --help        Show this help
```
