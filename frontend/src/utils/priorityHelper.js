/**
 * Priority values:
 * Placement = 3
 * Result = 2
 * Event = 1
 * 
 * Helper function to calculate notification priority weights.
 */
export function getPriorityWeight(type) {
  if (!type) return 0;
  const upperType = type.toUpperCase();
  if (upperType === "PLACEMENT") return 3;
  if (upperType === "RESULT") return 2;
  if (upperType === "EVENT") return 1;
  return 0;
}
