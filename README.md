# Mergie

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

.github/workflows/mergie

```
name: "Mergie"

on:
  push:
    branches:
      - "main"

jobs:
  mergie:
    name: "Mergie"
    runs-on: "ubuntu-latest"

    steps:
      - uses: "sprucehealth/mergie-action@latest"
```
