/** Stable keys for idempotent coin awards (unique per user + relatedTo.id + milestoneType). */
const MILESTONE_TYPES = {
  WELCOME_BONUS: 'welcome_bonus',
  REFERRAL_SIGNUP_REFEREE: 'referral_signup_referee',
  REFERRAL_SIGNUP_REFERRER: 'referral_signup_referrer',
  LEAD_BOOKING_SELF: 'lead_booking_self',
  LEAD_BOOKING_REFERRAL: 'lead_booking_referral',
  LEAD_VISITED: 'lead_visited',
  LEAD_VISIT_ON_CONVERT: 'lead_visit_on_convert',
  LEAD_CONVERTED: 'lead_converted',
  LEAD_BOOKING_CLAWBACK: 'lead_booking_clawback',
  REDEEM: 'redeem',
};

const BOOKING_MILESTONE_TYPES = [
  MILESTONE_TYPES.LEAD_BOOKING_SELF,
  MILESTONE_TYPES.LEAD_BOOKING_REFERRAL,
];

module.exports = { MILESTONE_TYPES, BOOKING_MILESTONE_TYPES };
