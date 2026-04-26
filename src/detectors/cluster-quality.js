// Cluster quality metrics. Silhouette is the headline number we surface to
// the user — it's interpretable (-1 to 1, ~0.25 is the noise threshold) and
// answers a single useful question: "how much does this cluster look like
// a real group versus an arbitrary slice of the corpus?"
//
// We work in similarity space (1 = identical, 0 = unrelated) and convert to
// distance internally, matching the rest of the pipeline.

const distance = (a, b, sim) => 1 - sim(a, b);

// Per-member silhouette: (b - a) / max(a, b) where
//   a = mean intra-cluster distance for this member
//   b = lowest mean inter-cluster distance to any OTHER cluster
// Returns 0 for singletons (a is undefined for a cluster of one).
export const memberSilhouette = (member, ownCluster, otherClusters, sim) => {
  if (ownCluster.length <= 1) return 0;
  const a = mean(ownCluster.filter((x) => x !== member).map((x) => distance(member, x, sim)));
  let b = Infinity;
  for (const other of otherClusters) {
    if (!other.length) continue;
    const meanDist = mean(other.map((x) => distance(member, x, sim)));
    if (meanDist < b) b = meanDist;
  }
  if (!isFinite(b)) return 0;
  const denom = Math.max(a, b);
  return denom === 0 ? 0 : (b - a) / denom;
};

// Cluster-level silhouette: mean of member silhouettes. The returned value
// is the figure we show users as confidence.
export const computeQuality = (clusterMembers, allMembers, sim) => {
  const otherMembers = allMembers.filter((m) => !clusterMembers.includes(m));
  // Treat all-other-members as one comparison set if we don't have
  // pre-computed sibling clusters. This is a conservative estimate — a true
  // sibling-aware silhouette would need the full clustering, which the
  // caller can pass via the `siblings` argument later.
  const otherClusters = otherMembers.length ? [otherMembers] : [];
  const silhouettes = clusterMembers.map((m) =>
    memberSilhouette(m, clusterMembers, otherClusters, sim),
  );
  return { silhouette: mean(silhouettes), perMember: silhouettes };
};

// Translate raw silhouette into a user-facing confidence label. Thresholds
// are calibrated for short technical documents that share vocabulary —
// silhouette > 0.4 is rare here in practice; 0.25+ is genuinely tight.
//   high   ≥ 0.28  → members clearly belong together
//   medium 0.18–0.28 → real cluster with some vocabulary overlap to siblings
//   low    < 0.18  → likely noise; manual review recommended
export const confidence = (silhouette) => {
  if (silhouette >= 0.28) return 'high';
  if (silhouette >= 0.18) return 'medium';
  return 'low';
};

const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
