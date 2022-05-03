const core = require("@actions/core");
const github = require("@actions/github");

// requires pull_request and repository as inputs bc of the differently shaped action payloads
module.exports = async () => {
  try {
    const { pull_request, repository } = github.context.payload;
    if (!pull_request) {
      throw Error('No pull_request key on github.context.payload in getSlackMessageId')
    } else if (!repository) {
      throw Error('No repository key on github.context.payload in getSlackMessageId')
    }
    // get slack id and PR number from pull comment
    const token = core.getInput("github-token");
    const octokit = github.getOctokit(token);
    const commentRes = await octokit.issues.listComments({
      owner: repository.owner.login,
      repo: repository.name,
      issue_number: pull_request.number,
    });
    let slackMessageId;
    commentRes.data.forEach((comment) => {
      const match = comment.body.match(/SLACK_MESSAGE_ID:[0-9]{1,}.[0-9]{1,}/);
      if (match) {
        slackMessageId = match[0];
      }
    });

    if (!slackMessageId) {
      throw Error(
        "Unable to find SLACK_MESSAGE_ID comment in PR comment thread."
      );
    }

    return slackMessageId;
  } catch (error) {
    console.error(error);
    return null;
  }
};
