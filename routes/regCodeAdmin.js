const { Router } = require("express");
const { getCodeRegAdmin, updateRegistrationCode } = require("../controllers/regCodeAdmin");

const router = Router();

router.get( "/get-code-admin", getCodeRegAdmin);
router.post("/update-code-admin", updateRegistrationCode);

module.exports = router;