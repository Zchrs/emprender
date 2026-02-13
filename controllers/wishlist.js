const mysqls = require('mysql');
const util = require('util');
// Configuración de la conexión a la base de datos MySQL

// Función para agregar un producto al carrito
const addToWishlist = (req, res) => {
  const { id, user_id, product_id, price, quantity } = req.body;

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
  connection.query(userAndProductExistQuery, [user_id, product_id], (error, results) => {
    if (error) {
      console.error('Error al verificar usuario y producto:', error);
      connection.end();
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
    if (results.length === 0) {
      connection.end();
      return res.status(404).json({ error: 'Usuario o producto no encontrado' });
      
    }

    // Insertar el producto en el carrito
    const insertProductQuery = `
      INSERT INTO wish_list (id, user_id, product_id, price, quantity) VALUES (?, ?, ?, ?, ?)
    `;
    connection.query(insertProductQuery, [id, user_id, product_id, price, quantity], (error, results) => {
      if (error) {
        console.error('Error al agregar producto al carrito:', error);
        connection.end();
        return res.status(500).json({ error: 'Error interno del servidor' });
      }
      connection.end();
      return res.status(201).json({ message: 'Producto agregado al carrito exitosamente' });
    });
  });
};

// Función para obtener todos los productos del carrito
const getWishlistProducts = async (req, res) => {
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
      SELECT uc.id, uc.user_id, uc.product_id, uc.price, uc.quantity, p.name, p.description, pi.img_url
      FROM wish_list uc
      JOIN products p ON uc.product_id = p.id
      LEFT JOIN products_img pi ON uc.product_id = pi.product_id
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
          product_id: item.product_id,
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

// Función para actualizar un producto del carrito
  const updateWishlistProduct = async (req, res) => {
    try {
        const { product_Id } = req.params;
        const { quantity } = req.body;

        const connection = mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USERNAME,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
        });

        connection.connect();

        // Verificar si el producto está en el carrito
        const queryFindProduct = 'SELECT * FROM cart WHERE product_Id = ?';
        connection.query(queryFindProduct, [product_Id], (error, results) => {
            if (error) {
                console.error('Error al buscar el producto en el carrito:', error);
                return res.status(500).json({ error: 'Error al buscar el producto en el carrito.' });
            }

            if (results.length === 0) {
                return res.status(404).json({ message: "El producto no está en el carrito." });
            }

            // Actualizar la cantidad del producto en el carrito
            const queryUpdateQuantity = 'UPDATE cart SET quantity = ? WHERE product_Id = ?';
            connection.query(queryUpdateQuantity, [quantity, product_Id], (error, results) => {
                if (error) {
                    console.error('Error al actualizar la cantidad del producto en el carrito:', error);
                    return res.status(500).json({ error: 'Error al actualizar la cantidad del producto en el carrito.' });
                }
                
                return res.status(200).json({ message: "Cantidad del producto actualizada en el carrito." });
            });
        });

        connection.end();
    } catch (error) {
        console.error('Error al actualizar la cantidad del producto en el carrito:', error);
        return res.status(500).json({ error: 'Error al actualizar la cantidad del producto en el carrito.' });
    }
};

// Función para quitar un producto de la lista de deseos
const removeFromWishlist = async (req, res) => {
  try {
    const { user_id, product_id } = req.body;

    console.log('Received userId:', user_id);
    console.log('Received productId:', product_id);

    // Validar que user_id y product_id sean cadenas no vacías
    if (typeof user_id !== 'string' || user_id.trim() === '') {
      throw new Error('Invalid user id');
    }
    if (typeof product_id !== 'string' || product_id.trim() === '') {
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
    const deleteSql = 'DELETE FROM wish_list WHERE user_id = ? AND product_id = ?';
    await query(deleteSql, [user_id, product_id]);

    // Cerrar la conexión
    connection.end();

    // Devolver una respuesta de éxito
    res.status(200).json({ message: 'Producto eliminado del carrito exitosamente' });
  } catch (error) {
    console.error('Error al eliminar producto del carrito:', error);
    res.status(500).json({ error: error.message });
  }
};

// Función para quitar un producto del carrito y enviarlo a la lista de deseos
const moveWishlistToCart = async (req, res) => {
  try {
    const { user_id, product_id } = req.body;

    // Validar que user_id y product_id sean cadenas no vacías
    if (typeof user_id !== 'string' || user_id.trim() === '') {
      throw new Error('Invalid user id');
    }
    if (typeof product_id !== 'string' || product_id.trim() === '') {
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

    // Iniciar una transacción
    await query('START TRANSACTION');

    // Verificar si el usuario existe en la base de datos
    const userCheckSql = 'SELECT id FROM users WHERE id = ?';
    const userExists = await query(userCheckSql, [user_id]);

    if (userExists.length === 0) {
      // Si el usuario no existe, lanzar un error
      throw new Error('User not found');
    }

    // Verificar si el producto ya está en el carrito
    const wishlistCheckSql = 'SELECT * FROM user_cart WHERE user_id = ? AND product_id = ?';
    const wishlistExists = await query(wishlistCheckSql, [user_id, product_id]);

    if (wishlistExists.length > 0) {
      throw new Error('Product already in cart');
    }

    // Obtener detalles del producto desde la wishlist
    const productDetailsSql = 'SELECT price, quantity FROM wish_list WHERE user_id = ? AND product_id = ?';
    const productDetails = await query(productDetailsSql, [user_id, product_id]);

    if (productDetails.length === 0) {
      throw new Error('Product not found in wishlist');
    }

    const { price, quantity } = productDetails[0];

    // Mover el producto de la wishlist al carrito
    const insertCartSql = 'INSERT INTO user_cart (user_id, product_id, price, quantity) VALUES (?, ?, ?, ?)';
    await query(insertCartSql, [user_id, product_id, price, quantity]);

    const deleteWishlistSql = 'DELETE FROM wish_list WHERE user_id = ? AND product_id = ?';
    await query(deleteWishlistSql, [user_id, product_id]);

    // Confirmar la transacción
    await query('COMMIT');

    // Cerrar la conexión
    connection.end();

    // Devolver una respuesta de éxito
    res.status(200).json({ message: 'Producto movido al carrito exitosamente' });
  } catch (error) {
    console.error('Error al mover el producto al carrito:', error);

    // Revertir la transacción en caso de error
    try {
      await query('ROLLBACK');
    } catch (rollbackError) {
      console.error('Error al revertir la transacción:', rollbackError);
    }

    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  addToWishlist,
  getWishlistProducts,
  updateWishlistProduct,
  removeFromWishlist,
  moveWishlistToCart
};
