# Auto-merge main into open Pull Requests Github Action

## What does this do?

The idea here is for this to be an incremental part of Mergie, rather than rewrite the existing Mergie functionality. For now, this will be the part that automatically merges `main` to `test*` branches that have active, non-draft PRs.

## Development of this Github Action

Use Github Codespaces to develop this in-browser. There's an existing codespace already set up.

Save your changes and commit the build artifacts:

```
yarn build
yarn package
git commit -am "...change description"
git push origin main
```

## Using this Github Action from another repo

_Make sure to allow Github Actions from the respective repo you want this Github Action to operate on._

Include a Github Workflow file in the respective repo:

.github/workflows/auto-merge-main-into-pull-requests.yml

```
name: Auto-merge main into open Pull Requests

on:
  push:
    branches:
      - "main"

jobs:
  auto-merge-main-into-open-pull-requests:
    name: Auto-merge main into open Pull Requests
    runs-on: "ubuntu-latest"

    steps:
      - name: Checkout repo
        uses: actions/checkout@v3
      - name: Auto-merge main into open Pull Requests
        uses: "sprucehealth/auto-merge-main-into-pull-requests-action@latest"
        with:
          mainBranchName: main
          waitMilliseconds: 500
          githubToken: ${{ secrets.GITHUB_TOKEN }}
          onlyMergeMainForDraftPullRequests: false
          onlyPullRequestsWithLabels: TEST_ENVIRONMENT
          skipPullRequestsWithLabels: DONT_SYNC_MAIN

```
