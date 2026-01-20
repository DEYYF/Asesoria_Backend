
const express = require('express');
const router = express.Router();
const { register, login, clientLogin, checkClientStatus } = require('../controllers/authController');

router.post('/register', register);
router.post('/login', login);
router.post('/client-login', clientLogin);
router.post('/check-client-status', checkClientStatus);

module.exports = router;
