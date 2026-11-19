# Developer Guide

This guide is for developers who modify and verify matrix-renderer and for maintainers who manage releases. See [package.json](../../package.json) and the [workflows](../../.github/workflows/) for the current configuration.

## Development Environment

* Node.js 24 or later. Standard CI runs use Node.js 24.
* npm.
* Bash. Tests and example rendering use shell scripts, so on Windows you need a Bash environment such as Git Bash.

After cloning the repository, install dependencies from the repository root. This uses the lockfile and skips dependency lifecycle scripts, just as CI does.

```sh
npm ci --ignore-scripts
```

## Checking Your Changes

Run the checks you need individually:

| Command | What it does |
|---|---|
| `npm run lint` | Runs Biome static analysis on source and test files. |
| `npm test` | Generates SVG test fixtures and runs the Node.js tests and CLI behavior tests. |
| `npm run test:coverage` | Runs tests and measures coverage. |
| `npm run render:examples` | Generates images from the examples. |
| `npm audit signatures` | Verifies the signatures and provenance of npm dependencies. |
| `npm audit --audit-level=high` | Checks dependencies for known vulnerabilities and fails if any are rated high or above. |
| `npm pack --dry-run` | Shows which files would be included in the package. |

Tests and example rendering may overwrite generated files. Review the diff afterward.

`npm run build:dev` also runs `npm audit fix`, which may change dependencies. To check changes without updating dependencies, run the relevant commands individually.

## Pull Request CI

[build.yaml](../../.github/workflows/build.yaml) runs for PRs targeting `main`, regardless of the source branch name. It does not run the release process.

* Version resolution and build verification run as separate reusable workflows.
* Build verification runs static analysis, tests, dependency audits, example rendering, and package content checks. CodeQL analysis runs in a separate job.
* If a check fails, find the relevant job and step in the PR's **Checks** tab or the Actions run log.

## For Maintainers: Workflow Structure

Reusable workflow file names start with `_` to distinguish them from entry-point workflows.

| File | Trigger and purpose |
|---|---|
| [build.yaml](../../.github/workflows/build.yaml) | Calls the shared version resolution and build verification workflows for all PRs targeting `main`. |
| [publish.yaml](../../.github/workflows/publish.yaml) | Runs shared checks on a push to `main` or a manual run, and releases when the release conditions are met. |
| [showcase.yaml](../../.github/workflows/showcase.yaml) | Generates example images and publishes the showcase to GitHub Pages. |
| [scorecard.yaml](../../.github/workflows/scorecard.yaml) | Runs OpenSSF Scorecard on a schedule or on demand to evaluate supply chain security. |
| [_build.yaml](../../.github/workflows/_build.yaml) | Runs via `workflow_call` and performs verification, CodeQL analysis, and optional Node.js compatibility checks. It does not return a version. |
| [_version-resolver.yaml](../../.github/workflows/_version-resolver.yaml) | Runs via `workflow_call` and returns the current version and whether it changed since before the push. |

To detect a version change on a push, the workflow compares the `package.json` from before the push with the current one. The change flag is `false` for PRs and manual runs. It is also `false` if the previous version is unavailable, such as on an initial push.

### Release Conditions and Process

The `release` job runs only when a push to `main` changes the version and both version resolution and build verification succeed.

1. Run `npm pack` to generate the npm package (`.tgz`) for the GitHub Release.
2. Use GitHub's `actions/attest` to generate SLSA build provenance for the package and register it with GitHub Attestations. Verify the attestation with the GitHub CLI, then prepare the Sigstore bundle (`.sigstore.json`) for upload.
3. If the `v<version>` GitHub Release does not exist, create it for the target commit with generated release notes, and attach the package and bundle. If the release already exists, upload both files and replace any assets with the same names.
4. Run `npm stage publish` to stage the package for review.

Staging is not the final publication. This workflow does not approve or publish the staged package. A push that does not change the version, or a manual workflow run, does not run the `release` job.

### Verifying Release Artifacts

Download the `.tgz` and `.sigstore.json` files for the same version from the GitHub Release, then verify them with the GitHub CLI:

```sh
# Replace the version with the one you want to verify.
PACKAGE=matrix-renderer-0.4.0.tgz
gh attestation verify "$PACKAGE" \
  --bundle "${PACKAGE}.sigstore.json" \
  --repo ubata-mamezou/matrix-renderer \
  --signer-workflow github.com/ubata-mamezou/matrix-renderer/.github/workflows/publish.yaml
```

### Publishing the Showcase

In the repository's **Settings > Pages**, set **Source** to **GitHub Actions**. Before publishing, verify that the files to be published do not contain sensitive information.

[showcase.yaml](../../.github/workflows/showcase.yaml) updates the showcase when changes to `examples/`, `showcase/`, or the workflow itself are pushed to `main`, or when run manually. It fetches the latest published npm version at run time and uses it to generate the examples. The `Test showcase generation` and `Build showcase page` steps are specific to the showcase.

Publishing a new npm version does not automatically update the showcase. Run the **Publish showcase** workflow manually if needed.

### OpenSSF Scorecard

[scorecard.yaml](../../.github/workflows/scorecard.yaml) runs on pushes to `main`, changes to branch protection rules, every Monday at 01:30 UTC (10:30 Japan Standard Time), or when manually triggered in Actions. PRs do not trigger it directly.

The results are stored in SARIF format in the `scorecard-results` artifact for five days and uploaded to GitHub code scanning. `publish_results: true` makes the Scorecard results public. Check the Actions run log, the artifact, or the GitHub **Security** tab for results and failure details. Code scanning requires repository support and configuration. See the [OpenSSF Scorecard Action](https://github.com/ossf/scorecard-action) for details about the checks.

### Optional Node.js Compatibility Checks

Manually run **CI and Publish** in Actions with `run_node_matrix` enabled to test and render examples on Node.js 24 and 26. These extra checks are skipped on regular PRs and pushes.

### Branch Protection

Adding workflow files does not make CI success a merge requirement. After the workflows have run for a PR, use GitHub branch protection or a ruleset to require the following checks from the run:

* `build / Verify`
* `build / CodeQL analysis`

Confirm the actual check names shown in GitHub before selecting them. Do not require the optional Node.js compatibility checks. Configure PR and review approval requirements in GitHub to match the project's policies.
