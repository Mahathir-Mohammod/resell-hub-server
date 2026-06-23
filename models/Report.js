const mongoose = require("mongoose");

const reportSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    reportedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    reason: {
      type: String,
      required: [true, "Reason is required"],
      enum: [
        "misleading",
        "counterfeit",
        "spam",
        "prohibited",
        "inappropriate",
        "fraud",
        "other",
      ],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, "Description cannot exceed 500 characters"],
    },
    status: {
      type: String,
      enum: ["pending", "reviewed", "dismissed"],
      default: "pending",
    },
    adminNote: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

// Prevent duplicate reports from the same user on the same product
reportSchema.index({ product: 1, reportedBy: 1 }, { unique: true });

module.exports = mongoose.model("Report", reportSchema);
