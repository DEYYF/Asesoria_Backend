
const express = require('express');
const router = express.Router();
const { register, login, clientLogin } = require('../controllers/authController');

router.post('/register', register);
router.post('/login', login);
router.post('/client-login', clientLogin);

module.exports = router;
