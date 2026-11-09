
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const http = require("http");
const jwt = require("jsonwebtoken");
const { Server } = require("socket.io");
const rateLimit = require("express-rate-limit");
const prisma = require("./lib/prisma");

const app = express();

const origins = (process.env.CLIENT_URL || "")
  .split(",")
  .map((url) => url.trim())
  .filter(Boolean);

app.use(helmet());
app.use(cors({ origin: origins }));
app.use(express.json({ limit: "100kb" }));

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: origins,
    methods: ["GET", "POST"]
  }
});

// Authenticate a merchant's Socket.IO connection.
// Anonymous customers may connect, but cannot join merchant rooms.
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;

  if (token) {
    try {
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET
      );
      socket.data.userId = decoded.userId;
    } catch {
      return next(new Error("Invalid socket token"));
    }
  }

  next();
});

io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id);

  // Merchant-specific room.
  socket.on("register-merchant", async () => {
    const userId = socket.data.userId;
    if (!userId) return;

    const exists = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true }
    });

    if (exists) {
      socket.join(`merchant:${userId}`);
    }
  });

  // Customers subscribe only to payment attempts
  // associated with a valid public payment link.
  socket.on("watch-payment", async (payload) => {
    try {
      const { paymentId, slug } = payload || {};

      if (!paymentId || !slug) return;

      const payment = await prisma.payment.findFirst({
        where: {
          id: paymentId,
          paymentLink: { slug }
        },
        select: {
          id: true,
          status: true,
          paidAt: true,
          mpesaReceiptNumber: true,
          failureReason: true
        }
      });

      if (!payment) return;

      socket.join(`payment:${payment.id}`);

      // Immediately sync current status on reconnect.
      socket.emit("payment-status", payment);
    } catch (error) {
      console.error("Payment subscription:", error.message);
    }
  });

  socket.on("disconnect", () => {
    console.log("Socket disconnected:", socket.id);
  });
});

// Make io available to route handlers.
app.set("io", io);

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: "draft-8",
  legacyHeaders: false
});

// A simple health endpoint for Railway
app.get("/", (req, res) => {
  res.json({
    name: "PayLink v2 API",
    status: "running"
  });
});

app.use("/api/auth", limiter, require("./routes/auth"));
app.use("/api/payments", require("./routes/payments"));
app.use("/api/analytics", require("./routes/analytics"));
app.use("/api/notifications", require("./routes/notifications"));
app.use("/api/sms", limiter, require("./routes/sms"));


// Central error handler
app.use((error, req, res, next) => {
  console.error("API error:", error);

  res.status(500).json({
    error: "Internal server error"
  });
});

const PORT = process.env.PORT || 3001;

// Important: listen on the HTTP server, not app.listen().
server.listen(PORT, "0.0.0.0", () => {
  console.log(`PayLink v2 running on port ${PORT}`);
});
