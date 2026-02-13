const express = require('express');
const { addRating, getProductRatings } = require('../controllers/ratings');
const router = express.Router();

router.post('/add-ratings', addRating); // Quité ':product_id' ya que el productId viene en el cuerpo
router.get('/get-ratings/:product_id', getProductRatings);

module.exports = router;