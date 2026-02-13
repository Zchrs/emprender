const express = require('express');
const router = express.Router();
const { generateInvitationCode, verifyInvitationCode } = require('../controllers/invitations');

router.post('/generate', generateInvitationCode);
router.get('/verify/:code', verifyInvitationCode);

module.exports = router;