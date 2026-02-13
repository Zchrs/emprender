const { Router } = require("express");
const { addToCart, 
  removeFromCart, 
  updateCartProduct, 
  getCartProducts, 
  moveToWishlist,
  payCart,
  getOrders,
  approveOrder,
  cancelOrder,
  getUserOrders,
} = require("../controllers/cart");



const router = Router();

router.get('/get-User-cart/:user_id', getCartProducts);

router.post('/add/:product_id', addToCart);

// mover del carrito a lista de deseos
router.post('/move-to-wishlist/:product_id', moveToWishlist);

// eliminar un producto del carrito
router.delete('/delete-product-cart/:product_id', removeFromCart);

// actualizar la cantidad de un producto en el carrito
router.put('/update/:productId', updateCartProduct);

router.post("/pay-order", payCart);

router.get("/get-orders", getOrders);

router.get("/get-user-orders", getUserOrders);

router.put("/approve-order/:orderId", approveOrder);

router.put("/cancel-order/:orderId", cancelOrder);

module.exports = router;