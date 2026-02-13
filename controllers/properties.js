// const mysql = require('mysql');
const util = require("util");
const mysql = require("mysql2/promise");
const mysqls = require("mysql2");
const moment = require("moment");
const QRCode = require("qrcode");
const { createCanvas, loadImage } = require("canvas");
const path = require("path");
const { getRandomRef } = require("../controllers/ref");

const { v4: uuidv4 } = require("uuid");
const { pool } = require("../database/config");
const { validateJwtAdmin } = require("../middlewares/validate-jwt");

const v4options = {
  random: [
    0x10, 0x91, 0x56, 0xbe, 0xc4, 0xfb, 0xc1, 0xea, 0x71, 0xb4, 0xef, 0xe1,
    0x67, 0x1c, 0x58, 0x36, 0x30, 0x51,
  ],
};

const createProperty = async (req, res) => {
  // Middleware wrapper mejorado
  const validateAdmin = (req, res) => {
    return new Promise((resolve) => {
      const originalJson = res.json;
      let adminValidated = false;

      res.json = (body) => {
        originalJson.call(res, body);
        resolve({ isAdmin: false, adminId: null });
      };

      validateJwtAdmin(req, res, () => {
        adminValidated = true;
        resolve({ isAdmin: true, adminId: req.id });
        res.json = originalJson; // Restauramos la función original
      });
    });
  };

  try {
    const { isAdmin, adminId } = await validateAdmin(req, res);

    if (req.body.submitClient === "admin" && !isAdmin) {
      return res.status(403).json({
        error: "Acceso denegado",
        details: "Se requieren privilegios de administrador",
      });
    }

    // Pasamos explícitamente adminId a handlePropertyCreation
    await handlePropertyCreation(req, res, { isAdmin, adminId });
  } catch (error) {
    console.error("Error in createProperty:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

const handlePropertyCreation = async (req, res, { isAdmin, adminId }) => {
  const authHeader =
    req.headers.authorization ||
    (req.headers["x-token"] ? `Bearer ${req.headers["x-token"]}` : null);

  let userId = null;

  // Validación para usuarios normales
  if (!isAdmin && authHeader?.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1];
    try {
      const decodedUser = jwt.verify(token, process.env.SECRET_JWT_SEED);
      userId = decodedUser.id;
    } catch (userError) {
      console.log("Token de usuario no válido - Continuando como invitado");
    }
  }

  // Generar referencia única con manejo de errores
  let ref;
  try {
    ref = await getRandomRef();
  } catch (error) {
    console.error("Error generando referencia:", error);
    return res.status(500).json({
      error: "Error al generar referencia",
      details: "No se pudo generar una referencia única para la propiedad",
    });
  }

  const {
    id = uuidv4(),
    name,
    city,
    price,
    area,
    district,
    category,
    furnished,
    admon,
    description,
    bedRoom,
    bathRoom,
    diningRoom,
    closets,
    kitchen,
    floor,
    parking,
    stratum,
    clothing,
    action,
    image,
    img_url = [],
    manager,
    submitClient = req.body.submitClient ||
      (isAdmin ? "admin" : userId ? "client" : "guest"),
  } = req.body;

  // Validación de campos obligatorios mejorada
  const requiredFields = [
    { field: "name", message: "El nombre de la propiedad es requerido" },
    { field: "city", message: "La ciudad es requerida" },
    { field: "price", message: "El precio es requerido" },
    {
      field: "action",
      message: "El tipo de operación (Venta/Arrendamiento) es requerido",
    },
  ];

  const missingFields = requiredFields.filter(
    ({ field }) => !req.body[field] || req.body[field].trim() === ""
  );

  if (missingFields.length > 0) {
    return res.status(400).json({
      error: "Faltan campos obligatorios",
      details: missingFields.map((f) => f.message),
      missingFields: missingFields.map((f) => f.field),
    });
  }

  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const targetTable =
      submitClient === "admin" ? "properties" : "pending_properties";

    /**
     * Validación exhaustiva de propiedades duplicadas
     * Verifica por:
     * 1. Referencia exacta
     * 2. Mismo nombre en la misma ciudad y sector
     * 3. Mismas características principales
     */
    const [duplicateCheck] = await connection.execute(
      `SELECT id, ref, name FROM ${targetTable} 
       WHERE ref = ? 
          OR (name = ? AND city = ? AND district = ?)
          OR (name = ? AND city = ? AND price = ? AND area = ? AND action = ?)
       LIMIT 1`,
      [
        ref,
        name,
        city,
        district,
        name,
        city,
        parseFloat(price) || 0,
        parseFloat(area) || 0,
        action,
      ]
    );

    if (duplicateCheck.length > 0) {
      await connection.rollback();
      const duplicate = duplicateCheck[0];

      let errorMessage = "Propiedad potencialmente duplicada: ";
      if (duplicate.ref === ref) {
        errorMessage += `La referencia ${ref} ya está registrada`;
      } else if (
        duplicate.name === name &&
        duplicate.city === city &&
        duplicate.district === district
      ) {
        errorMessage += `Ya existe una propiedad con el mismo nombre en ${city}, ${district}`;
      } else {
        errorMessage += `Propiedad con características similares ya registrada`;
      }

      return res.status(409).json({
        error: "Propiedad duplicada",
        details: errorMessage,
        duplicateId: duplicate.id,
        isExactDuplicate: duplicate.ref === ref,
      });
    }

    // Generar código QR
    let qrCodeBase64 = null;
    try {
      qrCodeBase64 = await generateQRCodeWithLogo({
        id,
        ref,
        name,
        price,
        area,
        action,
      });
    } catch (qrError) {
      console.error("Error generando QR:", qrError);
      await connection.rollback();
      return res.status(500).json({
        error: "Error al generar código QR",
        details: "No se pudo generar el código QR para la propiedad",
      });
    }

    // Preparar valores para inserción
    const propertyValues = [
      id,
      ref,
      name,
      city,
      parseFloat(price) || 0,
      parseFloat(area) || null,
      district || null,
      category || null,
      furnished === "Sí" ? 1 : 0,
      admon === "no" ? 0 : parseFloat(admon) || null,
      description || null,
      parseInt(bedRoom) || null,
      parseInt(bathRoom) || null,
      parseInt(diningRoom) || null,
      parseInt(closets) || null,
      kitchen || null,
      floor || null,
      parking === "No" ? 0 : parking || null,
      parseInt(stratum) || null,
      parseInt(clothing) || null,
      action,
      qrCodeBase64,
      isAdmin ? adminId : null,
      isAdmin ? adminId : userId,
      manager?.id || null,
      image || "/default-property.jpg",
    ];

    // Insertar propiedad principal
    await connection.execute(
      `INSERT INTO ${targetTable} (
        id, ref, name, city, price, area, district, category, furnished, admon, description, 
        bedRoom, bathRoom, diningRoom, closets, kitchen, floor, parking, stratum, 
        clothing, action, qr_code, admin_id, user_id, manager_id, image
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      propertyValues
    );

    // Registrar acción (Venta/Arrendamiento)
    if (["Venta", "Arrendamiento"].includes(action)) {
      const actionTable =
        action === "Venta" ? "sell_properties" : "rent_properties";
      const creatorId = isAdmin ? adminId : userId;
      const creatorField = isAdmin ? "admin_id" : "user_id";

      try {
        await connection.execute(
          `INSERT INTO ${actionTable} 
           (property_id, ${creatorField}, created_at) 
           VALUES (?, ?, NOW())`,
          [id, creatorId]
        );
      } catch (actionError) {
        await connection.rollback();
        console.error("Error registrando acción:", actionError);
        return res.status(500).json({
          error: "Error al registrar la acción de la propiedad",
          details: "No se pudo registrar el tipo de operación",
        });
      }
    }

    // Procesar imágenes de la galería
    if (Array.isArray(img_url) && img_url.length > 0) {
      const validImages = img_url
        .filter((url) => typeof url === "string" && url.trim() !== "")
        .map((url) => [id, url.trim()]);

      if (validImages.length > 0) {
        try {
          await connection.query(
            `INSERT INTO properties_img (property_id, img_url) VALUES ?`,
            [validImages]
          );
        } catch (imgError) {
          await connection.rollback();
          console.error("Error subiendo imágenes:", imgError);
          return res.status(500).json({
            error: "Error al subir imágenes",
            details: "No se pudieron registrar las imágenes de la propiedad",
          });
        }
      }
    }

    // Registrar en propiedades recientes
    try {
      await connection.execute(
        `INSERT INTO recent_properties (property_id, created_at) 
         VALUES (?, NOW()) ON DUPLICATE KEY UPDATE created_at = NOW()`,
        [id]
      );
    } catch (recentError) {
      console.error("Error actualizando propiedades recientes:", recentError);
      // No hacemos rollback porque es opcional
    }

    // Registrar encargado si es cliente
    if (submitClient === "client" && manager) {
      const { name: mName, docId, email: mEmail, phone: mPhone } = manager;
      try {
        await connection.execute(
          `INSERT INTO manager_guests 
           (id, name, doc_id, email, phone, property_id, user_id) 
           VALUES (UUID(), ?, ?, ?, ?, ?, ?)`,
          [
            mName?.trim() || "No proporcionado",
            docId?.trim() || null,
            mEmail?.trim() || null,
            mPhone?.trim() || null,
            id,
            userId,
          ]
        );
      } catch (managerError) {
        console.error("Error registrando encargado:", managerError);
        // No hacemos rollback porque no es crítico
      }
    }

    await connection.commit();

    // Respuesta exitosa
    return res.status(201).json({
      success: true,
      propertyId: id,
      propertyRef: ref,
      message: "Propiedad creada exitosamente",
      qrCodeGenerated: !!qrCodeBase64,
      createdBy: submitClient,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    if (connection) await connection.rollback();

    console.error("Error en createProperty:", {
      message: error.message,
      stack: error.stack,
      sql: error.sql,
      body: req.body,
    });

    // Manejo específico para errores de duplicados de MySQL
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        error: "Propiedad duplicada",
        details: "La propiedad ya existe en el sistema (verificación tardía)",
        code: "LATE_DUPLICATE_CHECK",
      });
    }

    // Respuesta genérica de error
    return res.status(500).json({
      error: "Error al crear la propiedad",
      details:
        process.env.NODE_ENV === "development"
          ? {
              message: error.message,
              code: error.code,
              sqlState: error.sqlState,
            }
          : undefined,
    });
  } finally {
    if (connection) {
      try {
        await connection.release();
      } catch (releaseError) {
        console.error("Error liberando conexión:", releaseError);
      }
    }
  }
};

const generateQRCodeWithLogo = async ({
  id,
  ref,
  name,
  price,
  area,
  action,
}) => {
  const size = 500;
  const qrData = JSON.stringify({
    propertyId: id,
    ref,
    name,
    price,
    area,
    action,
    timestamp: new Date().toISOString(),
  });

  const qrOptions = {
    errorCorrectionLevel: "H",
    margin: 1,
    color: { dark: "#000000", light: "#ffffff" },
    width: size,
  };

  const qrDataUrl = await QRCode.toDataURL(qrData, qrOptions);
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext("2d");
  const qrImage = await loadImage(qrDataUrl);
  ctx.drawImage(qrImage, 0, 0, size, size);

  try {
    const logoPath = path.join(__dirname, "../public/logo.png");
    const logo = await loadImage(logoPath);
    const logoSize = size * 0.2;
    const logoX = (size - logoSize) / 2;
    const logoY = (size - logoSize) / 2;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(logoX - 5, logoY - 5, logoSize + 10, logoSize + 10);
    ctx.drawImage(logo, logoX, logoY, logoSize, logoSize);
  } catch (error) {
    console.warn("No se pudo insertar el logo en el QR:", error.message);
  }

  return canvas.toDataURL("image/png");
};

const getPropertys = async () => {
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const query = util.promisify(connection.query).bind(connection);
    // Realizar la consulta a la base de datos
    const Propertys = await query("SELECT * FROM properties");

    // console.log(Propertys[1])
    // Enviar los Propertyos como respuesta
    return Propertys;
  } catch (error) {
    console.error("Error al obtener los inmuebles", error);
    throw error;
  } finally {
    if (connection) connection.release();
  }
};

const getSellPropertys = async (action) => {
  if (!action || action !== "Venta") {
    throw new Error('Parámetro "action" inválido');
  }

  let connection;

  try {
    connection = await pool.getConnection();

    const [properties] = await connection.execute(
      `
      SELECT 
        prop.*, 
        sp.property_id AS sell_properties,
        (
          SELECT JSON_ARRAYAGG(img.img_url) 
          FROM properties_img img 
          WHERE img.property_id = prop.id
        ) AS images
      FROM sell_properties sp
      JOIN properties prop ON prop.id = sp.property_id
      WHERE prop.action = ?
    `,
      [action]
    );

    return properties;
  } catch (error) {
    console.error(`Error al obtener propiedades para ${action}:`, error);
    throw error;
  } finally {
    // Versión simple para cerrar la conexión
    if (connection) {
      if (connection) connection.release();
    }
  }
};

const getSoldPropertys = async () => {
  // Eliminamos el parámetro action que no se usa
  let connection;

  try {
    connection = await pool.getConnection();

    // Consulta corregida - eliminamos la línea problemática
    const [properties] = await connection.execute(`
      SELECT 
        prop.*, 
        sp.property_id AS sold_properties,
        sp.created_at,
        (
          SELECT JSON_ARRAYAGG(img.img_url) 
          FROM properties_img img 
          WHERE img.property_id = prop.id
        ) AS images,
        (
          SELECT img_url 
          FROM properties_img 
          WHERE property_id = prop.id 
          LIMIT 1
        ) AS primary_image
      FROM sold_properties sp
      JOIN properties prop ON prop.id = sp.property_id
      ORDER BY sp.created_at DESC
    `); // Eliminamos el parámetro [action] que no se usaba

    // Procesamos las imágenes para convertirlas de JSON a array
    const processedProperties = properties.map((prop) => ({
      ...prop,
      images: prop.images ? JSON.parse(prop.images) : [],
      image: prop.primary_image || null,
      action: "Venta", // Añadimos el tipo de acción explícitamente
    }));

    return processedProperties;
  } catch (error) {
    console.error("Error al obtener propiedades vendidas:", {
      message: error.message,
      stack: error.stack,
      sql: error.sql, // Mostramos también la consulta SQL que falló
    });
    throw new Error("No se pudieron obtener las propiedades vendidas");
  } finally {
    if (connection) {
      await connection.release();
    }
  }
};

const getRentPropertys = async (action) => {
  if (!action || action !== "Arrendamiento") {
    throw new Error('Parámetro "action" inválido');
  }

  let connection;
  try {
    connection = await pool.getConnection();

    const [properties] = await connection.execute(`
      SELECT 
        prop.*,
        sp.property_id AS rent_properties,
        sp.created_at,
        IFNULL((
          SELECT JSON_ARRAYAGG(img.img_url)
          FROM properties_img img
          WHERE img.property_id = prop.id
        ), '[]') AS images,
        (
          SELECT img_url
          FROM properties_img
          WHERE property_id = prop.id
          LIMIT 1
        ) AS primary_image
      FROM rent_properties sp
      JOIN properties prop ON prop.id = sp.property_id
      ORDER BY sp.created_at DESC
    `);

    const processedProperties = properties.map((prop) => {
      let imagesArray = [];

      try {
        imagesArray =
          typeof prop.images === "string" ? JSON.parse(prop.images) : [];
      } catch (err) {
        console.warn(
          `Error al parsear imágenes para propiedad ID ${prop.id}:`,
          prop.images
        );
        imagesArray = [];
      }

      return {
        ...prop,
        images: imagesArray,
        image: prop.primary_image || null,
      };
    });

    return processedProperties;
  } catch (error) {
    console.error("Error al obtener propiedades en arrendamiento:", {
      message: error.message,
      stack: error.stack,
    });
    throw error;
  } finally {
    if (connection) connection.release();
  }
};

const getRentedPropertys = async (action) => {
  // Eliminamos el parámetro action que no se usa
  const connection = mysqls.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  try {
    const query = util.promisify(connection.query).bind(connection);

    const properties = await query(`
      SELECT 
        prop.*, 
        sp.property_id AS rented_properties,
        sp.created_at,
        (
          SELECT JSON_ARRAYAGG(img.img_url) 
          FROM properties_img img 
          WHERE img.property_id = prop.id
        ) AS images
      FROM rented_properties sp
      JOIN properties prop ON prop.id = sp.property_id
      ORDER BY sp.created_at DESC
    `); // Eliminamos el WHERE que limitaba la consulta

    return properties;
  } catch (error) {
    console.error("Error al obtener propiedades vendidas:", error);
    throw error;
  } finally {
    if (connection) {
      connection.end((err) => {
        if (err) console.error("Error al cerrar conexión:", err);
      });
    }
  }
};

async function getPropertysByActions(action) {
  // Validación inicial
  if (action === undefined) {
    console.error('Error: El parámetro "action" es requerido');
    throw new Error('El parámetro "action" es requerido');
  }

  let connection;
  try {
    connection = await pool.getConnection();

    console.log(`Buscando propiedades con action: ${action}`);

    // Construcción flexible de la consulta
    let query = "SELECT * FROM properties";
    const params = [];

    if (action !== null) {
      query += " WHERE action = ?";
      params.push(action);
    } else {
      query += " WHERE action IS NULL";
    }

    const [propertysRows] = await connection.execute(query, params);

    if (propertysRows.length === 0) {
      console.log("No se encontraron propiedades para la acción especificada");
      return [];
    }

    return propertysRows.map((property) => ({
      ...property,
      // Puedes agregar transformaciones adicionales aquí
    }));
  } catch (error) {
    console.error("Error en getPropertysByActions:", {
      error: error.message,
      action,
      stack: error.stack,
    });
    throw error;
  } finally {
    if (connection) {
      try {
        await connection.end();
        console.log("Conexión cerrada correctamente");
      } catch (err) {
        console.error("Error al cerrar la conexión:", err);
      }
    }
  }
}

async function getPropertysByCategory(category) {
  try {
    // Crea una conexión a la base de datos
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    });

    console.log("Conexión establecida con la base de datos");

    // Realiza la consulta para obtener los Propertyos por categoría
    const [propertysRows] = await connection.execute(
      "SELECT * FROM properties WHERE category = ?",
      [category]
    );

    // Obtén los IDs de los Propertyos para usar en la siguiente consulta
    const propertyIds = propertysRows.map((property) => property.id);

    if (propertyIds.length === 0) {
      // Si no hay Propertyos, cierra la conexión y retorna un array vacío
      connection.end();
      console.log("Conexión cerrada");
      return [];
    }
    // Cierra la conexión después de ejecutar la consulta
    connection.end();
    console.log("Conexión cerrada");
  } catch (error) {
    console.error("Error al obtener los inmuebles:", error);
    throw error;
  }
}

async function getRecentProperties() {
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const twentyFourHoursAgo = moment()
      .subtract(24, "hours")
      .format("YYYY-MM-DD HH:mm:ss");

    // Consulta para propiedades recientes
    let [properties] = await connection.execute(
      `SELECT 
        prop.*, 
        rp.created_at AS recent_created_at,
        (
          SELECT GROUP_CONCAT(img.img_url SEPARATOR '||') 
          FROM properties_img img 
          WHERE img.property_id = prop.id
        ) AS images,
        (
          SELECT img_url 
          FROM properties_img 
          WHERE property_id = prop.id 
          ORDER BY id ASC 
          LIMIT 1
        ) AS primary_image
      FROM recent_properties rp
      JOIN properties prop ON prop.id = rp.property_id
      WHERE rp.created_at >= ?
      ORDER BY rp.created_at DESC
      LIMIT 50`,
      [twentyFourHoursAgo]
    );

    // Fallback si no hay propiedades recientes
    if (properties.length === 0) {
      [properties] = await connection.execute(
        `SELECT 
          prop.*,
          prop.created_at AS recent_created_at,
          (
            SELECT GROUP_CONCAT(img.img_url SEPARATOR '||') 
            FROM properties_img img 
            WHERE img.property_id = prop.id
          ) AS images,
          (
            SELECT img_url 
            FROM properties_img 
            WHERE property_id = prop.id 
            ORDER BY id ASC 
            LIMIT 1
          ) AS primary_image
        FROM properties prop
        ORDER BY prop.created_at DESC
        LIMIT 50`
      );
    }

    const formattedProperties = properties.map((property) => {
      const formattedDate = moment(property.recent_created_at).format(
        "YYYY-MM-DD HH:mm:ss"
      );

      let imgUrls = [];
      try {
        if (property.images && typeof property.images === "string") {
          imgUrls = property.images
            .split("||")
            .filter((url) => url.trim() !== "");
        } else if (property.images) {
          imgUrls = Array.isArray(property.images) ? property.images : [];
        }
      } catch (e) {
        console.error("Error al procesar imágenes:", e.message);
        imgUrls = [];
      }

      const primaryImg =
        property.primary_image || (imgUrls.length > 0 ? imgUrls[0] : null);

      return {
        ...property,
        recent_created_at: formattedDate,
        images: imgUrls,
        primary_image: primaryImg,
        is_recent: moment(property.recent_created_at).isSameOrAfter(
          twentyFourHoursAgo
        ),
      };
    });

    await connection.commit(); // Asegúrate de hacer commit de la transacción
    return formattedProperties;
  } catch (error) {
    if (connection) await connection.rollback(); // Hacer rollback en caso de error
    console.error("Error al obtener propiedades recientes:", {
      message: error.message,
      stack: error.stack,
    });
    throw new Error("No se pudieron obtener las propiedades recientes");
  } finally {
    if (connection) {
      await connection.release(); // Cambiado de end() a release()
    }
  }
}

const updateProperty = async (req, res) => {
  const { id } = req.params;
  const {
    name,
    city,
    price,
    district,
    category,
    description,
    bedRoom,
    bathRoom,
    diningRoom,
    closets,
    kitchen,
    floor,
    stratum,
  } = req.body;
  const images = req.files;

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  try {
    await connection.beginTransaction();

    console.log("Updating Property with id:", id);
    city,
      console.log("Property details:", {
        name,
        price,
        district,
        category,
        description,
        bedRoom,
        bathRoom,
        diningRoom,
        closets,
        kitchen,
        floor,
        stratum,
      });
    console.log("Images:", images);

    const updatePropertyQuery = `
      UPDATE properties 

city,      SET name = ?, price = ?, district = ?, category = ?, description = ?, bedRoom = ?,  bathRoom = ?, diningRoom = ?, closets = ?, kitchen = ?, floor = ?, stratum = ?,
      WHERE id = ?
    `;

    city,
      await connection.execute(updatePropertyQuery, [
        id,
        name,
        price,
        district,
        category,
        description,
        bedRoom,
        bathRoom,
        diningRoom,
        closets,
        kitchen,
        floor,
        stratum,
      ]);

    // Delete existing images associated with the Property
    const deleteImagesQuery =
      "DELETE FROM properties_img WHERE property_id = ?";
    await connection.execute(deleteImagesQuery, [id]);

    // Insert new images into Propertys_img table
    if (images && images.length > 0) {
      const insertImagesQuery =
        "INSERT INTO properties_img (property_id, img_url) VALUES ?";
      const imagesData = img_url.map((image) => [id, image.filename]); // Assuming 'filename' is the correct property to use

      console.log("Images data to insert:", imagesData);

      await connection.query(insertImagesQuery, [imagesData]);
    }

    await connection.commit();
    res.status(200).json({ message: "Property updated successfully" });
  } catch (error) {
    await connection.rollback();
    console.error("Error updating Property", error);
    res.status(500).json({ error: "Error updating property" });
  } finally {
    await connection.end();
  }
};

const deleteProperty = async (req, res) => {
  const propertyId = req.params.id;

  const connection = await mysqls.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  // Primero eliminamos las imágenes asociadas al Propertyo
  const deleteImagesSql = "DELETE FROM properties_img WHERE property_id = ?";
  connection.query(deleteImagesSql, [propertyId], (err, imageResult) => {
    if (err) {
      console.error("Error deleting Property images: ", err);
      return res.status(500).json({ error: "Error deleting Property images" });
    }
    console.log(
      `Deleted ${imageResult.affectedRows} images for Property with ID: ${propertyId}`
    );

    // Luego eliminamos la propiedad
    const deletePropertySql = "DELETE FROM Propertys WHERE id = ?";
    connection.query(deletePropertySql, [propertyId], (err, result) => {
      if (err) {
        console.error("Error deleting Property: ", err);
        return res.status(500).json({ error: "Error deleting Property" });
      }
      console.log("Deleted Property with ID:", propertyId);
      res.status(200).json({ message: "Property deleted successfully" });
    });
  });
};

async function sellProperty(propertyId, quantity) {
  const connection = await mysqls.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  try {
    await connection.beginTransaction();

    const [updateResult] = await connection.execute(
      `UPDATE properties
       SET stock = stock - ?
       WHERE id = ?
         AND stock >= ?`,
      [quantity, propertyId, quantity]
    );

    if (updateResult.affectedRows === 0) {
      throw new Error("Stock insuficiente o Propertyo no encontrado");
    }

    const [insertResult] = await connection.execute(
      city,
      `INSERT INTO purchased_
      city,propertys (Property_id, name, price, quantity)
       SELECT id, name, price, ?
       FROM Propertys
       WHERE id = ?`,
      [quantity, propertyId]
    );

    await connection.commit();

    return insertResult.insertId;
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    await connection.end();
  }
}

const moveToSold = async (req, res) => {
  const connection = mysqls.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  let query; // <- Definimos query fuera del try

  try {
    await util.promisify(connection.connect).bind(connection)();
    query = util.promisify(connection.query).bind(connection); // <- Asignamos aquí

    const { property_id } = req.params;

    if (
      !property_id ||
      typeof property_id !== "string" ||
      property_id.trim() === ""
    ) {
      throw new Error("Se requiere un ID de propiedad válido");
    }

    await query("START TRANSACTION");

    const [property] = await query(
      "SELECT p.* FROM sell_properties sp JOIN properties p ON sp.property_id = p.id WHERE sp.property_id = ?",
      [property_id]
    );

    if (!property) {
      throw new Error("La propiedad no está disponible para venta");
    }

    await query(
      "INSERT INTO sold_properties (property_id, name, price, created_at) VALUES (?, ?, ?, NOW())",
      [property_id, property.name, property.price]
    );

    await query(
      "DELETE FROM sell_properties WHERE property_id = ?",
      [property_id],

      "DELETE FROM recent_properties WHERE property_id = ?",
      [property_id]
    );

    await query('UPDATE properties SET action = "Vendido" WHERE id = ?', [
      property_id,
    ]);

    await query("COMMIT");
    res.status(200).json({
      success: true,
      message: "Inmueble marcado como vendido exitosamente",
    });
  } catch (error) {
    if (query) {
      await query("ROLLBACK").catch((rollbackError) => {
        console.error("Error en ROLLBACK:", rollbackError);
      });
    }

    console.error("Error al mover propiedad a vendidas:", error);
    res.status(400).json({
      success: false,
      error: error.message,
    });
  } finally {
    connection.end();
  }
};

const moveToRented = async (req, res) => {
  const connection = mysqls.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  let query; // <- Definimos query fuera del try

  try {
    await util.promisify(connection.connect).bind(connection)();
    query = util.promisify(connection.query).bind(connection); // <- Asignamos aquí

    const { property_id } = req.params;

    if (
      !property_id ||
      typeof property_id !== "string" ||
      property_id.trim() === ""
    ) {
      throw new Error("Se requiere un ID de propiedad válido");
    }

    await query("START TRANSACTION");

    const [property] = await query(
      "SELECT p.* FROM rent_properties sp JOIN properties p ON sp.property_id = p.id WHERE sp.property_id = ?",
      [property_id]
    );

    if (!property) {
      throw new Error("La propiedad no está disponible para arrendar");
    }

    await query(
      "INSERT INTO rented_properties (property_id, name, price, created_at) VALUES (?, ?, ?, NOW())",
      [property_id, property.name, property.price]
    );

    await query("DELETE FROM rent_properties WHERE property_id = ?", [
      property_id,
    ]);

    await query('UPDATE properties SET action = "Arrendado" WHERE id = ?', [
      property_id,
    ]);

    await query("COMMIT");
    res.status(200).json({
      success: true,
      message: "Inmueble marcado como arrendada exitosamente",
    });
  } catch (error) {
    if (query) {
      await query("ROLLBACK").catch((rollbackError) => {
        console.error("Error en ROLLBACK:", rollbackError);
      });
    }

    console.error("Error al arrendar el inmueble:", error);
    res.status(400).json({
      success: false,
      error: error.message,
    });
  } finally {
    connection.end();
  }
};

const searchProperties = async (req, res) => {
  try {
    const { action, sector, type, budget, ref } = req.query;

    let query = "SELECT * FROM properties WHERE 1=1";
    const values = [];

    if (action) {
      query += " AND action = ?";
      values.push(action);
    }

    if (sector) {
      query += " AND district = ?";
      values.push(sector);
    }

    if (type) {
      query += " AND category = ?";
      values.push(type);
    }

    if (budget) {
      query += " AND price <= ?";
      values.push(Number(budget));
    }

    if (ref) {
      query += " AND ref = ?";
      values.push(ref);
    }

    const [results] = await pool.execute(query, values);
    res.json({ ok: true, results });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "Error interno del servidor" });
  }
};

module.exports = {
  createProperty,
  getPropertysByCategory,
  getPropertysByActions,
  updateProperty,
  deleteProperty,
  getSellPropertys,
  getSoldPropertys,
  getRentPropertys,
  getRentedPropertys,
  getRecentProperties,
  moveToSold,
  moveToRented,
  searchProperties,
  getPropertys,
};
