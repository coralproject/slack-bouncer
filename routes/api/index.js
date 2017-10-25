const express = require('express');
const router = express.Router();

router.use('/installations', require('./installations'));
router.use('/configuration', require('./configuration'));
router.use('/installation', require('./installation'));
router.use('/slack', require('./slack'));

module.exports = router;
