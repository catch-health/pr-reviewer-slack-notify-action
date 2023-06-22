import * as core from '@actions/core';
import * as github from '@actions/github';
import { fail } from '../utils/fail';
import { getPrForCommit } from '../utils/getPrForCommit';
import { getSlackMessageId } from '../utils/getSlackMessageId';
import { logger } from '../utils/logger';
import { slackWebClient } from '../utils/slackWebClient';

// will only run on push to base branch (i.e. staging), so we can assume that a closed state for PR
// equates to 'merged' (no specific event for 'merged' on PRs)
export const handleMerge = async (slackMessageId: string): Promise<void> => {
  logger.info('START handleMerge');
  try {
    const channelId = core.getInput('channel-id');
    const { commits, repository } = github.context.payload;
    const commitSha = commits[0].id;

    const pull_request = await getPrForCommit();

    if (!pull_request) {
      throw Error(`No pull_request found for commit: ${commitSha}`);
    }

    if (pull_request.state !== 'closed') {
      throw Error(`PR is not closed for commit: ${commitSha}`);
    }

    // Call the conversations.history method using the built-in WebClient
    await slackWebClient.reactions.add({
      channel: channelId,
      timestamp: slackMessageId,
      name: 'git-merged',
    });

    const mergeText = 'This PR has been merged. Deploying to Dev.';
    logger.info('START post merged message');
    await slackWebClient.chat.postMessage({
      channel: channelId,
      thread_ts: slackMessageId,
      text: mergeText,
    });
    logger.info('START get message');
    const result = await slackWebClient.conversations.history({
      channel: channelId,
      // In a more realistic app, you may store ts data in a db
      latest: slackMessageId,
      // Limit results
      inclusive: true,
      limit: 1,
    });

    // There should only be one result (stored in the zeroth index)
    const messages = result.messages! as any[];
    if (messages.length === 0) {
      return;
    }
    console.log(messages);
    const message = messages[0];
    // Print message text
    console.log(message.text);

    const text = `*MERGED:* ~${message.text}~`;

    const response = await slackWebClient.chat.update({
      channel: channelId,
      ts: slackMessageId,
      text,
      parse: 'none',
    });
    console.log(text);
    console.log(response);
    console.log(response.text);
    logger.info('END handleMerge');
    return;
  } catch (error) {
    fail(error);
    throw error;
  }
};
