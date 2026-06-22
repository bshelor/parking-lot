const fs = require('fs');

const latestDate = new Date('2023-01-01T00:00:00Z');
const newestDate = new Date('2024-01-30T00:00:00Z');

const backendRepos = [
  'waterworks', 'automation', 'freeparking', 'mission_control', 'scheduling',
  'messaging',	'z2o-devops',	'auditing',	'company-uploads-manager',
  'savings-center', 'zap', 'event-store',	'core-http-client',	'aws', 'gateway',
  'service-auth',	'express',	'logging',	'env', 'pg', 'archive-data', 'code-climate-action',
  'deploy-permissions-action', 'fn', 'node-package-version-changes', 
];
const frontendRepos = ['pennybags', 'marvengardens'/*, 'boardwalk'*/];

const summarizeRepo = (repo, startDate, endDate)  => {
  const path = `./data/01-30-2024/${repo}.json`;
  const file = JSON.parse(fs.readFileSync(path).toString());

  if (typeof file === 'object' && !Array.isArray(file)) {
    console.log(`No data in file for ${repo} repo`);
  }

  const summarized = {};
  if (file && Array.isArray(file)) {
    file.forEach((o) => {
      const aggregated = o.weeks.reduce((acc, week) => {
        if (new Date(week.w * 1000) >= startDate && new Date(week.w * 1000) <= endDate) {
          acc.additions += week.a;
          acc.deletions += week.d;
          acc.commits += week.c;
        }
        return acc;
      }, {
        additions: 0,
        deletions: 0,
        commits: 0
      });
      const username = o.author.login;
      summarized[username] = aggregated;
    });
  }

  return summarized;
};

const writeFileSync = (dir, filename, data) => {
  try {
    fs.writeFileSync(`${dir}/${filename}`, data);
  } catch (err) {
    if (err.code === 'ENOENT') {
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(`${dir}/${filename}`, data);
    } else {
      throw err;
    }
  }
}

const perRepoSummary = (repos) => {
  return repos.reduce((acc, r) => {
    const summarized = summarizeRepo(r, latestDate, newestDate);
    acc[r] = summarized;
    return acc;
  }, {});
};

const perUserSummary = (perRepoSummaryObj) => {
  return Object.keys(perRepoSummaryObj).reduce((acc, repoName) => {
    const repo = perRepoSummaryObj[repoName];
    const usernames = Object.keys(repo);
    usernames.forEach((username) => {
      const userInRepo = repo[username];
      if (acc[username]) {
        acc[username].repoStats[repoName] = userInRepo;
        acc[username].totalAdditions += userInRepo.additions;
        acc[username].totalDeletions += userInRepo.deletions;
        acc[username].totalChanges += (userInRepo.additions + userInRepo.deletions);
        acc[username].totalCommits += userInRepo.commits;
      } else {
        acc[username] = {
          repoStats: { [repoName]: userInRepo },
          totalAdditions: userInRepo.additions,
          totalDeletions: userInRepo.deletions,
          totalChanges: (userInRepo.additions + userInRepo.deletions),
          totalCommits: userInRepo.commits
        };
      }
    });
    return acc;
  }, {});
};

const sortUsersDesc = (perUserSummaryObj, sortBy) => {
  const sortedUsernames = Object.keys(perUserSummaryObj).sort((a, b) => {
    if (perUserSummaryObj[a][sortBy] < perUserSummaryObj[b][sortBy]) { return 1; }
    if (perUserSummaryObj[a][sortBy] > perUserSummaryObj[b][sortBy]) { return -1; }
    return 0;
  });
  return sortedUsernames.map(user => ({ user: user, ...perUserSummaryObj[user] }));
};

const summarizeRepos = (type, repos, sortBy) => {
  const perRepoSummarized = perRepoSummary(repos);
  writeFileSync(`./results/${type}`, 'per-repo-results.json', JSON.stringify(perRepoSummarized));

  const perUserSummarized = perUserSummary(perRepoSummarized);
  writeFileSync(`./results/${type}`, 'per-user-stats.json', JSON.stringify(perUserSummarized));

  const sortedUsers = sortUsersDesc(perUserSummarized, sortBy);
  writeFileSync(`./results/${type}`, 'sorted-user-contributions.json', JSON.stringify(sortedUsers));

  return {
    contributionsByRepo: `results/${type}/per-repo-results.json`,
    contributionsByUser: `results/${type}/per-user-stats.json`,
    contributionsSorted: `results/${type}/sorted-user-contributions.json`
  };
};

/**
 * Aggregate repo contribution stats into summary stats for each org user
 */
const main = () => {
  //let result = summarizeRepos('backend', backendRepos, 'totalChanges');
  //console.log('Calculated backend statistics. Data stored in results/');

  result = summarizeRepos('frontend', frontendRepos, 'totalChanges');
  console.log('Calculated frontend statistics. Data stored in results/');
};

main();
process.exit(0);
