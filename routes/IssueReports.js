const { Router } = require("express");
const { 
  createIssue
} = require('../controllers/issueReports');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const fs = require('fs');
const router = Router();
const server = http.createServer(router);
const io = socketIo(server);

router.post( "/create-issue-report", createIssue);

module.exports = router;