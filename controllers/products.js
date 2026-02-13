
// const mysql = require('mysql');
const util = require('util');
const { pool } = require("../database/config");
const cloudinary = require("../database/cloudinary");
const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require('uuid');

const v4options = {
  random: [
    0x10, 0x91, 0x56, 0xbe, 0xc4, 0xfb, 0xc1, 0xea, 0x71, 0xb4, 0xef, 0xe1, 0x67, 0x1c, 0x58, 0x36,
    0x30, 0x51
  ],
};

const createProduct = async (req, res) => {
  const {
    id = uuidv4(),
    name,
    price,
    previousPrice,
    category,
    quantity,
    description,
    img_url = [], // producción: [{ url, public_id }] | local: ["/uploads/x.jpg"]
  } = req.body;

  if (!Array.isArray(img_url)) {
    return res.status(400).json({ error: "img_url debe ser un array" });
  }

  const isProduction = process.env.NODE_ENV === "production";
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [exists] = await connection.execute(
      "SELECT COUNT(*) AS count FROM products WHERE name = ?",
      [name]
    );

    if (exists[0].count > 0) {
      await connection.rollback();
      return res.status(400).json({ error: "El producto ya está registrado" });
    }

    await connection.execute(
      `INSERT INTO products 
       (id, name, price, previousPrice, category, quantity, description)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, name, price, previousPrice, category, quantity, description]
    );

    /* ===============================
       🖼️ IMÁGENES
       =============================== */
    if (img_url.length > 0) {
      let images;

      if (isProduction) {
        // 🔵 PRODUCCIÓN (Cloudinary) → NO TOCAR
        images = img_url.map(img => [
          id,
          img.public_id,
          img.url,
        ]);
      } else {
        // 🟢 DESARROLLO (local)
        images = img_url.map(url => [
          id,
          url.public_id = url,
          url,
        ]);
      }

      await connection.query(
        "INSERT INTO products_img (product_id, file_id, img_url) VALUES ?",
        [images]
      );
    }

    await connection.commit();
    res.json({ ok: true, id });

  } catch (error) {
    await connection.rollback();
    console.error("CREATE PRODUCT ERROR:", error);
    res.status(500).json({ error: "Error al crear el producto" });
  } finally {
    connection.release();
  }
};


const getProducts = async () => {
  const [products] = await pool.execute("SELECT * FROM products");
  return products;
};


const getSoldProducts = async () => {
  const [products] = await pool.execute(`
    SELECT product_id, SUM(quantity) AS total_sales
    FROM sold_products
    GROUP BY product_id
  `);
  return products;
};

const getProductsByCategory = async (category) => {
  const connection = await pool.getConnection();

  try {
    const [products] = await connection.execute(
      "SELECT * FROM products WHERE category = ?",
      [category]
    );

    if (products.length === 0) return [];

    const ids = products.map(p => p.id);

    const [ratings] = await connection.query(
      `SELECT * FROM ratings WHERE product_id IN (${ids.map(() => "?").join(",")})`,
      ids
    );

    return products.map(product => ({
      ...product,
      ratings: ratings.filter(r => r.product_id === product.id),
    }));
  } finally {
    connection.release();
  }
};

const updateProduct = async (req, res) => {
  const { id } = req.params;
  const { name, price, previousPrice, category, quantity, description } = req.body;
  const images = req.files || [];

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    await connection.execute(
      `UPDATE products
       SET name=?, price=?, previousPrice=?, category=?, quantity=?, description=?
       WHERE id=?`,
      [name, price, previousPrice, category, quantity, description, id]
    );

    await connection.execute(
      "DELETE FROM products_img WHERE product_id = ?",
      [id]
    );

    if (images.length > 0) {
      const imageValues = images.map(img => [id, img.filename]);
      await connection.query(
        "INSERT INTO products_img (product_id, img_url) VALUES ?",
        [imageValues]
      );
    }

    await connection.commit();
    res.json({ message: "Producto actualizado correctamente" });
  } catch (error) {
    await connection.rollback();
    console.error(error);
    res.status(500).json({ error: "Error al actualizar producto" });
  } finally {
    connection.release();
  }
};


const deleteProduct = async (req, res) => {
  const { id } = req.params;
  const connection = await pool.getConnection();

  try {
    console.log("DELETE PRODUCT ID:", id);

    await connection.beginTransaction();

    // 🔍 Verificar que el producto existe
    const [product] = await connection.execute(
      "SELECT id FROM products WHERE id = ?",
      [id]
    );

    if (product.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: "Producto no existe" });
    }

    // 🖼️ Obtener imágenes
    const [images] = await connection.execute(
      "SELECT file_id FROM products_img WHERE product_id = ?",
      [id]
    );

    console.log("IMAGES FOUND:", images);

    // ☁️ Borrar Cloudinary si existen
    const publicIds = images.map(img => img.file_id).filter(Boolean);

    if (publicIds.length > 0) {
      const cloudRes = await cloudinary.api.delete_resources(publicIds);
      console.log("CLOUDINARY DELETE:", cloudRes);
    }

    // 🧹 Borrar relaciones primero
    await connection.execute(
      "DELETE FROM products_img WHERE product_id = ?",
      [id]
    );

    // ❌ Borrar producto
    const [result] = await connection.execute(
      "DELETE FROM products WHERE id = ?",
      [id]
    );

    console.log("PRODUCT DELETE RESULT:", result);

    await connection.commit();

    res.json({ ok: true, message: "Producto eliminado correctamente" });

  } catch (error) {
    await connection.rollback();
    console.error("DELETE PRODUCT ERROR:", error);
    res.status(500).json({ error: error.message });
  } finally {
    connection.release();
  }
};


// async function sellProduct(productId, quantity) {
//   const connection = await mysql.createConnection({host: 'localhost', user: 'root', database: 'shop'});
  
//   try {
//     await connection.beginTransaction();

//     const [updateResult] = await connection.execute(
//       `UPDATE products
//        SET stock = stock - ?
//        WHERE id = ?
//          AND stock >= ?`, [quantity, productId, quantity]
//     );

//     if (updateResult.affectedRows === 0) {
//       throw new Error('Stock insuficiente o producto no encontrado');
//     }

//     const [insertResult] = await connection.execute(
//       `INSERT INTO purchased_products (product_id, name, price, quantity)
//        SELECT id, name, price, ?
//        FROM products
//        WHERE id = ?`, [quantity, productId]
//     );

//     await connection.commit();

//     return insertResult.insertId;
//   } catch (err) {
//     await connection.rollback();
//     throw err;
//   } finally {
//     await connection.end();
//   }
// }

module.exports = {
  createProduct,
  getProductsByCategory,
  updateProduct,
  deleteProduct,
  getSoldProducts,
  getProducts
};