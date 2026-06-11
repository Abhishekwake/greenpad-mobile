const User = require('../models/User');

/**
 * Ensures a Lead has a linked app User for project creation (manual leads included).
 * Finds by phone or creates a minimal customer account.
 */
async function resolveCustomerForLead(lead) {
  if (lead.userId) {
    return lead.userId;
  }

  const phone = String(lead.phone || '').trim();
  if (!/^\d{10}$/.test(phone)) {
    const err = new Error('Lead phone must be a valid 10-digit number to create a project');
    err.statusCode = 400;
    throw err;
  }

  let user = await User.findOne({ phone });
  if (!user) {
    user = await User.create({
      name: String(lead.name || 'Customer').trim(),
      phone,
      email: lead.email ? String(lead.email).trim() : undefined,
    });
  } else if (
    lead.name &&
    String(lead.name).trim().length >= 2 &&
    /^User \d{4}$/.test(String(user.name || '').trim())
  ) {
    user.name = String(lead.name).trim();
    await user.save();
  }

  if (!lead.userId || String(lead.userId) !== String(user._id)) {
    lead.userId = user._id;
    await lead.save();
  }

  return user._id;
}

module.exports = { resolveCustomerForLead };
