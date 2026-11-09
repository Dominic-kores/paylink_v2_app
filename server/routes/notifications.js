
const express = require("express");
const prisma = require("../lib/prisma");
const auth = require("../middleware/auth");

const router = express.Router();

router.use(auth);

// Fetch stored notifications, including unread count.
router.get("/", async (req, res, next) => {
  try {
    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: { userId: req.userId },
        orderBy: { createdAt: "desc" },
        take: 50
      }),
      prisma.notification.count({
        where: {
          userId: req.userId,
          read: false
        }
      })
    ]);

    res.json({
      notifications,
      unreadCount
    });
  } catch (error) {
    next(error);
  }
});

// Mark an individual notification as read.
router.patch("/:id/read", async (req, res, next) => {
  try {
    const result = await prisma.notification.updateMany({
      where: {
        id: req.params.id,
        userId: req.userId
      },
      data: { read: true }
    });

    if (!result.count) {
      return res.status(404).json({
        error: "Notification not found"
      });
    }

    res.json({ message: "Notification marked as read" });
  } catch (error) {
    next(error);
  }
});

// Mark all notifications as read.
router.patch("/read-all", async (req, res, next) => {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.userId },
      data: { read: true }
    });

    res.json({ message: "All notifications marked as read" });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
