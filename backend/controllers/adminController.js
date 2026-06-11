const mongoose = require('mongoose');
const User = require('../models/User');
const Lead = require('../models/Lead');
const Transaction = require('../models/Transaction');
const Reward = require('../models/Reward');
const Agent = require('../models/Agent');
const AppSettings = require('../models/AppSettings');
const {
  getCoinSettings,
  pickAdminSettings,
  ALL_ADMIN_SETTING_KEYS,
} = require('../utils/getCoinSettings');
const { notifyLeadStatusChange } = require('../utils/pushNotifications');
const { resolveCustomerForLead } = require('../utils/resolveCustomerForLead');
const { runWithTransaction, awardCoins, MILESTONE_TYPES } = require('../utils/coinService');
const { logActivity } = require('../utils/activityLog');
const Project = require('../models/Project');
const { summarizeStageStatuses } = require('../utils/workflowHelpers');

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function endOfWeek(d = new Date()) {
  const x = startOfDay(d);
  const day = x.getDay();
  const daysUntilSunday = day === 0 ? 0 : 7 - day;
  x.setDate(x.getDate() + daysUntilSunday);
  return endOfDay(x);
}

const LEAD_SOURCES = ['mobile', 'manual', 'walk_in', 'referral'];
const FOLLOW_UP_STATUSES = ['called', 'no_answer', 'callback', 'meeting_set'];

function last30DaysKeys() {
  const keys = [];
  for (let i = 29; i >= 0; i -= 1) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    keys.push(d.toISOString().slice(0, 10));
  }
  return keys;
}

// GET /api/admin/stats
exports.getStats = async (req, res, next) => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    thirtyDaysAgo.setHours(0, 0, 0, 0);

    const [
      totalUsers,
      totalLeads,
      conversions,
      totalCoinsEarned,
      statusBreakdown,
      signupsAgg,
      recentTransactions,
      pendingRedemptions,
      followUpsDueToday,
      followUpsDueRaw,
      recentLeadsForActivity,
      recentProjectsForActivity,
      recentLeadsForCrmLog,
      activeProjects,
      delayedProjects,
      projectOverview,
    ] = await Promise.all([
      User.countDocuments(),
      Lead.countDocuments(),
      Lead.countDocuments({ status: 'converted' }),
      Transaction.aggregate([
        { $match: { type: 'earn', status: 'completed' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      Lead.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      User.aggregate([
        { $match: { createdAt: { $gte: thirtyDaysAgo } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      Transaction.find()
        .populate('userId', 'name phone')
        .sort({ createdAt: -1 })
        .limit(10)
        .lean(),
      Transaction.countDocuments({ type: 'redeem', status: 'pending' }),
      Lead.countDocuments({
        status: { $nin: ['converted', 'lost'] },
        nextFollowUpDate: { $ne: null, $lte: endOfDay() },
      }),
      Lead.find({
        status: { $nin: ['converted', 'lost'] },
        nextFollowUpDate: { $ne: null, $lte: endOfDay() },
      })
        .sort({ nextFollowUpDate: 1 })
        .limit(5)
        .select('name phone nextFollowUpDate followUps')
        .lean(),
      Lead.find()
        .sort({ updatedAt: -1 })
        .limit(5)
        .select('name status updatedAt')
        .lean(),
      Project.find()
        .sort({ updatedAt: -1 })
        .limit(5)
        .select('customerName updatedAt')
        .lean(),
      Lead.find()
        .sort({ updatedAt: -1 })
        .limit(20)
        .select('name phone status source followUps updatedAt createdAt createdByAdmin')
        .lean(),
      Project.countDocuments({ status: 'active' }),
      Project.countDocuments({ 'stageStatuses.status': 'delayed' }),
      Project.find({ status: 'active' })
        .sort({ updatedAt: -1 })
        .limit(5)
        .select('customerName currentStageId stageStatuses status')
        .lean(),
    ]);

    const dayMap = signupsAgg.reduce((acc, row) => {
      acc[row._id] = row.count;
      return acc;
    }, {});

    const signupsPerDay = last30DaysKeys().map((date) => ({
      date,
      count: dayMap[date] || 0,
    }));

    const followUpsDue = followUpsDueRaw.map((l) => {
      const followUps = l.followUps || [];
      const last = followUps.length ? followUps[followUps.length - 1] : null;
      return {
        _id: l._id,
        name: l.name,
        phone: l.phone,
        nextFollowUpDate: l.nextFollowUpDate,
        lastFollowUpNote: last?.note || '',
      };
    });

    const followUpsDueLeads = followUpsDue.map((l) => ({
      _id: l._id,
      name: l.name,
      phone: l.phone,
      nextFollowUpDate: l.nextFollowUpDate,
      status: '',
    }));

    const recentActivity = [
      ...recentLeadsForActivity.map((l) => ({
        type: 'lead',
        text: `Lead ${l.name} → ${l.status}`,
        time: l.updatedAt,
        color: 'blue',
      })),
      ...recentProjectsForActivity.map((p) => ({
        type: 'project',
        text: `Project ${p.customerName} stage updated`,
        time: p.updatedAt,
        color: 'green',
      })),
    ]
      .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
      .slice(0, 10);

    const recentCrmActivity = [];
    for (const lead of recentLeadsForCrmLog) {
      const latestFollowUp = lead.followUps?.length
        ? [...lead.followUps].sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          )[0]
        : null;
      if (latestFollowUp?.createdAt) {
        recentCrmActivity.push({
          id: `followup-${lead._id}-${latestFollowUp.createdAt}`,
          type: 'follow_up',
          leadId: lead._id,
          leadName: lead.name,
          description: latestFollowUp.note?.slice(0, 120) || 'Follow-up logged',
          actor: latestFollowUp.createdBy || 'Admin',
          at: latestFollowUp.createdAt,
        });
      }
      recentCrmActivity.push({
        id: `lead-${lead._id}-${lead.updatedAt}`,
        type: 'lead_update',
        leadId: lead._id,
        leadName: lead.name,
        description: `Lead status: ${lead.status}`,
        actor: lead.createdByAdmin || 'System',
        at: lead.updatedAt || lead.createdAt,
      });
    }
    recentCrmActivity.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

    const projectOverviewRows = projectOverview.map((p) => {
      const summary = summarizeStageStatuses(p.stageStatuses);
      const pct = summary.total > 0 ? Math.round((summary.done / summary.total) * 100) : 0;
      return {
        _id: p._id,
        customerName: p.customerName,
        currentStageId: p.currentStageId,
        progressPct: pct,
        delayedCount: summary.delayedCount,
      };
    });

    let avgProjectProgress = 0;
    if (projectOverviewRows.length) {
      avgProjectProgress = Math.round(
        projectOverviewRows.reduce((s, r) => s + r.progressPct, 0) / projectOverviewRows.length
      );
    }

    res.json({
      success: true,
      data: {
        totalUsers,
        totalLeads,
        conversions,
        conversionRate: totalLeads > 0 ? Number(((conversions / totalLeads) * 100).toFixed(1)) : 0,
        totalCoinsIssued: totalCoinsEarned[0]?.total || 0,
        leadsByStatus: statusBreakdown.reduce((acc, s) => {
          acc[s._id] = s.count;
          return acc;
        }, {}),
        signupsPerDay,
        recentTransactions,
        pendingRedemptions,
        followUpsDueToday,
        followUpsDue,
        followUpsDueLeads,
        recentActivity,
        recentCrmActivity: recentCrmActivity.slice(0, 15),
        activeProjects,
        avgProjectProgress,
        delayedProjects,
        projectOverview: projectOverviewRows,
      },
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/admin/leads/summary — stat cards for leads page
exports.getLeadsSummary = async (req, res, next) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endToday = endOfDay(now);

    const [totalLeads, followUpDueToday, convertedThisMonth, lostThisMonth] = await Promise.all([
      Lead.countDocuments({ status: { $ne: 'voided' } }),
      Lead.countDocuments({
        status: { $nin: ['converted', 'lost', 'voided'] },
        nextFollowUpDate: { $ne: null, $lte: endToday },
      }),
      Lead.countDocuments({ status: 'converted', updatedAt: { $gte: startOfMonth } }),
      Lead.countDocuments({ status: 'lost', updatedAt: { $gte: startOfMonth } }),
    ]);

    res.json({
      success: true,
      data: { totalLeads, followUpDueToday, convertedThisMonth, lostThisMonth },
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/admin/leads?status=&search=&page=&limit=&source=&followUpDue=&followUpFilter=&sort=
exports.getLeads = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20, search, source, followUpDue, followUpFilter, sort } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const filter = {};
    const leadStatuses = ['pending', 'contacted', 'visited', 'converted', 'lost', 'voided'];
    if (status && leadStatuses.includes(status)) {
      filter.status = status;
    } else {
      filter.status = { $ne: 'voided' };
    }

    if (source && LEAD_SOURCES.includes(String(source))) {
      if (String(source) === 'mobile') {
        filter.$and = filter.$and || [];
        filter.$and.push({
          $or: [{ source: 'mobile' }, { source: { $exists: false } }, { source: null }],
        });
      } else {
        filter.source = String(source);
      }
    }

    const activeLeadFilter = { status: { $nin: ['converted', 'lost', 'voided'] } };

    if (followUpDue === 'true') {
      Object.assign(filter, activeLeadFilter);
      filter.nextFollowUpDate = { $ne: null, $lte: endOfDay() };
    } else if (followUpFilter && followUpFilter !== 'all') {
      Object.assign(filter, activeLeadFilter);
      filter.nextFollowUpDate = { $ne: null };
      const todayStart = startOfDay();
      const todayEnd = endOfDay();

      if (followUpFilter === 'today') {
        filter.nextFollowUpDate.$gte = todayStart;
        filter.nextFollowUpDate.$lte = todayEnd;
      } else if (followUpFilter === 'week') {
        filter.nextFollowUpDate.$gte = todayStart;
        filter.nextFollowUpDate.$lte = endOfWeek();
      } else if (followUpFilter === 'overdue') {
        filter.nextFollowUpDate.$lt = todayStart;
      }
    }

    if (search && String(search).trim()) {
      const q = String(search).trim();
      const digits = q.replace(/\D/g, '');
      filter.$or = [
        { name: new RegExp(escapeRegex(q), 'i') },
        ...(digits ? [{ phone: new RegExp(escapeRegex(digits), 'i') }] : []),
      ];
    }

    const sortSpec =
      sort === 'nextFollowUpDate'
        ? { nextFollowUpDate: 1, createdAt: -1 }
        : { createdAt: -1 };

    const [leads, total] = await Promise.all([
      Lead.find(filter)
        .populate('userId', 'name phone referralCode')
        .populate('assignedAgent', 'name role phone email isActive')
        .sort(sortSpec)
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      Lead.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: {
        leads,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit)) || 1,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/admin/lead/:id/void — soft void site visit (reason required; not a hard delete)
exports.voidLead = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const trimmed = reason != null ? String(reason).trim() : '';

    if (trimmed.length < 5) {
      return res.status(400).json({
        success: false,
        message: 'A void reason is required (at least 5 characters)',
      });
    }

    const lead = await Lead.findById(id);
    if (!lead) {
      return res.status(404).json({ success: false, message: 'Lead not found' });
    }
    if (lead.status === 'voided') {
      return res.status(400).json({ success: false, message: 'Site visit is already voided' });
    }

    const activeProject = await Project.findOne({ leadId: lead._id, status: { $ne: 'voided' } });
    if (activeProject) {
      return res.status(400).json({
        success: false,
        message: 'Void the linked installation project first, or mark it completed, before voiding this site visit.',
      });
    }

    lead.status = 'voided';
    lead.voidedAt = new Date();
    lead.voidedBy = req.admin?.name || 'Admin';
    lead.voidReason = trimmed;
    await lead.save();

    await logActivity({
      req,
      action: 'lead_voided',
      entityType: 'Lead',
      entityId: lead._id,
      meta: { reason: trimmed },
    });

    const populated = await Lead.findById(lead._id)
      .populate('userId', 'name phone referralCode')
      .populate('assignedAgent', 'name role phone email isActive')
      .lean();

    res.json({
      success: true,
      message: 'Site visit voided. It will no longer appear in active enquiries.',
      data: populated,
    });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/admin/lead/:id/status
exports.updateLeadStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['pending', 'contacted', 'visited', 'converted', 'lost'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Status must be one of: ${validStatuses.join(', ')}`,
      });
    }

    const lead = await Lead.findById(id).populate('userId');
    if (!lead) {
      return res.status(404).json({ success: false, message: 'Lead not found' });
    }
    if (lead.status === 'voided') {
      return res.status(400).json({
        success: false,
        message: 'Voided site visits cannot be updated. Create a new enquiry if needed.',
      });
    }

    const previousStatus = lead.status;
    let warning;

    // ── 1. Persist the status change FIRST (no transaction needed) ────────
    //    This guarantees the status is saved even if coin awarding fails later.
    if (status !== previousStatus) {
      await Lead.updateOne({ _id: id }, { $set: { status } });
    }

    // ── 2. Try to award coins in a separate transaction ───────────────────
    //    If this fails the status is already saved, so only coins are lost.
    if (status !== previousStatus) {
      const rawReferrer = lead.userId;
      const referrerId =
        rawReferrer && typeof rawReferrer === 'object' && rawReferrer._id
          ? rawReferrer._id
          : rawReferrer;

      const shouldAwardVisit =
        status === 'visited' && previousStatus !== 'visited' && previousStatus !== 'lost';
      const shouldAwardConvert =
        status === 'converted' && previousStatus !== 'converted' && previousStatus !== 'lost';
      const shouldAwardVisitOnConvert =
        shouldAwardConvert && previousStatus !== 'visited' && previousStatus !== 'lost';

      const needsCoins =
        referrerId && (shouldAwardVisit || shouldAwardConvert || shouldAwardVisitOnConvert);

      if (needsCoins) {
        try {
          await runWithTransaction(async (session) => {
            const referrer = await User.findById(referrerId).session(session);
            if (!referrer) {
              warning = 'Referring user not found; no coins were awarded';
              return;
            }

            const coinCfg = await getCoinSettings();
            const visitCoins = coinCfg.coinsLeadVisited;
            const visitOnConvertCoins = coinCfg.coinsLeadVisitMilestoneOnConvert;
            const convertCoins = coinCfg.coinsLeadConverted;

            if (shouldAwardVisit) {
              await awardCoins({
                session,
                userId: referrer._id,
                amount: visitCoins,
                description: `Lead visited: ${lead.name}`,
                relatedTo: { model: 'Lead', id: lead._id },
                milestoneType: MILESTONE_TYPES.LEAD_VISITED,
              });
            }

            if (shouldAwardVisitOnConvert) {
              await awardCoins({
                session,
                userId: referrer._id,
                amount: visitOnConvertCoins,
                description: `Lead visited: ${lead.name}`,
                relatedTo: { model: 'Lead', id: lead._id },
                milestoneType: MILESTONE_TYPES.LEAD_VISIT_ON_CONVERT,
              });
            }

            if (shouldAwardConvert) {
              await awardCoins({
                session,
                userId: referrer._id,
                amount: convertCoins,
                description: `Installation confirmed: ${lead.name}`,
                relatedTo: { model: 'Lead', id: lead._id },
                milestoneType: MILESTONE_TYPES.LEAD_CONVERTED,
              });
            }
          });
        } catch (coinErr) {
          console.error('[updateLeadStatus] coin awarding failed (status was saved):', coinErr?.message || coinErr);
          warning = 'Status saved but coin awarding failed — check logs';
        }
      }

      // fire-and-forget notifications & activity log
      notifyLeadStatusChange(lead, previousStatus, status).catch((err) => {
        console.error('[push] lead status notify failed:', err?.message || err);
      });
      logActivity({
        req,
        action: 'lead_status_changed',
        entityType: 'Lead',
        entityId: lead._id,
        meta: { from: previousStatus, to: status },
      }).catch(() => {});
    }

    // ── 3. Re-fetch the lead with populated references for the response ───
    const updated = await Lead.findById(id)
      .populate('userId', 'name phone referralCode')
      .populate('assignedAgent', 'name role phone email isActive')
      .lean();

    res.json({
      success: true,
      message: `Lead status updated to ${status}`,
      data: updated,
      ...(warning && { warning }),
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/admin/lead/create — manual lead entry (no userId, no booking coins)
exports.createLeadManual = async (req, res, next) => {
  try {
    const {
      name,
      phone,
      email,
      address,
      propertyType,
      roofArea,
      preferredDate,
      timeSlot,
      source,
      assignedAgent,
      initialNote,
    } = req.body;

    if (!name || String(name).trim().length < 3) {
      return res.status(400).json({
        success: false,
        message: 'Name is required (minimum 3 characters)',
      });
    }
    if (!phone || !/^\d{10}$/.test(String(phone))) {
      return res.status(400).json({ success: false, message: 'Valid 10-digit phone required' });
    }

    const leadSource = source && LEAD_SOURCES.includes(String(source)) ? String(source) : 'manual';
    if (source && !LEAD_SOURCES.includes(String(source))) {
      return res.status(400).json({
        success: false,
        message: `source must be one of: ${LEAD_SOURCES.join(', ')}`,
      });
    }

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const duplicate = await Lead.findOne({
      phone: String(phone),
      status: { $nin: ['lost', 'voided'] },
      createdAt: { $gte: thirtyDaysAgo },
    });
    if (duplicate) {
      return res.status(409).json({
        success: false,
        message: 'This phone already has an active visit booked in the last 30 days',
      });
    }

    const adminName = req.admin?.name || 'Admin';
    const followUps = [];
    let nextFollowUpDate;

    if (initialNote && String(initialNote).trim()) {
      followUps.push({
        note: String(initialNote).trim(),
        status: 'called',
        createdBy: adminName,
        createdAt: new Date(),
      });
    }

    const leadData = {
      userId: null,
      name: String(name).trim(),
      phone: String(phone),
      email: email ? String(email).trim() : '',
      address: address && String(address).trim().length >= 10 ? String(address).trim() : 'Address pending',
      propertyType: propertyType || 'Residential',
      roofArea: roofArea != null && roofArea !== '' ? Number(roofArea) : undefined,
      preferredDate: preferredDate || undefined,
      timeSlot: timeSlot || undefined,
      source: leadSource,
      leadType: leadSource === 'referral' ? 'referral' : 'self',
      status: 'pending',
      followUps,
      createdByAdmin: adminName,
      nextFollowUpDate,
    };

    if (assignedAgent) {
      if (!mongoose.Types.ObjectId.isValid(assignedAgent)) {
        return res.status(400).json({ success: false, message: 'Invalid agent id' });
      }
      const agent = await Agent.findOne({ _id: assignedAgent, isActive: true });
      if (!agent) {
        return res.status(400).json({ success: false, message: 'Agent not found or inactive' });
      }
      leadData.assignedAgent = agent._id;
    }

    const lead = await Lead.create(leadData);

    try {
      await resolveCustomerForLead(lead);
    } catch (linkErr) {
      console.warn('[createLeadManual] App user link skipped:', linkErr.message);
    }

    const populated = await Lead.findById(lead._id)
      .populate('userId', 'name phone referralCode')
      .populate('assignedAgent', 'name role phone email isActive')
      .lean();

    res.status(201).json({
      success: true,
      message: 'Lead created',
      data: populated,
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/admin/lead/:id/followup
exports.addLeadFollowUp = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { note, status, nextFollowUpDate, createdBy } = req.body;

    if (!note || !String(note).trim()) {
      return res.status(400).json({ success: false, message: 'Note is required' });
    }

    const followStatus =
      status && FOLLOW_UP_STATUSES.includes(String(status)) ? String(status) : 'called';

    const lead = await Lead.findById(id);
    if (!lead) {
      return res.status(404).json({ success: false, message: 'Lead not found' });
    }

    const entry = {
      note: String(note).trim(),
      status: followStatus,
      createdBy: createdBy || req.admin?.name || 'Admin',
      createdAt: new Date(),
    };

    if (nextFollowUpDate) {
      entry.nextFollowUpDate = new Date(nextFollowUpDate);
    }

    lead.followUps.push(entry);
    lead.lastFollowUpAt = new Date();

    if (nextFollowUpDate) {
      lead.nextFollowUpDate = new Date(nextFollowUpDate);
    }

    await lead.save();

    await logActivity({
      req,
      action: 'lead_followup',
      entityType: 'Lead',
      entityId: lead._id,
      meta: { status: followStatus },
    });

    const updated = await Lead.findById(id)
      .populate('userId', 'name phone referralCode')
      .populate('assignedAgent', 'name role phone email isActive')
      .lean();

    res.json({
      success: true,
      message: 'Follow-up logged',
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/admin/lead — walk-in / manual lead (no booking coins)
exports.createLeadAdmin = async (req, res, next) => {
  try {
    const {
      userId,
      name,
      phone,
      address,
      propertyType,
      leadType = 'self',
      notes,
      preferredDate,
      timeSlot,
      relationshipNote,
    } = req.body;

    if (!userId || !name || !phone || !address) {
      return res.status(400).json({
        success: false,
        message: 'userId, name, phone, and address are required',
      });
    }
    if (!/^\d{10}$/.test(String(phone))) {
      return res.status(400).json({ success: false, message: 'Valid 10-digit phone required' });
    }

    const referrer = await User.findById(userId);
    if (!referrer) {
      return res.status(404).json({ success: false, message: 'Referring user not found' });
    }

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const duplicate = await Lead.findOne({
      phone: String(phone),
      status: { $nin: ['lost', 'voided'] },
      createdAt: { $gte: thirtyDaysAgo },
    });
    if (duplicate) {
      return res.status(409).json({
        success: false,
        message: 'This phone already has an active visit booked in the last 30 days',
      });
    }

    const type = leadType === 'referral' ? 'referral' : 'self';

    const lead = await Lead.create({
      userId: referrer._id,
      leadType: type,
      relationshipNote: relationshipNote ? String(relationshipNote).slice(0, 200) : '',
      name: String(name).trim(),
      phone: String(phone),
      address: String(address).trim(),
      propertyType: propertyType || 'Residential',
      preferredDate: preferredDate || undefined,
      timeSlot: timeSlot || undefined,
      notes: notes ? String(notes).slice(0, 500) : '',
      status: 'pending',
    });

    res.status(201).json({
      success: true,
      message: 'Lead created',
      data: lead,
    });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/admin/user/:id — deactivate / reactivate
exports.updateUserActive = async (req, res, next) => {
  try {
    const { isActive } = req.body;
    if (typeof isActive !== 'boolean') {
      return res.status(400).json({ success: false, message: 'isActive must be true or false' });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    if (user.role === 'admin') {
      return res.status(400).json({ success: false, message: 'Cannot deactivate legacy admin user records' });
    }

    user.isActive = isActive;
    await user.save();

    res.json({
      success: true,
      message: isActive ? 'User reactivated' : 'User deactivated',
      data: { _id: user._id, isActive: user.isActive },
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/admin/users?search=&page=&limit=
exports.getUsers = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const filter = {};
    if (search && String(search).trim()) {
      const digits = String(search).replace(/\D/g, '');
      if (digits) {
        filter.phone = new RegExp(escapeRegex(digits), 'i');
      }
    }

    const [users, total] = await Promise.all([
      User.find(filter)
        .select('-__v')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      User.countDocuments(filter),
    ]);

    const usersWithRefs = await Promise.all(
      users.map(async (u) => ({
        ...u,
        totalReferrals: u.referralCode
          ? await User.countDocuments({ referredBy: u.referralCode })
          : 0,
      }))
    );

    res.json({
      success: true,
      data: {
        users: usersWithRefs,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit)) || 1,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/admin/user/:id
exports.getUserById = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select('-__v').lean();
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const [transactions, leads, totalReferrals] = await Promise.all([
      Transaction.find({ userId: user._id }).sort({ createdAt: -1 }).lean(),
      Lead.find({ userId: user._id }).sort({ createdAt: -1 }).lean(),
      user.referralCode
        ? User.countDocuments({ referredBy: user.referralCode })
        : Promise.resolve(0),
    ]);

    res.json({
      success: true,
      data: {
        user,
        transactions,
        leads,
        totalReferrals,
      },
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/admin/rewards
exports.listRewards = async (req, res, next) => {
  try {
    const rewards = await Reward.find().sort({ coinsRequired: 1 }).lean();
    res.json({ success: true, data: rewards });
  } catch (error) {
    next(error);
  }
};

// POST /api/admin/reward
exports.createReward = async (req, res, next) => {
  try {
    const { title, description, coinsRequired, icon, stock } = req.body;

    if (!title || !description || coinsRequired == null) {
      return res.status(400).json({
        success: false,
        message: 'Title, description, and coinsRequired are mandatory',
      });
    }

    const coins = Number(coinsRequired);
    if (Number.isNaN(coins) || coins < 50) {
      return res.status(400).json({
        success: false,
        message: 'coinsRequired must be at least 50',
      });
    }

    const reward = await Reward.create({
      title,
      description,
      coinsRequired: coins,
      icon: icon || '🎁',
      stock: stock === '' || stock === undefined || stock === null ? null : Number(stock),
    });

    res.status(201).json({ success: true, data: reward });
  } catch (error) {
    next(error);
  }
};

// PUT /api/admin/reward/:id
exports.updateReward = async (req, res, next) => {
  try {
    const { id } = req.params;
    const allowed = ['title', 'description', 'coinsRequired', 'icon', 'stock', 'isActive'];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    if (updates.coinsRequired != null) {
      const c = Number(updates.coinsRequired);
      if (Number.isNaN(c) || c < 50) {
        return res.status(400).json({ success: false, message: 'coinsRequired must be at least 50' });
      }
      updates.coinsRequired = c;
    }

    const reward = await Reward.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true,
    });

    if (!reward) {
      return res.status(404).json({ success: false, message: 'Reward not found' });
    }

    res.json({ success: true, data: reward });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/admin/reward/:id
exports.deleteReward = async (req, res, next) => {
  try {
    const reward = await Reward.findByIdAndDelete(req.params.id);
    if (!reward) {
      return res.status(404).json({ success: false, message: 'Reward not found' });
    }
    res.json({ success: true, message: 'Reward deleted' });
  } catch (error) {
    next(error);
  }
};

// GET /api/admin/transactions?type=&startDate=&endDate=&page=&limit=
exports.getTransactions = async (req, res, next) => {
  try {
    const { type, startDate, endDate, page = 1, limit = 20 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const filter = {};
    if (type && ['earn', 'redeem', 'pending'].includes(type)) {
      filter.type = type;
    }

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(String(startDate));
      if (endDate) {
        const end = new Date(String(endDate));
        end.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = end;
      }
    }

    const [rows, total] = await Promise.all([
      Transaction.find(filter)
        .populate('userId', 'name phone')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      Transaction.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: {
        transactions: rows,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit)) || 1,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/admin/redemptions?status=pending|completed|cancelled|failed|all&page=&limit=
exports.getRedemptions = async (req, res, next) => {
  try {
    const { status = 'pending', page = 1, limit = 20 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const filter = { type: 'redeem' };
    if (status && status !== 'all' && ['pending', 'completed', 'cancelled', 'failed'].includes(String(status))) {
      filter.status = status;
    }

    const [rows, total] = await Promise.all([
      Transaction.find(filter)
        .populate('userId', 'name phone')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      Transaction.countDocuments(filter),
    ]);

    const rewardIds = rows
      .filter((r) => r.relatedTo?.model === 'Reward' && r.relatedTo?.id)
      .map((r) => r.relatedTo.id);
    const rewards =
      rewardIds.length > 0
        ? await Reward.find({ _id: { $in: rewardIds } }).select('title icon coinsRequired').lean()
        : [];
    const rewardMap = Object.fromEntries(rewards.map((rw) => [String(rw._id), rw]));

    const redemptions = rows.map((r) => ({
      ...r,
      reward:
        r.relatedTo?.model === 'Reward' && r.relatedTo?.id
          ? rewardMap[String(r.relatedTo.id)] || null
          : null,
    }));

    res.json({
      success: true,
      data: {
        redemptions,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit)) || 1,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/admin/redemption/:id  body: { status: 'completed' | 'cancelled' }
exports.updateRedemptionStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['completed', 'cancelled'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'status must be "completed" or "cancelled"',
      });
    }

    const tx = await Transaction.findById(id);
    if (!tx || tx.type !== 'redeem') {
      return res.status(404).json({ success: false, message: 'Redemption not found' });
    }
    if (tx.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Only pending redemptions can be updated',
      });
    }

    if (status === 'completed') {
      await runWithTransaction(async (session) => {
        tx.status = 'completed';
        tx.fulfilledAt = new Date();
        await tx.save({ session });
      });
      return res.json({
        success: true,
        message: 'Marked as fulfilled',
        data: tx,
      });
    }

    const refundResult = await runWithTransaction(async (session) => {
      const freshTx = await Transaction.findById(id).session(session);
      if (!freshTx || freshTx.type !== 'redeem' || freshTx.status !== 'pending') {
        return { ok: false, message: 'Redemption not found or already updated' };
      }

      const coins = Math.abs(Number(freshTx.amount) || 0);
      const user = await User.findById(freshTx.userId).session(session);
      if (!user) {
        return { ok: false, message: 'User not found for this redemption' };
      }

      await User.findByIdAndUpdate(
        user._id,
        {
          $inc: { coins },
          $set: { totalRedeemed: Math.max(0, (user.totalRedeemed || 0) - coins) },
        },
        { session }
      );

      if (freshTx.relatedTo?.model === 'Reward' && freshTx.relatedTo.id) {
        const reward = await Reward.findById(freshTx.relatedTo.id).session(session);
        if (reward && reward.stock != null) {
          await Reward.findByIdAndUpdate(
            freshTx.relatedTo.id,
            { $inc: { stock: 1 } },
            { session }
          );
        }
      }

      freshTx.status = 'cancelled';
      await freshTx.save({ session });

      return { ok: true, transaction: freshTx, coinsRefunded: coins };
    });

    if (!refundResult.ok) {
      return res.status(404).json({ success: false, message: refundResult.message });
    }

    return res.json({
      success: true,
      message: 'Redemption cancelled and coins refunded',
      data: { transaction: refundResult.transaction, coinsRefunded: refundResult.coinsRefunded },
    });
  } catch (error) {
    next(error);
  }
};

// --- Coin rules (AppSettings) ---

// GET /api/admin/coin-settings
exports.getCoinSettingsAdmin = async (req, res, next) => {
  try {
    const doc = await getCoinSettings();
    res.json({
      success: true,
      data: pickAdminSettings(doc),
    });
  } catch (error) {
    next(error);
  }
};

// PUT /api/admin/coin-settings
exports.putCoinSettingsAdmin = async (req, res, next) => {
  try {
    const updates = {};
    for (const k of ALL_ADMIN_SETTING_KEYS) {
      if (req.body[k] === undefined || req.body[k] === null) {
        continue;
      }
      if (
        k === 'notifyLeadStatusPush' ||
        k === 'notifyProjectStagePush' ||
        k === 'notifyCoinRedemptionPush' ||
        k === 'customerDocumentsEnabled' ||
        k === 'internalDocumentsEnabled' ||
        k === 'reelsEnabled'
      ) {
        updates[k] = Boolean(req.body[k]);
        continue;
      }
      if (
        k.startsWith('company') ||
        k.startsWith('brand') ||
        k === 'supportWhatsApp' ||
        k === 'supportPhone'
      ) {
        if (k === 'supportWhatsApp' || k === 'supportPhone') {
          const digits = String(req.body[k]).replace(/\D/g, '').slice(-10);
          if (!/^\d{10}$/.test(digits)) {
            return res.status(400).json({ success: false, message: `${k} must be a 10-digit number` });
          }
          updates[k] = digits;
        } else {
          updates[k] = String(req.body[k]).trim();
        }
        continue;
      }
      if (req.body[k] === '') {
        continue;
      }
      const n = Number(req.body[k]);
      if (Number.isNaN(n)) {
        return res.status(400).json({ success: false, message: `Invalid value for ${k}` });
      }
      if (k === 'bookingClawbackHours') {
        if (n < 1 || n > 168) {
          return res.status(400).json({
            success: false,
            message: 'bookingClawbackHours must be between 1 and 168',
          });
        }
        updates[k] = Math.round(n);
      } else if (n < 0 || n > 500000) {
        return res.status(400).json({ success: false, message: `Invalid value for ${k}` });
      } else {
        updates[k] = Math.round(n);
      }
    }
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, message: 'No valid fields to update' });
    }

    const doc = await AppSettings.findOneAndUpdate(
      { singletonKey: 'global' },
      { $set: updates },
      { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true }
    );

    res.json({
      success: true,
      message: 'Settings saved',
      data: pickAdminSettings(doc),
    });
  } catch (error) {
    next(error);
  }
};

// --- Agents ---

// GET /api/admin/agents?includeInactive=1
exports.listAgents = async (req, res, next) => {
  try {
    const includeInactive = req.query.includeInactive === '1';
    const filter = includeInactive ? {} : { isActive: true };
    const agents = await Agent.find(filter).sort({ name: 1 }).lean();
    res.json({ success: true, data: agents });
  } catch (error) {
    next(error);
  }
};

// POST /api/admin/agent
exports.createAgent = async (req, res, next) => {
  try {
    const { name, role, phone, email } = req.body;
    if (!name || !String(name).trim()) {
      return res.status(400).json({ success: false, message: 'Name is required' });
    }
    const agent = await Agent.create({
      name: String(name).trim(),
      role: role != null ? String(role).trim().slice(0, 80) : '',
      phone: phone != null ? String(phone).trim().slice(0, 20) : '',
      email: email != null ? String(email).trim().slice(0, 120) : '',
    });
    res.status(201).json({ success: true, data: agent });
  } catch (error) {
    next(error);
  }
};

// PUT /api/admin/agent/:id
exports.updateAgent = async (req, res, next) => {
  try {
    const { id } = req.params;
    const allowed = ['name', 'role', 'phone', 'email', 'isActive'];
    const updates = {};
    for (const k of allowed) {
      if (req.body[k] !== undefined) updates[k] = req.body[k];
    }
    if (updates.name != null) updates.name = String(updates.name).trim();
    if (updates.role != null) updates.role = String(updates.role).trim().slice(0, 80);
    if (updates.phone != null) updates.phone = String(updates.phone).trim().slice(0, 20);
    if (updates.email != null) updates.email = String(updates.email).trim().slice(0, 120);
    if (Object.prototype.hasOwnProperty.call(updates, 'isActive')) {
      updates.isActive = Boolean(updates.isActive);
    } else {
      delete updates.isActive;
    }

    const agent = await Agent.findByIdAndUpdate(id, updates, { new: true, runValidators: true });
    if (!agent) {
      return res.status(404).json({ success: false, message: 'Agent not found' });
    }
    res.json({ success: true, data: agent });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/admin/lead/:id/assign  body: { assignedAgentId: string | null }
exports.updateLeadAssign = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { assignedAgentId } = req.body;

    const lead = await Lead.findById(id);
    if (!lead) {
      return res.status(404).json({ success: false, message: 'Lead not found' });
    }

    if (assignedAgentId === null || assignedAgentId === '' || assignedAgentId === undefined) {
      lead.assignedAgent = null;
    } else if (!mongoose.Types.ObjectId.isValid(assignedAgentId)) {
      return res.status(400).json({ success: false, message: 'Invalid agent id' });
    } else {
      const agent = await Agent.findOne({ _id: assignedAgentId, isActive: true });
      if (!agent) {
        return res.status(400).json({ success: false, message: 'Agent not found or inactive' });
      }
      lead.assignedAgent = agent._id;
    }

    await lead.save();

    const updated = await Lead.findById(id)
      .populate('userId', 'name phone referralCode')
      .populate('assignedAgent', 'name role phone email isActive')
      .lean();

    res.json({ success: true, message: 'Assignment updated', data: updated });
  } catch (error) {
    next(error);
  }
};

// --- Coin reconciliation (super_admin) ---

const CoinReconciliationRun = require('../models/CoinReconciliationRun');

// GET /api/admin/reconciliation?limit=10
exports.getReconciliationRuns = async (req, res, next) => {
  try {
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 10));
    const runs = await CoinReconciliationRun.find()
      .sort({ ranAt: -1 })
      .limit(limit)
      .lean();
    res.json({ success: true, data: runs });
  } catch (error) {
    next(error);
  }
};

// POST /api/admin/reconciliation/run — manual trigger
exports.runReconciliationNow = async (req, res, next) => {
  try {
    const reconcileCoins = require('../jobs/reconcileCoins');
    const run = await reconcileCoins();
    res.json({ success: true, data: run });
  } catch (error) {
    next(error);
  }
};
