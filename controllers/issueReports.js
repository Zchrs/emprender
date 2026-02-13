// const mysql = require('mysql');
const util = require("util");
const path = require("path");
const jwt = require('jsonwebtoken'); // Importación faltante
const { validateJwt } = require("../middlewares/validate-jwt");
const { v4: uuidv4 } = require("uuid");
const { pool } = require("../database/config");

const createIssue = async (req, res) => {
  try {
    // 1. Extraer el token de manera consistente
    const token = req.headers.authorization?.split(' ')[1] || req.headers['x-token'];
    
    if (!token) {
      return res.status(401).json({
        ok: false,
        msg: 'Token no proporcionado',
        solution: 'Incluya el token en Authorization: Bearer <token> o en x-token header'
      });
    }

    // 2. Verificar el token directamente
    let clientId;
    let isClient = false; // Definimos isClient aquí
    
    try {
      const decoded = jwt.verify(token, process.env.SECRET_JWT_SEED);
      clientId = decoded.id;
      isClient = true; // Marcamos como true si el token es válido
    } catch (error) {
      console.error("Error verificando token:", error);
      return res.status(401).json({
        ok: false,
        msg: 'Token inválido o expirado',
        details: error.message
      });
    }

    // 3. Validar si es cliente
    if (req.body.submitClient === "client" && !clientId) {
      return res.status(403).json({
        error: "Acceso denegado",
        details: "Se requieren privilegios de cliente"
      });
    }

    // Pasamos explícitamente clientId e isClient a handleIssueCreation
    await handleIssueCreation(req, res, { isClient, clientId });
  } catch (error) {
    console.error("Error in createIssue:", error);
    return res.status(500).json({ 
      error: "Error interno del servidor",
      details: error.message 
    });
  }
};

const handleIssueCreation = async (req, res, { isClient, clientId }) => {
  const authHeader =
    req.headers.authorization ||
    (req.headers["x-token"] ? `Bearer ${req.headers["x-token"]}` : null);

  let userId = null;

  // Validación para usuarios normales
  if (!isClient && authHeader?.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1];
    try {
      const decodedUser = jwt.verify(token, process.env.SECRET_JWT_SEED);
      userId = decodedUser.id;
    } catch (userError) {
      console.log("Token de usuario no válido - Continuando como invitado");
    }
  }


  const {
    id = uuidv4(),
    user_id = userId,
    fullname,
    email,
    title,
    description,
    img_url = [],
    submitClient = req.body.submitClient ||
      (isClient ? "admin" : userId ? "client" : "guest"),
  } = req.body;

  // Validación de campos obligatorios mejorada
  const requiredFields = [
    { field: "fullname", message: "Nombres completos es requerido" },
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
      submitClient === "client" ? "issue_reports" : "";

    /**
     * Validación exhaustiva de propiedades duplicadas
     * Verifica por:
     * 1. Referencia exacta
     * 2. Mismo nombre en la misma ciudad y sector
     * 3. Mismas características principales
     */
const [duplicateCheck] = await connection.execute(
  `SELECT id, fullname, title FROM ${targetTable} 
   WHERE title = ? 
      OR (fullname = ? AND title = ?)
   LIMIT 1`,
  [title, fullname, title]
);

    if (duplicateCheck.length > 0) {
      await connection.rollback();
      const duplicate = duplicateCheck[0];

      let errorMessage = "Propiedad potencialmente duplicada: ";
      if (duplicate.title === title) {
        errorMessage += `El reporte con título: ${title} ya está registrada`;
      } else if (
        duplicate.fullname === fullname &&
        duplicate.title === title &&
        duplicate.id === id
      ) {
        errorMessage += `Ya existe una propiedad con el mismo nombre en ${title}, ${fullname}`;
      } else {
        errorMessage += `Propiedad con características similares ya registrada`;
      }

      return res.status(409).json({
        error: "Propiedad duplicada",
        details: errorMessage,
        duplicateId: duplicate.id,
        isExactDuplicate: duplicate.title === title,
      });
    }


    // Preparar valores para inserción
    const propertyValues = [
      id,
      user_id,
      fullname,
      email,
      title,
      description || null,
    ];

    // Insertar propiedad principal
    await connection.execute(
      `INSERT INTO ${targetTable} (
        id, user_id, fullname, email, title, description
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      propertyValues
    );

    // Procesar imágenes de la galería
    if (Array.isArray(img_url) && img_url.length > 0) {
      const validImages = img_url
        .filter((url) => typeof url === "string" && url.trim() !== "")
        .map((url) => [id, url.trim()]);

      if (validImages.length > 0) {
        try {
          await connection.query(
            `INSERT INTO issues_img (property_id, img_url) VALUES ?`,
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


    await connection.commit();

    // Respuesta exitosa
    return res.status(201).json({
      success: true,
      propertyId: id,
      createdBy: submitClient,
    });
  } catch (error) {
    if (connection) await connection.rollback();

    console.error("Error en createIssue:", {
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

module.exports = {
    createIssue,
}