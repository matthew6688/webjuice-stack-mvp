export function artifactTimestamp() {
  return process.env.WEBJUICE_STABLE_GENERATED_AT || new Date().toISOString();
}
