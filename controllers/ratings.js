const mysqls = require("mysql");
const mysql = require('mysql2/promise');

// const addRating = async (req, res) => {
//   const { product_id, user_id, rating } = req.body;
  
//   // Verifica los datos recibidos
//   console.log('Datos recibidos:', { product_id, user_id, rating });

//   if (product_id === undefined || user_id === undefined || rating === undefined) {
//     return res.status(400).json({ error: 'Faltan parámetros requeridos' });
//   }

//   const connection = await mysql.createConnection({
//     host: process.env.DB_HOST,
//     user: process.env.DB_USERNAME,
//     password: process.env.DB_PASSWORD,
//     database: process.env.DB_NAME,
//   });

//   try {
//     const insertRatingQuery = `
//       INSERT INTO ratings (product_id, user_id, rating) VALUES (?, ?, ?)
//     `;
//     const [results] = await connection.execute(insertRatingQuery, [product_id, user_id, rating]);

//     return res.status(201).json({ message: 'Calificación agregada exitosamente', results });
//   } catch (error) {
//     console.error('Error al agregar calificación:', error);
//     return res.status(500).json({ error: 'Error interno del servidor' });
//   } finally {
//     await connection.end();
//   }
// };

const addRating = async (req, res) => {
  const { product_id, user_id, rating } = req.body;

  // Verifica los datos recibidos
  console.log('Datos recibidos:', { product_id, user_id, rating });

  if (product_id === undefined || user_id === undefined || rating === undefined) {
    return res.status(400).json({ error: 'Faltan parámetros requeridos' });
  }

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  try {
    const insertRatingQuery = `
      INSERT INTO ratings (product_id, user_id, rating) VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE rating = VALUES(rating)
    `;
    const [results] = await connection.execute(insertRatingQuery, [product_id, user_id, rating]);

    // Obtén la nueva calificación para el producto
    const [ratingsRows] = await connection.execute('SELECT AVG(rating) AS averageRating, COUNT(*) AS totalRatings FROM ratings WHERE product_id = ?', [product_id]);

    // Emitir el evento de actualización
    // io.emit('updateRating', { product_id, averageRating: ratingsRows[0].averageRating, totalRatings: ratingsRows[0].totalRatings });

    return res.status(201).json({ message: 'Calificación agregada exitosamente', results });
  } catch (error) {
    console.error('Error al agregar calificación:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  } finally {
    await connection.end();
  }
};


const getProductRatings = async (req, res) => {
  const { product_id } = req.params;

  // Verifica los datos recibidos
  // console.log('Datos recibidos:', { product_id });

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  try {
    const [ratings] = await connection.query(
      'SELECT rating FROM ratings WHERE product_id = ?',
      [product_id]
    );

    const totalRatings = ratings.length;
    const averageRating = totalRatings
      ? ratings.reduce((sum, r) => sum + r.rating, 0) / totalRatings
      : 0;


    res.status(200).json({ totalRatings, averageRating, ratings });
  } catch (error) {
    console.error('Error al obtener las calificaciones:', error);
    res.status(500).json({ message: 'Error interno del servidor', error });
  } finally {
    await connection.end();
  }
};

module.exports = {
    addRating,
    getProductRatings,
}