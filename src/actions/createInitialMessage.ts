import * as core from "@actions/core";
import * as github from "@actions/github";
import { createUsersToAtString } from "../utils/createUsersToAtString";
import { fail } from "../utils/fail";
import { getPrForCommit } from "../utils/getPrForCommit";
import { logger } from "../utils/logger";
import { slackWebClient } from "../utils/slackWebClient";

export const createInitialMessage = async (): Promise<string | void> => {
  const verbose: boolean = core.getBooleanInput("verbose");
  logger.info(`START createInitialMessage. Verbose? ${verbose}`)

  try {
    const channelId = core.getInput("channel-id");
    const { repository } = github.context.payload;
    logger.info('about to get PR for commit');
    const pull_request = await getPrForCommit();
    logger.info({pull_request,repository});
    if (!pull_request || !repository) return;

    const requestedReviewers = pull_request.requested_reviewers ? pull_request.requested_reviewers.map((user: any) => user.login) : [];
    const requestedTeamsReviewers = pull_request.requested_teams ? pull_request.requested_teams.map((team: any) => team.id) : [];
    logger.info({requestedReviewers, requestedTeamsReviewers});
    //
    // ─── RETURN IF THERE ARE NO REQUESTED REVIEWERS ──────────────────
    //

    if (requestedReviewers.length + requestedTeamsReviewers.length === 0) {
      return;
    }

    let baseMessage = `*${pull_request.user?.login}* is requesting your review on <${pull_request._links.html.href}|*${pull_request.title}*>`;
    if (!!pull_request.body && verbose) {
      baseMessage = `${baseMessage}\n>${pull_request.body}`;
    }

    // build users to mention string
    const usersToAtString = await createUsersToAtString([...requestedReviewers,...requestedTeamsReviewers]);

    // DOCS https://api.slack.com/methods/chat.postMessage
    const text = `${usersToAtString} ${baseMessage}`;
    const prSlackMsg = await slackWebClient.chat.postMessage({
      channel: channelId,
      text,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text,
          },
        },
      ],
    });

    if (!prSlackMsg.ok || !prSlackMsg.ts) {
      throw Error("failed to create initial slack message");
    }

    const labelNameToWatchFor = core.getInput("label-name-to-watch-for");

    let hasLabel = false;
    pull_request.labels.forEach((label: any) => {
      if (label.name === labelNameToWatchFor) {
        hasLabel = true;
      } 
    });

if(hasLabel){
    await slackWebClient.reactions.add({
      channel: channelId,
      timestamp: prSlackMsg.ts,
      name: "crab",
    });
  }
  

    const ghToken = core.getInput("github-token");
    const octokit = github.getOctokit(ghToken);
    const slackMessageId = `SLACK_MESSAGE_ID:${prSlackMsg.ts}`;
    await octokit.rest.issues.createComment({
      owner: repository.owner.login,
      repo: repository.name,
      issue_number: pull_request.number,
      body: slackMessageId
    });

    logger.info(`END createInitialMessage: ${slackMessageId}`)
    return slackMessageId;
  } catch (error: any) {
    console.error("error in createInitialMessage::: ", error);

    fail(error.message);
  }
};
