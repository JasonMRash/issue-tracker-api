const router = module.exports = require('express').Router();

router.use('/issues', require('./issues'));
router.use('/users', require('./users'));
router.use('/projects', require('./projects'));

const ds = require('./datastore');
const datastore = ds.datastore;

var crypto = require("crypto");
const express = require('express');
const { default: axios } = require('axios');
router.use(express.json());
const {OAuth2Client} = require('google-auth-library');

// CLIENT_ID, REDIRECT_URI, and CLIENT_SECRET have been removed
const CLIENT_ID = "";
const REDIRECT_URI = "";
const CLIENT_SECRET = "";
const client = new OAuth2Client(CLIENT_ID);
var token = '';
var lastName = '';
var firstName = '';

router.get('/', (req, res) => {
    res.render('index');
  });

router.post('/', async (req, res) => {
    var OAuthEndpoint = "https://accounts.google.com/o/oauth2/v2/auth"
    var response_type = "code";
    var scope = "profile";
    const URL = OAuthEndpoint + "?response_type=" + response_type + "&client_id=" + CLIENT_ID +"&redirect_uri=" + REDIRECT_URI + "&scope=" + scope;
    return res.redirect(URL);
});

router.get('/oauth', async (req, res) => {
    axios({
        method: 'POST',
        url: 'https://oauth2.googleapis.com/token',
        data: {
                    
            code: req.query.code,
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            redirect_uri: REDIRECT_URI,
            grant_type: 'authorization_code'
        }
    }).then (response => {
        token = response.data.access_token;
        return res.redirect('/info?jwt=' + response.data.id_token);
    });
})

router.get('/info', async (req, res) => {
    const auth = 'Bearer ' + token;
    var content;
    var jwt;
    await axios({
        method: 'GET',
        url: 'https://people.googleapis.com/v1/people/me?personFields=names',
        headers: {
            'Authorization': auth
        },
    }).then (response => {
        jwt = req.query.jwt;
        lastName = response.data.names[0].familyName;
        firstName = response.data.names[0].givenName;
        content = {
            firstName: firstName,
            lastName: lastName,
            jwt: jwt
        }
    });
    var id_token;
    try {
        const ticket = await client.verifyIdToken({ idToken: jwt, audience: CLIENT_ID});
        payload = ticket.getPayload();
        id_token = payload['sub'];
    } catch (error) {
        console.log("Couldn't verify token");
        return
    }
    await axios({
        method: 'POST',
        url: req.protocol + "://" + req.get("host") + '/users',
        data: {firstName: firstName, lastName: lastName, token: id_token}
    }).then(response => {
        content.userid = response.data.id;
    })
    return res.render('profile', content)
});