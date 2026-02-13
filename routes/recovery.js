const express = require("express")
const router = express.Router()
const { sendCode, verifyCode, resetPassword } = require("../controllers/recovery");


router.post('/send-recovery-code', sendCode);
router.post('/verify-recovery-code', verifyCode);
router.post('/reset-password', resetPassword);

module.exports = router;