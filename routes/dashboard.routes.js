const express = require("express");
const Order = require("../models/Order");
const Product = require("../models/Product");
const User = require("../models/User");
const Wishlist = require("../models/Wishlist");
const Payment = require("../models/Payment");
const auth = require("../middleware/auth");
const admin = require("../middleware/admin");

const router = express.Router();

// @route   GET /api/dashboard/buyer-stats
// @desc    Get buyer dashboard statistics
// @access  Private/Buyer
router.get("/buyer-stats", auth, async (req, res, next) => {
  try {
    const [totalOrders, wishlist, recentOrders] = await Promise.all([
      Order.countDocuments({ buyer: req.user._id }),
      Wishlist.findOne({ user: req.user._id }),
      Order.find({ buyer: req.user._id })
        .sort({ createdAt: -1 })
        .limit(5)
        .populate("product", "title images price")
        .populate("seller", "name photo"),
    ]);

    res.json({
      success: true,
      stats: {
        totalOrders,
        wishlistCount: wishlist ? wishlist.products.length : 0,
        recentOrders,
      },
    });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/dashboard/seller-stats
// @desc    Get seller dashboard statistics
// @access  Private/Seller
router.get("/seller-stats", auth, async (req, res, next) => {
  try {
    const [totalProducts, completedOrders, pendingOrders, totalRevenue] =
      await Promise.all([
        Product.countDocuments({ seller: req.user._id }),
        Order.countDocuments({
          seller: req.user._id,
          orderStatus: "delivered",
        }),
        Order.countDocuments({
          seller: req.user._id,
          orderStatus: "pending",
        }),
        Payment.aggregate([
          {
            $lookup: {
              from: "orders",
              localField: "order",
              foreignField: "_id",
              as: "orderDetails",
            },
          },
          { $unwind: "$orderDetails" },
          {
            $match: {
              "orderDetails.seller": req.user._id,
              paymentStatus: "paid",
            },
          },
          { $group: { _id: null, total: { $sum: "$amount" } } },
        ]),
      ]);

    res.json({
      success: true,
      stats: {
        totalProducts,
        totalSales: completedOrders,
        totalRevenue: totalRevenue.length > 0 ? totalRevenue[0].total : 0,
        pendingOrders,
      },
    });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/dashboard/admin-stats
// @desc    Get admin dashboard statistics
// @access  Private/Admin
router.get("/admin-stats", auth, admin, async (req, res, next) => {
  try {
    const [totalUsers, totalProducts, totalOrders] = await Promise.all([
      User.countDocuments(),
      Product.countDocuments(),
      Order.countDocuments(),
    ]);

    res.json({
      success: true,
      stats: {
        totalUsers,
        totalProducts,
        totalOrders,
      },
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
