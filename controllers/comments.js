const { pool } = require("../database/config");

const createComment = async (req, res) => {
  const { user_id, product_id, comment } = req.body;

  if (!user_id || !product_id || !comment) {
    return res.status(400).json({
      message: "Todos los campos son obligatorios",
    });
  }

  try {
    const [result] = await pool.execute(
      `INSERT INTO comments (user_id, product_id, comment)
       VALUES (?, ?, ?)`,
      [user_id, product_id, comment]
    );

    res.status(201).json({
      id: result.insertId,
      user_id,
      product_id,
      comment,
    });
  } catch (error) {
    console.error("Error creando comentario:", error);
    res.status(500).json({
      message: "Error al publicar el comentario",
    });
  }
};

const getComents = async (req, res) => {
  const [comments] = await pool.execute("SELECT * FROM comments");
  res.json(comments);
};

module.exports = { createComment, getComents };