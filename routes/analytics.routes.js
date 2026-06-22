const express = require("express");
const Order = require("../models/Order");
const Product = require("../models/Product");
const User = require("../models/User");
const Payment = require("../models/Payment");
const auth = require("../middleware/auth");
const admin = require("../middleware/admin");
const seller = require("../middleware/seller");

const router = express.Router();

// @route   GET /api/analytics/seller/sales
// @desc    Get monthly sales data for seller chart
// @access  Private/Seller
router.get("/seller/sales", auth, seller, async (req, res, next) => {
  try {
    const salesData = await Order.aggregate([
      {
        $match: {
          seller: req.user._id,
          orderStatus: "delivered",
        },
      },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
          },
          totalSales: { $sum: "$totalAmount" },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
      {
        $project: {
          _id: 0,
          year: "$_id.year",
          month: "$_id.month",
          totalSales: 1,
          count: 1,
        },
      },
    ]);

    res.json({ success: true, salesData });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/analytics/seller/top-products
// @desc    Get seller's top selling products
// @access  Private/Seller
router.get("/seller/top-products", auth, seller, async (req, res, next) => {
  try {
    const topProducts = await Order.aggregate([
      {
        $match: {
          seller: req.user._id,
          orderStatus: { $ne: "cancelled" },
        },
      },
      {
        $group: {
          _id: "$product",
          totalSold: { $sum: "$quantity" },
          revenue: { $sum: "$totalAmount" },
        },
      },
      { $sort: { totalSold: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: "products",
          localField: "_id",
          foreignField: "_id",
          as: "product",
        },
      },
      { $unwind: "$product" },
      {
        $project: {
          _id: 0,
          productId: "$_id",
          title: "$product.title",
          images: "$product.images",
          totalSold: 1,
          revenue: 1,
        },
      },
    ]);

    res.json({ success: true, topProducts });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/analytics/admin/user-growth
// @desc    Get user registration trend (admin only)
// @access  Private/Admin
router.get("/admin/user-growth", auth, admin, async (req, res, next) => {
  try {
    const userGrowth = await User.aggregate([
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
      {
        $project: {
          _id: 0,
          year: "$_id.year",
          month: "$_id.month",
          count: 1,
        },
      },
    ]);

    res.json({ success: true, userGrowth });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/analytics/admin/category-performance
// @desc    Get product count per category (admin only)
// @access  Private/Admin
router.get("/admin/category-performance", auth, admin, async (req, res, next) => {
  try {
    const categoryData = await Product.aggregate([
      {
        $group: {
          _id: "$category",
          count: { $sum: 1 },
          averagePrice: { $avg: "$price" },
        },
      },
      { $sort: { count: -1 } },
      {
        $project: {
          _id: 0,
          category: "$_id",
          count: 1,
          averagePrice: { $round: ["$averagePrice", 2] },
        },
      },
    ]);

    res.json({ success: true, categoryData });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/analytics/admin/monthly-orders
// @desc    Get monthly order trend (admin only)
// @access  Private/Admin
router.get("/admin/monthly-orders", auth, admin, async (req, res, next) => {
  try {
    const monthlyOrders = await Order.aggregate([
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
          },
          count: { $sum: 1 },
          revenue: { $sum: "$totalAmount" },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
      {
        $project: {
          _id: 0,
          year: "$_id.year",
          month: "$_id.month",
          count: 1,
          revenue: 1,
        },
      },
    ]);

    res.json({ success: true, monthlyOrders });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
