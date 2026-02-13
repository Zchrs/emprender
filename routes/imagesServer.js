const express = require('express');
const { uploadImages, upload, uploadImage } = require('../controllers/imagesServer');
const router = express.Router();

router.post('/single', upload.single('image', ), uploadImage); // 'images' es el nombre del campo y 1 el máximo de archivos
router.post('/multiple', upload.array('img_url'), uploadImages); // 'images' es el nombre del campo y 4 el máximo de archivos

module.exports = router;