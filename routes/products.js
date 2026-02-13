const { Router } = require("express");
const { 
  createProduct, 
  getProducts, 
  getProductsByCategory, 
  updateProduct, 
  deleteProduct,
  getSoldProducts
} = require('../controllers/products');
const { check } = require("express-validator");
const { validateFields } = require("../middlewares/validate-form-data");
const http = require('http');
const socketIo = require('socket.io');
const { getImagesByProductId, uploadImages } = require("../controllers/images");
const multer = require('multer');
const path = require('path');
const router = Router();
const server = http.createServer(router);
const io = socketIo(server);


const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, '/uploads');
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== '.jpg' && ext !== '.jpeg' && ext !== '.png') {
      return cb(new Error('Only images are allowed'), false);
    }
    cb(null, true);
  }
});

router.post(
  "/new-product",
  [
    check("name", "name is required").not().isEmpty(),
    check("price", "price is required").not().isEmpty(),
    check("previousPrice", "previous price is required").not().isEmpty(),
    check("category", "category is required").not().isEmpty(),
    check("quantity", "quantity is required").isEmail(),
    check("description", "description is required").not().isEmpty(),
    check("image", "url is required").not().isEmpty(),

    validateFields,
 ],
 createProduct
);

router.get('/sold-products', async (req, res) => {
  try {
    const products = await getSoldProducts(req, res); // Pasa los parámetros req y res a la función getProducts
    res.json(products); // Devuelve los productos como respuesta
  } catch (error) {
    console.error('Error al obtener productos:', error);
    res.status(500).json({ error: 'Error al obtener productos' }); // Maneja errores
  }
});

router.get('/products', async (req, res) => {
  try {
    const products = await getProducts(req, res); // Pasa los parámetros req y res a la función getProducts
    res.json(products); // Devuelve los productos como respuesta
  } catch (error) {
    console.error('Error al obtener productos:', error);
    res.status(500).json({ error: 'Error al obtener productos' }); // Maneja errores
  }
});

router.get('/category', async (req, res) => {
  const category = req.query.category; // Obtiene la categoría de los parámetros de consulta

  try {
    const products = await getProductsByCategory(category); // Llama a la función para obtener productos por categoría
    res.json(products); // Devuelve los productos como respuesta
  } catch (error) {
    console.error('Error al obtener productos por categoría:', error);
    res.status(500).json({ error: 'Error al obtener productos por categoría' }); // Maneja errores
  }
});

router.get('/images/:product_id', getImagesByProductId);

router.put('/update/:id', upload.array('img_url', 6), updateProduct);

router.post('/:id/sell-product', async (req, res) => {
  const { productId, quantity } = req.body;

  try {
    const result = await sellProduct(productId, quantity);
    res.status(200).json({ success: true, saleId: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/delete/:id', deleteProduct);
module.exports = router;
