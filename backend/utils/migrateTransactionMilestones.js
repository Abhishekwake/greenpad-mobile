const Transaction = require('../models/Transaction');
const Reward = require('../models/Reward');
const { MILESTONE_TYPES } = require('./milestoneTypes');

function inferMilestoneType(tx) {
  if (tx.milestoneType) {
    return tx.milestoneType;
  }

  const desc = String(tx.description || '');

  if (tx.type === 'redeem') {
    return MILESTONE_TYPES.REDEEM;
  }

  if (desc === 'Welcome bonus') {
    return MILESTONE_TYPES.WELCOME_BONUS;
  }
  if (desc.startsWith('Referral bonus (code:')) {
    return MILESTONE_TYPES.REFERRAL_SIGNUP_REFEREE;
  }
  if (desc.startsWith('Referral signup:')) {
    return MILESTONE_TYPES.REFERRAL_SIGNUP_REFERRER;
  }
  if (desc === 'Site visit booked') {
    return MILESTONE_TYPES.LEAD_BOOKING_SELF;
  }
  if (desc === 'Referral site visit booked') {
    return MILESTONE_TYPES.LEAD_BOOKING_REFERRAL;
  }
  if (desc.startsWith('Installation confirmed:')) {
    return MILESTONE_TYPES.LEAD_CONVERTED;
  }
  if (desc.startsWith('Booking cancelled:')) {
    return MILESTONE_TYPES.LEAD_BOOKING_CLAWBACK;
  }
  if (desc.startsWith('Lead visited:')) {
    return MILESTONE_TYPES.LEAD_VISITED;
  }

  return null;
}

/** Backfill milestoneType on legacy transactions and resolve duplicate earn rows. */
async function migrateTransactionMilestones() {
  const withoutType = await Transaction.find({
    $or: [{ milestoneType: { $exists: false } }, { milestoneType: null }],
  }).sort({ createdAt: 1 });

  let backfilled = 0;
  for (const tx of withoutType) {
    const milestoneType = inferMilestoneType(tx);
    if (!milestoneType) {
      continue;
    }
    tx.milestoneType = milestoneType;
    await tx.save();
    backfilled += 1;
  }

  if (backfilled > 0) {
    console.log(`[migrate] Backfilled milestoneType on ${backfilled} transaction(s)`);
  }

  const dupGroups = await Transaction.aggregate([
    {
      $match: {
        type: 'earn',
        milestoneType: { $exists: true, $ne: null },
        'relatedTo.id': { $exists: true },
      },
    },
    {
      $group: {
        _id: {
          userId: '$userId',
          relatedId: '$relatedTo.id',
          milestoneType: '$milestoneType',
        },
        ids: { $push: '$_id' },
        count: { $sum: 1 },
      },
    },
    { $match: { count: { $gt: 1 } } },
  ]);

  let removedDupes = 0;
  for (const group of dupGroups) {
    const sorted = await Transaction.find({ _id: { $in: group.ids } })
      .sort({ createdAt: 1 })
      .select('_id')
      .lean();
    const toRemove = sorted.slice(1).map((d) => d._id);
    if (toRemove.length) {
      await Transaction.deleteMany({ _id: { $in: toRemove } });
      removedDupes += toRemove.length;
    }
  }

  if (removedDupes > 0) {
    console.log(`[migrate] Removed ${removedDupes} duplicate earn transaction(s)`);
  }

  const boostResult = await Reward.updateMany(
    { title: 'Referral Boost' },
    { $set: { isActive: false } }
  );
  if (boostResult.modifiedCount > 0) {
    console.log(`[migrate] Deactivated ${boostResult.modifiedCount} Referral Boost reward(s)`);
  }
}

module.exports = migrateTransactionMilestones;
