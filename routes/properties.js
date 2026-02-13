const { Router } = require("express");
const { 
  createProperty, 
  getPropertys, 
  getPropertysByCategory, 
  updateProperty, 
  deleteProperty,
  getSoldPropertys,
  getPropertysByActions,
  getRecentProperties,
  getRentedPropertys,
  moveToSold,
  getSellPropertys,
  getRentPropertys,
  moveToRented,
  searchProperties,
} = require('../controllers/properties');
const { check } = require("express-validator");
const { validateFields } = require("../middlewares/validate-form-data");
const http = require('http');
const socketIo = require('socket.io');
const { getImagesByPropertyId } = require("../controllers/images");
const multer = require('multer');
const path = require('path');
const fs = require('fs');
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

router.get('/get-sell-properties/:action', async (req, res) => {
  const action = req.params.action;
  try {
    const propertys = await getSellPropertys(action); // Pasa los parámetros req y res a la función getPropertys
    res.json(propertys); // Devuelve los propertyos como respuesta
  } catch (error) {
    console.error('Error al obtener las propiedades para la venta:', error);
    res.status(500).json({ error: 'Error al obtener las propiedades para la venta' }); // Maneja errores
  }
});

router.get('/get-sold-properties/:action', async (req, res) => {
  const action = req.params.action;
  try {
    const propertys = await getSoldPropertys(action); // Pasa los parámetros req y res a la función getPropertys
    res.json(propertys); // Devuelve los propertyos como respuesta
  } catch (error) {
    console.error('Error al obtener las propiedades vendidas:', error);
    res.status(500).json({ error: 'Error al obtener las propiedades vendidas' }); // Maneja errores
  }
});

router.get('/get-rent-properties/:action', async (req, res) => {
  const action = req.params.action;
  try {
    const propertys = await getRentPropertys(action); // Pasa los parámetros req y res a la función getPropertys
    res.json(propertys); // Devuelve los propertyos como respuesta
  } catch (error) {
    console.error('Error al obtener las propiedades en arrendamiento:', error);
    res.status(500).json({ error: 'Error al obtener las propiedades en arrendamiento' }); // Maneja errores
  }
});

router.get('/get-rented-properties/:action', async (req, res) => {
  const action = req.params.action;
  try {
    const propertys = await getRentedPropertys(action); // Pasa los parámetros req y res a la función getPropertys
    res.json(propertys); // Devuelve los propertyos como respuesta
  } catch (error) {
    console.error('Error al obtener las propiedades arrendadas:', error);
    res.status(500).json({ error: 'Error al obtener las propiedades arrendadas' }); // Maneja errores
  }
});

router.get('/get-properties', async (req, res) => {
  try {
    const propertys = await getPropertys(req, res); // Pasa los parámetros req y res a la función getPropertys
    res.json(propertys); // Devuelve los propertyos como respuesta
  } catch (error) {
    console.error('Error al obtener las propiedades:', error);
    res.status(500).json({ error: 'Error al obtener propopiedades' }); // Maneja errores
  }
});

router.get('/by-actions/:action', async (req, res) => {
  const action = req.params.action; // Obtiene la categoría de los parámetros de consulta

  try {
    const propertys = await getPropertysByActions(action); // Llama a la función para obtener propertyos por categoría
    res.json(propertys); // Devuelve los propertyos como respuesta
  } catch (error) {
    console.error('Error al obtener las propiedades por Acción a realizar:', error);
    res.status(500).json({ error: 'Error al obtener las propiedades por acción' }); // Maneja errores
  }
});

router.get('/by-category/:category', async (req, res) => {
  const category = req.params.category; // Obtiene la categoría de los parámetros de consulta

  try {
    const propertys = await getPropertysByCategory(category); // Llama a la función para obtener propertyos por categoría
    res.json(propertys); // Devuelve los propertyos como respuesta
  } catch (error) {
    console.error('Error al obtener las propiedades por categoría:', error);
    res.status(500).json({ error: 'Error al obtener las propiedades por categoría' }); // Maneja errores
  }
});

router.get('/get-images/images/:property_id', getImagesByPropertyId);

router.get('/get-recent', async (req, res) => {
  try {
    const recentProperties = await getRecentProperties();
    res.json( recentProperties );
  } catch (error) {
    console.error('Error en ruta /properties/recent:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener propiedades recientes'
    });
  }
});

router.put('/update/:id', upload.array('img_url', 4), updateProperty);

router.post( "/create-property",
  [
    check("ref", "ref is required").not().isEmpty(),
    check("price", "price is required").not().isEmpty(),
    check("district", "district is required").not().isEmpty(),
    check("category", "category is required").not().isEmpty(),
    check("description", "description is required").not().isEmpty(),
    check("bedRoom", "bedRoom is required").isEmail(),
    check("diningRoom", "diningRoom is required").not().isEmpty(),
    check("closets", "closets is required").not().isEmpty(),
    check("floor", "floor is required").not().isEmpty(),
    check("floor", "floor is required").not().isEmpty(),
    check("stratum", "stratum is required").not().isEmpty(),
    check("clothing", "clothing is required").not().isEmpty(),
    check("action", "action is required").not().isEmpty(),
    check("image", "url image is required").not().isEmpty(),
    check("img_url", "urls images is required").not().isEmpty(),

    validateFields,
 ],
 createProperty
);

router.post('/:id/sell-property', async (req, res) => {
  const { propertyId, quantity } = req.body;

  try {
    const result = await sellProperty(propertyId, quantity);
    res.status(200).json({ success: true, saleId: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/move-to-sold/:property_id', moveToSold);

router.post('/move-to-rented/:property_id', moveToRented);

router.delete('/delete/:id', deleteProperty);

router.get('/search', searchProperties);

module.exports = router;
