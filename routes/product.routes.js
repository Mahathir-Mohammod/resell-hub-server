const express = require("express");
const Product = require("../models/Product");
const auth = require("../middleware/auth");
const seller = require("../middleware/seller");
const admin = require("../middleware/admin");

const router = express.Router();

// @route   GET /api/products
// @desc    Get all products with search, sort, filter, pagination
// @access  Public
router.get("/", async (req, res, next) => {
  try {
    const {
      search,
      category,
      condition,
      minPrice,
      maxPrice,
      sort,
      page = 1,
      limit = 12,
    } = req.query;

    const query = { status: "available", adminApproval: "approved" };

    // Search by title
    if (search) {
      query.title = { $regex: search, $options: "i" };
    }

    // Filter by category
    if (category) {
      query.category = category;
    }

    // Filter by condition
    if (condition) {
      query.condition = condition;
    }

    // Filter by price range
    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = Number(minPrice);
      if (maxPrice) query.price.$lte = Number(maxPrice);
    }

    // Sort options
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
      case "oldest":
        sortOption = { createdAt: 1 };
        break;
      default:
        sortOption = { createdAt: -1 };
    }

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

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

// @route   GET /api/products/featured
// @desc    Get latest featured products for homepage
// @access  Public
router.get("/featured", async (req, res, next) => {
  try {
    const products = await Product.find({
      status: "available",
      adminApproval: "approved",
    })
      .sort({ createdAt: -1 })
      .limit(8)
      .populate("seller", "name photo isVerified");

    res.json({ success: true, products });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/products/categories
// @desc    Get all categories with product count
// @access  Public
router.get("/categories", async (req, res, next) => {
  try {
    const categories = await Product.aggregate([
      { $match: { status: "available", adminApproval: "approved" } },
      { $group: { _id: "$category", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $project: { name: "$_id", count: 1, _id: 0 } },
    ]);

    res.json({ success: true, categories });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/products/seller/my-products
// @desc    Get seller's own products
// @access  Private/Seller
router.get("/seller/my-products", auth, seller, async (req, res, next) => {
  try {
    const { search, status: filterStatus } = req.query;
    const query = { seller: req.user._id };

    if (search) {
      query.title = { $regex: search, $options: "i" };
    }

    if (filterStatus) {
      query.status = filterStatus;
    }

    const products = await Product.find(query).sort({ createdAt: -1 });
    res.json({ success: true, products });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/products/:id
// @desc    Get single product details
// @access  Public
router.get("/:id", async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id).populate(
      "seller",
      "name photo email phone isVerified createdAt"
    );

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    res.json({ success: true, product });
  } catch (error) {
    next(error);
  }
});

// @route   POST /api/products
// @desc    Create a new product
// @access  Private/Seller
router.post("/", auth, seller, async (req, res, next) => {
  try {
    const { title, category, condition, price, images, description, stock } =
      req.body;

    if (!title || !category || !condition || !price) {
      return res
        .status(400)
        .json({ message: "Title, category, condition, and price are required" });
    }

    const product = await Product.create({
      title,
      category,
      condition,
      price,
      images: images || [],
      description,
      stock: stock || 1,
      seller: req.user._id,
    });

    res.status(201).json({ success: true, product });
  } catch (error) {
    next(error);
  }
});

// @route   PUT /api/products/:id
// @desc    Update a product (seller only)
// @access  Private/Seller
router.put("/:id", auth, seller, async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    if (product.seller.toString() !== req.user._id.toString()) {
      return res
        .status(403)
        .json({ message: "You can only edit your own products" });
    }

    const updatedProduct = await Product.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    );

    res.json({ success: true, product: updatedProduct });
  } catch (error) {
    next(error);
  }
});

// @route   DELETE /api/products/:id
// @desc    Delete a product (seller only)
// @access  Private/Seller
router.delete("/:id", auth, seller, async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    if (product.seller.toString() !== req.user._id.toString()) {
      return res
        .status(403)
        .json({ message: "You can only delete your own products" });
    }

    await Product.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Product deleted successfully" });
  } catch (error) {
    next(error);
  }
});

// @route   PUT /api/products/admin/:id/approve
// @desc    Approve a product (admin only)
// @access  Private/Admin
router.put("/admin/:id/approve", auth, admin, async (req, res, next) => {
  try {
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { adminApproval: "approved" },
      { new: true }
    );

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    res.json({ success: true, message: "Product approved", product });
  } catch (error) {
    next(error);
  }
});

// @route   PUT /api/products/admin/:id/reject
// @desc    Reject a product (admin only)
// @access  Private/Admin
router.put("/admin/:id/reject", auth, admin, async (req, res, next) => {
  try {
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { adminApproval: "rejected" },
      { new: true }
    );

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    res.json({ success: true, message: "Product rejected", product });
  } catch (error) {
    next(error);
  }
});

// @route   DELETE /api/products/admin/:id
// @desc    Delete any product (admin only)
// @access  Private/Admin
router.delete("/admin/:id", auth, admin, async (req, res, next) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }
    res.json({ success: true, message: "Product deleted by admin" });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
