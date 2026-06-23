const express = require("express");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const auth = require("../middleware/auth");

const router = express.Router();

// ============================================
// CLOUDINARY CONFIG
// ============================================
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ============================================
// MULTER STORAGE (Cloudinary)
// ============================================
const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "resell-hub/products",
    allowed_formats: ["jpg", "jpeg", "png", "webp", "gif"],
    transformation: [{ width: 1200, height: 1200, crop: "limit", quality: "auto" }],
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only JPEG, PNG, WebP, and GIF images are allowed"), false);
    }
  },
});

// ============================================
// POST /api/upload/single
// @desc    Upload a single image
// @access  Private
// ============================================
router.post("/single", auth, upload.single("image"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "No image file provided" });
  }

  res.status(201).json({
    success: true,
    url: req.file.path,
    publicId: req.file.filename,
  });
});

// ============================================
// POST /api/upload/multiple
// @desc    Upload up to 5 images at once
// @access  Private
// ============================================
router.post("/multiple", auth, upload.array("images", 5), (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ message: "No image files provided" });
  }

  const files = req.files.map((f) => ({
    url: f.path,
    publicId: f.filename,
  }));

  res.status(201).json({
    success: true,
    files,
  });
});

// ============================================
// DELETE /api/upload/:publicId
// @desc    Delete an image from Cloudinary
// @access  Private
// ============================================
router.delete("/:publicId", auth, async (req, res, next) => {
  try {
    const result = await cloudinary.uploader.destroy(
      `resell-hub/products/${req.params.publicId}`
    );

    if (result.result === "not found") {
      return res.status(404).json({ message: "Image not found on Cloudinary" });
    }

    res.json({ success: true, message: "Image deleted successfully" });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
