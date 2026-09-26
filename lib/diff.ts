/**
 * Word-level diff (LCS) used to show exactly what the formatting assistant
 * changed. Small inputs only (a testimony, not a novel), so O(n·m) is fine.
 */
export type DiffOp = { type: "equal" | "insert" | "delete"; text: string };

const TOKEN = /\s+|[^\s]+/g;

export function diffWords(a: string, b: string): DiffOp[] {
  const A = a.match(TOKEN) ?? [];
  const B = b.match(TOKEN) ?? [];
  const n = A.length;
  const m = B.length;

  // Guard against pathological sizes: fall back to a whole-text replace.
  if (n * m > 4_000_000) {
    return [
      { type: "delete", text: a },
      { type: "insert", text: b },
    ];
  }

  const dp: Uint32Array[] = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const ops: DiffOp[] = [];
  let i = 0;
  let j = 0;
  const push = (type: DiffOp["type"], text: string) => {
    const last = ops[ops.length - 1];
    if (last && last.type === type) last.text += text;
    else ops.push({ type, text });
  };
  while (i < n && j < m) {
    if (A[i] === B[j]) {
      push("equal", A[i]);
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      push("delete", A[i]);
      i++;
    } else {
      push("insert", B[j]);
      j++;
    }
  }
  while (i < n) push("delete", A[i++]);
  while (j < m) push("insert", B[j++]);
  return ops;
}

export function diffStats(ops: DiffOp[]): { inserted: number; deleted: number } {
  let inserted = 0;
  let deleted = 0;
  for (const op of ops) {
    const words = op.text.trim() ? op.text.trim().split(/\s+/).length : 0;
    if (op.type === "insert") inserted += words;
    if (op.type === "delete") deleted += words;
  }
  return { inserted, deleted };
}
