const { Router } = require("express");
const { 
  addToWishlist,
  getWishlistProducts,
  updateWishlistProduct,
  removeFromWishlist,
  moveWishlistToCart
} = require("../controllers/wishlist");



const router = Router();

router.get('/get-user-whishlist/:user_id', getWishlistProducts);

router.post('/add/:product_id', addToWishlist);

// mover del carrito a lista de deseos
router.post('/move-to-cart/:user_id', moveWishlistToCart);

// eliminar un producto del carrito
router.delete('/delete-product-whishlist/:product_id', removeFromWishlist,);

// actualizar la cantidad de un producto en el carrito
router.put('/update/:productId', updateWishlistProduct);

module.exports = router;