/* 
    rutas de usuarios / auth
    host + /api/auth
*/

const mysqls = require("mysql2/promise");
const { Router } = require("express");
const { check } = require("express-validator");
const { validateFields } = require("../middlewares/validate-form-data");
const { createUser, renewToken, loginUser, verifyUser, verifyEmail, getVerificationToken } = require("../controllers/auth");
const { validateJwt } = require("../middlewares/validate-jwt");
const { isUUID } = require('validator');
const { connectionDB } = require("../database/config");

const router = Router();

router.post(
  "/register",
  [
    check("names", "Name is required").not().isEmpty(),
    check("lastnames", "Last name is required").not().isEmpty(),
    check("phone", "phone is required").not().isEmpty(),
    check("email", "Email is required").isEmail(),

    validateFields,
  ],
  createUser
);

router.post(
  "/login",
  [
    check("email", "Email is required").isEmail(),
    check("password", "Password is required").not().isEmpty(),

    validateFields,
  ],
  loginUser
);

router.post('/account/verify/email/:token', verifyEmail);

router.get('/account/email/verify-status/:token', async (req, res) => {
  let connection;
  try {
    connection = await connectionDB(); // Ahora obtendrá una conexión válida
    
    const [users] = await connection.execute(
      'SELECT isVerified FROM users WHERE verificationToken = ? OR id = ?',
      [req.params.token, req.params.token]
    );
    
    if (users.length === 0) {
      return res.status(404).json({ 
        success: false,
        isVerified: false,
        message: 'Token no encontrado' 
      });
    }
    
    res.status(200).json({ 
      success: true,
      isVerified: users[0].isVerified,
      userId: users[0].id
    });
    
  } catch (error) {
    console.error('Error en verify-status:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error al verificar estado',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    // Asegúrate de cerrar la conexión
    if (connection) await connection.end();
  }
});

router.get('/get-verification-token/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    console.log('Solicitud recibida para usuario ID:', userId);

    // Validación básica del ID (versión simplificada)
    if (!userId || userId.length < 10) { // Ajusta según tu formato de ID
      return res.status(400).json({ 
        message: 'ID de usuario no válido',
        receivedId: userId
      });
    }

    const tokenData = await getVerificationToken(userId);
    console.log('Resultado de la consulta:', tokenData);

    if (!tokenData || !tokenData.token) {
      return res.status(404).json({ 
        success: false,
        message: 'Usuario no encontrado o sin token de verificación',
        userId: userId
      });
    }

    res.status(200).json({ 
      success: true,
      userId: tokenData.id,
      token: tokenData.token 
    });

  } catch (error) {
    console.error('Error en la ruta:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error al obtener el token de verificación',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

router.get('/verify/:token', verifyUser);

router.get("/renew", validateJwt , renewToken);

module.exports = router;
