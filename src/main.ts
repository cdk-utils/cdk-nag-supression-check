import { info, setFailed } from "@actions/core";
import * as github from "@actions/github";
import type { GitHub } from "@actions/github/lib/utils";
import { type ActionInput, parseInput } from "./helpers/inputs.js";
import {
	extractFileMatches,
	type FileMatch,
	type PRFile,
} from "./helpers/regex-validations.js";

/**
 * The main function for the action.
 *
 * @returns Resolves when the action is complete.
 */
export async function run(): Promise<void> {
	try {
		const input: ActionInput | undefined = parseInput();
		if (!input) {
			return;
		}

		info(`Analyzing PR #${input.prNumber} for pattern: ${input.regexPattern}`);

		const { context, octokit, prNumber } = input;

		const { data: files } = await octokit.rest.pulls.listFiles({
			owner: context.repo.owner,
			repo: context.repo.repo,
			pull_number: prNumber,
		});

		const fileMatches: FileMatch[] = extractFileMatches(
			files,
			input.regexPattern,
		);

		if (fileMatches.length === 0) {
			info("No matches found. No action required.");
			return;
		}

		const { data: comments } = await octokit.rest.issues.listComments({
			owner: context.repo.owner,
			repo: context.repo.repo,
			issue_number: prNumber,
		});

		const { data: currentReviewers } =
			await octokit.rest.pulls.listRequestedReviewers({
				owner: context.repo.owner,
				repo: context.repo.repo,
				pull_number: prNumber,
			});
	} catch (error) {
		// Fail the workflow run if an error occurs
		if (error instanceof Error) setFailed(error.message);
	}
}
