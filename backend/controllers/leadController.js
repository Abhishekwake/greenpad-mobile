const Lead = require('../models/Lead');
const User = require('../models/User');
const Transaction = require('../models/Transaction');

// POST /api/lead/create
exports.createLead = async (req, res, next) => {
  try {
    const { name, phone, address, propertyType, roofArea, preferredDate, timeSlot, notes } =
      req.body;

    if (!name || !phone || !address) {
      return res.status(400).json({ success: false, message: 'Name, phone, and address are required' });
    }
    if (!/^\d{10}$/.test(phone)) {
      return res.status(400).json({ success: false, message: 'Valid 10-digit phone required' });
    }

    const lead = await Lead.create({
      userId: req.user._id,
      name,
      phone,
      address,
      propertyType: propertyType || 'Residential',
      roofArea,
      preferredDate,
      timeSlot,
      notes,
    });

    // Award 100 coins for booking a visit
    const user = await User.findById(req.user._id);
    user.coins += 100;
    user.totalEarned += 100;
    await user.save();

    await Transaction.create({
      userId: user._id,
      type: 'earn',
      amount: 100,
      description: 'Site visit booked',
      relatedTo: { model: 'Lead', id: lead._id },
    });

    res.status(201).json({
      success: true,
      message: 'Site visit booked! +100 coins earned',
      data: {
        lead,
        coinsEarned: 100,
        totalCoins: user.coins,
      },
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/lead/my-leads
exports.getMyLeads = async (req, res, next) => {
  try {
    const leads = await Lead.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .lean();

    res.json({ success: true, data: leads });
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

// PUT /api/lead/:id/cancel
exports.cancelLead = async (req, res, next) => {
  try {
    const lead = await Lead.findOne({ _id: req.params.id, userId: req.user._id });

    if (!lead) {
      return res.status(404).json({ success: false, message: 'Lead not found' });
    }

    if (!['pending', 'contacted'].includes(lead.status)) {
      return res.status(400).json({
        success: false,
        message: 'Can only cancel pending or contacted visits',
      });
    }

    lead.status = 'rejected';
    await lead.save();

    res.json({ success: true, message: 'Visit cancelled', data: lead });
  } catch (error) {
    next(error);
  }
};
