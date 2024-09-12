# Auto-update Custom Fields in Linked Asana Tasks

## What does this do?

This GitHub Action updates a custom field in Asana called "Status" based on specific events related to pull requests (PRs). The updates occur under the following conditions:

- When a PR is merged (or any other push to the main branch).
- When a PR is opened or reopened.

## Development of this GitHub Action

Use GitHub Codespaces to develop this in-browser. There's an existing codespace already set up.

Save your changes and commit the build artifacts:

```
nvm use && npm install && npm run build && npm run package && git add -A && git commit && git push origin main
```

Upon pushing to any branch, you'll trigger an automatic release

## Using this Github Action from another repo

_Make sure to allow Github Actions from the respective repo you want this Github Action to operate on._

Include a Github Workflow file in the respective repo:

.github/workflows/auto-update-asana-custom-field.yml

```
name: Asana Status

on:
  pull_request:
    types: [opened, reopened]
  push:
    branches:
      - "main"

jobs:
  auto-merge-main-into-open-pull-requests:
    name: Update
    runs-on: "ubuntu-latest"

    steps:
      - name: Checkout repo
        uses: actions/checkout@v3
      - name: Update Asana Status
        uses: "sprucehealth/auto-update-asana-custom-field-action@latest"
        with:
          mainBranchName: main
          asanaToken: ${{ secrets.ASANA_TOKEN }}
          githubToken: ${{ github.token }}
          statusFieldName: "Status"
          statusFieldValueWhenDraftPRIsOpen: "📖 In Code Review"
          statusFieldValueWhenPRReadyForReviewIsOpen: "✏️ In Development"
          statusFieldValueWhenPRReadyForReviewIsApproved: "✅ Approved"
          statusFieldValueForMergedCommitToMain: "ᛦ Merged"
          labelToApplyToPRWhenApproved: "QA_PENDING"

```
