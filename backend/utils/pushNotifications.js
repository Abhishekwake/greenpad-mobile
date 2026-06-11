const { Expo } = require('expo-server-sdk');
const User = require('../models/User');
const { getCoinSettings, pickNotificationSettings } = require('../utils/getCoinSettings');

const expo = new Expo();

async function sendPushToUser(userId, { title, body, data = {} }) {
  const user = await User.findById(userId).select('pushToken').lean();
  if (!user?.pushToken || !Expo.isExpoPushToken(user.pushToken)) {
    return { sent: false, reason: 'no_valid_token' };
  }

  const messages = [{ to: user.pushToken, sound: 'default', title, body, data }];
  const chunks = expo.chunkPushNotifications(messages);
  for (const chunk of chunks) {
    try {
      const tickets = await expo.sendPushNotificationsAsync(chunk);
      for (const ticket of tickets) {
        if (ticket.status === 'error') {
          const err = ticket.details?.error;
          if (err === 'DeviceNotRegistered') {
            await User.updateOne({ _id: userId }, { $set: { pushToken: null } });
          }
          console.warn('[push] delivery error:', ticket.message, err);
        }
      }
    } catch (err) {
      console.error('[push] send failed:', err?.message || err);
    }
  }
  return { sent: true };
}

const STATUS_PUSH_COPY = {
  contacted: (leadName) => ({
    title: 'Visit update',
    body: `We contacted ${leadName} about their site visit.`,
  }),
  visited: (leadName) => ({
    title: 'Site visit completed',
    body: `${leadName}'s home visit is done. Check your coins!`,
  }),
  converted: (leadName) => ({
    title: 'Installation confirmed',
    body: `Solar installation confirmed for ${leadName}. Rewards may apply!`,
  }),
  lost: (leadName) => ({
    title: 'Visit closed',
    body: `The visit for ${leadName} was marked closed.`,
  }),
};

async function notifyLeadStatusChange(lead, previousStatus, newStatus) {
  if (!lead?.userId || previousStatus === newStatus) return;

  const settings = pickNotificationSettings(await getCoinSettings());
  if (!settings.notifyLeadStatusPush) return;

  const copyFn = STATUS_PUSH_COPY[newStatus];
  if (!copyFn) return;

  const { title, body } = copyFn(lead.name || 'your referral');
  await sendPushToUser(lead.userId, {
    title,
    body,
    data: { type: 'lead_status', leadId: String(lead._id), status: newStatus },
  });
}

async function notifyProjectStageChange(project, stageId, status, stageName) {
  const settings = pickNotificationSettings(await getCoinSettings());
  if (!settings.notifyProjectStagePush || !project?.customerId) return;

  let title = 'Project update';
  let body = `Your installation progress was updated.`;
  if (status === 'done') {
    title = 'Stage completed';
    body = stageName ? `${stageName} is complete.` : 'A project stage was completed.';
  } else if (status === 'delayed') {
    title = 'Project delayed';
    body = stageName ? `${stageName} has been delayed.` : 'Your project has a delay.';
  }

  await sendPushToUser(project.customerId, {
    title,
    body,
    data: { type: 'project_stage', projectId: String(project._id), stageId, status },
  });
}

module.exports = { sendPushToUser, notifyLeadStatusChange, notifyProjectStageChange };
