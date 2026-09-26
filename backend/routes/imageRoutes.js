import express from "express";
import multer from "multer";
import { removeBackground } from "../services/photoroomService.js";

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: 8 * 1024 * 1024,
  },

  fileFilter: (_req, file, callback) => {
    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
    ];

    if (!allowedTypes.includes(file.mimetype)) {
      return callback(
        new Error("Only JPEG, PNG and WebP images are supported.")
      );
    }

    callback(null, true);
  },
});

router.post(
  "/remove-background",
  upload.single("image"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "Please upload an image.",
        });
      }

      const processedImage = await removeBackground(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype
      );

      const imageDataUrl = `data:image/png;base64,${processedImage.toString(
        "base64"
      )}`;

      return res.json({
        success: true,
        provider: "photoroom",
        message: "Background removed successfully.",
        imageDataUrl,
      });
    } catch (error) {
      console.error(
        "[Photoroom] Background removal failed:",
        error
      );

      return res.status(502).json({
        success: false,
        message: "Photoroom image processing failed.",
        error:
          process.env.NODE_ENV === "development"
            ? error?.message || String(error)
            : undefined,
      });
    }
  }
);

export default router;