const ImageKit = require("imagekit");
const { Router } = require("express");
const { uploadImages, upload, uploadImage, getImagesByPropertyId } = require("../controllers/images");


const router = Router();

// router.post('/images/single', uploadImage);

router.post('/multiple', upload.array('img_url'), (req, res) => {
  uploadImages(req, res);
});

router.post('/single', upload.single('image'), uploadImage);

router.get("/auth", (req, res) => {
  console.log("ImageKit auth requested");
  const result = imagekit.getAuthenticationParameters();
  res.json(result);
});

const imagekit = new ImageKit({
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
});

  module.exports = router;
  