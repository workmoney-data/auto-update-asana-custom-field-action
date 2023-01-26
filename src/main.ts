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
      const labelFoundThatMeansWeShouldSkipSync = pullRequest.labels.find(
        label =>
          skipPullRequestsWithLabels.find(
            labelToSkip =>
              labelToSkip.toLowerCase() === label.name.toLowerCase()
          )
      )
      if (labelFoundThatMeansWeShouldSkipSync) {
        core.info(
          `Not merging in the main branch (${mainBranchName}) into head of PR #${pullRequest.number} (${pullRequest.head.ref}) because it has the label "${labelFoundThatMeansWeShouldSkipSync.name}".`
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
          `Not merging in the main branch (${mainBranchName}) into head of PR #${pullRequest.number} (${pullRequest.head.ref}) because it is missing the label "${requiredLabelThatsMissing}".`
        )
        continue
      }

      if (onlyMergeBranchesWithPrefixes.length > 0) {
        const branchNameStartsWithPrefix = onlyMergeBranchesWithPrefixes.find(
          prefix =>
            pullRequest.head.ref.toLowerCase().startsWith(prefix.toLowerCase())
        )
        if (!branchNameStartsWithPrefix) {
          core.info(
            `Not merging in the main branch (${mainBranchName}) into head of PR #${
              pullRequest.number
            } (${
              pullRequest.head.ref
            }) because it does not start with one of the prefixes: ${JSON.stringify(
              onlyMergeBranchesWithPrefixes
            )}.`
          )
          continue
        }
      }

      if (onlyMergeMainForDraftPullRequests && !pullRequest.draft) {
        core.info(
          `Not merging in the main branch (${mainBranchName}) into head of PR #${pullRequest.number} (${pullRequest.head.ref}) because it is NOT a draft PR.`
        )
        continue
      }

      try {
        core.info(
          `Attempting merge of the main branch (${mainBranchName}) into head of PR #${pullRequest.number} (${pullRequest.head.ref})...`
        )
        await octokit.rest.repos.merge({
          owner: repoOwner,
          repo,
          base: pullRequest.head.ref,
          head: mainBranchName
        })
        core.info(
          `Successfully merged the main branch (${mainBranchName}) into head of PR #${pullRequest.number} (${pullRequest.head.ref}).`
        )
      } catch (err) {
        if (err instanceof Error) {
          core.info(
            `Couldn't automatically merge in the main branch into the PR head: this is often due to a merge conflict needing resolution. Error: ${err.message}`
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
