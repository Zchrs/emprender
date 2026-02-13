
const EXPIRATION_TIME = 24 * 60 * 60 * 1000; // 24 horas en milisegundos

const mysql = require('mysql');
const connection = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
});

const generateInvitationCode = (req, res) => {
  const code = Math.random().toString(36).substring(2, 15); // Genera un código aleatorio
  const createdAt = new Date();

  connection.query(
    'INSERT INTO invitations (code, createdAt) VALUES (?, ?)',
    [code, createdAt],
    (error, results) => {
      if (error) {
        console.error('Error al generar el código de invitación:', error);
        return res.status(500).json({ error: 'Error interno del servidor' });
      }
      return res.status(201).json({ code });
    }
  );
};

const verifyInvitationCode = (req, res) => {
  const { code } = req.params;

  connection.query(
    'SELECT * FROM invitations WHERE code = ?',
    [code],
    (error, results) => {
      if (error) {
        console.error('Error al verificar el código de invitación:', error);
        return res.status(500).json({ error: 'Error interno del servidor' });
      }

      if (results.length === 0) {
        return res.status(404).json({ error: 'Código de invitación no encontrado' });
      }

      const invitation = results[0];
      const currentTime = new Date().getTime();
      const creationTime = new Date(invitation.createdAt).getTime();

      if ((currentTime - creationTime) > EXPIRATION_TIME) {
        return res.status(400).json({ error: 'El código de invitación ha caducado' });
      }

      return res.status(200).json({ message: 'Código de invitación válido' });
    }
  );
};

module.exports = {
  generateInvitationCode,
  verifyInvitationCode,
};