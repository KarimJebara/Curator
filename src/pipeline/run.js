import { fingerprintCluster } from './2-fingerprint.js';
import { specializeCluster } from './3-specialize.js';
import { generateRouter } from './4-router.js';
import { verifyCluster } from './5-verify.js';

// Orchestrate the LLM pipeline for a single cluster. Each stage's output is
// kept on the proposal so the report can show partial progress and the user
// can re-run individual stages.
export const runPipelineForCluster = async (cluster, { skipRouter = false } = {}) => {
  const proposal = { clusterId: cluster.id };

  proposal.fingerprints = await fingerprintCluster(cluster);
  proposal.specialization = await specializeCluster(cluster, proposal.fingerprints);

  if (!skipRouter && proposal.specialization.actions?.some((a) => a.type === 'specialize')) {
    proposal.routerSkill = await generateRouter(cluster, proposal.specialization);
    proposal.router = { name: proposal.specialization.cluster_label };
  }

  proposal.verification = await verifyCluster(cluster, proposal.specialization);

  proposal.actions = proposal.specialization.actions || [];
  proposal.notes = (proposal.verification.verdicts || [])
    .filter((v) => v.verdict !== 'PASS')
    .map((v) => `${v.verdict}: ${v.reason}`);

  return proposal;
};

export const runPipeline = async (clusters, { onProgress } = {}) => {
  const proposals = {};
  for (const c of clusters) {
    onProgress?.({ stage: 'cluster-start', cluster: c });
    try {
      proposals[c.id] = await runPipelineForCluster(c);
      onProgress?.({ stage: 'cluster-done', cluster: c });
    } catch (err) {
      onProgress?.({ stage: 'cluster-error', cluster: c, error: err.message });
      proposals[c.id] = { clusterId: c.id, error: err.message };
    }
  }
  return proposals;
};
