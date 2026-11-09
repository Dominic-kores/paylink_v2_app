
const { Resend } = require("resend");

const money = (amount) =>
  `KES ${Number(amount).toLocaleString("en-KE")}`;

function escapeHTML(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]
  );
}

function paymentReceipt(payment) {
  const rows = [
    ["Amount", money(payment.amount)],
    ["Merchant", payment.paymentLink.user.name],
    ["Description", payment.paymentLink.description],
    ["Transaction ID", payment.id],
    ["M-Pesa Receipt", payment.mpesaReceiptNumber],
    ["Date", new Date(payment.paidAt).toLocaleString(
      "en-KE",
      { timeZone: "Africa/Nairobi" }
    )]
  ];

  const tableRows = rows.map(([label, value]) => `
    <tr>
      <td style="padding:12px;border-bottom:1px solid #e5e7eb">
        ${escapeHTML(label)}
      </td>
      <td style="padding:12px;border-bottom:1px solid #e5e7eb">
        ${escapeHTML(value)}
      </td>
    </tr>
  `).join("");

  const html = `
    <table role="presentation" width="100%"
      cellpadding="0" cellspacing="0"
      style="background:#f3f6fa;font-family:Arial,sans-serif">
      <tr>
        <td align="center" style="padding:32px 12px">
          <table role="presentation" width="560"
            style="max-width:100%;background:white;border-radius:12px">
            <tr>
              <td style="padding:28px;background:#163b67;color:white">
                <h1 style="margin:0">PayLink</h1>
                <p>Payment Receipt</p>
              </td>
            </tr>
            <tr>
              <td style="padding:28px">
                <p style="color:#15803d;font-weight:bold">
                  ✓ PAYMENT SUCCESSFUL
                </p>
                <h2>${escapeHTML(money(payment.amount))}</h2>
                <table role="presentation" width="100%"
                  cellpadding="0" cellspacing="0">
                  ${tableRows}
                </table>
                <p>Thank you for using PayLink.</p>
                <p style="font-size:12px;color:#6b7280">
                  This is an automated transaction receipt.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `;

  const text = [
    "PayLink - Payment Successful",
    ...rows.map(([key, value]) => `${key}: ${value}`),
    "Thank you for using PayLink."
  ].join("\n");

  return { html, text };
}

async function sendPaymentReceipt(payment) {
  if (!payment.payerEmail || !process.env.RESEND_API_KEY) {
    return;
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const { html, text } = paymentReceipt(payment);

  const { data, error } = await resend.emails.send({
    from: process.env.FROM_EMAIL,
    to: payment.payerEmail,
    subject: "PayLink - Payment Successful",
    html,
    text
  });

  if (error) throw new Error(JSON.stringify(error));

  return data;
}

async function sendDailySummary(email, payments, dashboardURL) {
  if (!email || !process.env.RESEND_API_KEY) return;

  const resend = new Resend(process.env.RESEND_API_KEY);
  const total = payments.reduce((sum, p) => sum + p.amount, 0);

  const lines = payments.map((p) =>
    `<tr><td>${escapeHTML(p.id)}</td><td>${escapeHTML(
      new Date(p.paidAt).toLocaleString("en-KE")
    )}</td><td>${money(p.amount)}</td></tr>`
  ).join("");

  const { error } = await resend.emails.send({
    from: process.env.FROM_EMAIL,
    to: email,
    subject: "PayLink Daily Payment Summary",
    html: `
      <h2>PayLink Daily Summary</h2>
      <p>Completed payments: ${payments.length}</p>
      <p>Total received: ${money(total)}</p>
      <table border="1" cellpadding="8">
        <tr><th>Transaction</th><th>Time</th><th>Amount</th></tr>
        ${lines}
      </table>
      <p><a href="${escapeHTML(dashboardURL)}">View Dashboard</a></p>
    `,
    text: `Payments: ${payments.length}\nTotal: ${money(total)}\n${dashboardURL}`
  });

  if (error) throw new Error(JSON.stringify(error));
}

module.exports = {
  sendPaymentReceipt,
  sendDailySummary
};
