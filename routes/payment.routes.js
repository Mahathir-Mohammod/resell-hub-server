const express = require("express");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const Payment = require("../models/Payment");
const Order = require("../models/Order");
const Product = require("../models/Product");
const auth = require("../middleware/auth");
const admin = require("../middleware/admin");

const router = express.Router();

// @route   POST /api/payments/create-payment-intent
// @desc    Create Stripe payment intent
// @access  Private/Buyer
router.post("/create-payment-intent", auth, async (req, res, next) => {
  try {
    const { productId, amount } = req.body;

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    if (product.seller.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: "You cannot buy your own product" });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency: "usd",
      metadata: {
        productId: productId,
        buyerId: req.user._id.toString(),
      },
    });

    res.json({
      success: true,
      clientSecret: paymentIntent.client_secret,
    });
  } catch (error) {
    next(error);
  }
});

// @route   POST /api/payments/confirm
// @desc    Confirm payment and create order
// @access  Private/Buyer
router.post("/confirm", auth, async (req, res, next) => {
  try {
    const { paymentIntentId, productId, quantity, deliveryAddress } = req.body;

    // Retrieve payment intent from Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status !== "succeeded") {
      return res.status(400).json({ message: "Payment not successful" });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    // Create order
    const order = await Order.create({
      buyer: req.user._id,
      seller: product.seller,
      product: productId,
      quantity: quantity || 1,
      totalAmount: paymentIntent.amount / 100,
      paymentStatus: "paid",
      orderStatus: "pending",
      deliveryAddress,
    });

    // Generate transaction ID
    const transactionId = `TXN-${Date.now()}-${Math.random()
      .toString(36)
      .substring(2, 8)
      .toUpperCase()}`;

    // Save payment record
    const payment = await Payment.create({
      order: order._id,
      buyer: req.user._id,
      transactionId,
      amount: paymentIntent.amount / 100,
      paymentStatus: "paid",
      paymentMethod: "stripe",
      stripePaymentIntentId: paymentIntentId,
    });

    // Update product status
    product.status = "sold";
    await product.save();

    const populatedOrder = await Order.findById(order._id)
      .populate("product", "title images price")
      .populate("seller", "name email");

    res.status(201).json({
      success: true,
      order: populatedOrder,
      payment: {
        transactionId: payment.transactionId,
        amount: payment.amount,
        paymentStatus: payment.paymentStatus,
        createdAt: payment.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/payments/history
// @desc    Get buyer's payment history
// @access  Private/Buyer
router.get("/history", auth, async (req, res, next) => {
  try {
    const payments = await Payment.find({ buyer: req.user._id })
      .sort({ createdAt: -1 })
      .populate({
        path: "order",
        populate: { path: "product", select: "title images price" },
      });

    res.json({ success: true, payments });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/payments/admin/all
// @desc    Get all payments (admin only)
// @access  Private/Admin
router.get("/admin/all", auth, admin, async (req, res, next) => {
  try {
    const { search, status } = req.query;
    let query = {};

    if (status) {
      query.paymentStatus = status;
    }

    const payments = await Payment.find(query)
      .sort({ createdAt: -1 })
      .populate("buyer", "name email")
      .populate({
        path: "order",
        populate: { path: "product", select: "title price" },
      });

    res.json({ success: true, payments });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/payments/admin/revenue
// @desc    Get total revenue (admin only)
// @access  Private/Admin
router.get("/admin/revenue", auth, admin, async (req, res, next) => {
  try {
    const revenue = await Payment.aggregate([
      { $match: { paymentStatus: "paid" } },
      { $group: { _id: null, totalRevenue: { $sum: "$amount" } } },
    ]);

    const totalRevenue = revenue.length > 0 ? revenue[0].totalRevenue : 0;

    res.json({ success: true, totalRevenue });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
