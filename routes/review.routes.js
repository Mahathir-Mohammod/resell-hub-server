const express = require("express");
const Review = require("../models/Review");
const Order = require("../models/Order");
const auth = require("../middleware/auth");

const router = express.Router();

// @route   POST /api/reviews
// @desc    Create a review (must have purchased the product)
// @access  Private/Buyer
router.post("/", auth, async (req, res, next) => {
  try {
    const { productId, rating, comment } = req.body;

    if (!productId || !rating) {
      return res.status(400).json({ message: "Product ID and rating are required" });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({ message: "Rating must be between 1 and 5" });
    }

    // Check if user has purchased this product
    const order = await Order.findOne({
      buyer: req.user._id,
      product: productId,
      orderStatus: "delivered",
    });

    if (!order) {
      return res
        .status(400)
        .json({ message: "You can only review products you have purchased and received" });
    }

    // Check if already reviewed
    const existingReview = await Review.findOne({
      reviewer: req.user._id,
      product: productId,
    });

    if (existingReview) {
      return res
        .status(400)
        .json({ message: "You have already reviewed this product" });
    }

    const review = await Review.create({
      reviewer: req.user._id,
      product: productId,
      order: order._id,
      rating,
      comment,
    });

    const populatedReview = await Review.findById(review._id)
      .populate("reviewer", "name photo");

    res.status(201).json({ success: true, review: populatedReview });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/reviews/product/:productId
// @desc    Get all reviews for a product
// @access  Public
router.get("/product/:productId", async (req, res, next) => {
  try {
    const reviews = await Review.find({ product: req.params.productId })
      .sort({ createdAt: -1 })
      .populate("reviewer", "name photo");

    // Calculate average rating
    const totalRating = reviews.reduce((sum, r) => sum + r.rating, 0);
    const averageRating = reviews.length > 0 ? totalRating / reviews.length : 0;

    res.json({
      success: true,
      reviews,
      stats: {
        total: reviews.length,
        averageRating: Math.round(averageRating * 10) / 10,
      },
    });
  } catch (error) {
    next(error);
  }
});

// @route   DELETE /api/reviews/:id
// @desc    Delete own review
// @access  Private
router.delete("/:id", auth, async (req, res, next) => {
  try {
    const review = await Review.findById(req.params.id);

    if (!review) {
      return res.status(404).json({ message: "Review not found" });
    }

    if (review.reviewer.toString() !== req.user._id.toString()) {
      return res
        .status(403)
        .json({ message: "You can only delete your own reviews" });
    }

    await Review.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Review deleted successfully" });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
