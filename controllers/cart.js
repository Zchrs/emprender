const { pool } = require("../database/config");
const { getRandomRef } = require("../controllers/ref");
const util = require('util');

// Configuración de la conexión a la base de datos MySQL

// Función para agregar un producto al carrito
const addToCart = async (req, res) => {
  const { user_id, product_id, price, quantity } = req.body;
  const connection = await pool.getConnection();

  try {
    const qty = Number(quantity);
    const unitPrice = Number(price);

    if (!user_id || !product_id || !unitPrice || !qty || qty <= 0) {
      return res.status(400).json({ error: "Datos inválidos" });
    }

    await connection.beginTransaction();

    // 🔍 Usuario
    const [user] = await connection.execute(
      "SELECT id FROM users WHERE id = ?",
      [user_id]
    );
    if (!user.length) {
      await connection.rollback();
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    // 🔍 Producto + lock
    const [product] = await connection.execute(
      "SELECT id, quantity FROM products WHERE id = ? FOR UPDATE",
      [product_id]
    );
    if (!product.length) {
      await connection.rollback();
      return res.status(404).json({ error: "Producto no encontrado" });
    }

    if (product[0].quantity < qty) {
      await connection.rollback();
      return res.status(400).json({ error: "Stock insuficiente" });
    }

    // 🛒 Insertar o sumar cantidad
    await connection.execute(
      `INSERT INTO user_cart (user_id, product_id, price, quantity)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE quantity = quantity + VALUES(quantity)`,
      [user_id, product_id, unitPrice, qty]
    );

    // ➖ Descontar stock
    await connection.execute(
      "UPDATE products SET quantity = quantity - ? WHERE id = ?",
      [qty, product_id]
    );

    await connection.commit();
    res.status(201).json({ ok: true, message: "Producto agregado al carrito" });

  } catch (error) {
    await connection.rollback();
    console.error("ADD TO CART ERROR:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  } finally {
    connection.release();
  }
};

// Función para obtener todos los productos del carrito
const getCartProducts = async (req, res) => {
  const { user_id } = req.params;
  const connection = await pool.getConnection();

  try {
    if (!user_id) {
      return res.status(400).json({ error: "user_id requerido" });
    }

    // 🔍 Verificar usuario
    const [user] = await connection.execute(
      "SELECT id FROM users WHERE id = ?",
      [user_id]
    );

    if (user.length === 0) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    // 🛒 Obtener productos del carrito
    const [cartProductsRaw] = await connection.execute(`
      SELECT 
        uc.id,
        uc.user_id,
        uc.product_id,
        uc.price,
        uc.quantity,
        p.name,
        p.description,
        pi.img_url
      FROM user_cart uc
      JOIN products p ON uc.product_id = p.id
      LEFT JOIN products_img pi ON uc.product_id = pi.product_id
      WHERE uc.user_id = ?
    `, [user_id]);

    // 📦 Consolidar imágenes por producto
    const cartProducts = cartProductsRaw.reduce((acc, item) => {
      const product = acc.find(p => p.id === item.id);

      if (product) {
        if (item.img_url && !product.img_urls.includes(item.img_url)) {
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

    res.status(200).json(cartProducts);

  } catch (error) {
    console.error("GET CART PRODUCTS ERROR:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  } finally {
    connection.release();
  }
};
// Función para actualizar un producto del carrito
  const updateCartProduct = async (req, res) => {
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

// Función para quitar un producto del carrito
const removeFromCart = async (req, res) => {
  const { user_id, product_id } = req.body;
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    if (!user_id || !product_id) {
      await connection.rollback();
      return res.status(400).json({ error: "user_id y product_id son requeridos" });
    }

    // 🔍 Verificar usuario
    const [user] = await connection.execute(
      "SELECT id FROM users WHERE id = ?",
      [user_id]
    );
    if (user.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    // 🔍 Obtener producto del carrito
    const [cartItem] = await connection.execute(
      "SELECT quantity FROM user_cart WHERE user_id = ? AND product_id = ? FOR UPDATE",
      [user_id, product_id]
    );

    if (cartItem.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: "Producto no está en el carrito" });
    }

    const cartQty = cartItem[0].quantity;

    // ❌ Eliminar del carrito
    await connection.execute(
      "DELETE FROM user_cart WHERE user_id = ? AND product_id = ?",
      [user_id, product_id]
    );

    // ➕ Devolver stock al producto
    await connection.execute(
      "UPDATE products SET quantity = quantity + ? WHERE id = ?",
      [cartQty, product_id]
    );

    await connection.commit();
    res.json({ ok: true, message: "Producto eliminado y stock restaurado" });

  } catch (error) {
    await connection.rollback();
    console.error("REMOVE FROM CART ERROR:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  } finally {
    connection.release();
  }
};

const payCart = async (req, res) => {
  const { user_id, product_ids } = req.body;
  const connection = await pool.getConnection();

  try {
    if (!user_id || !Array.isArray(product_ids) || !product_ids.length) {
      return res.status(400).json({ error: "Datos inválidos" });
    }

    await connection.beginTransaction();

    const [cartItems] = await connection.execute(
      `SELECT c.product_id, c.quantity, c.price, p.quantity AS stock
       FROM user_cart c
       JOIN products p ON p.id = c.product_id
       WHERE c.user_id = ? AND c.product_id IN (${product_ids.map(() => "?").join(",")})
       FOR UPDATE`,
      [user_id, ...product_ids]
    );

    if (!cartItems.length) {
      await connection.rollback();
      return res.status(404).json({ error: "No hay productos válidos para pagar" });
    }

    for (const item of cartItems) {
      if (item.stock < item.quantity) {
        await connection.rollback();
        return res.status(400).json({
          error: `Stock insuficiente para producto ${item.product_id}`,
        });
      }
    }

    const total = cartItems.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );

    // 🟡 Crear orden pendiente
    let orderId = getRandomRef();

    const [orderResult] = await connection.execute(
      "INSERT INTO orders (order_id, user_id, total, status) VALUES (?, ?, ?, 'pending')",
      [orderId, user_id, total]
    );

     orderId = orderResult.insertId;

    // 📦 Crear items
    for (const item of cartItems) {
      await connection.execute(
        "INSERT INTO order_items (order_id, product_id, price, quantity) VALUES (?, ?, ?, ?)",
        [orderId, item.product_id, item.price, item.quantity]
      );
    }

    // 🧹 Limpiar carrito
    await connection.execute(
      `DELETE FROM user_cart
       WHERE user_id = ? AND product_id IN (${product_ids.map(() => "?").join(",")})`,
      [user_id, ...product_ids]
    );

    await connection.commit();
    res.status(201).json({
      ok: true,
      message: "Pedido creado y pendiente de aprobación",
      orderId,
    });

  } catch (error) {
    await connection.rollback();
    console.error("PAY CART ERROR:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  } finally {
    connection.release();
  }
};

const approveOrder = async (req, res) => {
  const { orderId } = req.params;
  const connection = await pool.getConnection();

  try {
    if (!orderId) return res.status(400).json({ error: "orderId requerido" });

    await connection.beginTransaction();

    // 🔒 Bloquear orden
    const [[order]] = await connection.execute(
      "SELECT id, status FROM orders WHERE id = ? FOR UPDATE",
      [orderId]
    );

    if (!order) {
      await connection.rollback();
      return res.status(404).json({ error: "Orden no encontrada" });
    }

    if (order.status !== "pending") {
      await connection.rollback();
      return res.status(400).json({ error: "Esta orden ya fue procesada" });
    }

    // 🔒 Obtener items reales
    const [items] = await connection.execute(
      "SELECT product_id, quantity FROM order_items WHERE order_id = ?",
      [orderId]
    );

    for (const item of items) {
      const [[product]] = await connection.execute(
        "SELECT quantity FROM products WHERE id = ? FOR UPDATE",
        [item.product_id]
      );

      if (product.quantity < item.quantity) {
        await connection.rollback();
        return res.status(400).json({
          error: `Stock insuficiente para producto ${item.product_id}`,
        });
      }

      await connection.execute(
        "UPDATE products SET quantity = quantity - ? WHERE id = ?",
        [item.quantity, item.product_id]
      );
    }

    // ✅ Marcar orden como aprobada
    await connection.execute(
      "UPDATE orders SET status = 'approved' WHERE id = ?",
      [orderId]
    );

    await connection.commit();
    res.json({ ok: true, message: "Orden aprobada correctamente" });

  } catch (error) {
    await connection.rollback();
    console.error("APPROVE ORDER ERROR:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  } finally {
    connection.release();
  }
};

const cancelOrder = async (req, res) => {
  const { orderId } = req.params;
  const connection = await pool.getConnection();

  try {
    if (!orderId) return res.status(400).json({ error: "orderId requerido" });

    await connection.beginTransaction();

    // 🔒 Bloquear orden
    const [[order]] = await connection.execute(
      "SELECT id, status FROM orders WHERE id = ? FOR UPDATE",
      [orderId]
    );

    if (!order) {
      await connection.rollback();
      return res.status(404).json({ error: "Orden no encontrada" });
    }

    if (order.status !== "pending") {
      await connection.rollback();
      return res.status(400).json({
        error: "Solo se pueden cancelar órdenes pendientes",
      });
    }

    // ❌ Cancelar orden
    await connection.execute(
      "UPDATE orders SET status = 'cancelled' WHERE id = ?",
      [orderId]
    );

    await connection.commit();
    res.json({ ok: true, message: "Orden cancelada correctamente" });

  } catch (error) {
    await connection.rollback();
    console.error("CANCEL ORDER ERROR:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  } finally {
    connection.release();
  }
};

const getOrders = async (req, res) => {
  try {
    const [orders] = await pool.execute(
      `SELECT 
        o.id,
        o.total,
        o.status,
        o.created_at,
        u.id AS user_id,
        u.name,
        u.lastname,
        u.email
       FROM orders o
       LEFT JOIN users u ON u.id = o.user_id
       ORDER BY o.created_at DESC`
    );

    res.json({ ok: true, orders });
  } catch (error) {
    console.error("GET ORDERS ERROR:", error);
    res.status(500).json({ error: "Error interno" });
  }
};

const getUserOrders = async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `
      SELECT 
        o.id AS order_id,
        o.total,
        o.status,
        o.created_at,

        u.id AS user_id,
        u.name,
        u.lastname,
        u.email,

        oi.product_id,
        oi.price,
        oi.quantity,

        p.name AS product_name,
        pi.img_url AS image_url

      FROM orders o
      LEFT JOIN users u ON u.id = o.user_id
      LEFT JOIN order_items oi ON oi.order_id = o.id
      LEFT JOIN products p ON p.id = oi.product_id
      LEFT JOIN products_img pi ON pi.product_id = p.id
      ORDER BY o.created_at DESC
      `
    );

    // 🧠 Agrupar estructura
    const ordersMap = {};

    for (const row of rows) {
      if (!ordersMap[row.order_id]) {
        ordersMap[row.order_id] = {
          id: row.order_id,
          total: row.total,
          status: row.status,
          created_at: row.created_at,
          user: {
            id: row.user_id,
            name: row.name,
            lastname: row.lastname,
            email: row.email,
          },
          items: [],
        };
      }

      if (row.product_id) {
        let product = ordersMap[row.order_id].items.find(
          (p) => p.product_id === row.product_id
        );

        if (!product) {
          product = {
            product_id: row.product_id,
            name: row.product_name,
            price: row.price,
            quantity: row.quantity,
            images: [],
          };
          ordersMap[row.order_id].items.push(product);
        }

        if (row.image_url) {
          product.images.push(row.image_url);
        }
      }
    }

    res.json({ ok: true, orders: Object.values(ordersMap) });
  } catch (error) {
    console.error("GET ORDERS ERROR:", error);
    res.status(500).json({ error: "Error interno" });
  }
};



// Función para quitar un producto del carrito y agregarki a lista de deseos
const moveToWishlist = async (req, res) => {
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
    const connection = await pool.getConnection();

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

    // Verificar si el producto ya está en la lista de deseos
    const wishlistCheckSql = 'SELECT * FROM wish_list WHERE user_id = ? AND product_id = ?';
    const wishlistExists = await query(wishlistCheckSql, [user_id, product_id]);

    if (wishlistExists.length > 0) {
      throw new Error('Product already in wishlist');
    }

    // Obtener detalles del producto desde el carrito
    const productDetailsSql = 'SELECT price, quantity FROM user_cart WHERE user_id = ? AND product_id = ?';
    const productDetails = await query(productDetailsSql, [user_id, product_id]);

    if (productDetails.length === 0) {
      throw new Error('Product not found in cart');
    }

    const { price, quantity } = productDetails[0];

    // Mover el producto del carrito a la lista de deseos
    const insertWishlistSql = 'INSERT INTO wish_list (user_id, product_id, price, quantity) VALUES (?, ?, ?, ?)';
    await query(insertWishlistSql, [user_id, product_id, price, quantity]);

    const deleteCartSql = 'DELETE FROM user_cart WHERE user_id = ? AND product_id = ?';
    await query(deleteCartSql, [user_id, product_id]);

    // Confirmar la transacción
    await query('COMMIT');

    // Cerrar la conexión
    connection.end();

    // Devolver una respuesta de éxito
    res.status(200).json({ message: 'Producto movido a la lista de deseos exitosamente' });
  } catch (error) {
    console.error('Error al mover el producto a la lista de deseos:', error);

    // Revertir la transacción en caso de error
    try {
      const connection = mysqls.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USERNAME,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
      });
      connection.connect();
      const query = util.promisify(connection.query).bind(connection);
      await query('ROLLBACK');
      connection.end();
    } catch (rollbackError) {
      console.error('Error al revertir la transacción:', rollbackError);
    }

    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  addToCart,
  getCartProducts,
  updateCartProduct,
  removeFromCart,
  moveToWishlist,
  approveOrder,
  getOrders,
  getUserOrders,
  cancelOrder,
  payCart
};
