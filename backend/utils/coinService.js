const mongoose = require('mongoose');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const Reward = require('../models/Reward');
const { MILESTONE_TYPES, BOOKING_MILESTONE_TYPES } = require('./milestoneTypes');
const { getCoinSettings } = require('./getCoinSettings');

/**
 * Run fn inside a MongoDB transaction. Requires replica set (Atlas default).
 * @template T
 * @param {(session: import('mongoose').ClientSession) => Promise<T>} fn
 * @returns {Promise<T>}
 */
async function runWithTransaction(fn) {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await fn(session);
    });
    return result;
  } catch (err) {
    if (err.code === 20 || /replica set/i.test(String(err.message))) {
      const wrapped = new Error(
        'MongoDB transactions require a replica set (use Atlas or enable replica set locally).'
      );
      wrapped.cause = err;
      throw wrapped;
    }
    throw err;
  } finally {
    session.endSession();
  }
}

function isDuplicateKeyError(err) {
  return err && (err.code === 11000 || err.code === 11001);
}

/**
 * Idempotent earn: one award per userId + relatedTo.id + milestoneType.
 * @returns {Promise<{ awarded: boolean, transaction?: object, user?: object, reason?: string }>}
 */
async function awardCoins({
  session,
  userId,
  amount,
  description,
  relatedTo,
  milestoneType,
  status = 'completed',
}) {
  if (!amount || amount <= 0) {
    return { awarded: false, reason: 'invalid_amount' };
  }

  let transaction;
  try {
    [transaction] = await Transaction.create(
      [
        {
          userId,
          type: 'earn',
          amount,
          description,
          relatedTo,
          milestoneType,
          status,
        },
      ],
      { session }
    );
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      return { awarded: false, reason: 'duplicate' };
    }
    throw err;
  }

  const user = await User.findByIdAndUpdate(
    userId,
    { $inc: { coins: amount, totalEarned: amount } },
    { session, new: true }
  );

  if (!user) {
    throw new Error(`User not found for coin award: ${userId}`);
  }

  return { awarded: true, transaction, user };
}

/**
 * Deduct coins. Floors balance at 0 if deduct exceeds balance.
 * @returns {Promise<{ deducted: number, user: object, transaction: object }>}
 */
async function deductCoins({
  session,
  userId,
  amount,
  description,
  relatedTo,
  milestoneType,
  type = 'earn',
  status = 'completed',
}) {
  const deductAmount = Math.abs(Number(amount) || 0);
  if (deductAmount <= 0) {
    throw new Error('deductCoins requires a positive amount');
  }

  const userBefore = await User.findById(userId).session(session);
  if (!userBefore) {
    throw new Error(`User not found for coin deduction: ${userId}`);
  }

  const actualDeduct = Math.min(deductAmount, userBefore.coins);

  const [transaction] = await Transaction.create(
    [
      {
        userId,
        type,
        amount: -actualDeduct,
        description,
        relatedTo,
        milestoneType,
        status,
      },
    ],
    { session }
  );

  const user = await User.findByIdAndUpdate(
    userId,
    {
      $inc: {
        coins: -actualDeduct,
        totalEarned: -actualDeduct,
      },
    },
    { session, new: true }
  );

  return { deducted: actualDeduct, user, transaction };
}

/**
 * Atomic redeem: conditional balance debit, stock decrement, pending redeem tx.
 */
async function atomicRedeem({ session, userId, rewardId }) {
  const reward = await Reward.findById(rewardId).session(session);
  if (!reward || !reward.isActive) {
    return { ok: false, code: 'REWARD_NOT_FOUND', message: 'Reward not found or inactive' };
  }

  if (reward.stock !== null && reward.stock <= 0) {
    return { ok: false, code: 'OUT_OF_STOCK', message: 'Reward out of stock' };
  }

  const user = await User.findOneAndUpdate(
    { _id: userId, coins: { $gte: reward.coinsRequired } },
    { $inc: { coins: -reward.coinsRequired, totalRedeemed: reward.coinsRequired } },
    { session, new: true }
  );

  if (!user) {
    return {
      ok: false,
      code: 'INSUFFICIENT_COINS',
      message: `Insufficient coins. Need ${reward.coinsRequired}`,
    };
  }

  if (reward.stock !== null) {
    const stockUpdated = await Reward.findOneAndUpdate(
      { _id: rewardId, isActive: true, stock: { $gte: 1 } },
      { $inc: { stock: -1 } },
      { session, new: true }
    );
    if (!stockUpdated) {
      throw new Error('Reward stock race — transaction aborted');
    }
  }

  const [transaction] = await Transaction.create(
    [
      {
        userId: user._id,
        type: 'redeem',
        amount: -reward.coinsRequired,
        description: `Redeemed: ${reward.title}`,
        relatedTo: { model: 'Reward', id: reward._id },
        milestoneType: MILESTONE_TYPES.REDEEM,
        status: 'pending',
      },
    ],
    { session }
  );

  return { ok: true, user, reward, transaction };
}

/**
 * Reverse booking coins on eligible lead cancel (idempotent via clawback milestone).
 */
async function clawbackBookingCoins({ session, lead, userId }) {
  const coinCfg = await getCoinSettings();
  const clawbackHours = coinCfg.bookingClawbackHours ?? 24;
  const hoursSinceBooking = (Date.now() - new Date(lead.createdAt).getTime()) / (1000 * 60 * 60);
  const withinWindow = hoursSinceBooking < clawbackHours;
  const beforeContacted = lead.status === 'pending';

  if (!withinWindow && !beforeContacted) {
    return { clawedBack: false, reason: 'outside_clawback_window' };
  }

  const bookingTx = await Transaction.findOne({
    userId,
    type: 'earn',
    'relatedTo.model': 'Lead',
    'relatedTo.id': lead._id,
    milestoneType: { $in: BOOKING_MILESTONE_TYPES },
  }).session(session);

  if (!bookingTx || bookingTx.amount <= 0) {
    return { clawedBack: false, reason: 'no_booking_award' };
  }

  const existingClawback = await Transaction.findOne({
    userId,
    milestoneType: MILESTONE_TYPES.LEAD_BOOKING_CLAWBACK,
    'relatedTo.model': 'Lead',
    'relatedTo.id': lead._id,
  }).session(session);

  if (existingClawback) {
    return { clawedBack: false, reason: 'already_clawed_back' };
  }

  const { deducted, user, transaction } = await deductCoins({
    session,
    userId,
    amount: bookingTx.amount,
    description: `Booking cancelled: ${lead.name}`,
    relatedTo: { model: 'Lead', id: lead._id },
    milestoneType: MILESTONE_TYPES.LEAD_BOOKING_CLAWBACK,
  });

  return { clawedBack: true, deducted, user, transaction };
}

module.exports = {
  runWithTransaction,
  awardCoins,
  deductCoins,
  atomicRedeem,
  clawbackBookingCoins,
  MILESTONE_TYPES,
};
