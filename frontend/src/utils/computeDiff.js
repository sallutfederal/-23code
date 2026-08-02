/**
 * computeDiff — minimal LCS-based line diff for frontend display.
 * Port of backend/main.js computeDiff, adapted for browser (no Buffer).
 */

const MAX_LINES = 500;

export function computeDiff(oldContent, newContent) {
  const oldLines = (oldContent || '').split('\n');
  const newLines = (newContent || '').split('\n');

  if (oldLines.length > MAX_LINES || newLines.length > MAX_LINES) {
    return {
      truncated: true,
      oldLines: oldLines.length,
      newLines: newLines.length,
    };
  }

  const m = oldLines.length;
  const n = newLines.length;

  // LCS matrix
  const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Reconstruct diff
  const diff = [];
  let i = m, j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      diff.unshift({ type: 'context', content: oldLines[i - 1], lineOld: i, lineNew: j });
      i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      diff.unshift({ type: 'added', content: newLines[j - 1], lineNew: j });
      j--;
    } else {
      diff.unshift({ type: 'removed', content: oldLines[i - 1], lineOld: i });
      i--;
    }
  }

  // Context limiting: show max 3 lines before/after each change
  const changes = diff.map((d, idx) => ({ ...d, idx })).filter(d => d.type !== 'context');
  const showIndices = new Set();
  for (const change of changes) {
    for (let k = Math.max(0, change.idx - 3); k <= Math.min(diff.length - 1, change.idx + 3); k++) {
      showIndices.add(k);
    }
  }

  const filtered = [];
  let lastIdx = -1;
  for (const idx of showIndices) {
    if (lastIdx >= 0 && idx - lastIdx > 1) {
      filtered.push({ type: 'separator', content: '...' });
    }
    filtered.push(diff[idx]);
    lastIdx = idx;
  }

  return { truncated: false, lines: filtered };
}
