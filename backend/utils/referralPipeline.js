/** Map lead CRM status to mobile referral pipeline display. */
function pipelineFromLeadStatus(status) {
  if (!status) {
    return { pipelineStatus: 'signed_up', pipelineLabel: 'Signed up' };
  }
  const map = {
    pending: { pipelineStatus: 'visit_booked', pipelineLabel: 'Visit booked' },
    contacted: { pipelineStatus: 'contacted', pipelineLabel: 'Contacted' },
    visited: { pipelineStatus: 'visited', pipelineLabel: 'Visited' },
    converted: { pipelineStatus: 'converted', pipelineLabel: 'Converted' },
    lost: { pipelineStatus: 'lost', pipelineLabel: 'Closed' },
  };
  return map[status] || { pipelineStatus: 'signed_up', pipelineLabel: 'Signed up' };
}

module.exports = { pipelineFromLeadStatus };
