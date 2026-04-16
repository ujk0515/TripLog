const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

/**
 * 비밀번호 재설정 인증코드 이메일 발송
 * @param {string} to - 수신 이메일
 * @param {string} code - 6자리 인증코드
 */
async function sendVerificationCode(to, code) {
  await transporter.sendMail({
    from: `TripLog <${process.env.SMTP_USER}>`,
    to,
    subject: 'TripLog 비밀번호 재설정 인증코드',
    html: `<p>인증코드: <strong>${code}</strong></p><p>2분 내에 입력해주세요.</p>`,
  });
}

module.exports = { sendVerificationCode };
