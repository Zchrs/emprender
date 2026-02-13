const jwt = require('jsonwebtoken');
const mysql = require("mysql2/promise");
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');


const v4options = {
  random: [
    0x10, 0x91, 0x56, 0xbe, 0xc4, 0xfb, 0xc1, 0xea, 0x71, 0xb4, 0xef, 0xe1, 0x67, 0x1c, 0x58
  ],
};

const createAdmin = async (req, res) => {
  try {
    const hashedPassword = await bcrypt.hash(req.body.pass, 10);
    const { id = uuidv4(), fullname, email, pass = hashedPassword, codeAccess } = req.body;

    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    });

    // 1. Verificar si el email ya está registrado
    const [emailResults] = await connection.execute(
      "SELECT COUNT(*) AS count FROM admins WHERE email = ?",
      [email]
    );

    if (emailResults[0].count > 0) {
      await connection.end();
      return res.status(400).json({ error: 'El email ya está registrado' });
    }

    // 2. Verificar si el código de acceso es válido
    const [codeResults] = await connection.execute(
      "SELECT COUNT(*) AS count FROM registration_codes_admins WHERE code = ?",
      [codeAccess]
    );

    if (codeResults[0].count === 0) {
      await connection.end();
      return res.status(400).json({ error: 'Código de acceso inválido' });
    }

    // 3. Insertar nuevo admin
    const [insertResult] = await connection.execute(
      "INSERT INTO admins (id, fullname, email, pass, codeAccess) VALUES (?, ?, ?, ?, ?)",
      [id, fullname, email, pass, codeAccess]
    );

    // 4. Generar JWT
    const role = 'admin';
    const generateJwtAdm = (id, fullname, email, role) => {
      const payload = { id, fullname, email, role };
      const secretKey = process.env.SECRET_JWT_SEED_ADM;
      const options = { expiresIn: '2h' };
      return jwt.sign(payload, secretKey, options);
    };

    const token = generateJwtAdm(id, fullname, email, role);

    await connection.end();

    // 5. Respuesta exitosa
    res.status(201).json({
      id,
      fullname,
      email,
      token,
      role,
    });

    console.log(`Admin registrado correctamente:
      ID: ${id}
      Email: ${email}
      Nombre: ${fullname}
      Token: ${token}
      Rol: ${role}`);
  } catch (error) {
    console.error('Error en createAdmin:', error);
    res.status(500).json({ error: 'Error al crear el admin' });
  }
};

const loginUserAdmin = async (req, res) => {
    const { email, pass } = req.body;
    const findAdminQuery = "SELECT * FROM admins WHERE email = ?";
    const findAdminValues = [email];

    try {
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USERNAME,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
        });

        const [results] = await connection.query(findAdminQuery, findAdminValues);

        if (results.length === 0) {
            await connection.end();
            return res.status(400).json({ error: "Usuario y/o contraseña incorrecta." });
        }

        const admin = results[0];

        if (admin.pass !== pass) {
            await connection.end();
            return res.status(400).json({ error: "Contraseña incorrecta." });
        }

        const generateJwtAdm = (id, fullname, email, role) => {
            const payload = { id, email, fullname, role };
            const secretKey = process.env.SECRET_JWT_SEED_ADM;
            const options = { expiresIn: '2h' };
            return jwt.sign(payload, secretKey, options);
        };

        const { id, fullname } = admin;
        const role = 'admin';
        const token = generateJwtAdm(id, fullname, email, role);

        await connection.end();

        res.json({
            ok: true,
            msg: "Login successful",
            admin: {
                id: admin.id,
                fullname: admin.fullname,
                email: admin.email,
                role,
                token,
            },
        });

        console.log(`Inicio de sesión exitoso para: ${fullname} (${email})`);

    } catch (error) {
        console.error("Error en loginUserAdmin:", error);
        res.status(500).json({
            ok: false,
            msg: "Please contact the administrator",
        });
    }
};

const renewTokenAdmin = async (req, res) => {
    const role = 'admin';
    const admin = req;
    const { id, fullname, email } = admin;
    // console.log(id, name, email, 'require desde renew');
    const generateJwtAdm = (id, fullname, email, role) => {
      const payload = {
        id: admin.id,
        fullname: admin.fullname,
        email: admin.email,
        role
      };
      const secretKey = process.env.SECRET_JWT_SEED_ADM;
      const options = {
        expiresIn: '2h' 
      };
      const token = jwt.sign(payload, secretKey, options);
      return token;
    };
  
  
    
    const token = generateJwtAdm( id, fullname, email, role );
  
    res.json({
      ok: true,
      id: admin.id,
      fullname: admin.fullname,
      email: admin.email,
      role,
      token,
     
    });
};
  
  
module.exports = {
    createAdmin,
    loginUserAdmin,
    renewTokenAdmin,
  };