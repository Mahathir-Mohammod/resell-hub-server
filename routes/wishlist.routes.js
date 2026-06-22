const express = require("express");
const Wishlist = require("../models/Wishlist");
const auth = require("../middleware/auth");

const router = express.Router();

// @route   GET /api/wishlist
// @desc    Get user's wishlist
// @access  Private/Buyer
router.get("/", auth, async (req, res, next) => {
  try {
    let wishlist = await Wishlist.findOne({ user: req.user._id })
      .populate({
        path: "products",
        populate: { path: "seller", select: "name photo" },
      });

    if (!wishlist) {
      wishlist = { products: [] };
    }

    res.json({ success: true, wishlist: wishlist.products || [] });
  } catch (error) {
    next(error);
  }
});

// @route   POST /api/wishlist/:productId
// @desc    Add product to wishlist
// @access  Private/Buyer
router.post("/:productId", auth, async (req, res, next) => {
  try {
    let wishlist = await Wishlist.findOne({ user: req.user._id });

    if (!wishlist) {
      wishlist = await Wishlist.create({
        user: req.user._id,
        products: [req.params.productId],
      });
      return res.status(201).json({ success: true, message: "Added to wishlist", wishlist });
    }

    // Check if product already in wishlist
    if (wishlist.products.includes(req.params.productId)) {
      return res.status(400).json({ message: "Product already in wishlist" });
    }

    wishlist.products.push(req.params.productId);
    await wishlist.save();

    res.json({ success: true, message: "Added to wishlist", wishlist });
  } catch (error) {
    next(error);
  }
});

// @route   DELETE /api/wishlist/:productId
// @desc    Remove product from wishlist
// @access  Private/Buyer
router.delete("/:productId", auth, async (req, res, next) => {
  try {
    const wishlist = await Wishlist.findOne({ user: req.user._id });

    if (!wishlist) {
      return res.status(404).json({ message: "Wishlist not found" });
    }

    wishlist.products = wishlist.products.filter(
      (p) => p.toString() !== req.params.productId
    );
    await wishlist.save();

    res.json({ success: true, message: "Removed from wishlist", wishlist });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
