const { Router } = require("express");
const cors = require('cors');
const { check } = require("express-validator");
const { validateFields } = require("../middlewares/validate-form-data");
const { renewTokenAdvisor, loginUserAdvisor, createAdvisor, verifyAdvisor, verifyEmail } = require("../controllers/advisors");
const { validateJwtAdviror } = require("../middlewares/validate-jwt");

//hola

const router = Router();

router.post(
  "/register",
  [
    check("name", "Campo nombre es obligatorio").not().isEmpty(),
    check("lastname", "Campo apellido es obligatorio").not().isEmpty(),
    check("email", "Campo email es obligatorio").isEmail(),
    check("password", "Escribe una contraseña").isLength({ min: 7 }),
    
    validateFields,
  ],
  createAdvisor
);

router.post(
  "/login",
  [
    check("email", "Email is required").isEmail(),
    check("password", "Password is required").not().isEmpty(),

    validateFields,
  ],
  loginUserAdvisor
);

router.get('/get-verification-token/:advisorId', async (req, res) => {
  try {
    const advisorId = req.params.advisorId;
    console.log('Solicitud recibida para asesor ID:', advisorId);

    // Validación básica del ID (versión simplificada)
    if (!advisorId || advisorId.length < 10) { // Ajusta según tu formato de ID
      return res.status(400).json({ 
        message: 'ID de usuario no válido',
        receivedId: advisorId
      });
    }

    const tokenData = await getVerificationToken(advisorId);
    console.log('Resultado de la consulta:', tokenData);

    if (!tokenData || !tokenData.token) {
      return res.status(404).json({ 
        success: false,
        message: 'Usuario no encontrado o sin token de verificación',
        advisorId: advisorId
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

router.post('/account/verify/email/:token', verifyEmail);

router.get('/verify/:token', verifyAdvisor);

router.get("/renew", validateJwtAdviror, renewTokenAdvisor);

module.exports = router;