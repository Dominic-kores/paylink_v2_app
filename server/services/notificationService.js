
const prisma = require("../lib/prisma");

async function createNotification(io, {
  userId,
  title,
  message,
  type = "info"
}) {
  const notification = await prisma.notification.create({
    data: {
      userId,
      title,
      message,
      type
    }
  });

  // Only the authenticated merchant's room receives it.
  io.to(`merchant:${userId}`).emit(
    "new-notification",
    notification
  );

  return notification;
}

module.exports = { createNotification };
