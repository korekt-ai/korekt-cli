/**
 * File processing rules for code review.
 */

/**
 * Check if a file should be skipped entirely (binary/non-reviewable).
 * @param {string} filePath - The file path to check
 * @param {string[]} skipExtensions - Extensions to skip
 * @returns {boolean} - True if the file should be skipped
 */
export function shouldSkip(filePath, skipExtensions) {
  if (!skipExtensions || !Array.isArray(skipExtensions)) {
    return false;
  }

  const lowerPath = filePath.toLowerCase();

  for (const ext of skipExtensions) {
    if (lowerPath.endsWith(ext.toLowerCase())) {
      return true;
    }
  }

  return false;
}

/**
 * Check if a file should only show diff (no full content).
 * @param {string} filePath - The file path to check
 * @param {string[]} diffOnlyExtensions - Extensions for diff-only
 * @param {string[]} diffOnlyFiles - Specific filenames for diff-only
 * @returns {boolean} - True if only diff should be shown
 */
export function isDiffOnly(filePath, diffOnlyExtensions, diffOnlyFiles) {
  const lowerPath = filePath.toLowerCase();
  const fileName = lowerPath.split('/').pop();

  // Check exact filename matches first (lowercase comparison)
  if (diffOnlyFiles && Array.isArray(diffOnlyFiles)) {
    if (diffOnlyFiles.some((f) => f.toLowerCase() === fileName)) {
      return true;
    }
  }

  // Check extension matches
  if (diffOnlyExtensions && Array.isArray(diffOnlyExtensions)) {
    for (const ext of diffOnlyExtensions) {
      if (lowerPath.endsWith(ext.toLowerCase())) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Check if content appears to be binary by looking for null bytes.
 * @param {string} content - The content to check
 * @returns {boolean} - True if content appears binary
 */
export function isBinary(content) {
  if (!content || content.length === 0) {
    return false;
  }

  const sample = content.slice(0, 8192);

  // Check for null bytes - text files never contain them
  return sample.includes('\0');
}
