export function validatePreReviewGate(runResult = {}) {
  const audit = runResult.audit || {};
  const contextRead = audit.contextRead || {};
  const designProtocol = audit.designProtocolUsed || {};
  const missing = [];
  for (const key of ['case', 'caseContext', 'evidence', 'content', 'design', 'brandSpec']) {
    if (!contextRead[key]) missing.push(`contextRead.${key}`);
  }
  if (!designProtocol.requiredSkill) missing.push('designProtocolUsed.requiredSkill');
  if (!Array.isArray(designProtocol.openDesignSkills) || designProtocol.openDesignSkills.length === 0) {
    missing.push('designProtocolUsed.openDesignSkills');
  }
  if (!Array.isArray(audit.qaScreenshots) || audit.qaScreenshots.length === 0) {
    missing.push('qaScreenshots');
  }
  if (!audit.devDeployUrl) missing.push('devDeployUrl');
  return {
    ok: missing.length === 0,
    missing,
  };
}
