
const express = require("express");
const prisma = require("../lib/prisma");
const auth = require("../middleware/auth");

const router = express.Router();

router.get("/", auth, async (req, res, next) => {
  try {
    const merchantFilter = {
      paymentLink: {
        userId: req.userId
      }
    };

    const today = new Date();
    const start = new Date(Date.UTC(
      today.getUTCFullYear(),
      today.getUTCMonth(),
      today.getUTCDate() - 6
    ));

    const [
      totals,
      pendingPayments,
      completedPayments,
      totalAttempts,
      recentPayments
    ] = await Promise.all([
      prisma.payment.aggregate({
        where: {
          ...merchantFilter,
          status: "COMPLETED"
        },
        _sum: { amount: true }
      }),
      prisma.payment.count({
        where: {
          ...merchantFilter,
          status: "PENDING"
        }
      }),
      prisma.payment.count({
        where: {
          ...merchantFilter,
          status: "COMPLETED"
        }
      }),
      prisma.payment.count({
        where: merchantFilter
      }),
      prisma.payment.findMany({
        where: {
          ...merchantFilter,
          status: "COMPLETED",
          paidAt: { gte: start }
        },
        select: {
          amount: true,
          paidAt: true
        }
      })
    ]);

    const revenueMap = new Map();

    for (let i = 0; i < 7; i++) {
      const date = new Date(start);
      date.setUTCDate(start.getUTCDate() + i);

      revenueMap.set(
        date.toISOString().slice(0, 10),
        0
      );
    }

    recentPayments.forEach((payment) => {
      const day = payment.paidAt.toISOString().slice(0, 10);

      if (revenueMap.has(day)) {
        revenueMap.set(
          day,
          revenueMap.get(day) + payment.amount
        );
      }
    });

    res.json({
      totalRevenue: totals._sum.amount || 0,
      pendingPayments,
      completedPayments,
      totalAttempts,
      conversionRate: totalAttempts
        ? Number(
            (completedPayments / totalAttempts * 100).toFixed(1)
          )
        : 0,
      dailyRevenue: Array.from(revenueMap, ([date, amount]) => ({
        date,
        amount
      }))
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
