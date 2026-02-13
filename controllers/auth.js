const {response} = require("express");
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const mysqls = require("mysql2/promise");
const nodemailer = require('nodemailer');
const { v4: uuidv4 } = require('uuid');


// Crear usuarios

const createUser = async (req, res) => {
  const userId = uuidv4();

  try {
    const connection = await mysqls.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    });

    const { names, lastnames, docId, phone, email, address } = req.body;

    // 🔎 Validar campos obligatorios
    if (!names || !lastnames || !docId || !phone || !email) {
      await connection.end();
      return res.status(400).json({
        error: "Todos los campos obligatorios deben estar completos"
      });
    }

    // 🔎 Verificar si ya existe email, phone o docId
    const [existingUser] = await connection.execute(
      `SELECT id FROM users 
       WHERE email = ? OR phone = ? OR docId = ? 
       LIMIT 1`,
      [email, phone, docId]
    );

    if (existingUser.length > 0) {
      await connection.end();
      return res.status(409).json({
        error: "Ya existe un usuario con ese email, teléfono o documento"
      });
    }

    // ✅ Insertar usuario
    const [result] = await connection.execute(
      `INSERT INTO users (
        id,
        names,
        lastnames,
        docId,
        phone,
        email,
        address
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userId, names, lastnames, docId, phone, email, address]
    );

    await connection.end();

    return res.status(201).json({
      id: userId,
      message: 'Usuario registrado correctamente',
    });

  } catch (error) {
    console.error('Error en createUser:', error);
    return res.status(500).json({
      error: "Error en el servidor",
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

const verifyUser = async (req, res) => {
  const { token } = req.params;

  try {
    const [rows] = await connection.query(
      'SELECT * FROM users WHERE verificationToken = ?',
      [token]
    );

    if (rows.length === 0) {
      return res.status(400).json({ message: 'Invalid token or user already verified.' });
    }

    await connection.query(
      'UPDATE users SET isVerified = 1, verificationToken = NULL WHERE verificationToken = ?',
      [token]
    );

    res.status(200).json({ message: 'User verified successfully.' });
  } catch (error) {
    console.error('Error verifying user:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
};

const loginUser = async (req, res) => {
  try {
    const connection = await mysqls.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    });

    const { email, password } = req.body;
    const findUserQuery = "SELECT * FROM users WHERE email = ?";
    const [results] = await connection.query(findUserQuery, [email]);

    if (results.length === 0) {
      console.log("Usuario y/o contraseña incorrecto.");
      return res.status(400).json({ error: "Usuario y/o contraseña incorrecta." });
    }

    const user = results[0];

    if (user.password !== password) {
      console.log("Contraseña incorrecta.");
      return res.status(400).json({ error: "Contraseña incorrecta." });
    }

    const role = 'user';
    const generateJwt = (id, name, lastname, email, role) => {
      const payload = { id, email, name, lastname, role };
      const secretKey = process.env.SECRET_JWT_SEED;
      const options = { expiresIn: '2h' };
      return jwt.sign(payload, secretKey, options);
    };

    const { id, name, lastname, city, phone, address, zip_code } = user;
    const token = generateJwt(id, name, lastname, email, role);

    res.json({
      ok: true,
      msg: "Login successful",
      user: {
        id,
        name,
        lastname,
        city,
        phone,
        email,
        address,
        zip_code,
        role,
        token,
      },
    });

    console.log(`Inicio de sesión exitoso.
      ID: ${id}
      Nombre: ${name}
      Apellido: ${lastname}
      Ciudad: ${city}
      Teléfono: ${phone}
      Dirección: ${address}
      Email: ${email}
      Rol: ${role}
      Token: ${token}
    `);

    await connection.end();
  } catch (error) {
    console.log(error);
    res.status(500).json({
      ok: false,
      msg: "Please contact the administrator",
    });
  }
};

const renewToken = async (req, res) => {
  const role = "user";
  const { id } = req;

  try {
    const connection = await mysqls.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    });

    const [rows] = await connection.query("SELECT * FROM users WHERE id = ?", [id]);

    if (rows.length === 0) {
      return res.status(404).json({ ok: false, msg: "Usuario no encontrado" });
    }

    const user = rows[0];
    const { name, lastname, email, address, phone, city } = user;

    const generateJwtAdv = (id, name, lastname, email, role) => {
      const payload = { id, name, lastname, email, role };
      const secretKey = process.env.SECRET_JWT_SEED;
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
    const [users] = await connection.execute(
      'SELECT * FROM users WHERE verificationToken = ?',
      [token]
    );

    if (users.length === 0) {
      await connection.end();
      return res.status(400).json({ error: 'Token inválido o expirado' });
    }

    const user = users[0];

    // 3. Si el usuario ya está verificado
    if (user.isVerified) {
      await connection.end();
      return res.status(200).json({ message: 'El correo ya está verificado' });
    }

    // 4. Actualiza el usuario como verificado y limpia el token
    await connection.execute(
      'UPDATE users SET isVerified = true, verificationToken = NULL WHERE id = ?',
      [user.id]
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

async function getVerificationToken(userId) {
  let connection;
  try {
    // Crea una conexión a la base de datos
    connection = await mysqls.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    });

    console.log('Buscando token para usuario ID:', userId);

    // Realiza la consulta para obtener el token
    const [userRows] = await connection.execute(
      'SELECT id, verificationToken FROM users WHERE id = ?', 
      [userId]
    );

    // Verifica si se encontró el usuario
    if (userRows.length === 0) {
      console.log('No se encontró usuario con ID:', userId);
      return null; // Mejor que retornar array vacío para distinguir "no encontrado" de "error"
    }

    const userData = userRows[0];
    console.log('Datos encontrados:', userData);

    return {
      id: userData.id,
      token: userData.verificationToken
    };

  } catch (error) {
    console.error('Error al obtener el token:', error);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
      console.log('Conexión cerrada');
    }
  }
}

module.exports = {
  createUser,
  loginUser,
  verifyEmail,
  verifyUser,
  getVerificationToken,
  renewToken
};