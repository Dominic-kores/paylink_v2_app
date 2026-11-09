
const axios = require("axios");

const baseURL =
  process.env.MPESA_ENV === "production"
    ? "https://api.safaricom.co.ke"
    : "https://sandbox.safaricom.co.ke";

function formatPhoneNumber(value) {
  let phone = String(value || "").replace(/\D/g, "");

  if (phone.startsWith("0")) {
    phone = "254" + phone.slice(1);
  }

  if (/^[17]\d{8}$/.test(phone)) {
    phone = "254" + phone;
  }

  if (!/^254[17]\d{8}$/.test(phone)) {
    throw new Error("Enter a valid Kenyan mobile number");
  }

  return phone;
}

// M-Pesa requires the timestamp in East Africa Time.
function getTimestamp() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Nairobi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  }).formatToParts(new Date());

  const get = (type) =>
    parts.find((part) => part.type === type)?.value;

  return [
    get("year"),
    get("month"),
    get("day"),
    get("hour"),
    get("minute"),
    get("second")
  ].join("");
}

async function getAccessToken() {
  const credentials = Buffer.from(
    `${process.env.MPESA_CONSUMER_KEY}:${process.env.MPESA_CONSUMER_SECRET}`
  ).toString("base64");

  const response = await axios.get(
    `${baseURL}/oauth/v1/generate`,
    {
      params: {
        grant_type: "client_credentials"
      },
      headers: {
        Authorization: `Basic ${credentials}`
      },
      timeout: 15000
    }
  );

  return response.data.access_token;
}

async function initiateSTKPush({
  phone,
  amount,
  paymentId
}) {
  const token = await getAccessToken();
  const timestamp = getTimestamp();

  const shortcode = process.env.MPESA_SHORTCODE;

  const password = Buffer.from(
    `${shortcode}${process.env.MPESA_PASSKEY}${timestamp}`
  ).toString("base64");

  const callbackURL =
    `${process.env.PUBLIC_SERVER_URL}/api/payments/mpesa/callback/` +
    encodeURIComponent(process.env.MPESA_CALLBACK_SECRET);

  const payload = {
    BusinessShortCode: shortcode,
    Password: password,
    Timestamp: timestamp,
    TransactionType: "CustomerPayBillOnline",
    Amount: amount,
    PartyA: phone,
    PartyB: shortcode,
    PhoneNumber: phone,
    CallBackURL: callbackURL,
    AccountReference: paymentId.slice(0, 12),
    TransactionDesc: "PayLink Payment"
  };

  const response = await axios.post(
    `${baseURL}/mpesa/stkpush/v1/processrequest`,
    payload,
    {
      headers: {
        Authorization: `Bearer ${token}`
      },
      timeout: 20000
    }
  );

  return response.data;
}

module.exports = {
  formatPhoneNumber,
  initiateSTKPush
};
