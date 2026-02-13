const mysqls = require('mysql');
const util = require('util');
// Configuración de la conexión a la base de datos MySQL

// Función para agregar un producto al carrito
const addLike = (req, res) => {
  const { id, user_id, property_id, price, quantity } = req.body;

  const connection = mysqls.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  connection.connect();

  // Verificar si el usuario y el producto existen
  const userAndProductExistQuery = `
    SELECT * FROM users WHERE id = ? AND EXISTS (SELECT * FROM products WHERE id = ?)
  `;
  connection.query(userAndProductExistQuery, [user_id, property_id], (error, results) => {
    if (error) {
      console.error('Error al verificar usuario y propiedad:', error);
      connection.end();
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
    if (results.length === 0) {
      connection.end();
      return res.status(404).json({ error: 'Usuario o producto no encontrado' });
      
    }

    // Insertar el like en la tabla de likes
    const insertPropertyLike = `
      INSERT INTO likes (id, user_id, property_id, like) VALUES (?, ?, ?, ?, ?)
    `;
    connection.query(insertPropertyLike, [id, user_id, property_id, like], (error, results) => {
      if (error) {
        console.error('Error al agregar producto al carrito:', error);
        connection.end();
        return res.status(500).json({ error: 'Error interno del servidor' });
      }
      connection.end();
      return res.status(201).json({ message: 'Has indicado que te gusta!' });
    });
  });
};

// Función para obtener todos los productos del carrito
const getLikeProperties = async (req, res) => {
  try {
    const { user_id } = req.params;

    // Validar que user_id sea una cadena no vacía
    if (typeof user_id !== 'string' || user_id.trim() === '') {
      throw new Error('Invalid user id');
    }

    // Crear conexión a la base de datos
    const connection = mysqls.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    });

    // Establecer la conexión
    connection.connect();

    // Promisify la función de consulta para poder usar async/await
    const query = util.promisify(connection.query).bind(connection);

    // Verificar si el usuario existe en la base de datos
    const userCheckSql = 'SELECT id FROM users WHERE id = ?';
    const userExists = await query(userCheckSql, [user_id]);

    if (userExists.length === 0) {
      // Si el usuario no existe, lanzar un error
      throw new Error('User not found');
    }

    // Realizar la consulta a la base de datos para obtener los productos de la lista de deseos
    const wishlistSql = `
      SELECT uc.id, uc.user_id, uc.property_id, uc.price, uc.quantity, p.name, p.description, pi.img_url
      FROM wish_list uc
      JOIN products p ON uc.property_id = p.id
      LEFT JOIN products_img pi ON uc.property_id = pi.property_id
      WHERE uc.user_id = ?
    `;
    const wishlistRaw = await query(wishlistSql, [user_id]);

    // Consolidar los productos y sus imágenes
    const wishlist = wishlistRaw.reduce((acc, item) => {
      const product = acc.find(p => p.id === item.id);

      if (product) {
        if (!product.img_urls.includes(item.img_url)) {
          product.img_urls.push(item.img_url);
        }
      } else {
        acc.push({
          id: item.id,
          user_id: item.user_id,
          property_id: item.property_id,
          price: item.price,
          quantity: item.quantity,
          name: item.name,
          description: item.description,
          img_urls: item.img_url ? [item.img_url] : [],
        });
      }

      return acc;
    }, []);

    // Cerrar la conexión
    connection.end();

    // Devolver los productos de la lista de deseos como respuesta
    res.status(200).json(wishlist);
  } catch (error) {
    console.error('Error al obtener los productos de la lista de deseos:', error);
    res.status(500).json({ error: error.message });
  }
};

// Función para quitar un producto de la lista de deseos
const removeLike = async (req, res) => {
  try {
    const { user_id, property_id } = req.body;

    console.log('Received userId:', user_id);
    console.log('Received propertyId:', property_id);

    // Validar que user_id y property_id sean cadenas no vacías
    if (typeof user_id !== 'string' || user_id.trim() === '') {
      throw new Error('Invalid user id');
    }
    if (typeof property_id !== 'string' || property_id.trim() === '') {
      throw new Error('Invalid product id');
    }

    // Crear conexión a la base de datos
    const connection = mysqls.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    });

    // Establecer la conexión
    connection.connect();

    // Promisify la función de consulta para poder usar async/await
    const query = util.promisify(connection.query).bind(connection);

    // Verificar si el usuario existe en la base de datos
    const userCheckSql = 'SELECT id FROM users WHERE id = ?';
    const userExists = await query(userCheckSql, [user_id]);

    if (userExists.length === 0) {
      // Si el usuario no existe, lanzar un error
      throw new Error('User not found');
    }

    // Eliminar el producto de la lista de deseos
    const deleteSql = 'DELETE FROM wish_list WHERE user_id = ? AND property_id = ?';
    await query(deleteSql, [user_id, property_id]);

    // Cerrar la conexión
    connection.end();

    // Devolver una respuesta de éxito
    res.status(200).json({ message: 'Producto eliminado del carrito exitosamente' });
  } catch (error) {
    console.error('Error al eliminar producto del carrito:', error);
    res.status(500).json({ error: error.message });
  }
};


module.exports = {
  addLike,
  getLikeProperties,
  removeLike
};
