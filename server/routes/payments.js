
const express = require("express");
const crypto = require("crypto");
const prisma = require("../lib/prisma");
const auth = require("../middleware/auth");
const {
  formatPhoneNumber,
  initiateSTKPush
} = require("../services/mpesaService");
const {
  sendPaymentReceipt
} = require("../services/emailService");
const {
  sendPaymentSMS
} = require("../services/smsService");
const {
  createNotification
} = require("../services/notificationService");

const router = express.Router();

const paymentInclude = {
  paymentLink: {
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true
        }
      }
    }
  }
};

// Helper: return payment fields safe for the payer.
function publicPayment(payment) {
  return {
    id: payment.id,
    status: payment.status,
    amount: payment.amount,
    paidAt: payment.paidAt,
    mpesaReceiptNumber: payment.mpesaReceiptNumber,
    failureReason: payment.failureReason
  };
}

// 1. CREATE A PAYMENT LINK (merchant only)
router.post("/links", auth, async (req, res, next) => {
  try {
    const { description, amount } = req.body;
    const value = Number(amount);

    if (!description?.trim() ||
        description.length > 200 ||
        !Number.isSafeInteger(value) ||
        value < 1) {
      return res.status(400).json({
        error: "Enter a description and a positive whole KES amount"
      });
    }

    const link = await prisma.paymentLink.create({
      data: {
        description: description.trim(),
        amount: value,
        slug: crypto.randomBytes(12).toString("hex"),
        userId: req.userId
      }
    });

    res.status(201).json({
      ...link,
      paymentUrl: `${process.env.CLIENT_URL}/pay/${link.slug}`
    });
  } catch (error) {
    next(error);
  }
});

// 2. LIST MERCHANT PAYMENT LINKS
router.get("/links", auth, async (req, res, next) => {
  try {
    const links = await prisma.paymentLink.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: "desc" }
    });

    res.json(links.map((link) => ({
      ...link,
      paymentUrl: `${process.env.CLIENT_URL}/pay/${link.slug}`
    })));
  } catch (error) {
    next(error);
  }
});

// 3. GET PUBLIC PAYMENT LINK
router.get("/links/:slug", async (req, res, next) => {
  try {
    const link = await prisma.paymentLink.findUnique({
      where: { slug: req.params.slug },
      include: {
        user: { select: { name: true } }
      }
    });

    if (!link || !link.active) {
      return res.status(404).json({
        error: "Payment link not found or inactive"
      });
    }

    res.json({
      slug: link.slug,
      amount: link.amount,
      description: link.description,
      merchantName: link.user.name
    });
  } catch (error) {
    next(error);
  }
});

// 4. INITIATE M-PESA STK PUSH
router.post("/stkpush", async (req, res, next) => {
  try {
    const { slug, phone, email } = req.body;

    const link = await prisma.paymentLink.findUnique({
      where: { slug: String(slug || "") }
    });

    if (!link || !link.active) {
      return res.status(404).json({
        error: "Payment link unavailable"
      });
    }

    const payerPhone = formatPhoneNumber(phone);

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({
        error: "Invalid email address"
      });
    }

    // Create pending payment BEFORE requesting STK Push.
    const payment = await prisma.payment.create({
      data: {
        paymentLinkId: link.id,
        amount: link.amount,
        payerPhone,
        payerEmail: email?.trim() || null,
        status: "PENDING"
      }
    });

    try {
      const result = await initiateSTKPush({
        phone: payerPhone,
        amount: link.amount,
        paymentId: payment.id
      });

      if (String(result.ResponseCode) !== "0" ||
          !result.CheckoutRequestID) {
        throw new Error(
          result.ResponseDescription || "STK request rejected"
        );
      }

      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          checkoutRequestId: result.CheckoutRequestID,
          merchantRequestId: result.MerchantRequestID
        }
      });

      return res.status(202).json({
        paymentId: payment.id,
        status: "PENDING",
        message: "STK Push sent. Complete payment on your phone."
      });
    } catch (error) {
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: "FAILED",
          failureReason: "Unable to initiate STK Push"
        }
      });

      console.error(
        "STK Push error:",
        error.response?.data || error.message
      );

      return res.status(502).json({
        error: "Unable to initiate M-Pesa payment. Please retry."
      });
    }
  } catch (error) {
    if (error.message.includes("Kenyan mobile")) {
      return res.status(400).json({ error: error.message });
    }
    next(error);
  }
});

// 5. PUBLIC PAYMENT STATUS
router.get("/status/:paymentId", async (req, res, next) => {
  try {
    const { slug } = req.query;

    if (!slug) {
      return res.status(400).json({
        error: "Payment link slug required"
      });
    }

    const payment = await prisma.payment.findFirst({
      where: {
        id: req.params.paymentId,
        paymentLink: { slug: String(slug) }
      }
    });

    if (!payment) {
      return res.status(404).json({
        error: "Payment not found"
      });
    }

    res.json(publicPayment(payment));
  } catch (error) {
    next(error);
  }
});

// 6. M-PESA CALLBACK
router.post(
  "/mpesa/callback/:secret",
  async (req, res) => {
    // Callback path secret is basic protection, not
    // cryptographic verification of Safaricom's identity.
    const expected = Buffer.from(
      process.env.MPESA_CALLBACK_SECRET || ""
    );
    const supplied = Buffer.from(req.params.secret || "");

    if (!expected.length ||
        expected.length !== supplied.length ||
        !crypto.timingSafeEqual(expected, supplied)) {
      return res.sendStatus(403);
    }

    const callback = req.body?.Body?.stkCallback;

    if (!callback?.CheckoutRequestID ||
        typeof callback.ResultCode !== "number") {
      return res.status(400).json({
        error: "Invalid callback"
      });
    }

    // Acknowledge quickly after database persistence.
    try {
      const payment = await prisma.payment.findUnique({
        where: {
          checkoutRequestId: callback.CheckoutRequestID
        },
        include: paymentInclude
      });

      if (!payment) {
        console.error(
          "Unknown checkout ID:",
          callback.CheckoutRequestID
        );

        return res.status(404).json({
          error: "Unknown checkout request"
        });
      }

      const success = callback.ResultCode === 0;
      const items = callback.CallbackMetadata?.Item || [];

      const metadata = (name) =>
        items.find((item) => item.Name === name)?.Value;

      const receipt = metadata("MpesaReceiptNumber");
      const callbackAmount = Number(metadata("Amount"));

      // Do not accept a success with missing/mismatched
      // receipt or transaction amount.
      const validSuccess =
        success &&
        typeof receipt === "string" &&
        receipt.length > 0 &&
        callbackAmount === payment.amount;

      if (success && !validSuccess) {
        console.error("Suspicious M-Pesa success callback", {
          paymentId: payment.id
        });

        return res.status(400).json({
          error: "Payment verification required"
        });
      }

      // updateMany prevents repeated callbacks from
      // changing an already finalised transaction.
      const updated = await prisma.payment.updateMany({
        where: {
          id: payment.id,
          status: "PENDING"
        },
        data: {
          status: success ? "COMPLETED" : "FAILED",
          mpesaReceiptNumber: success ? receipt : null,
          paidAt: success ? new Date() : null,
          failureReason: success
            ? null
            : String(callback.ResultDesc || "Payment failed")
                .slice(0, 300)
        }
      });

      // Duplicate callbacks must not repeat notifications.
      if (updated.count === 0) {
        return res.json({
          ResultCode: 0,
          ResultDesc: "Already processed"
        });
      }

      const finalPayment = await prisma.payment.findUnique({
        where: { id: payment.id },
        include: paymentInclude
      });

      const io = req.app.get("io");
      const merchantId = finalPayment.paymentLink.userId;

      const payload = publicPayment(finalPayment);

      io.to(`payment:${payment.id}`).emit(
        "payment-status",
        payload
      );

      io.to(`merchant:${merchantId}`).emit(
        "payment-updated",
        payload
      );

      const backgroundTasks = [];

      // Persist a notification for the merchant.
      backgroundTasks.push(createNotification(io, {
        userId: merchantId,
        title: success ? "Payment Received" : "Payment Failed",
        message: success
          ? `KES ${payment.amount.toLocaleString("en-KE")} received. Receipt: ${receipt}`
          : `Payment failed: ${finalPayment.failureReason}`,
        type: success ? "success" : "error"
      }));

      if (success) {
        if (finalPayment.payerEmail) {
          backgroundTasks.push(
            sendPaymentReceipt(finalPayment)
          );
        }

        backgroundTasks.push(
          sendPaymentSMS(finalPayment)
        );
      }

      // Do not make the M-Pesa callback wait for
      // email or SMS provider responses.
      Promise.allSettled(backgroundTasks).then((results) => {
        results.forEach((result) => {
          if (result.status === "rejected") {
            console.error(
              "Notification delivery error:",
              result.reason
            );
          }
        });
      });

      return res.json({
        ResultCode: 0,
        ResultDesc: "Accepted"
      });
    } catch (error) {
      console.error("M-Pesa callback error:", error);

      return res.status(500).json({
        error: "Callback processing error"
      });
    }
  }
);

// 7. PAYMENT HISTORY WITH FILTERS
router.get("/", auth, async (req, res, next) => {
  try {
    const {
      status,
      from,
      to,
      minAmount,
      maxAmount
    } = req.query;

    const page = Math.max(
      1,
      Number.parseInt(req.query.page, 10) || 1
    );

    const limit = Math.min(
      100,
      Math.max(1, Number.parseInt(req.query.limit, 10) || 20)
    );

    if (status &&
        !["pending", "completed", "failed"].includes(status)) {
      return res.status(400).json({
        error: "Invalid payment status"
      });
    }

    const where = {
      paymentLink: { userId: req.userId }
    };

    if (status) {
      where.status = status.toUpperCase();
    }

    if (from || to) {
      where.createdAt = {};

      if (from) {
        const start = new Date(`${from}T00:00:00Z`);
        if (Number.isNaN(start.getTime())) {
          return res.status(400).json({ error: "Invalid from date" });
        }
        where.createdAt.gte = start;
      }

      if (to) {
        const end = new Date(`${to}T00:00:00Z`);
        if (Number.isNaN(end.getTime())) {
          return res.status(400).json({ error: "Invalid to date" });
        }
        end.setUTCDate(end.getUTCDate() + 1);
        where.createdAt.lt = end;
      }
    }

    if (minAmount !== undefined ||
        maxAmount !== undefined) {
      where.amount = {};

      if (minAmount !== undefined) {
        where.amount.gte = Number(minAmount);
      }

      if (maxAmount !== undefined) {
        where.amount.lte = Number(maxAmount);
      }

      if (Object.values(where.amount).some(
        (value) => !Number.isFinite(value) || value < 0
      )) {
        return res.status(400).json({
          error: "Invalid amount range"
        });
      }
    }

    const [total, payments] = await Promise.all([
      prisma.payment.count({ where }),
      prisma.payment.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          paymentLink: {
            select: { description: true, slug: true }
          }
        }
      })
    ]);

    res.json({
      data: payments,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
