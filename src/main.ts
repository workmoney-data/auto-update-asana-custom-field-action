import * as core from '@actions/core'
import * as github from '@actions/github'

import {wait} from './wait'

async function run(): Promise<void> {
  try {
    const ms: string = core.getInput('waitMilliseconds')
    if (ms) {
      core.debug(`Waiting ${ms} milliseconds ...`) // debug is only output if you set the secret `ACTIONS_STEP_DEBUG` to true

      core.debug(new Date().toTimeString())
      await wait(parseInt(ms, 10))
      core.debug(new Date().toTimeString())
    }

    const githubToken: string = core.getInput('githubToken', {
      required: true
    })
    if (!githubToken) {
      throw new Error('No github token provided!')
    }

    const onlyMergeMainForDraftPullRequests = core.getBooleanInput(
      'onlyMergeMainForDraftPullRequests'
    )

    const mainBranchName = core.getInput('mainBranchName') || 'main'
    core.debug(`Main branch name: ${mainBranchName}`)

    core.setOutput('time', new Date().toTimeString())

    const octokit = github.getOctokit(githubToken)

    const repoOwner = github.context.repo.owner
    const repo = github.context.repo.repo

    const pullRequests = await octokit.rest.pulls.list({
      owner: repoOwner,
      repo
    })

    const alwaysMergeIntoAutoMergePRs = core.getBooleanInput(
      'alwaysMergeIntoAutoMergePRs'
    )
    core.debug(`alwaysMergeIntoAutoMergePRs: ${alwaysMergeIntoAutoMergePRs}`)

    const alwaysMergeIntoAutoMergePRsWhenApproved = core.getBooleanInput(
      'alwaysMergeIntoAutoMergePRsWhenApproved'
    )
    core.debug(
      `alwaysMergeIntoAutoMergePRsWhenApproved: ${alwaysMergeIntoAutoMergePRsWhenApproved}`
    )

    const skipPullRequestsWithLabels = core
      .getInput('skipPullRequestsWithLabels')
      .split(',')
      .map(label => label.trim())
      .filter(label => label !== 'false')
    core.debug(`skipPullRequestsWithLabels: ${skipPullRequestsWithLabels}`)

    const onlyPullRequestsWithLabels = core
      .getInput('onlyPullRequestsWithLabels')
      .split(',')
      .map(label => label.trim())
      .filter(label => label !== 'false')
    core.debug(`onlyPullRequestsWithLabels: ${onlyPullRequestsWithLabels}`)

    const onlyMergeBranchesWithPrefixes = core
      .getInput('onlyMergeBranchesWithPrefixes')
      .split(',')
      .map(label => label.trim())
      .filter(label => label !== 'false')
    core.debug(
      `onlyMergeBranchesWithPrefixes setting: ${onlyMergeBranchesWithPrefixes}`
    )

    for (const pullRequest of pullRequests.data) {
      core.info(`\n\n#${pullRequest.number} - ${pullRequest.head.ref}:`)

      let shouldMergeMain = false

      const reviews = await octokit.rest.pulls.listReviews({
        owner: repoOwner,
        repo,
        pull_number: pullRequest.number
      })
      const hasOneApprovedReview =
        reviews.data.length > 0 &&
        reviews.data.some(review => review.state === 'APPROVED')

      core.info(
        hasOneApprovedReview
          ? `- has at least one review approval`
          : `- has no review approvals`
      )
      // if a PR has Auto-Merge enabled, and alwaysMergeIntoAutoMergePRs is true, then always merge in `main`
      if (alwaysMergeIntoAutoMergePRs && pullRequest.auto_merge) {
        shouldMergeMain = true
        core.info(
          `- moving forward since "alwaysMergeIntoAutoMergePRs" is enabled and #${pullRequest.number} has Auto-Merge enabled currently`
        )
      } else if (
        alwaysMergeIntoAutoMergePRsWhenApproved &&
        pullRequest.auto_merge &&
        hasOneApprovedReview
      ) {
        // DONT MERGE: fill me in
      } else {
        const labelFoundThatMeansWeShouldSkipSync = pullRequest.labels.find(
          label =>
            skipPullRequestsWithLabels.find(
              labelToSkip =>
                labelToSkip.toLowerCase() === label.name.toLowerCase()
            )
        )
        if (labelFoundThatMeansWeShouldSkipSync) {
          core.info(
            `🛑 not moving forward since #${pullRequest.number} has the label "${labelFoundThatMeansWeShouldSkipSync.name}"`
          )
          continue
        }

        const requiredLabelThatsMissing = onlyPullRequestsWithLabels.find(
          requiredLabel =>
            !pullRequest.labels.find(
              label => label.name.toLowerCase() === requiredLabel.toLowerCase()
            )
        )
        if (requiredLabelThatsMissing) {
          core.info(
            `🛑 not moving forward since #${pullRequest.number} is missing the label "${requiredLabelThatsMissing}"`
          )
          continue
        }

        if (onlyMergeBranchesWithPrefixes.length > 0) {
          const branchNameStartsWithPrefix = onlyMergeBranchesWithPrefixes.find(
            prefix =>
              pullRequest.head.ref
                .toLowerCase()
                .startsWith(prefix.toLowerCase())
          )
          if (!branchNameStartsWithPrefix) {
            core.info(
              `🛑 not moving forward since the branch for #${
                pullRequest.number
              } (${
                pullRequest.head.ref
              }) does not start with one of the required prefixes: ${JSON.stringify(
                onlyMergeBranchesWithPrefixes
              )}.`
            )
            continue
          }
        }

        if (onlyMergeMainForDraftPullRequests && !pullRequest.draft) {
          core.info(
            `🛑 not moving forward since "onlyMergeMainForDraftPullRequests" is enabled and #${pullRequest.number} (${pullRequest.head.ref}) it is NOT a draft PR`
          )
          continue
        }

        shouldMergeMain = true
      }

      if (!shouldMergeMain) {
        core.info(
          `🛑 not merging the ${mainBranchName} branch into #${pullRequest.number} (${pullRequest.head.ref})`
        )
        continue
      }

      try {
        core.info(
          `... attempting to merge ${mainBranchName} branch into head of PR #${pullRequest.number} (${pullRequest.head.ref})`
        )
        await octokit.rest.repos.merge({
          owner: repoOwner,
          repo,
          base: pullRequest.head.ref,
          head: mainBranchName
        })
        // set job status to markdown text
        core.setOutput(
          'jobStatus',
          `Merged ${mainBranchName} into ${pullRequest.head.ref}`
        )
        core.info(
          `✅ successfully merged the ${mainBranchName} branch into head of PR #${pullRequest.number} (${pullRequest.head.ref}).`
        )
      } catch (err) {
        if (err instanceof Error) {
          core.info(
            `⚠️ couldn't automatically merge in the ${mainBranchName} branch into the PR head: this is often due to a merge conflict needing resolution. Error: ${err.message}`
          )
          // We intentionally don't log this as an error because that shows up as a red X in the GitHub UI, which is confusing because it's an expected outcome
          // core.error(err)
          continue
        }
      }
    }
  } catch (error) {
    if (error instanceof Error) {
      core.error(error)
      core.setFailed(error.message)
    }
  }
}

core.info('Running Mergie...')

run()
