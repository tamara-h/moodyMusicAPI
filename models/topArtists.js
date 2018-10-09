/**
 * Models topArtists
 */

const logger = require('../utils/logHelper').getLogger;
const SpotifyWebApi = require('spotify-web-api-node');
const secrets = require('../secrets');

const clientId = secrets.spotifyCreds.clientId;
const clientSecret = secrets.spotifyCreds.clientSecret;

// The time at which the spotify bearer token will expire
let spotifyAPITokenExpieryTime = 0;

// Create the api object with the credentials
const spotifyApi = new SpotifyWebApi({
    clientId: clientId,
    clientSecret: clientSecret
});

// Get a token as part of app start
refreshSpotifyAccessToken();


function refreshSpotifyAccessToken() {
    return new Promise((resolve, reject) => {

        spotifyApi.clientCredentialsGrant().then(
            function (data) {

                // Update token expiry time
                let tokenLifeSeconds = data.body['expires_in'];

                // For a bit of reliability the token will be said to have expired 30 seconds early
                tokenLifeSeconds = tokenLifeSeconds - (30 * 1000);

                // Unix time is in milliseconds so the seconds are multiplied by 1000
                spotifyAPITokenExpieryTime = Date.now() + (tokenLifeSeconds * 1000);

                logger.info('The access token expires in ' + data.body['expires_in']);
                logger.info('The access token is ' + data.body['access_token']);

                // Save the access token so that it's used in future calls
                spotifyApi.setAccessToken(data.body['access_token']);

                // Tasks complete, authentication set up, API requests can now be made
                resolve();
            },
            function (err) {
                logger.error('Something went wrong when retrieving an access token', err);
                reject(err)

            }
        );
    });
}



/**
 * Gets the bands that owner of the spotify account wants to see
 * Gets the playlist with the bands to see
 * Then gets the artist data for each of the tracks on that playlist
 * Then wraps it all up and resolves it
 *
 * @returns {Promise<any>}
 */
exports.getBandsToSee = () => {
    return new Promise((resolve, reject) => {

        handleCredentials()
            .then(() => {

                spotifyApi.getPlaylist(secrets.spotifySourcePlaylist.userId, secrets.spotifySourcePlaylist.playlistId)
                    .then(
                        function (data) {

                            const playlistTracks = data.body.tracks.items;
                            let bandsToSee = [];

                            let artistIDToBandToSeeIndex = {};

                            for (let trackNumber in playlistTracks) {
                                const track = playlistTracks[trackNumber].track;

                                bandsToSee.push({
                                    'trackTitle': track.name,
                                    'sourceTrackID': track.id,
                                    external_urls: track.external_urls
                                });

                                // Populate the look up for linking the artist lookup response back to the band
                                if (artistIDToBandToSeeIndex[track.artists[0].id] === undefined) {
                                    artistIDToBandToSeeIndex[track.artists[0].id] = [{bandIndex: trackNumber}];
                                } else {
                                    artistIDToBandToSeeIndex[track.artists[0].id].push({bandIndex: trackNumber});

                                }
                            }

                            // Get the artist Spotify data
                            const artistIds = Object.keys(artistIDToBandToSeeIndex);

                            getArtists(artistIds)
                                .then(artists => {

                                    // Extract artist data into bandsToSee object
                                    for (artistToSeeID in artistIDToBandToSeeIndex) {
                                        for (bandIndex in artistIDToBandToSeeIndex[artistToSeeID]) {
                                            const bandToSeeIndex = artistIDToBandToSeeIndex[artistToSeeID][bandIndex].bandIndex;

                                            bandsToSee[bandToSeeIndex].artist = artists[artistToSeeID];



                                        }
                                    }

                                    // Return the bands to see to the caller
                                    resolve(bandsToSee);


                                })
                                .catch(err => {
                                    logger.error('Unable to get artist data for tracks');
                                    logger.error(err);

                                    // Reject back to caller with the error
                                    reject(err);
                                });

                        },
                        function (err) {
                            logger.error('Something went wrong!', err);

                            // Reject back to caller with the error
                            reject(err);
                        }
                    );

            })
            .catch(err => {
                logger.error('Unable to get bands to see as failed to authenticate with Spotify');
                reject(err);

            });
    });

};

/**
 * Gets the passed Artist Spotify Object
 *
 * @param artists Array of Spotify Artist IDs
 * @returns {Promise<any>}
 */
function getArtists(artists) {
    return new Promise((resolve, reject) => {

        /***
         * Make a request for artists data from the spotify API
         * using the node spotify lib
         *
         * @param artists  Array of Spotify ArtistIDs
         * @returns {Promise<any>}
         */
        const getArtistsFromSpotifyAPI = (artists) => {
            return new Promise((resolve, reject) => {

                spotifyApi.getArtists(artists)
                    .then(function (data) {

                        const responseArtists = data.body.artists;
                        let artistJSONMap = {};

                        // Build the map of artistID to artist object
                        for (index in responseArtists) {
                            const currentArtist = responseArtists[index];

                            artistJSONMap[currentArtist.id] = currentArtist;

                        }

                        // Resolve the artists
                        resolve(artistJSONMap);

                    }, function (err) {
                        logger.error('Request for artist data failed');
                        logger.error(err);
                        reject(err);

                    });
            });

        };


        const artistsPerRequest = 2;
        let artistRequestPromises = [];

        let startIndex = 0;
        while (startIndex < artists.length) {
            const endIndex = startIndex + artistsPerRequest;
            artistRequestPromises.push(getArtistsFromSpotifyAPI(artists.slice(startIndex, endIndex)));

            startIndex = endIndex;

        }

        Promise.all(artistRequestPromises)
            .then(responseArr => {

                let spotifyArtists = {};

                for (let index in responseArr) {
                    spotifyArtists = {...responseArr[index], ...spotifyArtists};

                }

                logger.info('All Artist Data received successfully');
                resolve(spotifyArtists);

            })
            .catch(err => {
                logger.error('One or more of the artist requests failed');
                logger.error(err);

            });


    });
}


/**
 * Ensures that the node spotify lib has been authenticated to the
 * spotify API and the token is valid
 *
 * @returns {Promise<any>}
 */
function handleCredentials() {
    return new Promise((resolve, reject) => {

        // Check to see if the current token is valid
        if (spotifyAPITokenExpieryTime < Date.now()) {
            // The token is no longer valid
            // Get a new token
            refreshSpotifyAccessToken()
                .then(() => {
                    // Token refreshed, API requests can now proceed
                    resolve();

                }).catch(err => {
                logger.error('Failed to get new Spotify token');
                reject(err);

            })


        } else {
            // The token is valid, no action needed
            resolve();

        }
    })
}


module.exports = exports;