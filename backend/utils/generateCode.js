const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateReferralCode() {
  let code = 'GP';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

module.exports = { generateReferralCode };
