const Lead = require('../models/Lead');
const User = require('../models/User');

function isGenericUserName(name) {
  const n = String(name || '').trim();
  return !n || /^User \d{4}$/.test(n);
}

/**
 * Attach walk-in / manual leads (same phone, no userId) to the logged-in customer.
 * Optionally sync name from the lead when the account still has a placeholder name.
 */
async function linkUserToLeadsByPhone(user) {
  if (!user?.phone) return { linked: 0 };

  const phone = String(user.phone).trim();
  if (!/^\d{10}$/.test(phone)) return { linked: 0 };

  const orphans = await Lead.find({
    phone,
    status: { $nin: ['voided'] },
    $or: [{ userId: null }, { userId: { $exists: false } }],
  });

  let linked = 0;
  for (const lead of orphans) {
    lead.userId = user._id;
    await lead.save();
    linked += 1;
  }

  if (isGenericUserName(user.name)) {
    const best = await Lead.findOne({
      phone,
      status: { $nin: ['voided', 'lost'] },
    })
      .sort({ updatedAt: -1 })
      .select('name')
      .lean();

    if (best?.name && String(best.name).trim().length >= 2) {
      await User.findByIdAndUpdate(user._id, { name: String(best.name).trim() });
    }
  }

  return { linked };
}

module.exports = { linkUserToLeadsByPhone, isGenericUserName };
