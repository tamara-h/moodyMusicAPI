const express = require('express');
const router = express.Router();
const logger = require('../utils/logHelper').getLogger;

const topArtists = require('../models/topArtists');


/**
 * GET /concerts
 */
router.get('/', function (req, res, next) {

    // Get the Spofity API
    logger.info('GET Request Received at /userdata');

    topArtists.getArtists()
        .then( bands => {
            logger.info('Retrieved artists successfully');

            res.send(bands);

        })
        .catch( err => {
            logger.error('Failed to get the artists');
            logger.error(err);

            // Send on error to user
            res.status(500);
            res.send({Err: 'It would appear that this failed.'});
        });

});



module.exports = router;
