const Lead = require('../models/Lead');
const User = require('../models/User');
const { getCoinSettings } = require('../utils/getCoinSettings');
const { runWithTransaction, awardCoins, clawbackBookingCoins, MILESTONE_TYPES } = require('../utils/coinService');

// POST /api/lead/create
exports.createLead = async (req, res, next) => {
  try {
    const {
      name,
      phone,
      address,
      propertyType,
      roofArea,
      preferredDate,
      timeSlot,
      notes,
      leadType = 'self',
      relationshipNote,
    } = req.body;

    if (!name || !phone || !address) {
      return res.status(400).json({ success: false, message: 'Name, phone, and address are required' });
    }
    if (!/^\d{10}$/.test(phone)) {
      return res.status(400).json({ success: false, message: 'Valid 10-digit phone required' });
    }

    const type = leadType === 'referral' ? 'referral' : 'self';
    if (type === 'referral' && phone === req.user.phone) {
      return res.status(400).json({
        success: false,
        message: 'Use your own phone only when booking for yourself',
      });
    }

    const coinCfg = await getCoinSettings();
    const coinsForBooking = type === 'referral' ? coinCfg.coinsReferralBook : coinCfg.coinsSelfBook;
    const description =
      type === 'referral' ? 'Referral site visit booked' : 'Site visit booked';
    const milestoneType =
      type === 'referral'
        ? MILESTONE_TYPES.LEAD_BOOKING_REFERRAL
        : MILESTONE_TYPES.LEAD_BOOKING_SELF;

    const { lead, user } = await runWithTransaction(async (session) => {
      const [createdLead] = await Lead.create(
        [
          {
            userId: req.user._id,
            leadType: type,
            relationshipNote: relationshipNote ? String(relationshipNote).slice(0, 200) : '',
            name,
            phone,
            address,
            propertyType: propertyType || 'Residential',
            roofArea,
            preferredDate,
            timeSlot,
            notes,
          },
        ],
        { session }
      );

      const award = await awardCoins({
        session,
        userId: req.user._id,
        amount: coinsForBooking,
        description,
        relatedTo: { model: 'Lead', id: createdLead._id },
        milestoneType,
      });

      const updatedUser = award.user || (await User.findById(req.user._id).session(session));
      return { lead: createdLead, user: updatedUser };
    });

    res.status(201).json({
      success: true,
      message:
        type === 'referral'
          ? `Referral visit booked! +${coinsForBooking} coins`
          : `Site visit booked! +${coinsForBooking} coins earned`,
      data: {
        lead,
        coinsEarned: coinsForBooking,
        totalCoins: user.coins,
      },
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/lead/my-leads — show all; legacy DB values normalized to current enum
exports.getMyLeads = async (req, res, next) => {
  try {
    const leads = await Lead.find({ userId: req.user._id }).sort({ createdAt: -1 }).lean();

    const legacyToLost = new Set(['not_converted', 'cancelled', 'rejected']);
    const sanitized = leads.map((l) => ({
      ...l,
      status: legacyToLost.has(l.status) ? 'lost' : l.status,
    }));

    res.json({ success: true, data: sanitized });
  } catch (error) {
    next(error);
  }
};

// PUT /api/lead/:id/reschedule
exports.rescheduleLead = async (req, res, next) => {
  try {
    const { preferredDate, timeSlot } = req.body;

    if (!preferredDate) {
      return res.status(400).json({ success: false, message: 'preferredDate is required' });
    }

    const lead = await Lead.findOne({ _id: req.params.id, userId: req.user._id });

    if (!lead) {
      return res.status(404).json({ success: false, message: 'Lead not found' });
    }

    if (!['pending', 'contacted'].includes(lead.status)) {
      return res.status(400).json({
        success: false,
        message: 'Can only reschedule pending or contacted visits',
      });
    }

    lead.preferredDate = preferredDate;
    if (timeSlot) lead.timeSlot = timeSlot;
    await lead.save();

    res.json({ success: true, message: 'Visit rescheduled', data: lead });
  } catch (error) {
    next(error);
  }
};

// PUT /api/lead/:id/cancel — before visit completed (not visited+)
exports.cancelLead = async (req, res, next) => {
  try {
    const lead = await Lead.findOne({ _id: req.params.id, userId: req.user._id });

    if (!lead) {
      return res.status(404).json({ success: false, message: 'Lead not found' });
    }

    if (!['pending', 'contacted'].includes(lead.status)) {
      return res.status(400).json({
        success: false,
        message: 'You can only cancel before the site visit is completed',
      });
    }

    const result = await runWithTransaction(async (session) => {
      const clawback = await clawbackBookingCoins({
        session,
        lead,
        userId: req.user._id,
      });

      lead.status = 'lost';
      await lead.save({ session });

      return clawback;
    });

    const message =
      result.clawedBack && result.deducted > 0
        ? `Visit cancelled. ${result.deducted} booking coins were reversed.`
        : 'Visit cancelled';

    res.json({
      success: true,
      message,
      data: {
        lead,
        coinsClawedBack: result.clawedBack ? result.deducted : 0,
      },
    });
  } catch (error) {
    next(error);
  }
};
