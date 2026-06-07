const year = new Date().getFullYear();

const baseStyle = `
  <style>
    body { font-family: Arial, sans-serif; margin: 0; padding: 0; background: #f4f4f4; }
    .wrap { max-width: 600px; margin: 30px auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); border: 1px solid #e5e7eb; }
    .header { background: linear-gradient(135deg, #7c3aed, #2563eb); padding: 28px 20px; text-align: center; }
    .header h1 { color: #fff; margin: 0; font-size: 24px; font-weight: bold; }
    .header p { color: rgba(255,255,255,0.8); margin: 6px 0 0; font-size: 14px; }
    .logo { width: 48px; height: 48px; background: rgba(255,255,255,0.2); border-radius: 12px; display: inline-flex; align-items: center; justify-content: center; font-size: 22px; font-weight: bold; color: #fff; margin-bottom: 10px; }
    .body { padding: 30px; color: #374151; line-height: 1.7; }
    .otp-box { background: linear-gradient(135deg, #f5f3ff, #eff6ff); border: 2px dashed #7c3aed; border-radius: 10px; padding: 16px; text-align: center; margin: 20px 0; font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #7c3aed; }
    .badge { display: inline-block; background: linear-gradient(135deg, #7c3aed, #2563eb); color: #fff; padding: 10px 28px; border-radius: 8px; font-weight: bold; font-size: 15px; text-decoration: none; margin: 16px 0; }
    .info-box { background: #f9fafb; border-left: 4px solid #7c3aed; border-radius: 6px; padding: 14px 18px; margin: 16px 0; font-size: 14px; }
    .info-box b { color: #7c3aed; }
    .warning { background: #fffbeb; border-left: 4px solid #f59e0b; border-radius: 6px; padding: 12px 16px; margin: 16px 0; font-size: 13px; color: #92400e; }
    .footer { background: #f9fafb; padding: 16px; text-align: center; color: #9ca3af; font-size: 12px; border-top: 1px solid #e5e7eb; }
    p { margin: 0 0 12px; }
  </style>
`;

// 1. OTP Verification Email (sent to user on signup)
const Verification_Email_Template = `
<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Verify Your Email</title>${baseStyle}</head>
<body>
  <div class="wrap">
    <div class="header">
      <div class="logo">T</div>
      <h1>Verify Your Email</h1>
      <p>TutorHub — Pakistan's Top Tutoring Platform</p>
    </div>
    <div class="body">
      <p>Hello,</p>
      <p>Thank you for signing up on <b>TutorHub</b>! Please verify your email address by entering the code below:</p>
      <div class="otp-box">{verificationCode}</div>
      <div class="warning">⏰ This code expires in <b>10 minutes</b>. Do not share it with anyone.</div>
      <p>If you did not create an account, please ignore this email.</p>
    </div>
    <div class="footer"><p>&copy; ${year} TutorHub. All rights reserved.</p></div>
  </div>
</body></html>
`;

// 2. Welcome Email (sent to user after email verification)
const Welcome_Email_Template = `
<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Welcome to TutorHub</title>${baseStyle}</head>
<body>
  <div class="wrap">
    <div class="header">
      <div class="logo">T</div>
      <h1>Welcome to TutorHub! 🎉</h1>
      <p>Your email has been verified successfully</p>
    </div>
    <div class="body">
      <p>Hello <b>{name}</b>,</p>
      <p>Your email has been verified and your account is now active. Welcome to Pakistan's top online tutoring platform!</p>
      <p>Here's what you can do now:</p>
      <ul>
        <li>Browse and book sessions with expert tutors</li>
        <li>Access learning materials and resources</li>
        <li>Join live sessions and interact in real-time</li>
        <li>Track your learning progress</li>
      </ul>
      <div style="text-align:center"><a href="http://localhost:5173/login" class="badge">Get Started →</a></div>
    </div>
    <div class="footer"><p>&copy; ${year} TutorHub. All rights reserved.</p></div>
  </div>
</body></html>
`;

// 3. Teacher Pending Email (sent to teacher after signup — account pending approval)
const Teacher_Pending_Template = `
<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Account Pending Approval</title>${baseStyle}</head>
<body>
  <div class="wrap">
    <div class="header">
      <div class="logo">T</div>
      <h1>Account Under Review ⏳</h1>
      <p>TutorHub Teacher Verification</p>
    </div>
    <div class="body">
      <p>Hello <b>{name}</b>,</p>
      <p>Thank you for registering as a tutor on <b>TutorHub</b>! We have received your documents and your account is currently <b>pending admin approval</b>.</p>
      <div class="info-box">
        <b>What happens next?</b><br>
        Our admin team will review your submitted documents (CNIC and Experience Letter) within <b>24–48 hours</b>. You will receive an email once your account is approved.
      </div>
      <p>Documents submitted:</p>
      <ul>
        <li>✅ National ID (CNIC)</li>
        <li>✅ Experience Letter</li>
      </ul>
      <div class="warning">⚠️ You will <b>not</b> be able to login until your account is approved by the admin.</div>
      <p>If you have any questions, please contact us at <a href="mailto:tutorhub999@gmail.com" style="color:#7c3aed">tutorhub999@gmail.com</a></p>
    </div>
    <div class="footer"><p>&copy; ${year} TutorHub. All rights reserved.</p></div>
  </div>
</body></html>
`;

// 4. Admin Notification Email (sent to admin when a teacher signs up)
const Admin_Teacher_Notification_Template = `
<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>New Teacher Registration</title>${baseStyle}</head>
<body>
  <div class="wrap">
    <div class="header">
      <div class="logo">T</div>
      <h1>New Teacher Registration 👨🏫</h1>
      <p>Action Required — TutorHub Admin Panel</p>
    </div>
    <div class="body">
      <p>Hello <b>Admin</b>,</p>
      <p>A new teacher has registered on TutorHub and is awaiting your approval. Please review their documents and approve or reject their account.</p>
      <div class="info-box">
        <b>Teacher Details:</b><br><br>
        <b>Name:</b> {name}<br>
        <b>Email:</b> {email}<br>
        <b>Phone:</b> {phone}<br>
        <b>Registered At:</b> {date}
      </div>
      <p>Documents submitted:</p>
      <ul>
        <li>📄 National ID (CNIC) — uploaded to Cloudinary</li>
        <li>📄 Experience Letter — uploaded to Cloudinary</li>
      </ul>
      <div style="text-align:center"><a href="http://localhost:5173/admin_dashboard" class="badge">Review in Admin Panel →</a></div>
    </div>
    <div class="footer"><p>&copy; ${year} TutorHub. All rights reserved.</p></div>
  </div>
</body></html>
`;

// 5. Teacher Approved Email
const Teacher_Approved_Template = `
<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Account Approved</title>${baseStyle}</head>
<body>
  <div class="wrap">
    <div class="header">
      <div class="logo">T</div>
      <h1>Account Approved! 🎉</h1>
      <p>Welcome to the TutorHub Teacher Community</p>
    </div>
    <div class="body">
      <p>Hello <b>{name}</b>,</p>
      <p>Great news! Your tutor account on <b>TutorHub</b> has been <b style="color:#16a34a">approved</b> by our admin team. You can now login and start teaching!</p>
      <div class="info-box">
        <b>You can now:</b><br>
        ✅ Login to your tutor dashboard<br>
        ✅ Set your availability schedule<br>
        ✅ Accept student bookings<br>
        ✅ Conduct live sessions<br>
        ✅ Upload learning materials
      </div>
      <div style="text-align:center"><a href="http://localhost:5173/login" class="badge">Login to Dashboard →</a></div>
      <p>If you have any questions, feel free to contact us at <a href="mailto:tutorhub999@gmail.com" style="color:#7c3aed">tutorhub999@gmail.com</a></p>
    </div>
    <div class="footer"><p>&copy; ${year} TutorHub. All rights reserved.</p></div>
  </div>
</body></html>
`;

// 6. Teacher Rejected Email
const Teacher_Rejected_Template = `
<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Account Rejected</title>${baseStyle}</head>
<body>
  <div class="wrap">
    <div class="header" style="background:linear-gradient(135deg,#dc2626,#b91c1c)">
      <div class="logo">T</div>
      <h1>Application Rejected ❌</h1>
      <p>TutorHub Teacher Verification</p>
    </div>
    <div class="body">
      <p>Hello <b>{name}</b>,</p>
      <p>We regret to inform you that your tutor application on <b>TutorHub</b> has been <b style="color:#dc2626">rejected</b> by our admin team after reviewing your submitted documents.</p>
      <div class="info-box" style="border-left-color:#dc2626">
        <b style="color:#dc2626">Reason:</b><br>
        Your submitted documents did not meet our verification requirements. This could be due to unclear images, invalid documents, or incomplete information.
      </div>
      <p>You may re-apply with valid documents by creating a new account:</p>
      <div style="text-align:center"><a href="http://localhost:5173/signup" class="badge" style="background:linear-gradient(135deg,#dc2626,#b91c1c)">Re-Apply →</a></div>
      <p>If you believe this is a mistake, please contact us at <a href="mailto:tutorhub999@gmail.com" style="color:#7c3aed">tutorhub999@gmail.com</a></p>
    </div>
    <div class="footer"><p>&copy; ${year} TutorHub. All rights reserved.</p></div>
  </div>
</body></html>
`;

module.exports = {
  Verification_Email_Template,
  Welcome_Email_Template,
  Teacher_Pending_Template,
  Admin_Teacher_Notification_Template,
  Teacher_Approved_Template,
  Teacher_Rejected_Template,
};
