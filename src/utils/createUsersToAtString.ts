import { fail } from './fail';
import { getEngineersFromS3 } from './getEngineersFromS3';
import { EngineerGithubSlackMapping } from './getEngineersFromS3/types';
import { logger } from './logger';

// reviewers is string[], where the strings should be github user names
export const createUsersToAtString = async (
  reviewers: string[]
): Promise<string> => {
  logger.info('START createUsersToAtString');
  let engineers: EngineerGithubSlackMapping[] = [];
  try {
    const res = await getEngineersFromS3();
    engineers = res.engineers;
  } catch (error) {
    fail(error);
  }

  const usersToAt = engineers.filter((user) =>
    reviewers.map((id) => `${id}`).includes(user.github_username)
  );

  let usersToAtString: string = '';

  usersToAt.forEach((user) => {
    if (!usersToAtString) {
      usersToAtString = user.slack_id.startsWith('U')
        ? `<@${user.slack_id}>`
        : 'Team, ';
      return;
    }
    usersToAtString =
      `${usersToAtString}, ` +
      (user.slack_id.startsWith('U') ? `<@${user.slack_id}>` : 'Team, ');
    return;
  });

  logger.info(`END createUsersToAtString: ${JSON.stringify(usersToAtString)}`);
  return usersToAtString;
};
