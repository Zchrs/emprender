const dotenv = require("dotenv");
const mysql = require("mysql2/promise");
const { v4: uuidv4 } = require("uuid");

// Cargar variables de entorno (.env)
dotenv.config();

const createPqrs = async (req, res) => {
  const {
    fullname,
    dnaId,
    phone,
    email,
    address,
    title,
    description,
    img_url = [] // Puede venir vacío o con URLs
  } = req.body;

  const id = uuidv4();

  // 🔍 Validar campos obligatorios
  if (!fullname || !dnaId || !phone || !email || !address || !title || !description) {
    return res.status(400).json({ error: "Faltan campos obligatorios" });
  }

  let connection;

  try {
    // 1️⃣ Conexión a la base de datos
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    });

    console.log("✅ Conectado a la base de datos:", process.env.DB_NAME);

    // 2️⃣ Iniciar transacción
    await connection.beginTransaction();

    // 3️⃣ Insertar PQRS principal
    const insertPqrsQuery = `
      INSERT INTO pqrs_data (
        id, fullname, dnaId, phone, email, address, title, description, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `;

    await connection.execute(insertPqrsQuery, [
      id, fullname, dnaId, phone, email, address, title, description
    ]);

    // 4️⃣ Si hay imágenes, insertarlas en pqrs_img
    if (img_url.length > 0) {
      const insertImagesQuery = `
        INSERT INTO pqrs_img (pqrs_id, img_url)
        VALUES ?
      `;

      // Mapea las URLs a formato [[pqrs_id, img1], [pqrs_id, img2], ...]
      const imageValues = img_url.map(url => [id, url]);

      await connection.query(insertImagesQuery, [imageValues]);
    }

    // 5️⃣ Confirmar cambios
    await connection.commit();

    // 6️⃣ Respuesta exitosa
    res.status(201).json({
      success: true,
      message: "PQRS registrada correctamente",
      pqrs: {
        id, fullname, dnaId, phone, email, address, title, description, img_url
      },
    });

  } catch (error) {
    // 🚨 Si algo falla, revertimos los cambios
    if (connection) await connection.rollback();
    console.error("Error en createPqrs:", error);

    res.status(500).json({
      error: "Error al registrar la PQRS",
      details: process.env.NODE_ENV === "development" ? error.message : undefined,
    });

  } finally {
    // 7️⃣ Cerrar conexión
    if (connection) await connection.end();
  }
};

// Exportar como objeto
module.exports = {
  createPqrs
};