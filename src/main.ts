import * as core from '@actions/core'
import * as github from '@actions/github'

import {wait} from './wait'

const MainBranchName = 'main'

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

    core.setOutput('time', new Date().toTimeString())

    const octokit = github.getOctokit(githubToken)

    const repoOwner = github.context.repo.owner
    const repo = github.context.repo.repo

    const pullRequestAbridged = github.context.payload.pull_request
    if (pullRequestAbridged) {
      const pullRequest = await octokit.rest.pulls.get({
        owner: repoOwner,
        repo,
        pull_number: pullRequestAbridged.number
      })

      if (!onlyMergeMainForDraftPullRequests || pullRequest.data.draft) {
        core.info(`Merging in the main branch...`)

        await octokit.rest.repos.merge({
          owner: repoOwner,
          repo,
          base: pullRequest.data.head.ref,
          head: MainBranchName
        })
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
