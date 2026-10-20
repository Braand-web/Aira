// Only definitive local provider receipts can release a mission's reservation.
// New or unrecognized provider states remain unresolved until explicitly handled.
export function missionUsageIsKnown(statuses) {
  return Array.isArray(statuses) && statuses.every(status => status === 'complete' || status === 'rejected');
}

export function missionCostIsSettled(holdStatus, usageStatuses) {
  return holdStatus === 'settled' && missionUsageIsKnown(usageStatuses);
}
