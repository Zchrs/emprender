const multer = require('multer');
const mysqls = require("mysql2");
const path = require('path');
const fs = require('fs');
// const busboy = require('busboy');

// Configuración de almacenamiento
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, uniqueSuffix + ext);
  }
});

// Configuración de Multer
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 30 * 1024 * 1024, // 30 MB
  },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
    if (!allowedExtensions.includes(ext)) {
      return cb(new Error('Solo se permiten imágenes (JPEG, PNG, WEBP)'), false);
    }
    cb(null, true);
  }
});

const uploadImage = async (req, res) => {
  try {
    // Verificar si hay un archivo cargado
    if (!req.file) {
      return res.status(400).json({ error: "No se ha proporcionado ningún archivo" });
    }

    // Construir URL de la imagen cargada
    const imageUrl = `${req.protocol}://${req.get('host')}/${req.file.path}`;

    // Devolver la URL de la imagen como respuesta
    res.status(200).json({ 
        success: true, // ✅ <-- esto faltaba
        message: "Imagen subida correctamente", 
      imageUrl
     });
    console.log(imageUrl);
  } catch (error) {
    console.error("Error al procesar la solicitud:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

const uploadImages = async (req, res) => {
  try {
      // Verificar si hay archivos cargados
      if (!req.files || req.files.length === 0) {
          return res.status(400).json({ error: "No se han proporcionado archivos" });
      }

      // Construir URLs de las imágenes cargadas
      const imageUrls = req.files.map(file => `${req.protocol}://${req.get('host')}/${file.path}`);
      
      // Devolver las URLs de las imágenes como respuesta
      res.status(200).json({
        success: true, // ✅ <-- esto faltaba
        message: "Imágenes subidas correctamente", 
        imageUrls
       });
      console.log(imageUrls)
  } catch (error) {
      console.error("Error al procesar la solicitud:", error);
      res.status(500).json({ error: "Internal Server Error" });
  }
};

const getImagesByProductId = async (req, res) => {
  const { product_id } = req.params;

  const connection = mysqls.createConnection({
    connectionLimit: 10,
    host: process.env.DB_HOST,
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });
  

  const sql = 'SELECT * FROM products_img WHERE product_id = ?';
  connection.query(sql, [product_id], (err, results) => {
    if (err) {
      console.error('Error al obtener las imágenes del producto:', err);
      return res.status(500).json({ error: 'Error al obtener las imágenes del producto' });
    }

    res.json({ images: results });
  });
};

module.exports = {
    uploadImages,
    getImagesByProductId,
    uploadImage,
    upload,
};
