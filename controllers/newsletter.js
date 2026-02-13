const {response} = require("express");
const mysql = require("mysql");
const { v4: uuidv4 } = require('uuid');

const subscribeNewsletter = async (req, res) =>{
  
  const { id = uuidv4(), email } = req.body;
  
  
   try {
    // Configura la conexión a la base de datos MySQL
    const connection = mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    });

    // Verificar si el email ya existe en la base de datos
    const findEmailQuery = "SELECT COUNT(*) AS count FROM newsletter WHERE email = ?";
    const findEmailValues = [email];

    connection.query(findEmailQuery, findEmailValues, (error, results) => {
      if (error) {
        console.log("Error al verificar el email: ", error);
        res.status(500).json({ error: "Ocurrió un error al verificar el email" });
        return;
      }

      const emailExists = results[0].count > 0;

      if (emailExists) {
        console.log("El email ya se encuentra registrado")
        res.status(400).json({ error: "El email ya está registrado" });
        return;
      }

      // Data preliminar
      // Si el email no existe, usuario listo para grabar
        const insertUser = `INSERT INTO newsletter (id, email) 
          VALUES (?, ?)`;
        
       

        const values = [
          id,
          email
        ];
        // usuario grabado con exito a menos que haya algún error de conexión
        connection.query(insertUser, values, async (error, results) => {
          if (error) {
            console.error("Error al insertar datos: ", error);
            console.log(error);
            res
              .status(500)
              .json({ error: "Ocurrió un error al insertar los datos"
             });
            return;
          }

          const { id, email } = req.body;
        
          res.json({
            id,
            email
          });
          console.log(`
          Email suscrito correctamente.
          id: ${id} 
          Usuario: ${email}`);
          connection.end();
        });
    });
  } catch (error) {
    console.log(error);
    throw new Error("Error al inicializar la DB");
  }
  }

  module.exports = {
    subscribeNewsletter
  };