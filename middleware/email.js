const {
  Verification_Email_Template,
  Welcome_Email_Template,
  Teacher_Pending_Template,
  Admin_Teacher_Notification_Template,
  Teacher_Approved_Template,
  Teacher_Rejected_Template,
} = require("../utils/emailTemplate");
const transporter = require("./nodemailer");
require("dotenv").config();

const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const FROM = '"TutorHub" <' + process.env.EMAIL_USER + ">";

// Send OTP verification code to user
const sendVerificationCode = async (email, verificationCode) => {
  await transporter.sendMail({
    from: FROM,
    to: email,
    subject: "Verify Your Email — TutorHub",
    html: Verification_Email_Template.replace("{verificationCode}", verificationCode),
  });
};

// Send welcome email after email is verified
const welcomeCode = async (email, name) => {
  await transporter.sendMail({
    from: FROM,
    to: email,
    subject: "Welcome to TutorHub! 🎉",
    html: Welcome_Email_Template.replace("{name}", name),
  });
};

// Send pending approval email to teacher after signup
const sendTeacherPendingEmail = async (email, name) => {
  await transporter.sendMail({
    from: FROM,
    to: email,
    subject: "Your TutorHub Account is Under Review ⏳",
    html: Teacher_Pending_Template.replace("{name}", name),
  });
};

// Send notification to admin when a teacher registers
const sendAdminTeacherNotification = async ({ name, email, phone }) => {
  const date = new Date().toLocaleString("en-PK", { timeZone: "Asia/Karachi" });
  await transporter.sendMail({
    from: FROM,
    to: ADMIN_EMAIL,
    subject: `New Teacher Registration: ${name} — TutorHub`,
    html: Admin_Teacher_Notification_Template
      .replace("{name}", name)
      .replace("{email}", email)
      .replace("{phone}", phone)
      .replace("{date}", date),
  });
};

// Send approval email to teacher when admin approves their account
const sendTeacherApprovedEmail = async (email, name) => {
  await transporter.sendMail({
    from: FROM,
    to: email,
    subject: "Your TutorHub Account Has Been Approved! 🎉",
    html: Teacher_Approved_Template.replace("{name}", name),
  });
};

// Send rejection email to teacher when admin rejects their account
const sendTeacherRejectedEmail = async (email, name) => {
  await transporter.sendMail({
    from: FROM,
    to: email,
    subject: "Your TutorHub Application Has Been Rejected",
    html: Teacher_Rejected_Template.replace("{name}", name),
  });
};

const paymentHtml = ({ heading, message, booking }) => `
  <div style="font-family:Arial,sans-serif;background:#f6f7fb;padding:24px">
    <div style="max-width:620px;margin:auto;background:#fff;border-radius:14px;padding:24px;border:1px solid #eee">
      <h2 style="margin:0 0 12px;color:#4c1d95">${heading}</h2>
      <p style="color:#444;line-height:1.6">${message}</p>
      <div style="background:#f5f3ff;border-radius:12px;padding:16px;margin-top:18px">
        <p><b>Student:</b> ${booking.studentName}</p>
        <p><b>Tutor:</b> ${booking.tutorName}</p>
        <p><b>Subject:</b> ${booking.subject || "N/A"}</p>
        <p><b>Session:</b> ${booking.day}, ${booking.from} - ${booking.to}</p>
        <p><b>Amount:</b> PKR ${booking.amount}</p>
        <p><b>Payment Ref:</b> ${booking.paymentReference}</p>
      </div>
      <p style="font-size:12px;color:#777;margin-top:20px">TutorHub</p>
    </div>
  </div>
`;

const sendStudentPaymentEmail = async (email, booking) => {
  await transporter.sendMail({
    from: FROM,
    to: email,
    subject: "Payment received by TutorHub",
    html: paymentHtml({
      heading: "Payment received",
      message: "Your JazzCash payment has been received by TutorHub admin. Your session is now booked.",
      booking,
    }),
  });
};

const sendTutorPaymentEmail = async (email, booking) => {
  await transporter.sendMail({
    from: FROM,
    to: email,
    subject: "Student paid for a session",
    html: paymentHtml({
      heading: "Session payment completed",
      message: "A student has paid TutorHub admin for your session. You can view this booking in your tutor dashboard.",
      booking,
    }),
  });
};

const sendAdminPaymentEmail = async (booking) => {
  if (!ADMIN_EMAIL) return;

  await transporter.sendMail({
    from: FROM,
    to: ADMIN_EMAIL,
    subject: `New session payment: PKR ${booking.amount}`,
    html: paymentHtml({
      heading: "New payment received",
      message: "A student has paid for a tutor session. The amount has been recorded for admin.",
      booking,
    }),
  });
};

const complaintHtml = ({ heading, message, details }) => `
  <div style="font-family:Arial,sans-serif;background:#f6f7fb;padding:24px">
    <div style="max-width:620px;margin:auto;background:#fff;border-radius:14px;padding:24px;border:1px solid #eee">
      <h2 style="margin:0 0 12px;color:#4c1d95">${heading}</h2>
      <p style="color:#444;line-height:1.6">${message}</p>
      ${
        details
          ? `<div style="background:#f5f3ff;border-radius:12px;padding:16px;margin-top:18px">
              ${details}
            </div>`
          : ""
      }
      <p style="font-size:12px;color:#777;margin-top:20px">TutorHub</p>
    </div>
  </div>
`;

const sendComplaintConfirmationEmail = async (email, complaint) => {
  await transporter.sendMail({
    from: FROM,
    to: email,
    subject: "Your complaint has been submitted",
    html: complaintHtml({
      heading: "Complaint submitted",
      message: `You submitted a complaint against ${complaint.againstName}. Our admin team will review it.`,
      details: `
        <p><b>Against:</b> ${complaint.againstName} (${complaint.againstRole})</p>
        <p><b>Subject:</b> ${complaint.subject}</p>
        <p><b>Details:</b> ${complaint.message}</p>
      `,
    }),
  });
};

const sendAdminComplaintEmail = async (complaint) => {
  if (!ADMIN_EMAIL) return;

  await transporter.sendMail({
    from: FROM,
    to: ADMIN_EMAIL,
    subject: `New complaint: ${complaint.subject}`,
    html: complaintHtml({
      heading: "New complaint received",
      message: "A new complaint has been submitted on TutorHub.",
      details: `
        <p><b>From:</b> ${complaint.complainantName} (${complaint.complainantRole}) - ${complaint.complainantEmail}</p>
        <p><b>Against:</b> ${complaint.againstName} (${complaint.againstRole}) - ${complaint.againstEmail}</p>
        <p><b>Subject:</b> ${complaint.subject}</p>
        <p><b>Details:</b> ${complaint.message}</p>
      `,
    }),
  });
};

const sendComplaintNoticeEmail = async (email, complaint) => {
  await transporter.sendMail({
    from: FROM,
    to: email,
    subject: "A complaint has been filed about your account",
    html: complaintHtml({
      heading: "Complaint notice",
      message:
        "A complaint has been filed about your TutorHub account. For privacy, the complainant's identity is not shared. Admin will review the complaint and contact you if needed.",
      details: `<p><b>Subject:</b> ${complaint.subject}</p>`,
    }),
  });
};

const sendContactFormEmail = async ({ name, email, subject, message }) => {
  if (!ADMIN_EMAIL) return;

  await transporter.sendMail({
    from: FROM,
    to: ADMIN_EMAIL,
    replyTo: email,
    subject: `Contact form: ${subject}`,
    html: `
      <div style="font-family:Arial,sans-serif;background:#f6f7fb;padding:24px">
        <div style="max-width:620px;margin:auto;background:#fff;border-radius:14px;padding:24px;border:1px solid #eee">
          <h2 style="margin:0 0 12px;color:#4c1d95">New contact message</h2>
          <p style="color:#444;line-height:1.6">A visitor submitted the TutorHub contact form.</p>
          <div style="background:#f5f3ff;border-radius:12px;padding:16px;margin-top:18px">
            <p><b>Name:</b> ${name}</p>
            <p><b>Email:</b> ${email}</p>
            <p><b>Subject:</b> ${subject}</p>
            <p><b>Message:</b></p>
            <p style="white-space:pre-line;color:#444">${message}</p>
          </div>
          <p style="font-size:12px;color:#777;margin-top:20px">TutorHub</p>
        </div>
      </div>
    `,
  });
};

module.exports = {
  sendVerificationCode,
  welcomeCode,
  sendTeacherPendingEmail,
  sendAdminTeacherNotification,
  sendTeacherApprovedEmail,
  sendTeacherRejectedEmail,
  sendStudentPaymentEmail,
  sendTutorPaymentEmail,
  sendAdminPaymentEmail,
  sendComplaintConfirmationEmail,
  sendAdminComplaintEmail,
  sendComplaintNoticeEmail,
  sendContactFormEmail,
};
