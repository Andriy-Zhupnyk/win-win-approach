/**
 * Replace the spec's `**Status:** ...` line, preserving line endings.
 * @param {string} text spec file contents
 * @param {number | string} prNumber
 */
export function rewriteStatusLine(text, prNumber) {
  const status = `**Status:** Done (merged in #${prNumber})`;
  if (!/^\*\*Status:\*\*.*$/m.test(text)) {
    throw new Error("spec has no '**Status:**' line");
  }
  return text.replace(/^\*\*Status:\*\*.*$/m, status);
}

/**
 * Find the single spec file for an id (e.g. "0010") among repo-relative paths.
 * @param {string[]} files
 * @param {string} specId
 * @param {string} dir
 */
export function findSpecFile(files, specId, dir = "specs/active") {
  const matches = files.filter((f) => f.startsWith(`${dir}/${specId}-`));
  if (matches.length !== 1) {
    throw new Error(
      `expected exactly one ${dir}/${specId}-*.md, found ${matches.length}`,
    );
  }
  return matches[0];
}

/**
 * Destination of a closed spec: specs/active/x.md -> specs/done/x.md
 * @param {string} file
 */
export function doneDestination(file) {
  return file.replace(/^specs\/[^/]+\//, "specs/done/");
}
