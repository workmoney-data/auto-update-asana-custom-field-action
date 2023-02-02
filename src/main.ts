import * as Asana from 'asana'
import * as core from '@actions/core'
import * as github from '@actions/github'

const statusFieldGID = '257694800786854'

// getAsanaTaskGIDsFromText function copied from /diffy-mcdiffface/functions/updatePRBodyWithAsanaTaskURLs.ts
function getAsanaTaskGIDsFromText(text: string): string[] {
  const asanaTaskGIDsInBodySorted = text
    .split('\r\n')
    .flatMap(line => line.split('\n'))
    .flatMap(line => {
      const match = line.match(
        /https:\/\/app.asana.com(?:\/(?:[0-9]+|board|search|inbox))+(?:\/(?<taskGID>[0-9]+))+/
      )
      if (!match) {
        return []
      }
      const {taskGID} = match.groups as {taskGID: string}
      return taskGID
    })
    .sort((a, b) => a.localeCompare(b))

  const allUniqueAsanaGIDsSorted = Array.from(
    new Set([...asanaTaskGIDsInBodySorted])
  ).sort((a, b) => a.localeCompare(b))

  let noNewAsanaGIDs = true
  if (allUniqueAsanaGIDsSorted.length === asanaTaskGIDsInBodySorted.length) {
    for (let i = 0; i < allUniqueAsanaGIDsSorted.length; i++) {
      const a = allUniqueAsanaGIDsSorted[i]
      const b = asanaTaskGIDsInBodySorted[i]
      if (a !== b) {
        noNewAsanaGIDs = false
        break
      }
    }
  }

  return allUniqueAsanaGIDsSorted
}

async function run(): Promise<void> {
  try {
    core.info(`Triggered by event name: ${github.context.eventName}`)

    const mainBranchName: string = core.getInput('mainBranchName', {
      required: true
    })
    if (!mainBranchName) {
      throw new Error(`🛑 main branch name must be specified`)
    }

    const asanaToken: string = core.getInput('asanaToken', {
      required: true
    })
    if (!asanaToken) {
      throw new Error(`🛑 couldn't find Asana access token`)
    }
    const triggerIsPushToMain =
      github.context.eventName === 'push' &&
      github.context.ref === `refs/heads/${mainBranchName}`

    const triggerIsPullRequest = github.context.eventName === 'pull_request'

    const body = triggerIsPullRequest
      ? github.context.payload.pull_request?.body
      : github.context.payload.commits?.[0]?.message
    if (!body) {
      core.info(`🛑 couldn't find PR body`)
      return
    }

    const statusFieldName: string = core.getInput('statusFieldName')
    const statusFieldValueWhenPRReadyForReviewIsOpen: string = core.getInput(
      'statusFieldValueWhenPRReadyForReviewIsOpen'
    )
    const statusFieldValueWhenDraftPRIsOpen: string = core.getInput(
      'statusFieldValueWhenDraftPRIsOpen'
    )
    const statusFieldValueForMergedCommitToMain: string = core.getInput(
      'statusFieldValueForMergedCommitToMain'
    )

    const taskIDs = getAsanaTaskGIDsFromText(body)
    for (const taskID of taskIDs) {
      core.info(`🎬 Attempting to update mentioned task ${taskID}`)

      const client = Asana.Client.create().useAccessToken(asanaToken)
      const task = await client.tasks.findById(taskID)
      core.info(`Task name: "${task.name}"`)

      const customFields = task.custom_fields
      core.debug(`Custom fields on task: ${JSON.stringify(customFields)}`)

      // the format of customFields is:
      // [
      //   {
      //     gid: '1199185787854818',
      //     enabled: true,
      //     enum_options: [
      //       {
      //         gid: '1201498974322684',
      //         color: 'green',
      //         enabled: true,
      //         name: 'Tiny (< 0.5)',
      //         resource_type: 'enum_option'
      //       },
      //       {
      //         gid: '1199185787854819',
      //         color: 'yellow-green',
      //         enabled: true,
      //         name: 'Small (0.5)',
      //         resource_type: 'enum_option'
      //       },
      //       {
      //         gid: '1199185787854820',
      //         color: 'yellow-orange',
      //         enabled: true,
      //         name: 'Medium (1)',
      //         resource_type: 'enum_option'
      //       },
      //       {
      //         gid: '1199185787854821',
      //         color: 'orange',
      //         enabled: true,
      //         name: 'Large (3)',
      //         resource_type: 'enum_option'
      //       },
      //       {
      //         gid: '1200635321982997',
      //         color: 'purple',
      //         enabled: true,
      //         name: 'Unknown (?)',
      //         resource_type: 'enum_option'
      //       }
      //     ],
      //     enum_value: {
      //       gid: '1199185787854819',
      //       color: 'yellow-green',
      //       enabled: true,
      //       name: 'Small (0.5)',
      //       resource_type: 'enum_option'
      //     },
      //     name: 'Task Size',
      //     description: '',
      //     created_by: {
      //       gid: '7423375371225',
      //       name: 'Kunal Jham',
      //       resource_type: 'user'
      //     },
      //     display_value: 'Small (0.5)',
      //     resource_subtype: 'enum',
      //     resource_type: 'custom_field',
      //     type: 'enum'
      //   },
      //   {
      //     gid: '257694800786854',
      //     enabled: true,
      //     enum_options: [
      //       {
      //         gid: '316679932150687',
      //         color: 'red',
      //         enabled: true,
      //         name: '⛔️ Blocked',
      //         resource_type: 'enum_option'
      //       },
      //       {
      //         gid: '337934556375517',
      //         color: 'blue',
      //         enabled: true,
      //         name: '✏️ In Development',
      //         resource_type: 'enum_option'
      //       },
      //       {
      //         gid: '316679932150689',
      //         color: 'yellow',
      //         enabled: true,
      //         name: '⏸ Paused',
      //         resource_type: 'enum_option'
      //       },
      //       {
      //         gid: '316679932150690',
      //         color: 'green',
      //         enabled: true,
      //         name: '📖 In Code Review',
      //         resource_type: 'enum_option'
      //       },
      //       {
      //         gid: '1203202062692552',
      //         color: 'orange',
      //         enabled: true,
      //         name: '🫱 Not Started',
      //         resource_type: 'enum_option'
      //       },
      //       {
      //         gid: '1203204719175103',
      //         color: 'yellow-green',
      //         enabled: true,
      //         name: '🤞Testing',
      //         resource_type: 'enum_option'
      //       },
      //       {
      //         gid: '1203228454200302',
      //         color: 'yellow-orange',
      //         enabled: true,
      //         name: '🏁 Ready to merge',
      //         resource_type: 'enum_option'
      //       },
      //       {
      //         gid: '1203276499178630',
      //         color: 'blue-green',
      //         enabled: true,
      //         name: '🚀 Shipped',
      //         resource_type: 'enum_option'
      //       },
      //       {
      //         gid: '1203277864039331',
      //         color: 'aqua',
      //         enabled: true,
      //         name: 'ᛦ Merged ',
      //         resource_type: 'enum_option'
      //       }
      //     ],
      //     enum_value: {
      //       gid: '316679932150690',
      //       color: 'green',
      //       enabled: true,
      //       name: '📖 In Code Review',
      //       resource_type: 'enum_option'
      //     },
      //     name: 'Status',
      //     description: '',
      //     created_by: {
      //       gid: '983844366067368',
      //       name: 'Kaleigh Yang',
      //       resource_type: 'user'
      //     },
      //     display_value: '📖 In Code Review',
      //     resource_subtype: 'enum',
      //     resource_type: 'custom_field',
      //     type: 'enum'
      //   }
      // ]

      // uncomment this to get the GIDs of the custom fields' values
      // core.debug(
      //   `Custom fields on task: ${JSON.stringify(customFields[1].enum_options)}`
      // )

      // these are the possible values for the `status` custom field
      // [
      //   {
      //     gid: '316679932150687',
      //     color: 'red',
      //     enabled: true,
      //     name: '⛔️ Blocked',
      //     resource_type: 'enum_option'
      //   },
      //   {
      //     gid: '337934556375517',
      //     color: 'blue',
      //     enabled: true,
      //     name: '✏️ In Development',
      //     resource_type: 'enum_option'
      //   },
      //   {
      //     gid: '316679932150689',
      //     color: 'yellow',
      //     enabled: true,
      //     name: '⏸ Paused',
      //     resource_type: 'enum_option'
      //   },
      //   {
      //     gid: '316679932150690',
      //     color: 'green',
      //     enabled: true,
      //     name: '📖 In Code Review',
      //     resource_type: 'enum_option'
      //   },
      //   {
      //     gid: '1203202062692552',
      //     color: 'orange',
      //     enabled: true,
      //     name: '🫱 Not Started',
      //     resource_type: 'enum_option'
      //   },
      //   {
      //     gid: '1203204719175103',
      //     color: 'yellow-green',
      //     enabled: true,
      //     name: '🤞Testing',
      //     resource_type: 'enum_option'
      //   },
      //   {
      //     gid: '1203228454200302',
      //     color: 'yellow-orange',
      //     enabled: true,
      //     name: '🏁 Ready to merge',
      //     resource_type: 'enum_option'
      //   },
      //   {
      //     gid: '1203276499178630',
      //     color: 'blue-green',
      //     enabled: true,
      //     name: '🚀 Shipped',
      //     resource_type: 'enum_option'
      //   },
      //   {
      //     gid: '1203277864039331',
      //     color: 'aqua',
      //     enabled: true,
      //     name: 'ᛦ Merged ',
      //     resource_type: 'enum_option'
      //   }
      // ]

      if (!statusFieldName) {
        core.info(
          `🛑 statusFieldName not specified, so we won't be updating any status field`
        )
        continue
      }

      const statusCustomField = customFields.find(
        field => field.name === statusFieldName
      )
      if (!statusCustomField) {
        core.info(
          `🛑 didn't find status field called ${statusFieldName} on this task`
        )
        continue
      }

      const setStatus = async ({
        fieldValue
      }: {
        fieldValue: string
      }): Promise<{didSetStatus: boolean}> => {
        core.info(`✏️ attempting to update status to ${fieldValue}`)
        const enumOption = statusCustomField.enum_options?.find(
          option => option.name === fieldValue
        )
        if (!enumOption) {
          core.info(
            `🛑 didn't find enum option called ${fieldValue} on status field ${JSON.stringify(
              statusCustomField
            )} for this task`
          )
          return {didSetStatus: false}
        }
        await client.tasks.update(taskID, {
          custom_fields: {
            // GID of the "📖 In Code Review" option
            [statusCustomField.gid]: enumOption.gid
          }
        })
        core.info(`✅ status updated to ${fieldValue}`)
        return {didSetStatus: true}
      }

      if (
        // this is expected to run upon PRs being opened or reopened
        triggerIsPullRequest
      ) {
        if (
          github.context.payload.pull_request?.draft &&
          statusFieldValueWhenDraftPRIsOpen
        ) {
          await setStatus({fieldValue: statusFieldValueWhenDraftPRIsOpen})
        } else if (statusFieldValueWhenPRReadyForReviewIsOpen) {
          await setStatus({
            fieldValue: statusFieldValueWhenPRReadyForReviewIsOpen
          })
        }
      } else if (
        // this is expected to run on pushes to `main` (aka a merged pull request)
        triggerIsPushToMain &&
        statusFieldValueForMergedCommitToMain
      ) {
        await setStatus({
          fieldValue: statusFieldValueForMergedCommitToMain
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

core.info('Running...')

run()
