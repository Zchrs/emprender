const path = require('path');
const fs = require('fs');
const multer = require('multer');


const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 30 * 1024 * 1024 }, // 120 MB
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|gif/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Solo se permiten imágenes (JPEG, JPG, PNG, GIF)'));
  }
});

const uploadImages = async (req, res) => {
  try {
    // Verificar si hay archivos cargados
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ 
        success: false,
        error: "No se han proporcionado archivos" 
      });
    }

    // Configuración para Hostinger
    const uploadDir = '/home/u100171750/domains/gavicinmobiliaria.com/public_html/uploads';
    const publicUrlBase = 'https://gavicinmobiliaria.com/uploads';

    // Verificar/Crear directorio (con manejo de errores)
    try {
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
        console.log(`Directorio creado: ${uploadDir}`);
      }
    } catch (dirError) {
      console.error('Error al verificar/crear directorio:', {
        error: dirError.message,
        code: dirError.code,
        path: uploadDir,
        timestamp: new Date().toISOString()
      });
      throw new Error(`No se pudo acceder al directorio de destino: ${dirError.message}`);
    }

    // Procesar cada archivo
    const uploadResults = await Promise.all(req.files.map(async (file) => {
      try {
        // Generar nombre único para el archivo
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const fileExt = path.extname(file.originalname);
        const fileName = `img-${uniqueSuffix}${fileExt}`;
        const filePath = path.join(uploadDir, fileName);

        // Escribir el buffer directamente en Hostinger
        await fs.promises.writeFile(filePath, file.buffer);
        
        console.log(`Archivo subido correctamente: ${fileName}`);
        return {
          success: true,
          fileName,
          url: `${publicUrlBase}/${fileName}`
        };
      } catch (fileError) {
        console.error('Error al subir archivo:', {
          originalname: file.originalname,
          error: fileError.message,
          code: fileError.code,
          timestamp: new Date().toISOString()
        });
        return {
          success: false,
          fileName: file.originalname,
          error: fileError.message,
          code: fileError.code
        };
      }
    }));

    // Separar resultados exitosos y fallidos
    const successfulUploads = uploadResults.filter(r => r.success);
    const failedUploads = uploadResults.filter(r => !r.success);

    // Preparar respuesta
    const response = {
      success: true,
      message: `Procesamiento completado. ${successfulUploads.length} éxito(s), ${failedUploads.length} fallo(s)`,
      uploadedImages: successfulUploads.map(u => u.url),
      details: {
        totalFiles: req.files.length,
        successful: successfulUploads.length,
        failed: failedUploads.length
      }
    };

    // Agregar detalles de errores si hay fallos (solo en desarrollo)
    if (failedUploads.length > 0 && process.env.NODE_ENV === 'development') {
      response.failedUploads = failedUploads.map(f => ({
        originalFile: f.fileName,
        error: f.error,
        code: f.code
      }));
    }

    // Devolver respuesta
    const statusCode = successfulUploads.length > 0 ? 200 : 500;
    res.status(statusCode).json(response);

  } catch (error) {
    console.error("Error general en uploadImages:", {
      error: error.message,
      stack: error.stack,
      code: error.code,
      timestamp: new Date().toISOString()
    });
    
    // Determinar código de estado según el tipo de error
    let statusCode = 500;
    let errorMessage = "Error al procesar las imágenes";
    
    if (error.message.includes('directorio de destino')) {
      statusCode = 503; // Servicio no disponible
      errorMessage = "Problema con el sistema de archivos del servidor";
    } else if (error.code === 'ENOSPC') {
      statusCode = 507; // Almacenamiento insuficiente
      errorMessage = "Espacio en disco insuficiente en el servidor";
    } else if (error.code === 'EPERM' || error.code === 'EACCES') {
      statusCode = 403; // Prohibido
      errorMessage = "Problema de permisos en el servidor";
    }
    
    res.status(statusCode).json({ 
      success: false,
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? {
        message: error.message,
        code: error.code
      } : undefined
    });
  }
};

const uploadImage = async (req, res) => {
  try {
    // Verificar si hay un archivo cargado
    if (!req.file) {
      return res.status(400).json({ 
        success: false,
        error: "No se ha proporcionado ningún archivo" 
      });
    }

    // Configuración para Hostinger
    const uploadDir = '/home/u100171750/domains/gavicinmobiliaria.com/public_html/uploads';
    const publicUrlBase = 'https://gavicinmobiliaria.com/uploads';

    // Generar nombre único para el archivo
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const fileExt = path.extname(req.file.originalname);
    const fileName = `img-${uniqueSuffix}${fileExt}`;
    const filePath = path.join(uploadDir, fileName);

    // Crear stream de lectura del buffer del archivo
    const fileBuffer = req.file.buffer;
    
    // Intentar escribir directamente en Hostinger
    try {
      // Verificar si el directorio existe, si no, crearlo
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      
      // Escribir el archivo directamente
      await fs.promises.writeFile(filePath, fileBuffer);
      
      console.log(`Archivo ${fileName} escrito correctamente en ${filePath}`);
    } catch (fsError) {
      console.error('Error al escribir en Hostinger:', fsError);
      throw new Error(`Error del sistema de archivos: ${fsError.message}`);
    }

    // Construir URL pública
    const imageUrl = `${publicUrlBase}/${fileName}`;

    // Devolver la URL de la imagen como respuesta
    res.status(200).json({ 
      success: true,
      message: "Imagen subida correctamente",
      imageUrl 
    });

  } catch (error) {
    console.error("Error en uploadImage:", {
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
    
    // Determinar el tipo de error
    let errorMessage = "Error al procesar la imagen";
    let statusCode = 500;
    
    if (error.message.includes('sistema de archivos')) {
      errorMessage = "Error al escribir en el servidor de hosting";
      statusCode = 503; // Servicio no disponible
    } else if (error.message.includes('permiso denegado')) {
      errorMessage = "Problema de permisos en el servidor";
      statusCode = 403;
    }
    
    res.status(statusCode).json({ 
      success: false,
      error: errorMessage,
      // Solo mostrar detalles en desarrollo
      details: process.env.NODE_ENV === 'development' ? {
        message: error.message,
        code: error.code
      } : undefined
    });
  }
};

module.exports = {
    upload,
    uploadImage,
    uploadImages,
};