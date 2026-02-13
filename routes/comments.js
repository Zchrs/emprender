const express = require("express");
const router = express.Router();
const { createComment, getComents } = require("../controllers/comments");

router.post("/post", createComment);
router.get("/get", getComents);

module.exports = router;