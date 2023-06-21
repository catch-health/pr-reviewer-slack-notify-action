import * as github from '@actions/github';
import * as core from '@actions/core';
import { createInitialMessage } from './actions/createInitialMessage';
import { handleLabelChange } from './actions/handleLabelChange';
import { getSlackMessageId } from './utils/getSlackMessageId';
import { handleMerge } from './actions/handleMerge';
import { handleCommitPush } from './actions/handleCommitPush';
import { handlePullRequestReview } from './actions/handlePullRequestReview';
import { handleReRequest } from './actions/handleReRequest';

const run = async (): Promise<void> => {
  const { eventName, payload, ref } = github.context;
  const baseBranch = core.getInput('base-branch');
  const isActingOnBaseBranch = ref.includes(baseBranch);

  let hasQuietLabel = false;
  const pull_request = payload.pull_request;

  const ignoreDraft = core.getInput('ignore-draft-prs');
  const silenceQuiet = core.getInput('silence-on-quiet-label');

  // need to prevent unhandled errors here
  if (pull_request) {
    for (const label of pull_request.labels) {
      if (label.name === 'quiet') {
        hasQuietLabel = true;
        break;
      }
    }

    const isWip = pull_request && pull_request['draft'] && ignoreDraft;

    // Don't do anything if this is a draft or we tell it to shut up
    if (isWip || (hasQuietLabel && silenceQuiet)) return;
  }

  const slackMessageId = await getSlackMessageId();

  // route to the appropriate action
  if (eventName === 'pull_request') {
    if (payload.action === 'opened' || payload.action === 'ready_for_review') {
      console.log('running createInitialMessage::: ', payload);
      if (!slackMessageId) {
        await createInitialMessage();
      }
      return;
    }

    if (payload.action === 'review_requested') {
      console.log('running handleReRequest::: ', payload);
      if (slackMessageId != null) {
        await handleReRequest();
      } else {
        await createInitialMessage();
      }
      return;
    }

    // notify thread of a PR label change
    if (payload.action === 'labeled' || payload.action === 'unlabeled') {
      console.log('running handleLabelChange::: ', payload);

      await handleLabelChange();
      return;
    }
  }

  // reduce spamming channels by adding a message if one didn't get created somehow

  if (!slackMessageId) {
    await createInitialMessage();
    return;
  }

  // push of commit / review dismissed
  if (
    eventName === 'push' ||
    (eventName === 'pull_request_review' && payload.action === 'dismissed')
  ) {
    // merge of PR to base branch
    if (isActingOnBaseBranch) {
      console.log('running handleMerge::: ', payload);

      await handleMerge(slackMessageId);
      return;
    }

    console.log('running handleCommitPush::: ', payload);

    await handleCommitPush();
    return;
  }

  // a review has been submitted
  if (eventName === 'pull_request_review') {
    console.log('running handlePullRequestReview::: ', payload);

    await handlePullRequestReview();
    return;
  }
};

run();
