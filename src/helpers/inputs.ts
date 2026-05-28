import type { Context } from "node:vm";
import { getInput, setFailed } from "@actions/core";
import * as github from "@actions/github";
import type { GitHub } from "@actions/github/lib/utils";

export interface ActionInput {
	octokit: InstanceType<typeof GitHub>;
	prNumber: number;
	regexPattern: RegExp;
	context: Context;
	reviewers: string[];
}

const regex = /\.addResourceSuppressions\(/gm;

function isValidRegex(pattern: string): boolean {
	try {
		new RegExp(pattern);
		return true;
	} catch (_) {
		return false;
	}
}

export function parseInput(): ActionInput | undefined {
	const context = github.context;

	if (context.eventName !== "pull_request") {
		setFailed("This action should only run on pull_request events.");
		return;
	}

	const prNumber = context.payload.pull_request?.number;

	if (!prNumber) {
		setFailed("Could not find pull request number in the event payload.");
		return;
	}

	const token = getInput("github-token", { required: true });

	const customRegexPattern = getInput("custom-regex-pattern");

	if (customRegexPattern.length > 0 && !isValidRegex(customRegexPattern)) {
		setFailed(
			"The provided custom regex pattern is not a valid regular expression.",
		);
		return;
	}

	const regexPattern =
		customRegexPattern.length > 0 ? new RegExp(customRegexPattern) : regex;

	const reviewers = getInput("reviewers", {
		required: true,
	})
		.split(",")
		.map((r) => r.trim());

	const octokit = github.getOctokit(token);

	return {
		context,
		octokit,
		prNumber,
		regexPattern,
		reviewers,
	};
}
