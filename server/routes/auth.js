
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const prisma = require("../lib/prisma");
const auth = require("../middleware/auth");

const router = express.Router();

function createToken(userId) {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
}

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone
  };
}

// Register merchant
router.post("/register", async (req, res, next) => {
  try {
    const { name, email, password, phone } = req.body;

    if (!name?.trim() ||
        !email?.trim() ||
        !password ||
        password.length < 8) {
      return res.status(400).json({
        error: "Provide a name, email and password of at least 8 characters"
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const exists = await prisma.user.findUnique({
      where: { email: normalizedEmail }
    });

    if (exists) {
      return res.status(409).json({
        error: "Email already registered"
      });
    }

    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        email: normalizedEmail,
        passwordHash: await bcrypt.hash(password, 12),
        phone: phone || null
      }
    });

    res.status(201).json({
      token: createToken(user.id),
      user: publicUser(user)
    });
  } catch (error) {
    next(error);
  }
});

// Login merchant
router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({
      where: {
        email: String(email || "").trim().toLowerCase()
      }
    });

    const valid = user && await bcrypt.compare(
      String(password || ""),
      user.passwordHash
    );

    if (!valid) {
      return res.status(401).json({
        error: "Invalid email or password"
      });
    }

    res.json({
      token: createToken(user.id),
      user: publicUser(user)
    });
  } catch (error) {
    next(error);
  }
});

// Get authenticated merchant
router.get("/me", auth, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId }
    });

    if (!user) {
      return res.status(404).json({
        error: "Merchant not found"
      });
    }

    res.json(publicUser(user));
  } catch (error) {
    next(error);
  }
});

module.exports = router;
