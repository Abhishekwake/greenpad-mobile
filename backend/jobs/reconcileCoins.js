const User = require('../models/User');
const Transaction = require('../models/Transaction');
const CoinReconciliationRun = require('../models/CoinReconciliationRun');

async function reconcileCoins() {
  const run = {
    ranAt: new Date(),
    usersChecked: 0,
    mismatchCount: 0,
    mismatches: [],
    status: 'completed',
  };

  try {
    const users = await User.find({ role: 'user' }).select('_id phone coins').lean();

    for (const user of users) {
      run.usersChecked += 1;

      const agg = await Transaction.aggregate([
        { $match: { userId: user._id } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]);

      const expected = Math.round(agg[0]?.total || 0);
      const stored = Math.round(user.coins || 0);

      if (expected !== stored) {
        run.mismatchCount += 1;
        run.mismatches.push({
          userId: user._id,
          phone: user.phone,
          storedCoins: stored,
          expectedCoins: expected,
          delta: stored - expected,
        });
      }
    }

    await CoinReconciliationRun.create(run);

    if (run.mismatchCount > 0) {
      console.warn(
        `[reconcile] ${run.mismatchCount} coin mismatch(es) across ${run.usersChecked} users`
      );
    } else {
      console.log(`[reconcile] OK — ${run.usersChecked} users, no mismatches`);
    }

    return run;
  } catch (err) {
    run.status = 'failed';
    run.errorMessage = err.message || String(err);
    await CoinReconciliationRun.create(run);
    console.error('[reconcile] failed:', err);
    throw err;
  }
}

module.exports = reconcileCoins;
