import * as core from '@actions/core';
import * as github from '@actions/github';
import { Octokit } from '@octokit/rest';
import * as asana from 'asana';
import { getAsanaTaskGIDsFromText } from './getAsanaTaskGIDsFromText';

const githubToken: string = core.getInput('githubToken', { required: false });
if (!githubToken) {
  core.info(`ℹ️ GitHub token not provided, skipping PR details fetch`);
}

const octokit = new Octokit({ auth: githubToken });

const setStatusFieldvalueForAsanaTask = async ({
  fieldValue,
  taskID,
  client,
  statusCustomField,
}: {
  fieldValue: string;
  taskID: string;
  client: asana.Client;
  statusCustomField: asana.resources.CustomField;
}): Promise<{ didSetStatus: boolean }> => {
  core.info(`✍️ attempting to update status to ${fieldValue}`);
  const enumOption = statusCustomField.enum_options?.find((option) => option.name === fieldValue);
  if (!enumOption) {
    core.info(
      `🛑 didn't find enum option called ${fieldValue} on status field ${JSON.stringify(
        statusCustomField
      )} for this task`
    );
    return { didSetStatus: false };
  }
  await client.tasks.updateTask(taskID, {
    custom_fields: {
      [statusCustomField.gid]: enumOption.gid,
    },
  });
  core.info(`✅ status updated to ${fieldValue}`);
  return { didSetStatus: true };
};

const dontUpdateStatusFieldWhenReviewIsApprovedIfStatusFieldValueIsCurrentlyOneOf: string[] = core
  .getInput('dontUpdateStatusFieldWhenReviewIsApprovedIfStatusFieldValueIsCurrentlyOneOf')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

export async function run(): Promise<void> {
  try {
    core.info(`Triggered by event name: ${github.context.eventName}`);

    const mainBranchName: string = core.getInput('mainBranchName', {
      required: true,
    });
    if (!mainBranchName) {
      throw new Error(`🛑 main branch name must be specified`);
    }

    const asanaToken: string = core.getInput('asanaToken', {
      required: true,
    });
    if (!asanaToken) {
      throw new Error(`🛑 couldn't find Asana access token`);
    }
    const headIsMainBranch = github.context.ref === `refs/heads/${mainBranchName}`;
    const triggerIsPushToMain =
      github.context.eventName === 'push' && github.context.ref === `refs/heads/${mainBranchName}`;

    const triggerIsPullRequest =
      github.context.eventName === 'pull_request' ||
      github.context.eventName === 'pull_request_review';


    const prDescriptionInput = core.getInput("pull-request-description");
    const body =
      prDescriptionInput ?? github.context.payload.pull_request?.body ?? github.context.payload.commits?.[0]?.message;
    core.info(`prDescriptionInput: ${prDescriptionInput}`);
    if (!body) {
      // core.info(`ℹ️ github.context: ${JSON.stringify(github.context)}`);
      core.info(
        `ℹ️ github.context.payload.pull_request: ${JSON.stringify(
          github.context.payload.pull_request,
          null,
          2
        )}`
      );
      core.info(`🛑 couldn't find PR body`);
      return;
    }

    const statusFieldName: string = core.getInput('statusFieldName');
    const statusFieldValueWhenPRReadyForReviewIsOpen: string = core.getInput(
      'statusFieldValueWhenPRReadyForReviewIsOpen'
    );
    const statusFieldValueWhenDraftPRIsOpen: string = core.getInput(
      'statusFieldValueWhenDraftPRIsOpen'
    );
    const statusFieldValueForMergedCommitToMain: string = core.getInput(
      'statusFieldValueForMergedCommitToMain'
    );
    const statusFieldValueWhenPRReadyForReviewIsApproved: string = core.getInput(
      'statusFieldValueWhenPRReadyForReviewIsApproved'
    );
    const skipSettingStatusForPRReadyForReviewIsApprovedIfLabeledWith: string[] = core
      .getInput('skipSettingStatusForPRReadyForReviewIsApprovedIfLabeledWith')
      .split(',')
      .map((label) => label.trim())
      .filter(Boolean);
    const labelToApplyToPRWhenApproved: string = core.getInput('labelToApplyToPRWhenApproved');

    const taskIDs = getAsanaTaskGIDsFromText(body);
    for (const taskID of taskIDs) {
      core.info(`🎬 Attempting to update mentioned task ${taskID}`);

      const client = asana.Client.create().useAccessToken(asanaToken);
      const task = await client.tasks.getTask(taskID);
      core.info(`Task name: "${task.name}"`);

      const customFields = task.custom_fields;
      core.debug(`Custom fields on task: ${JSON.stringify(customFields)}`);

      if (!statusFieldName) {
        core.info(`🛑 statusFieldName not specified, so we won't be updating any status field`);
        continue;
      }

      const statusCustomField = customFields.find((field) => field.name === statusFieldName);
      if (!statusCustomField) {
        core.info(`🛑 didn't find status field called ${statusFieldName} on this task`);
        continue;
      }

      let fieldValue = '';
      let shouldSkipUpdatingStatusField = false;

      if (
        // this is expected to run upon PRs being opened or reopened
        triggerIsPullRequest
      ) {
        core.info(`🔍 triggerIsPullRequest`);
        const prNumber = github.context.payload.pull_request?.number;
        if (!prNumber) {
          core.info(`🛑 couldn't find PR number`);
          return;
        }

        const prResponse = await octokit.pulls.get({
          owner: github.context.repo.owner,
          repo: github.context.repo.repo,
          pull_number: prNumber,
        });
        const pr = prResponse.data;

        const isMerged = !!pr?.merged_at;

        const reviewsResponse = await octokit.pulls.listReviews({
          owner: github.context.repo.owner,
          repo: github.context.repo.repo,
          pull_number: prNumber,
        });
        const reviews = reviewsResponse.data;

        const latestReviewByEachReviewer = (reviews ?? []).reduce(
          (acc, review) => {
            if (!review.user) {
              return acc;
            }
            acc[review.user.login] = review;
            return acc;
          },
          {} as Record<string, (typeof reviews)[number]>
        );
        core.info(`🔍 latestReviewByEachReviewer: ${JSON.stringify(latestReviewByEachReviewer)}`);

        const isApproved =
          Object.values(latestReviewByEachReviewer || {}).some(
            (review) => review.state === 'APPROVED'
          ) ?? false;
        const isReadyForReview = pr ? !pr.draft : true; // Assume ready for review if PR details not available
        const hasSkipSettingStatusForPRApprovedLabel =
          pr?.labels?.some((label) =>
            skipSettingStatusForPRReadyForReviewIsApprovedIfLabeledWith.includes(label.name)
          ) ?? false;

        core.info(`🔍 isApproved: ${isApproved}`);
        core.info(`🔍 isReadyForReview: ${isReadyForReview}`);
        core.info(
          `🔍 hasSkipSettingStatusForPRApprovedLabel: ${hasSkipSettingStatusForPRApprovedLabel}`
        );
        core.info(
          `🔍 statusFieldValueWhenPRReadyForReviewIsApproved: ${statusFieldValueWhenPRReadyForReviewIsApproved}`
        );

        if (isApproved && isReadyForReview && !isMerged) {
          core.info(`🔍 Checking if current status field value allows update`);

          // Fetch the current status field value
          const currentStatusFieldValue = statusCustomField.display_value || '';

          core.info(`🔍 Current status field value: "${currentStatusFieldValue}"`);

          // Check if the current value is in the skip list
          shouldSkipUpdatingStatusField =
            dontUpdateStatusFieldWhenReviewIsApprovedIfStatusFieldValueIsCurrentlyOneOf.includes(
              currentStatusFieldValue
            );

          if (shouldSkipUpdatingStatusField) {
            core.info(
              `🛑 Current status field value "${currentStatusFieldValue}" is in the skip list. Skipping status update.`
            );
          } else {
            fieldValue = statusFieldValueWhenPRReadyForReviewIsApproved;
            core.info(`🔍 fieldValue set to: ${fieldValue}`);

            // Apply label if specified
            if (labelToApplyToPRWhenApproved) {
              await octokit.issues.addLabels({
                owner: github.context.repo.owner,
                repo: github.context.repo.repo,
                issue_number: prNumber,
                labels: [labelToApplyToPRWhenApproved],
              });
            }
          }
        } else if (pr?.draft && statusFieldValueWhenDraftPRIsOpen) {
          fieldValue = statusFieldValueWhenDraftPRIsOpen;
          core.info(`🔍 fieldValue set to: ${fieldValue}`);
        } else if (isMerged && headIsMainBranch && statusFieldValueForMergedCommitToMain) {
          // updated this to check if the PR is merged and the head branch is the main branch.
          fieldValue = statusFieldValueForMergedCommitToMain;
          core.info(`🔍 fieldValue set to: ${fieldValue}`);
        } else if (statusFieldValueWhenPRReadyForReviewIsOpen) {
          fieldValue = statusFieldValueWhenPRReadyForReviewIsOpen;
          core.info(`🔍 fieldValue set to: ${fieldValue}`);
        }
      } else if (
        // this is expected to run on pushes to `main` (aka a merged pull request)
        triggerIsPushToMain &&
        statusFieldValueForMergedCommitToMain
      ) {
        core.info(`🔍 triggerIsPushToMain`);
        fieldValue = statusFieldValueForMergedCommitToMain;
        core.info(`🔍 fieldValue set to: ${fieldValue}`);
      }

      if (fieldValue && !shouldSkipUpdatingStatusField) {
        await setStatusFieldvalueForAsanaTask({
          fieldValue,
          taskID,
          client,
          statusCustomField,
        });
        core.setOutput('didSetStatus', 'true');
        core.setOutput('statusFieldValue', fieldValue);
      } else {
        core.setOutput('didSetStatus', 'false');
      }
    }
  } catch (error) {
    if (error instanceof Error) {
      core.error(error);
      core.setFailed(error.message);
    }
  }
}

core.info('Running...');

run();
