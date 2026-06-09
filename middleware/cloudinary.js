const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const multer = require("multer");
require("dotenv").config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
  cloudinary,
  params: (req, file) => {
    let folder = "tutorhub/profiles";
    if (file.fieldname === "cnic") folder = "tutorhub/cnic";
    if (file.fieldname === "experienceLetter") folder = "tutorhub/experience";
    if (file.fieldname === "attachment") folder = "tutorhub/chat";

    const isImage = file.mimetype?.startsWith("image/");
    const isVideo = file.mimetype?.startsWith("video/");
    const isAttachment = file.fieldname === "attachment";
    return {
      folder,
      allowed_formats: isAttachment
        ? [
            "jpg",
            "jpeg",
            "png",
            "webp",
            "pdf",
            "mp4",
            "mov",
            "webm",
            "doc",
            "docx",
            "ppt",
            "pptx",
            "xls",
            "xlsx",
          ]
        : ["jpg", "jpeg", "png", "pdf"],
      resource_type: isImage ? "image" : isVideo && isAttachment ? "video" : "raw",
    };
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
});

module.exports = { upload, cloudinary };
