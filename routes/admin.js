const { Router } = require("express");
const cors = require('cors');
const { check } = require("express-validator");
const { validateFields } = require("../middlewares/validate-form-data");
const { renewTokenAdmin, loginUserAdmin, createAdmin } = require("../controllers/admin");
const { validateJwtAdmin } = require("../middlewares/validate-jwt");

//hola

const router = Router();

router.post(
  "/register",
  [
    check("fullname", "Name is required").not().isEmpty(),
    check("email", "Email is required").isEmail(),
    check("pass", "Password is required").isLength({ min: 7 }),
    check("access_code", "access code is required").not().isEmpty(),
    
    validateFields,
  ],
  createAdmin
);

router.post(
  "/login",
  [
    check("email", "Email is required").isEmail(),
    check("pass", "Password is required").not().isEmpty(),

    validateFields,
  ],
  loginUserAdmin
);

router.get("/renew", validateJwtAdmin, renewTokenAdmin);

module.exports = router;