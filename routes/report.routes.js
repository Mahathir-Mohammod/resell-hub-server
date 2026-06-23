const express = require("express");
const Report = require("../models/Report");
const Product = require("../models/Product");
const auth = require("../middleware/auth");
const admin = require("../middleware/admin");

const router = express.Router();

// ============================================
// POST /api/reports
// @desc    Report a product
// @access  Private
// ============================================
router.post("/", auth, async (req, res, next) => {
  try {
    const { productId, reason, description } = req.body;

    if (!productId || !reason) {
      return res
        .status(400)
        .json({ message: "Product ID and reason are required" });
    }

    // Check product exists
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    // Prevent reporting own product
    if (product.seller.toString() === req.user._id.toString()) {
      return res
        .status(400)
        .json({ message: "You cannot report your own product" });
    }

    // Check for duplicate report from same user
    const existingReport = await Report.findOne({
      product: productId,
      reportedBy: req.user._id,
    });

    if (existingReport) {
      return res
        .status(400)
        .json({ message: "You have already reported this product" });
    }

    const report = await Report.create({
      product: productId,
      reportedBy: req.user._id,
      reason,
      description,
    });

    // Mark product as reported
    product.isReported = true;
    await product.save();

    const populatedReport = await Report.findById(report._id)
      .populate("product", "title images price")
      .populate("reportedBy", "name email");

    res.status(201).json({ success: true, report: populatedReport });
  } catch (error) {
    next(error);
  }
});

// ============================================
// GET /api/reports/my-reports
// @desc    Get current user's reports
// @access  Private
// ============================================
router.get("/my-reports", auth, async (req, res, next) => {
  try {
    const reports = await Report.find({ reportedBy: req.user._id })
      .sort({ createdAt: -1 })
      .populate("product", "title images price status");

    res.json({ success: true, reports });
  } catch (error) {
    next(error);
  }
});

// ============================================
// GET /api/reports/admin/all
// @desc    Get all reports (admin only)
// @access  Private/Admin
// ============================================
router.get("/admin/all", auth, admin, async (req, res, next) => {
  try {
    const { status, search } = req.query;
    let query = {};

    if (status) {
      query.status = status;
    }

    let reports = await Report.find(query)
      .sort({ createdAt: -1 })
      .populate("product", "title images price status adminApproval")
      .populate("reportedBy", "name email");

    // Search by product title if search param provided
    if (search) {
      const Product = require("../models/Product");
      const matchingProducts = await Product.find({
        title: { $regex: search, $options: "i" },
      }).select("_id");
      const productIds = matchingProducts.map((p) => p._id);
      reports = reports.filter((r) =>
        productIds.some((id) => id.equals(r.product?._id))
      );
    }

    res.json({ success: true, reports });
  } catch (error) {
    next(error);
  }
});

// ============================================
// GET /api/reports/admin/stats
// @desc    Get report statistics (admin only)
// @access  Private/Admin
// ============================================
router.get("/admin/stats", auth, admin, async (req, res, next) => {
  try {
    const [totalReports, pendingReports, reviewedReports, dismissedReports] =
      await Promise.all([
        Report.countDocuments(),
        Report.countDocuments({ status: "pending" }),
        Report.countDocuments({ status: "reviewed" }),
        Report.countDocuments({ status: "dismissed" }),
      ]);

    // Get top reported products
    const topReported = await Report.aggregate([
      { $group: { _id: "$product", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
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
          reportCount: "$count",
        },
      },
    ]);

    res.json({
      success: true,
      stats: {
        totalReports,
        pendingReports,
        reviewedReports,
        dismissedReports,
        topReported,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// GET /api/reports/:id
// @desc    Get single report details
// @access  Private/Admin
// ============================================
router.get("/:id", auth, admin, async (req, res, next) => {
  try {
    const report = await Report.findById(req.params.id)
      .populate({
        path: "product",
        populate: { path: "seller", select: "name email photo phone" },
      })
      .populate("reportedBy", "name email photo");

    if (!report) {
      return res.status(404).json({ message: "Report not found" });
    }

    res.json({ success: true, report });
  } catch (error) {
    next(error);
  }
});

// ============================================
// PUT /api/reports/admin/:id/review
// @desc    Mark report as reviewed (admin takes action)
// @access  Private/Admin
// ============================================
router.put("/admin/:id/review", auth, admin, async (req, res, next) => {
  try {
    const { adminNote } = req.body;

    const report = await Report.findByIdAndUpdate(
      req.params.id,
      { status: "reviewed", adminNote: adminNote || "" },
      { new: true }
    )
      .populate("product", "title")
      .populate("reportedBy", "name email");

    if (!report) {
      return res.status(404).json({ message: "Report not found" });
    }

    res.json({ success: true, message: "Report marked as reviewed", report });
  } catch (error) {
    next(error);
  }
});

// ============================================
// PUT /api/reports/admin/:id/dismiss
// @desc    Dismiss a report (no action needed)
// @access  Private/Admin
// ============================================
router.put("/admin/:id/dismiss", auth, admin, async (req, res, next) => {
  try {
    const { adminNote } = req.body;

    const report = await Report.findByIdAndUpdate(
      req.params.id,
      { status: "dismissed", adminNote: adminNote || "" },
      { new: true }
    );

    if (!report) {
      return res.status(404).json({ message: "Report not found" });
    }

    // Check if any other pending reports exist for this product
    const otherPending = await Report.countDocuments({
      product: report.product,
      status: { $ne: "dismissed" },
    });

    // If no other active reports, mark product as not reported
    if (otherPending === 0) {
      await Product.findByIdAndUpdate(report.product, { isReported: false });
    }

    res.json({ success: true, message: "Report dismissed", report });
  } catch (error) {
    next(error);
  }
});

// ============================================
// DELETE /api/reports/admin/:id
// @desc    Delete a report (admin only)
// @access  Private/Admin
// ============================================
router.delete("/admin/:id", auth, admin, async (req, res, next) => {
  try {
    const report = await Report.findByIdAndDelete(req.params.id);

    if (!report) {
      return res.status(404).json({ message: "Report not found" });
    }

    // Re-check if product still has other reports
    const otherReports = await Report.countDocuments({
      product: report.product,
    });
    if (otherReports === 0) {
      await Product.findByIdAndUpdate(report.product, { isReported: false });
    }

    res.json({ success: true, message: "Report deleted successfully" });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
