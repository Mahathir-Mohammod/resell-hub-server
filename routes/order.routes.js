const express = require("express");
const Order = require("../models/Order");
const Product = require("../models/Product");
const auth = require("../middleware/auth");
const admin = require("../middleware/admin");
const seller = require("../middleware/seller");

const router = express.Router();

// @route   POST /api/orders
// @desc    Create a new order (after payment)
// @access  Private/Buyer
router.post("/", auth, async (req, res, next) => {
  try {
    const { productId, quantity, totalAmount, deliveryAddress } = req.body;

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    if (product.status !== "available") {
      return res.status(400).json({ message: "Product is not available" });
    }

    // Prevent buying own product
    if (product.seller.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: "You cannot buy your own product" });
    }

    const order = await Order.create({
      buyer: req.user._id,
      seller: product.seller,
      product: productId,
      quantity: quantity || 1,
      totalAmount,
      deliveryAddress,
      paymentStatus: "paid",
      orderStatus: "pending",
    });

    // Update product status to sold
    product.status = "sold";
    await product.save();

    const populatedOrder = await Order.findById(order._id)
      .populate("product", "title images price")
      .populate("seller", "name email phone")
      .populate("buyer", "name email");

    res.status(201).json({ success: true, order: populatedOrder });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/orders/my-orders
// @desc    Get buyer's orders
// @access  Private/Buyer
router.get("/my-orders", auth, async (req, res, next) => {
  try {
    const orders = await Order.find({ buyer: req.user._id })
      .sort({ createdAt: -1 })
      .populate("product", "title images price")
      .populate("seller", "name photo");

    res.json({ success: true, orders });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/orders/seller/incoming
// @desc    Get seller's incoming orders
// @access  Private/Seller
router.get("/seller/incoming", auth, seller, async (req, res, next) => {
  try {
    const orders = await Order.find({ seller: req.user._id })
      .sort({ createdAt: -1 })
      .populate("product", "title images price")
      .populate("buyer", "name email photo phone");

    res.json({ success: true, orders });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/orders/:id
// @desc    Get single order details
// @access  Private
router.get("/:id", auth, async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate("product", "title images price description")
      .populate("seller", "name email photo phone")
      .populate("buyer", "name email photo phone");

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Only buyer, seller, or admin can view order
    if (
      order.buyer._id.toString() !== req.user._id.toString() &&
      order.seller._id.toString() !== req.user._id.toString() &&
      req.user.role !== "admin"
    ) {
      return res.status(403).json({ message: "Not authorized to view this order" });
    }

    res.json({ success: true, order });
  } catch (error) {
    next(error);
  }
});

// @route   PUT /api/orders/:id/cancel
// @desc    Cancel an order (before shipped)
// @access  Private/Buyer
router.put("/:id/cancel", auth, async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (order.buyer.toString() !== req.user._id.toString()) {
      return res
        .status(403)
        .json({ message: "You can only cancel your own orders" });
    }

    if (!["pending", "accepted"].includes(order.orderStatus)) {
      return res
        .status(400)
        .json({ message: "Order cannot be cancelled at this stage" });
    }

    order.orderStatus = "cancelled";
    await order.save();

    // Make product available again
    await Product.findByIdAndUpdate(order.product, { status: "available" });

    res.json({ success: true, message: "Order cancelled", order });
  } catch (error) {
    next(error);
  }
});

// @route   PUT /api/orders/:id/accept
// @desc    Accept an order (seller)
// @access  Private/Seller
router.put("/:id/accept", auth, seller, async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (order.seller.toString() !== req.user._id.toString()) {
      return res
        .status(403)
        .json({ message: "This order is not for your products" });
    }

    if (order.orderStatus !== "pending") {
      return res
        .status(400)
        .json({ message: "Order can only be accepted when pending" });
    }

    order.orderStatus = "accepted";
    await order.save();

    res.json({ success: true, message: "Order accepted", order });
  } catch (error) {
    next(error);
  }
});

// @route   PUT /api/orders/:id/reject
// @desc    Reject an order (seller)
// @access  Private/Seller
router.put("/:id/reject", auth, seller, async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (order.seller.toString() !== req.user._id.toString()) {
      return res
        .status(403)
        .json({ message: "This order is not for your products" });
    }

    if (order.orderStatus !== "pending") {
      return res
        .status(400)
        .json({ message: "Order can only be rejected when pending" });
    }

    order.orderStatus = "cancelled";
    await order.save();

    // Make product available again
    await Product.findByIdAndUpdate(order.product, { status: "available" });

    res.json({ success: true, message: "Order rejected", order });
  } catch (error) {
    next(error);
  }
});

// @route   PUT /api/orders/:id/status
// @desc    Update order delivery status (seller)
// @access  Private/Seller
router.put("/:id/status", auth, seller, async (req, res, next) => {
  try {
    const { orderStatus } = req.body;
    const validStatuses = ["processing", "shipped", "delivered"];

    if (!validStatuses.includes(orderStatus)) {
      return res.status(400).json({ message: "Invalid order status" });
    }

    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (order.seller.toString() !== req.user._id.toString()) {
      return res
        .status(403)
        .json({ message: "This order is not for your products" });
    }

    order.orderStatus = orderStatus;
    await order.save();

    res.json({ success: true, message: `Order status updated to ${orderStatus}`, order });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/orders/admin/all
// @desc    Get all orders (admin only)
// @access  Private/Admin
router.get("/admin/all", auth, admin, async (req, res, next) => {
  try {
    const orders = await Order.find()
      .sort({ createdAt: -1 })
      .populate("product", "title price")
      .populate("buyer", "name email")
      .populate("seller", "name email");

    res.json({ success: true, orders });
  } catch (error) {
    next(error);
  }
});

// @route   PUT /api/orders/admin/:id/status
// @desc    Admin override order status
// @access  Private/Admin
router.put("/admin/:id/status", auth, admin, async (req, res, next) => {
  try {
    const { orderStatus } = req.body;

    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { orderStatus },
      { new: true }
    );

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    res.json({ success: true, message: "Order status updated by admin", order });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
