const CompanySettings = require('../models/CompanySettings');

async function getSingleton() {
  let doc = await CompanySettings.findOne();
  if (!doc) {
    doc = await CompanySettings.create({});
  }
  return doc;
}

function toApi(doc) {
  const o = doc.toObject ? doc.toObject() : doc;
  return {
    companyName: o.companyName || 'GreenPad Ventures',
    contactEmail: o.contactEmail || '',
    contactPhone: o.contactPhone || '',
    address: o.address || '',
    logoUrl: o.logoUrl || '',
    primaryColor: o.primaryColor || '#1D9E75',
    smsNotifications: Boolean(o.smsNotificationsEnabled),
    emailNotifications: Boolean(o.emailNotificationsEnabled),
    notifyOnLeadCreated: o.notifyOnLeadCreated !== false,
    notifyOnLeadConverted: o.notifyOnLeadConverted !== false,
    notifyOnProjectStageUpdate: o.notifyOnProjectStageUpdate !== false,
    notifyOnRedemptionRequested: o.notifyOnRedemptionRequested !== false,
    updatedAt: o.updatedAt,
  };
}

exports.getCompanySettings = async (_req, res, next) => {
  try {
    const doc = await getSingleton();
    res.json({ success: true, data: toApi(doc) });
  } catch (error) {
    next(error);
  }
};

exports.putCompanySettings = async (req, res, next) => {
  try {
    const body = req.body || {};
    const patch = {};

    if (body.companyName !== undefined) patch.companyName = String(body.companyName).trim();
    if (body.contactEmail !== undefined) patch.contactEmail = String(body.contactEmail).trim();
    if (body.contactPhone !== undefined) patch.contactPhone = String(body.contactPhone).trim();
    if (body.address !== undefined) patch.address = String(body.address).trim();
    if (body.logoUrl !== undefined) patch.logoUrl = String(body.logoUrl).trim();
    if (body.primaryColor !== undefined) patch.primaryColor = String(body.primaryColor).trim();

    if (body.smsNotifications !== undefined) {
      patch.smsNotificationsEnabled = Boolean(body.smsNotifications);
    }
    if (body.emailNotifications !== undefined) {
      patch.emailNotificationsEnabled = Boolean(body.emailNotifications);
    }
    if (body.notifyOnLeadCreated !== undefined) {
      patch.notifyOnLeadCreated = Boolean(body.notifyOnLeadCreated);
    }
    if (body.notifyOnLeadConverted !== undefined) {
      patch.notifyOnLeadConverted = Boolean(body.notifyOnLeadConverted);
    }
    if (body.notifyOnProjectStageUpdate !== undefined) {
      patch.notifyOnProjectStageUpdate = Boolean(body.notifyOnProjectStageUpdate);
    }
    if (body.notifyOnRedemptionRequested !== undefined) {
      patch.notifyOnRedemptionRequested = Boolean(body.notifyOnRedemptionRequested);
    }

    const doc = await CompanySettings.findOneAndUpdate({}, patch, {
      new: true,
      upsert: true,
      runValidators: true,
      setDefaultsOnInsert: true,
    });

    res.json({
      success: true,
      message: 'Company settings saved',
      data: toApi(doc),
    });
  } catch (error) {
    next(error);
  }
};
