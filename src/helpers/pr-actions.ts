import type { Context } from "node:vm";
import { info } from "@actions/core";
import type { GitHub } from "@actions/github/lib/utils";
import type { FileMatch } from "./regex-validations.js";

const COMMENT_IDENTIFIER = "<!-- cdk-nag-suppression-check-comment -->";

function generateCommentBody(
	fileMatches: FileMatch[],
	reviewers: string[],
): string {
	const metadata = [
		COMMENT_IDENTIFIER,
		...fileMatches.map((match) => `<!-- ${match.hash} -->`),
	].join("\n");

	const changeTree = fileMatches.reduce(
		(acc, match) => {
			if (!acc[match.fileName]) {
				acc[match.fileName] = [];
			}
			acc[match.fileName].push(`Line ${match.lineNumber}: \`${match.change}\``);
			return acc;
		},
		{} as Record<string, string[]>,
	);

	const bodyLines = [
		"",
		"## CDK Nag Suppression Check",
		"",
		"The following changes in this pull request match the configured regex pattern for CDK Nag suppression checks:",
		"",
	];
	Object.keys(changeTree).forEach((fileName) => {
		bodyLines.push(`- **File:** \`${fileName}\``);
		changeTree[fileName].forEach((change) => {
			bodyLines.push(`  - ${change}`);
		});
	});

	bodyLines.push("\n\nRequesting Review from:");

	reviewers.forEach((reviewer) => {
		bodyLines.push(`- @${reviewer}`);
	});

	return `${metadata}\n${bodyLines.join("\n")}`;
}

export async function applyCommentAndReviewers(
	context: Context,
	octokit: InstanceType<typeof GitHub>,
	prNumber: number,
	reviewers: string[],
	fileMatches: FileMatch[],
): Promise<void> {
	// Fix to retrieve PR comments
	const { data: comments } = await octokit.rest.issues.listComments({
		owner: context.repo.owner,
		repo: context.repo.repo,
		issue_number: prNumber,
	});

	// TODO: Update to create match hash and search it in all comments

	const previousComment = comments.filter((comment) =>
		comment.body?.includes(COMMENT_IDENTIFIER),
	);

	if (previousComment) {
		info("Comment added previously. Terminating action.");
		return;
	}

	await octokit.rest.issues.createComment({
		owner: context.repo.owner,
		repo: context.repo.repo,
		issue_number: prNumber,
		body: generateCommentBody(fileMatches, reviewers),
	});

	const { data: currentReviewers } =
		await octokit.rest.pulls.listRequestedReviewers({
			owner: context.repo.owner,
			repo: context.repo.repo,
			pull_number: prNumber,
		});

	const existingReviewers = new Set([
		...currentReviewers.users
			.filter((user) => reviewers.includes(user.login))
			.map((user) => user.login),
		...currentReviewers.teams
			.filter((team) => reviewers.includes(team.slug))
			.map((team) => team.slug),
	]);

	const missingReviewers = reviewers.filter(
		(reviewer) => !existingReviewers.has(reviewer),
	);

	if (missingReviewers.length === 0) {
		info("All reviewers are already requested.");
		return;
	}

	await octokit.rest.pulls.requestReviewers({
		owner: context.repo.owner,
		repo: context.repo.repo,
		pull_number: prNumber,
		reviewers: missingReviewers,
	});
}
