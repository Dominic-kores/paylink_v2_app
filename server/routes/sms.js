
const express = require("express");
const auth = require("../middleware/auth");
const { sendSMS } = require("../services/smsService");

const router = express.Router();

// Authenticated merchant test endpoint.
router.post("/test", auth, async (req, res) => {
  try {
    const { phone, message } = req.body;

    if (!phone || !message) {
      return res.status(400).json({
        success: false,
        error: "Phone number and message are required"
      });
    }

    const result = await sendSMS({
      to: phone,
      message
    });

    res.status(200).json({
      success: true,
      message: "SMS accepted by Africa's Talking",
      result
    });
  } catch (error) {
    console.error("SMS test failed:", error.message);

    res.status(500).json({
      success: false,
      error: "Unable to send test SMS"
    });
  }
});

module.exports = router;
