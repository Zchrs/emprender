const { pool } = require("../database/config");

const getCodeRegAdmin = async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    
    // Consulta para obtener el código activo más reciente
    const [results] = await connection.query(
      "SELECT * FROM registration_codes_admins WHERE is_active = TRUE ORDER BY created_at DESC LIMIT 1"
    );

    if (results.length === 0) {
      return res.status(404).json({
        success: false,
        error: "No active registration code found",
        message: "No se encontró ningún código de registro activo"
      });
    }

    // Enviar el código activo
    res.json({
      success: true,
      data: results[0],
      message: "Código de administrador obtenido correctamente"
    });
    
  } catch (error) {
    console.error("Error al obtener los códigos de administrador", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      message: "Error interno del servidor"
    });
  } finally {
    if (connection) connection.release();
  }
}

const updateRegistrationCode = async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // 1. Desactivar todos los códigos anteriores
    await connection.query(
      "UPDATE registration_codes_admins SET is_active = FALSE WHERE is_active = TRUE"
    );

    // 2. Generar nuevo código
    const newCode = generateRandomCode();
    
    // 3. Insertar nuevo código activo
    const [insertResult] = await connection.query(
      "INSERT INTO registration_codes_admins (code, is_active, created_by) VALUES (?, TRUE, ?)",
      [newCode, req.body.created_by || 'admin']
    );

    // 4. Obtener el código recién creado
    const [newCodeResult] = await connection.query(
      "SELECT * FROM registration_codes_admins WHERE id = ?",
      [insertResult.insertId]
    );

    await connection.commit();

    console.log("✅ Nuevo código creado:", newCode);

    res.json({
      success: true,
      data: newCodeResult[0],
      message: "Código de acceso actualizado correctamente"
    });
    
  } catch (error) {
    if (connection) await connection.rollback();
    console.error("❌ Error actualizando código:", error);
    res.status(500).json({
      success: false,
      error: "Database error",
      message: `Error al actualizar el código: ${error.message}`
    });
  } finally {
    if (connection) connection.release();
  }
}

// Función para generar código aleatorio
const generateRandomCode = (length = 64) => {
  const characters = 'abcdefghijklmnopqrstuvwxyzABCDEFGH!JKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

module.exports = {
    getCodeRegAdmin,
    updateRegistrationCode
}