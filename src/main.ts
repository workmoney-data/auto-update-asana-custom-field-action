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
    const body = github.context.payload.pull_request?.body
    if (!body) {
      core.info(`🛑 couldn't find PR body`)
      return
    }

    const asanaToken: string = core.getInput('asanaToken', {
      required: true
    })
    if (!asanaToken) {
      throw new Error(`🛑 couldn't find Asana access token`)
    }

    const mainBranchName: string = core.getInput('mainBranchName', {
      required: true
    })
    if (!asanaToken) {
      throw new Error(`🛑 main branch name must be specified`)
    }

    const taskIDs = getAsanaTaskGIDsFromText(body)
    for (const taskID of taskIDs) {
      core.info(`🎬 Attempting to update mentioned task ${taskID}`)

      const client = Asana.Client.create().useAccessToken(asanaToken)
      const task = await client.tasks.findById(taskID)
      core.info(`Task name: "${task.name}"`)

      const customFields = task.custom_fields
      core.debug(`Custom fields on task: ${JSON.stringify(customFields)}`)

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

      const statusCustomField = customFields.find(
        field => field.gid === statusFieldGID
      )
      if (!statusCustomField) {
        core.info(`🛑 didn't find status field`)
        continue
      }
      await client.tasks.update(taskID, {
        custom_fields: {
          // GID of the "📖 In Code Review" option
          [statusFieldGID]: '316679932150690'
        }
      })
    }
  } catch (error) {
    if (error instanceof Error) {
      core.error(error)
      core.setFailed(error.message)
      console.error(JSON.stringify(error))
    }
  }
}

core.info('Running...')

run()
