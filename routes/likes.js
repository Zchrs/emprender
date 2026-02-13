const { Router } = require("express");
const { 
  addLike,
  getLikeProperties,
  removeLike
} = require("../controllers/likes");



const router = Router();

// agregar like
router.post('/add-like/:product_id', addLike);

// obtener likes
router.get('/get-likes/:user_id', getLikeProperties);

// eliminar like
router.delete('/delete-like/:property_id', removeLike,);

module.exports = router;