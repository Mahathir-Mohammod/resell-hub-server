const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Product title is required"],
      trim: true,
    },
    category: {
      type: String,
      required: [true, "Category is required"],
      trim: true,
    },
    condition: {
      type: String,
      enum: ["New", "Like New", "Good", "Fair", "Refurbished"],
      required: [true, "Condition is required"],
    },
    price: {
      type: Number,
      required: [true, "Price is required"],
      min: [0, "Price cannot be negative"],
    },
    images: [
      {
        type: String,
      },
    ],
    description: {
      type: String,
      trim: true,
    },
    stock: {
      type: Number,
      default: 1,
      min: 0,
    },
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: ["available", "sold", "hidden"],
      default: "available",
    },
    adminApproval: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "approved",
    },
    isReported: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Index for search functionality
productSchema.index({ title: "text", category: "text" });
productSchema.index({ price: 1 });
productSchema.index({ createdAt: -1 });

module.exports = mongoose.model("Product", productSchema);
