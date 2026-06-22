const express = require("express");
const Product = require("../models/Product");

const router = express.Router();

// @route   GET /api/categories
// @desc    Get all categories with product counts
// @access  Public
router.get("/", async (req, res, next) => {
  try {
    const categories = await Product.aggregate([
      { $match: { status: "available", adminApproval: "approved" } },
      { $group: { _id: "$category", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      {
        $project: {
          _id: 0,
          name: "$_id",
          count: 1,
        },
      },
    ]);

    res.json({ success: true, categories });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/categories/:name/products
// @desc    Get products by category
// @access  Public
router.get("/:name/products", async (req, res, next) => {
  try {
    const { sort, page = 1, limit = 12 } = req.query;

    let sortOption = { createdAt: -1 };
    switch (sort) {
      case "price_asc":
        sortOption = { price: 1 };
        break;
      case "price_desc":
        sortOption = { price: -1 };
        break;
      case "newest":
        sortOption = { createdAt: -1 };
        break;
      default:
        sortOption = { createdAt: -1 };
    }

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const query = {
      category: req.params.name,
      status: "available",
      adminApproval: "approved",
    };

    const [products, total] = await Promise.all([
      Product.find(query)
        .sort(sortOption)
        .skip(skip)
        .limit(limitNum)
        .populate("seller", "name photo isVerified"),
      Product.countDocuments(query),
    ]);

    res.json({
      success: true,
      products,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
