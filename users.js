const express = require('express');
const bodyParser = require('body-parser');
const router = express.Router();
const ds = require('./datastore');
const datastore = ds.datastore;

const USER = "USER";

router.use(bodyParser.json());


/* ------------- Begin Lodging Model Functions ------------- */
function post_user(req, firstName, lastName, token) {
    const key = datastore.key(USER);
    var projects = [];
    const new_user = {"firstName": firstName, "lastName": lastName, "projects": projects, "token": token.toString()};
    return datastore.save({ "key": key, "data": new_user }).then(() => {
        var self_url = req.protocol + "://" + req.get("host") + req.baseUrl + "/" + key.id;
        return {"id": key.id, "token": token, "firstName": firstName, "lastName": lastName, "projects": projects, "self": self_url}
    });
}

async function user_token_exists(req, token) {
    var q = datastore.createQuery(USER).filter('token', token.toString());
    return datastore.runQuery(q).then(entities => {
        if (entities[0][0] === undefined || entities[0][0] === null) {
            return false;
        }
        else {
            return true;
        }
    });
};

async function get_user_by_token(token) {
    var q = datastore.createQuery(USER).filter('token', token.toString());
    return datastore.runQuery(q).then(entities => {
        var entity = entities[0];
        if (entity[0] === undefined || entity[0] === null) {
            return entity;
        }
        else {
            return entity.map(ds.fromDatastore);
        }
    });
}

function get_user(req, id) {
    const key = datastore.key([USER, parseInt(id, 10)]);
    return datastore.get(key).then((entity) => {
        if (entity[0] === undefined || entity[0] === null) {
            return entity;
        } else {
            var self_url = req.protocol + "://" + req.get("host") + req.baseUrl + key.id
            entity[0].self = self_url;
            return entity.map(ds.fromDatastore);
        }
    });
}

function get_users(req){
    var q = datastore.createQuery(USER);
	return datastore.runQuery(q).then( (entities) => {
            results = entities[0].map(ds.fromDatastore);
            for (var i= 0; i<results.length;i++ ) {
                var self_url = req.protocol + "://" + req.get("host") + "/users/" + results[i].id
                results[i].self = self_url;
                for (var j = 0; j< results[i].projects.length; j++) {
                    var self_url_project = req.protocol + "://" + req.get("host") + "/projects/" + results[i].projects[j].id
                    results[i].projects[j].self = self_url_project;
                }
            }
			return {"users": results};
		});
}

/* ------------- End Model Functions ------------- */

/* ------------- Begin Controller Functions ------------- */

// GET All Users
router.get('/', function(req, res){
    if(req.get('Accept') !== 'application/json'){
        return res.status(406).json({'Error': 'Accepts type must be application/json'});
    }
    get_users(req).then((users) => {
        res.status(200).json(users);
    });
});

// POST User
router.post('/', async function(req, res){
    if (req.body.firstName === undefined || req.body.firstName === null ||
        req.body.lastName === undefined || req.body.lastName === null ||
        req.body.token === undefined || req.body.token === null)
    {
        res.status(400).json({'Error': 'The request object is missing at least one of the required attributes'});
    }
    else
    {
        if (await user_token_exists(req, req.body.token) === false) {
            post_user(req, req.body.firstName, req.body.lastName, req.body.token)
            .then(user => {
                res.status(201).json(user);
            });
        }
        else {
            await get_user_by_token(req.body.token).then(entity => {
                res.status(200).json(entity[0]);
            })
        }
    }
});

router.delete('/', function (req, res){
    res.set('Accept', 'GET, POST');
    res.status(405).end();
});

router.put('/', function (req, res){
    res.set('Accept', 'GET, POST');
    res.status(405).end();
});

router.patch('/', function (req, res){
    res.set('Accept', 'GET, POST');
    res.status(405).end();
});

router.delete('/:id', function (req, res){
    res.set('Accept', 'GET, POST');
    res.status(405).end();
});

router.put('/:id', function (req, res){
    res.set('Accept', 'GET, POST');
    res.status(405).end();
});

router.patch('/:id', function (req, res){
    res.set('Accept', 'GET, POST');
    res.status(405).end();
});

router.get('/:id', function (req, res){
    res.set('Accept', 'GET, POST');
    res.status(405).end();
});

/* ------------- End Controller Functions ------------- */

module.exports = router;