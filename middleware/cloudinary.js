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

    const isPdf = file.mimetype === "application/pdf";
    return {
      folder,
      allowed_formats: ["jpg", "jpeg", "png", "pdf"],
      resource_type: isPdf ? "raw" : "image",
      format: isPdf ? "pdf" : undefined,
    };
  },
});

const upload = multer({ storage });

module.exports = { upload, cloudinary };
