
const AfricasTalking = require("africastalking");

// Initialise Africa's Talking using environment variables.
const client = AfricasTalking({
  apiKey: process.env.AT_API_KEY,
  username: process.env.AT_USERNAME
});

// Initialise SMS service.
const sms = client.SMS;

// Convert Kenyan phone numbers into international format.
function formatPhoneNumber(phone) {
  let number = String(phone || "").replace(/\D/g, "");

  if (number.startsWith("0")) {
    number = "254" + number.slice(1);
  }

  if (/^[17]\d{8}$/.test(number)) {
    number = "254" + number;
  }

  if (!/^254[17]\d{8}$/.test(number)) {
    throw new Error("Invalid Kenyan phone number");
  }

  return `+${number}`;
}

// Send a single SMS.
async function sendSMS({ to, message }) {
  if (!message || !message.trim()) {
    throw new Error("SMS message cannot be empty");
  }

  const phone = formatPhoneNumber(to);

  const options = {
    to: [phone],
    message
  };

  // Only use a sender ID if configured.
  if (process.env.AT_SENDER_ID) {
    options.senderId = process.env.AT_SENDER_ID;
  }

  try {
    const response = await sms.send(options);

    // An HTTP success does not always mean the SMS
    // was accepted for delivery.
    const recipients =
      response?.SMSMessageData?.Recipients || [];

    if (
      !recipients.length ||
      !recipients.every((recipient) =>
        ["Success", "Sent"].includes(recipient.status)
      )
    ) {
      throw new Error(
        `SMS not accepted: ${JSON.stringify(response)}`
      );
    }

    console.log("SMS accepted by provider:", response);

    return response;
  } catch (error) {
    console.error("Africa's Talking SMS error:", error);
    throw error;
  }
}

// Send notification after successful payment.
async function sendPaymentSMS(payment) {
  const merchant = payment.paymentLink.user;

  const amount = Number(payment.amount).toLocaleString("en-KE");
  const receipt = payment.mpesaReceiptNumber;

  const tasks = [];

  // SMS to merchant
  if (merchant.phone) {
    tasks.push(
      sendSMS({
        to: merchant.phone,
        message:
          `PayLink: Payment of KES ${amount} received ` +
          `from ${payment.payerPhone}. ` +
          `M-Pesa receipt: ${receipt}. ` +
          "Log in to your dashboard for details."
      })
    );
  }

  // SMS to customer
  tasks.push(
    sendSMS({
      to: payment.payerPhone,
      message:
        `Your payment of KES ${amount} to ${merchant.name} ` +
        `was successful. Receipt: ${receipt}. ` +
        "Thank you for using PayLink."
    })
  );

  return Promise.allSettled(tasks);
}

module.exports = {
  formatPhoneNumber,
  sendSMS,
  sendPaymentSMS
};
