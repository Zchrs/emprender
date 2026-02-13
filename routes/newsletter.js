/* 
    ruta de usuarios / newsletter
    host + /api/newsletter/subscribe
*/

const { Router } = require("express");
const { subscribeNewsletter } = require("../controllers/newsletter");
const { check } = require("express-validator");
const { validateFields } = require("../middlewares/validate-form-data");


const router = Router();

router.post(
    "/subscribe", 
    [
      check("email", "Email is required").isEmail(),
      validateFields,
    ],
    subscribeNewsletter
  );

  module.exports = router;