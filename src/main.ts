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

    const githubToken: string = core.getInput('githubToken')
    if (!githubToken) {
      throw new Error('No github token provided')
    }

    const onlyMergeMainForDraftPullRequests = core.getBooleanInput(
      'onlyMergeMainForDraftPullRequests'
    )

    const mainBranchName = core.getInput('mainBranchName') || 'main'

    core.setOutput('time', new Date().toTimeString())

    const octokit = github.getOctokit(githubToken)

    const repoOwner = github.context.repo.owner
    const repo = github.context.repo.repo

    const pullRequests = await octokit.rest.pulls.list({
      owner: repoOwner,
      repo
    })

    for (const pullRequest of pullRequests.data) {
      if (
        pullRequest.labels.find(
          label => label.name.toLowerCase() === 'dont_update'
        )
      ) {
        core.info(
          `Not merging in the main branch (${mainBranchName}) into head of PR #${pullRequest.number} (${pullRequest.head.ref}) because it has the label "dont_update".`
        )
        continue
      }

      if (onlyMergeMainForDraftPullRequests && !pullRequest.draft) {
        core.info(
          `Not merging in the main branch (${mainBranchName}) into head of PR #${pullRequest.number} (${pullRequest.head.ref}) because it is a draft PR.`
        )
        continue
      }

      core.info(
        `Merging in the main branch (${mainBranchName}) into head of PR #${pullRequest.number} (${pullRequest.head.ref})...`
      )
      await octokit.rest.repos.merge({
        owner: repoOwner,
        repo,
        base: pullRequest.head.ref,
        head: mainBranchName
      })
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
