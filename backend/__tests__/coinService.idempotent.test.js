const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const { awardCoins, MILESTONE_TYPES } = require('../utils/coinService');

let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  await Transaction.syncIndexes();
}, 120_000);

afterAll(async () => {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
});

beforeEach(async () => {
  await Transaction.deleteMany({});
  await User.deleteMany({});
});

describe('awardCoins idempotency', () => {
  it('awards once and returns duplicate on second call with same milestone', async () => {
    const user = await User.create({ phone: '9876543210', name: 'Test', coins: 0 });
    const relatedTo = { model: 'Lead', id: new mongoose.Types.ObjectId() };

    const first = await awardCoins({
      userId: user._id,
      amount: 50,
      description: 'Welcome',
      relatedTo,
      milestoneType: MILESTONE_TYPES.LEAD_VISITED,
    });

    expect(first.awarded).toBe(true);
    expect(first.transaction).toBeTruthy();

    const updated = await User.findById(user._id);
    expect(updated.coins).toBe(50);

    const second = await awardCoins({
      userId: user._id,
      amount: 50,
      description: 'Visit duplicate',
      relatedTo,
      milestoneType: MILESTONE_TYPES.LEAD_VISITED,
    });

    expect(second.awarded).toBe(false);
    expect(second.reason).toBe('duplicate');

    const count = await Transaction.countDocuments({ userId: user._id, type: 'earn' });
    expect(count).toBe(1);

    const after = await User.findById(user._id);
    expect(after.coins).toBe(50);
  });
});
