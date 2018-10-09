/**
 * Log Helper
 *
 * Uses Bunyan npm module
 *
 */

const Logger = require('bunyan');

exports.getLogger = new Logger({
    name: 'bandsIwantToSeeAPI',
    streams: [
        {
            stream: process.stdout,
            level: 'debug'
        }
        // {
        //     path: 'tmp.log', // Need to come back and sort this properly
        //     level: 'trace'
        // }
    ],
    serializers: {
        req: Logger.stdSerializers.req,
    },
});

