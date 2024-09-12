"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.run = void 0;
const core = __importStar(require("@actions/core"));
const github = __importStar(require("@actions/github"));
const rest_1 = require("@octokit/rest");
const asana = __importStar(require("asana"));
const getAsanaTaskGIDsFromText_1 = require("./getAsanaTaskGIDsFromText");
const githubToken = core.getInput('githubToken', { required: false });
if (!githubToken) {
    core.info(`ℹ️ GitHub token not provided, skipping PR details fetch`);
}
const octokit = new rest_1.Octokit({ auth: githubToken });
const setStatusFieldvalueForAsanaTask = async ({ fieldValue, taskID, client, statusCustomField, }) => {
    core.info(`✍️ attempting to update status to ${fieldValue}`);
    const enumOption = statusCustomField.enum_options?.find((option) => option.name === fieldValue);
    if (!enumOption) {
        core.info(`🛑 didn't find enum option called ${fieldValue} on status field ${JSON.stringify(statusCustomField)} for this task`);
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
async function run() {
    try {
        core.info(`Triggered by event name: ${github.context.eventName}`);
        const mainBranchName = core.getInput('mainBranchName', {
            required: true,
        });
        if (!mainBranchName) {
            throw new Error(`🛑 main branch name must be specified`);
        }
        const asanaToken = core.getInput('asanaToken', {
            required: true,
        });
        if (!asanaToken) {
            throw new Error(`🛑 couldn't find Asana access token`);
        }
        const triggerIsPushToMain = github.context.eventName === 'push' && github.context.ref === `refs/heads/${mainBranchName}`;
        const triggerIsPullRequest = github.context.eventName === 'pull_request';
        const body = github.context.payload.pull_request?.body ?? github.context.payload.commits?.[0]?.message;
        if (!body) {
            // core.info(`ℹ️ github.context: ${JSON.stringify(github.context)}`);
            core.info(`ℹ️ github.context.payload.pull_request: ${JSON.stringify(github.context.payload.pull_request, null, 2)}`);
            core.info(`🛑 couldn't find PR body`);
            return;
        }
        const statusFieldName = core.getInput('statusFieldName');
        const statusFieldValueWhenPRReadyForReviewIsOpen = core.getInput('statusFieldValueWhenPRReadyForReviewIsOpen');
        const statusFieldValueWhenDraftPRIsOpen = core.getInput('statusFieldValueWhenDraftPRIsOpen');
        const statusFieldValueForMergedCommitToMain = core.getInput('statusFieldValueForMergedCommitToMain');
        const statusFieldValueWhenPRReadyForReviewIsApproved = core.getInput('statusFieldValueWhenPRReadyForReviewIsApproved');
        const skipSettingStatusForPRReadyForReviewIsApprovedIfLabeledWith = core
            .getInput('skipSettingStatusForPRReadyForReviewIsApprovedIfLabeledWith')
            .split(',')
            .map((label) => label.trim())
            .filter(Boolean);
        const labelToApplyToPRWhenApproved = core.getInput('labelToApplyToPRWhenApproved');
        const taskIDs = (0, getAsanaTaskGIDsFromText_1.getAsanaTaskGIDsFromText)(body);
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
            triggerIsPullRequest) {
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
                if (isMerged) {
                    core.info(`🔍 PR is merged, returning early`);
                    return;
                }
                const reviewsResponse = await octokit.pulls.listReviews({
                    owner: github.context.repo.owner,
                    repo: github.context.repo.repo,
                    pull_number: prNumber,
                });
                const reviews = reviewsResponse.data;
                const latestReviews = (reviews ?? []).reduce((acc, review) => {
                    if (!review.user) {
                        return acc;
                    }
                    acc[review.user.login] = review;
                    return acc;
                }, {});
                const latestReviewsArray = Object.values(latestReviews || {});
                core.info(`🔍 latestReviewsArray: ${JSON.stringify(latestReviewsArray)}`);
                const isApproved = latestReviewsArray.some((review) => review.state === 'APPROVED') ?? false;
                const isReadyForReview = pr ? !pr.draft : true; // Assume ready for review if PR details not available
                const hasSkipSettingStatusForPRApprovedLabel = pr?.labels?.some((label) => skipSettingStatusForPRReadyForReviewIsApprovedIfLabeledWith.includes(label.name)) ?? false;
                core.info(`🔍 isApproved: ${isApproved}`);
                core.info(`🔍 isReadyForReview: ${isReadyForReview}`);
                core.info(`🔍 hasSkipSettingStatusForPRApprovedLabel: ${hasSkipSettingStatusForPRApprovedLabel}`);
                core.info(`🔍 statusFieldValueWhenPRReadyForReviewIsApproved: ${statusFieldValueWhenPRReadyForReviewIsApproved}`);
                if (isApproved && isReadyForReview) {
                    if (skipSettingStatusForPRReadyForReviewIsApprovedIfLabeledWith.length > 0 &&
                        !hasSkipSettingStatusForPRApprovedLabel) {
                        await setStatusFieldvalueForAsanaTask({
                            fieldValue: statusFieldValueWhenPRReadyForReviewIsApproved,
                            taskID,
                            client,
                            statusCustomField,
                        });
                    }
                    if (labelToApplyToPRWhenApproved) {
                        await octokit.issues.addLabels({
                            owner: github.context.repo.owner,
                            repo: github.context.repo.repo,
                            issue_number: prNumber,
                            labels: [labelToApplyToPRWhenApproved],
                        });
                    }
                }
                else if (pr?.draft && statusFieldValueWhenDraftPRIsOpen) {
                    await setStatusFieldvalueForAsanaTask({
                        fieldValue: statusFieldValueWhenDraftPRIsOpen,
                        taskID,
                        client,
                        statusCustomField,
                    });
                }
                else if (statusFieldValueWhenPRReadyForReviewIsOpen) {
                    await setStatusFieldvalueForAsanaTask({
                        fieldValue: statusFieldValueWhenPRReadyForReviewIsOpen,
                        taskID,
                        client,
                        statusCustomField,
                    });
                }
            }
            else if (
            // this is expected to run on pushes to `main` (aka a merged pull request)
            triggerIsPushToMain &&
                statusFieldValueForMergedCommitToMain) {
                core.info(`🔍 triggerIsPushToMain`);
                await setStatusFieldvalueForAsanaTask({
                    fieldValue: statusFieldValueForMergedCommitToMain,
                    taskID,
                    client,
                    statusCustomField,
                });
            }
        }
    }
    catch (error) {
        if (error instanceof Error) {
            core.error(error);
            core.setFailed(error.message);
        }
    }
}
exports.run = run;
core.info('Running...');
run();
