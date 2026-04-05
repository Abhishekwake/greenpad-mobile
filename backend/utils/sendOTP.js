// In-memory OTP store for MVP
const otpStore = new Map();
const OTP_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function storeOTP(phone, otp) {
  otpStore.set(phone, {
    otp,
    expiresAt: Date.now() + OTP_EXPIRY_MS,
    attempts: 0,
  });
}

function verifyOTP(phone, otp) {
  const record = otpStore.get(phone);
  if (!record) return { valid: false, message: 'OTP not found. Please request a new one.' };
  if (Date.now() > record.expiresAt) {
    otpStore.delete(phone);
    return { valid: false, message: 'OTP has expired. Please request a new one.' };
  }
  if (record.attempts >= 5) {
    otpStore.delete(phone);
    return { valid: false, message: 'Too many failed attempts. Please request a new OTP.' };
  }
  if (record.otp !== otp) {
    record.attempts += 1;
    return { valid: false, message: 'Incorrect OTP.' };
  }
  otpStore.delete(phone);
  return { valid: true };
}

async function sendOTPViaSMS(phone, otp) {
  // TODO: Integrate real SMS gateway (Twilio, MSG91, etc.)
  console.log(`[OTP] Sending ${otp} to ${phone}`);
  return true;
}

module.exports = { generateOTP, storeOTP, verifyOTP, sendOTPViaSMS };
