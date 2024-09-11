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
    const triggerIsPushToMain =
      github.context.eventName === 'push' && github.context.ref === `refs/heads/${mainBranchName}`;

    const triggerIsPullRequest = github.context.eventName === 'pull_request';

    const body =
      github.context.payload.pull_request?.body ?? github.context.payload.commits?.[0]?.message;
    if (!body) {
      core.info(`ℹ️ github.context: ${JSON.stringify(github.context)}`);
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

        interface PullRequest {
          reviews?: Array<{ state: string }>;
          draft?: boolean;
          labels?: Array<{ name: string }>;
        }

        let pr: PullRequest | null = null;

        // Fetch PR details
        const prData = await octokit.pulls.get({
          owner: github.context.repo.owner,
          repo: github.context.repo.repo,
          pull_number: prNumber,
        });
        pr = prData.data;

        // Fetch PR reviews
        const reviewsData = await octokit.pulls.listReviews({
          owner: github.context.repo.owner,
          repo: github.context.repo.repo,
          pull_number: prNumber,
        });
        const reviews = reviewsData.data;

        const latestReviews = (reviews ?? []).reduce((acc, review) => {
          if (!review.user) {
            return acc;
          }
          acc[review.user.login] = review;
          return acc;
        }, {} as Record<string, typeof reviews[number]>);

        const latestReviewsArray = Object.values(latestReviews || {});
        core.info(`🔍 latestReviewsArray: ${JSON.stringify(latestReviewsArray)}`);

        const isApproved =
          latestReviewsArray.some((review) => review.state === 'APPROVED') ?? false;
        const isReadyForReview = pr ? !pr.draft : true; // Assume ready for review if PR details not available
        const hasSkipLabel =
          pr?.labels?.some((label) =>
            skipSettingStatusForPRReadyForReviewIsApprovedIfLabeledWith.includes(label.name)
          ) ?? false;

        core.info(`🔍 isApproved: ${isApproved}`);
        core.info(`🔍 isReadyForReview: ${isReadyForReview}`);
        core.info(`🔍 hasSkipLabel: ${hasSkipLabel}`);
        core.info(
          `🔍 statusFieldValueWhenPRReadyForReviewIsApproved: ${statusFieldValueWhenPRReadyForReviewIsApproved}`
        );

        if (
          isApproved &&
          isReadyForReview &&
          statusFieldValueWhenPRReadyForReviewIsApproved &&
          !hasSkipLabel
        ) {
          await setStatusFieldvalueForAsanaTask({
            fieldValue: statusFieldValueWhenPRReadyForReviewIsApproved,
            taskID,
            client,
            statusCustomField,
          });
        } else if (pr?.draft && statusFieldValueWhenDraftPRIsOpen) {
          await setStatusFieldvalueForAsanaTask({
            fieldValue: statusFieldValueWhenDraftPRIsOpen,
            taskID,
            client,
            statusCustomField,
          });
        } else if (statusFieldValueWhenPRReadyForReviewIsOpen) {
          await setStatusFieldvalueForAsanaTask({
            fieldValue: statusFieldValueWhenPRReadyForReviewIsOpen,
            taskID,
            client,
            statusCustomField,
          });
        }
      } else if (
        // this is expected to run on pushes to `main` (aka a merged pull request)
        triggerIsPushToMain &&
        statusFieldValueForMergedCommitToMain
      ) {
        core.info(`🔍 triggerIsPushToMain`);
        await setStatusFieldvalueForAsanaTask({
          fieldValue: statusFieldValueForMergedCommitToMain,
          taskID,
          client,
          statusCustomField,
        });
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
