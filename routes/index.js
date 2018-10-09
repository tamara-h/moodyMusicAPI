const express = require('express');
const router = express.Router();

/**
 * Get  /
 *
 */
router.get('/', function(req, res, next) {
  res.send({bandsIWantToSeeAPI: {version: 0.01, dateMade: '04-05-1018'}});
});

module.exports = router;