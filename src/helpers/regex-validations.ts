import { createHash } from "crypto";

function hashString(input: string): string {
	const hash = createHash("sha256");
	hash.update(input);
	return hash.digest("hex");
}

export interface FileMatch {
	fileName: string;
	change: string;
	lineNumber: number;
	hash: string;
}

export interface PRFile {
	sha: string | null;
	filename: string;
	status:
		| "added"
		| "removed"
		| "modified"
		| "renamed"
		| "copied"
		| "changed"
		| "unchanged";
	additions: number;
	deletions: number;
	changes: number;
	blob_url: string;
	raw_url: string;
	contents_url: string;
	patch?: string | undefined;
	previous_filename?: string | undefined;
}

export function extractFileMatches(
	files: PRFile[],
	regex: RegExp,
): FileMatch[] {
	const matches: FileMatch[] = [];

	files
		.filter((file) => file.patch)
		.forEach((file) => {
			// biome-ignore lint/style/noNonNullAssertion: truthy check on previous filter
			const lines = file.patch!.split("\n");
			lines.forEach((line, index) => {
				if (regex.test(line)) {
					matches.push({
						fileName: file.filename,
						change: line.trim(),
						lineNumber: index + 1,
						hash: hashString(`${file.filename}:${index + 1}:${line.trim()}`),
					});
				}
			});
		});

	return matches;
}
