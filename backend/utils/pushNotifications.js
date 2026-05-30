const { Expo } = require('expo-server-sdk');
const User = require('../models/User');

const expo = new Expo();

/**
 * Send a push notification to a user's saved Expo push token.
 * @param {import('mongoose').Types.ObjectId|string} userId
 * @param {{ title: string, body: string, data?: Record<string, string> }} message
 */
async function sendPushToUser(userId, { title, body, data = {} }) {
  const user = await User.findById(userId).select('pushToken').lean();
  if (!user?.pushToken || !Expo.isExpoPushToken(user.pushToken)) {
    return { sent: false, reason: 'no_valid_token' };
  }

  const messages = [
    {
      to: user.pushToken,
      sound: 'default',
      title,
      body,
      data,
    },
  ];

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

/**
 * Notify lead owner when admin changes pipeline status.
 */
async function notifyLeadStatusChange(lead, previousStatus, newStatus) {
  if (!lead?.userId || previousStatus === newStatus) {
    return;
  }
  const copyFn = STATUS_PUSH_COPY[newStatus];
  if (!copyFn) {
    return;
  }
  const { title, body } = copyFn(lead.name || 'your referral');
  await sendPushToUser(lead.userId, {
    title,
    body,
    data: {
      type: 'lead_status',
      leadId: String(lead._id),
      status: newStatus,
    },
  });
}

module.exports = { sendPushToUser, notifyLeadStatusChange };
