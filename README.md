# Mergie

## What does this do?

The idea here is for this to be an incremental part of Mergie, rather than rewrite the existing Mergie functionality. For now, this will be the part that automatically merges `main` to `test*` branches that have active, non-draft PRs.

## Usage

Save your changes and commit the build artifacts:

```
yarn package
git commit -am "...change description"
git push origin main
```

Then, from another repo, include a Github Workflow file:

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

## What is this code based on?

This boilerplate project: https://github.com/NickLiffen/actions-boilerplate
