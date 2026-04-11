const Lead = require('../models/Lead');

/** Merge legacy terminal statuses into `lost` (admin CRM model). */
async function migrateLeadStatuses() {
  const r = await Lead.updateMany(
    { status: { $in: ['not_converted', 'cancelled', 'rejected'] } },
    { $set: { status: 'lost' } }
  );
  if (r.modifiedCount > 0) {
    console.log(`[migrate] ${r.modifiedCount} lead(s) set to "lost" (merged not_converted / cancelled / rejected)`);
  }
}

module.exports = migrateLeadStatuses;
