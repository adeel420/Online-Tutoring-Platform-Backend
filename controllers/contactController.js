const { sendContactFormEmail } = require("../middleware/email");

exports.submitContactForm = async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;

    if (!name?.trim() || !email?.trim() || !subject?.trim() || !message?.trim()) {
      return res.status(400).json({ error: "All fields are required." });
    }

    await sendContactFormEmail({
      name: name.trim(),
      email: email.trim(),
      subject: subject.trim(),
      message: message.trim(),
    });

    res.status(200).json({ message: "Message sent successfully." });
  } catch (err) {
    console.error("Contact Form Error:", err);
    res.status(500).json({ error: "Could not send your message." });
  }
};
