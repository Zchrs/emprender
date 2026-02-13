const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const mysqls = require("mysql2/promise");
const nodemailer = require('nodemailer');

const v4options = {
  random: [
    0x10, 0x91, 0x56, 0xbe, 0xc4, 0xfb, 0xc1, 0xea, 0x71, 0xb4, 0xef, 0xe1,
    0x67, 0x1c, 0x58,
  ],
};

const createAdvisor = async (req, res) => {
  const advisorId = uuidv4();
  const verificationToken = crypto.randomBytes(32).toString('hex');

  try {
    const connection = await mysqls.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    });

    const { email, phone } = req.body;

    // 🔍 Verificar si el email o el teléfono ya existen en la tabla advisors
    const [existing] = await connection.execute(
      `SELECT email, phone FROM advisors WHERE email = ? OR phone = ?`,
      [email, phone]
    );

    if (existing.length > 0) {
      const existingEmail = existing.some(e => e.email === email);
      const existingPhone = existing.some(e => e.phone === phone);

      let errorMessage = "Ya existe un registro con ";
      if (existingEmail && existingPhone) errorMessage += "ese correo y número de teléfono.";
      else if (existingEmail) errorMessage += "ese correo.";
      else errorMessage += "ese número de teléfono.";

      await connection.end();
      return res.status(400).json({ error: errorMessage });
    }

    // 🔐 Hashea la contraseña
    const hashedPassword = await bcrypt.hash(req.body.password, 10);

    // ✅ Insertar asesor
    const [result] = await connection.execute(
      `INSERT INTO advisors (
        id, country, name, lastname, typeDoc, dnaId, expDate, state, city, address, phone,
        email, password, verificationToken
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        advisorId,
        req.body.country,
        req.body.name,
        req.body.lastname,
        req.body.typeDoc,
        req.body.dnaId,
        req.body.expDate,
        req.body.state,
        req.body.city,
        req.body.address,
        req.body.phone,
        req.body.email,
        hashedPassword,
        verificationToken
      ]
    );

    if (result.affectedRows > 0) {
      // ✉️ Enviar correo de verificación
      const transporter = nodemailer.createTransport({
        service: process.env.EMAIL_SENDER_TO_VERIFY,
        host: process.env.EMAIL_SERVER,
        port: process.env.EMAIL_SERVER_PORT,
        secure: true,
        auth: {
          user: process.env.EMAIL_SENDER_TO_VERIFY,
          pass: process.env.EMAIL_PASSWORD,
        },
      });

      const mailBody = {
        from: '"Gavic Inmobiliaria" <noreply@gavicinmobiliaria.com>',
        to: req.body.email,
        subject: 'Verifica tu correo electrónico',
        html: `
          <p>Por favor verifica tu correo:</p>
          <a href="http://192.168.47.181:5173/#/advisors/account/verify/${advisorId}/${verificationToken}">
            Haz clic aquí
          </a>
          <p>O copia esta URL en tu navegador:</p>
          <p>http://192.168.47.181:5173/#/advisors/account/verify/${advisorId}/${verificationToken}</p>
        `,
      };

      await transporter.sendMail(mailBody);

      res.status(201).json({
        id: advisorId,
        message: 'Asesor registrado. Por favor verifica tu correo.',
      });
    }

    await connection.end();
  } catch (error) {
    console.error('Error en createAdvisor:', error);
    res.status(500).json({
      error: "Error en el servidor",
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

const loginUserAdvisor = async (req, res) => {
  try {
    const connection = await mysqls.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    });

    const { email, password } = req.body;
    const findUserQuery = "SELECT * FROM advisors WHERE email = ?";
    const [results] = await connection.query(findUserQuery, [email]);

    if (results.length === 0) {
      return res.status(400).json({ error: "Asesor y/o contraseña incorrecta." });
    }

    const advisor = results[0];

    // ✅ Comparación segura con bcrypt
    const passwordMatch = await bcrypt.compare(password, advisor.password);
    if (!passwordMatch) {
      return res.status(400).json({ error: "Contraseña incorrecta." });
    }

    const role = 'advisor';
    const generateJwt = (id, name, lastname, email, role) => {
      const payload = { id, name, lastname, email, role };
      const secretKey = process.env.SECRET_JWT_SEED_ADV;
      const options = { expiresIn: '2h' };
      return jwt.sign(payload, secretKey, options);
    };

    const { id, name, lastname, address, phone, dnaId, city } = advisor;
    const token = generateJwt(id, name, lastname, email, role);

    res.json({
      ok: true,
      msg: "Login successful",
      advisor: {
        id,
        name,
        lastname,
        email,
        address, 
        phone, 
        dnaId,
        city,
        role,
        token,
      },
    });

    await connection.end();
  } catch (error) {
    console.log(error);
    res.status(500).json({
      ok: false,
      msg: "Please contact the administrator",
    });
  }
};

const renewTokenAdvisor = async (req, res) => {
  const role = "advisor";
  const { id } = req;

  try {
    const connection = await mysqls.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    });

    const [rows] = await connection.query("SELECT * FROM advisors WHERE id = ?", [id]);

    if (rows.length === 0) {
      return res.status(404).json({ ok: false, msg: "Asesor no encontrado" });
    }

    const advisor = rows[0];
    const { name, lastname, email, address, phone, dnaId, city } = advisor;

    const generateJwtAdv = (id, name, lastname, email, role) => {
      const payload = { id, name, lastname, email, role };
      const secretKey = process.env.SECRET_JWT_SEED_ADV;
      const options = { expiresIn: "2h" };
      return jwt.sign(payload, secretKey, options);
    };

    const token = generateJwtAdv(id, name, lastname, email, role);

    res.json({
      ok: true,
      id,
      name,
      lastname,
      email,
      address,
      phone,
      dnaId,
      city,
      role,
      token
    });

    await connection.end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, msg: "Error renovando el token" });
  }
};

const verifyAdvisor = async (req, res) => {
  const { token } = req.params;

  try {
    const [rows] = await connection.query(
      'SELECT * FROM advisors WHERE verificationToken = ?',
      [token]
    );

    if (rows.length === 0) {
      return res.status(400).json({ message: 'Invalid token or advisor already verified.' });
    }

    await connection.query(
      'UPDATE users SET isVerified = 1, verificationToken = NULL WHERE verificationToken = ?',
      [token]
    );

    res.status(200).json({ message: 'Asesor verified successfully.' });
  } catch (error) {
    console.error('Error verifying Asesor:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
};

const verifyEmail = async (req, res) => {
  const { token } = req.params; // Obtiene el token de la URL

  try {
    // 1. Conecta a la base de datos
    const connection = await mysqls.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    });

    // 2. Busca al usuario con el token de verificación
    const [advisors] = await connection.execute(
      'SELECT * FROM advisors WHERE verificationToken = ?',
      [token]
    );

    if (advisors.length === 0) {
      await connection.end();
      return res.status(400).json({ error: 'Token inválido o expirado' });
    }

    const advisor = advisors[0];

    // 3. Si el usuario ya está verificado
    if (advisor.isVerified) {
      await connection.end();
      return res.status(200).json({ message: 'El correo ya está verificado' });
    }

    // 4. Actualiza el usuario como verificado y limpia el token
    await connection.execute(
      'UPDATE advisors SET isVerified = true, verificationToken = NULL WHERE id = ?',
      [advisor.id]
    );

    await connection.end();

    // 5. Respuesta exitosa
    res.status(200).json({ 
      success: true,
      message: 'Correo verificado exitosamente' 
    });

  } catch (error) {
    console.error('Error en verifyEmail:', error);
    res.status(500).json({ error: 'Error al verificar el correo' });
  }
};

module.exports = {
  createAdvisor,
  loginUserAdvisor,
  renewTokenAdvisor,
  verifyAdvisor,
  verifyEmail
};
