import * as core from '@actions/core';
import * as github from '@actions/github';
import { clearReactions } from '../utils/clearReactions';
import { createUsersToAtString } from '../utils/createUsersToAtString';
import { fail } from '../utils/fail';
import { getPrForCommit } from '../utils/getPrForCommit';
import { getSlackMessageId } from '../utils/getSlackMessageId';
import { logger } from '../utils/logger';
import { slackWebClient } from '../utils/slackWebClient';

export const handleReRequest = async (): Promise<void> => {
  const verbose: boolean = core.getBooleanInput('verbose');
  logger.info(`START handleReRequest. Verbose? ${verbose}`);
  try {
    const channelId = core.getInput('channel-id');
    const { repository } = github.context.payload;
    logger.info('about to get PR for commit');
    const pull_request = await getPrForCommit();
    logger.info({ pull_request, repository });
    if (!pull_request || !repository) return;

    const requestedReviewers = pull_request.requested_reviewers
      ? pull_request.requested_reviewers.map((user: any) => user.login)
      : [];
    const requestedTeamsReviewers = pull_request.requested_teams
      ? pull_request.requested_teams.map((team: any) => team.id)
      : [];
    logger.info({ requestedReviewers, requestedTeamsReviewers });
    //
    // ─── RETURN IF THERE ARE NO REQUESTED REVIEWERS ──────────────────
    //

    if (requestedReviewers.length + requestedTeamsReviewers.length === 0) {
      return;
    }
    //
    // ─── GET THE ISSUE NUMBER FOR THE COMMIT ─────────────────────────
    //

    const slackMessageId = await getSlackMessageId();
    if (!slackMessageId) {
      return;
    }

    let baseMessage = `*${pull_request.user?.login}* is requesting your review on <${pull_request._links.html.href}|*${pull_request.title}*>`;
    if (!!pull_request.body && verbose) {
      baseMessage = `${baseMessage}\n>${pull_request.body}`;
    }

    // build users to mention string
    const usersToAtString = await createUsersToAtString([
      ...requestedReviewers,
      ...requestedTeamsReviewers,
    ]);

    // DOCS https://api.slack.com/methods/chat.postMessage
    const text = `${usersToAtString} ${baseMessage}`;

    const threadUpdateRes = await slackWebClient.chat.postMessage({
      channel: channelId,
      thread_ts: slackMessageId,
      text,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text,
          },
        },
      ],
    });

    if (!threadUpdateRes.ok || !threadUpdateRes.ts) {
      throw Error('Failed to post message to thread requesting re-review');
    }

    logger.info('END handleReRequest');
    return;
  } catch (error) {
    fail(error);
    throw error;
  }
};
