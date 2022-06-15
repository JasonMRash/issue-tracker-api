const express = require('express');
const bodyParser = require('body-parser');
const router = express.Router();
const ds = require('./datastore');
const { DatastoreRequest } = require('@google-cloud/datastore');
const datastore = ds.datastore;
const {OAuth2Client} = require('google-auth-library');
// CLIENT_ID REMOVED
const CLIENT_ID = "";
const client = new OAuth2Client(CLIENT_ID);
const PROJECT = "PROJECT";
const ISSUE = "ISSUE";
const USER = "USER";

router.use(bodyParser.json());



/* ------------- Begin PROJECT Model Functions ------------- */
function post_project(req, name, description, date, user_id) {
    var key = datastore.key(PROJECT);
    var issues = []
    const new_project = { "name": name, "description": description, "date": date, "user_id": user_id, "issues": issues};
    return datastore.save({ "key": key, "data": new_project }).then(() => {
        return get_project(req, key.id);
    });
}

async function put_project(req, project_id, name, description, date) {
    var key = datastore.key([PROJECT, parseInt(project_id, 10)]);
    await get_project(req, project_id).then(async project => {
        var issues = []
        for (var i= 0; i < project[0].issues.length; i++) {
            issues.push({id: project[0].issues[i].id});
        }
        const update_project = { "name": name, "description": description, "date": date, "user_id": project[0].user_id, "issues": issues};
        return await datastore.save({ "key": key, "data": update_project });
    });
}

function patch_project(req, project_id, name, description, date) {
    var key = datastore.key([PROJECT, parseInt(project_id, 10)]);
    return datastore.get(key).then((entity) => {
        if (entity[0] === undefined || entity[0] === null) {
            return entity;
        } else {
            if (name === undefined || name === null) {
                name = entity[0].name;
            }
            if (description === undefined || description === null) {
                description = entity[0].description;
            }
            if (date === undefined || date === null) {
                date = entity[0].date;
            }
            var issues = [];
            for (var i= 0; i < entity[0].issues.length; i++) {
                issues.push({id: entity[0].issues[i].id});
            }
            const update_project = { "name": name, "description": description, "date": date, "user_id": entity[0].user_id, "issues": issues};
            return datastore.save({ "key": key, "data": update_project });
        }
    });
}

function get_project(req, id) {
    const key = datastore.key([PROJECT, parseInt(id, 10)]);
    return datastore.get(key).then((entity) => {
        if (entity[0] === undefined || entity[0] === null) {
            return entity;
        } else {
            var self_url = req.protocol + "://" + req.get("host") + "/projects/" + key.id
            entity[0].self = self_url;
            for (var i = 0; i < entity[0].issues.length; i++) {
                issue_self_url = req.protocol + "://" + req.get("host") + "/issues/" + entity[0].issues[i].id;
                entity[0].issues[i].self = issue_self_url;
            }
            return entity.map(ds.fromDatastore);
        }
    });
}

function get_projects(req, user_id){
    var q = datastore.createQuery(PROJECT).filter('user_id', user_id).limit(5);
    var results = {};
    if(Object.keys(req.query).includes("cursor")){
        q = q.start(req.query.cursor);
    }
	return datastore.runQuery(q).then( (entities) => {
        results = entities[0].map(ds.fromDatastore);
        for (var i= 0; i<results.length;i++ )
        {
            var self_url = req.protocol + "://" + req.get("host") + "/projects/" + results[i].id
            results[i].self = self_url;
            for (var j = 0; j < results[i].issues.length; j++) {
                issue_self_url = req.protocol + "://" + req.get("host") + "/issues/" + results[i].issues[j].id;
                results[i].issues[j].self = issue_self_url;
            }
        }
        if(entities[1].moreResults !== ds.Datastore.NO_MORE_RESULTS ){
            results[i-1].next = req.protocol + "://" + req.get("host") + "/projects/" + "?cursor=" + entities[1].endCursor;
        }
		return {"projects": results};
	});
}

function delete_project(id){
    const key = datastore.key([PROJECT, parseInt(id,10)]);
    return datastore.delete(key);
}

async function delete_issues_for_project(project_id){
    var q = datastore.createQuery(ISSUE).filter('project_id', project_id);
    const issues = await datastore.runQuery(q);
    var results = issues[0].map(ds.fromDatastore);
    for (var i = 0; i < results.length; i++) {
        if (results[i].project_id == project_id) {
            var id = results[i].id
            const key = datastore.key([ISSUE, parseInt(id, 10)]);
            datastore.delete(key);
        }
    }
}

async function get_token(id) {
    const key = datastore.key([USER, parseInt(id, 10)]);
    return datastore.get(key).then((entity) => {
        if (entity[0] === undefined || entity[0] === null) {
            return null;
        } else {
            var user = entity.map(ds.fromDatastore);
            var token = user[0].token;
            return token;
        }
    });
}

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

function add_project_to_user(user_id, project_id) {
    const key = datastore.key([USER, parseInt(user_id, 10)]);
    return datastore.get(key).then((user) => {
        if (user[0] === undefined || user[0] === null) {
            return null;
        } else {
            user[0].projects.push({"id": project_id})
            return datastore.save({ "key": key, "data": user[0] })
        }
    });
}

function delete_project_from_user(user_id, project_id) {
    const key = datastore.key([USER, parseInt(user_id, 10)]);
    return datastore.get(key).then((user) => {
        if (user[0] === undefined || user[0] === null) {
            return null;
        } else {
            for (var i=0; i < user[0].projects.length; i++) {
                user[0].projects.splice(i, 1);
            }
            return datastore.save({ "key": key, "data": user[0] })
        }
    });
}

function project_name_unique(name){
    var q = datastore.createQuery(PROJECT).filter('name', name);
    return datastore.runQuery(q).then( (project) => {
        if (project[0][0] === undefined || project[0][0] === null) {
            return true;
        } else {
            return false;
        }
    });
}

/*------------ End Model Functions ------------- */

/* ------------- Begin Controller Functions ------------- */

// View All Projects For User
router.get('/', async function(req, res){
    var jwt = req.headers.authorization;
    if(req.get('Accept') !== 'application/json'){
        return res.status(406).json({'Error': 'Accepts type is Not Acceptable. Must be application/json.'});
    }
    if (jwt === undefined || jwt === null){
        return res.status(401).json({'Error': 'Access Denied. JWT sub does not match user token for project.'});
    }
    if (jwt.startsWith("Bearer ")){
        jwt = jwt.substring(7, jwt.length);
    }
    var sub;
    try {
        const ticket = await client.verifyIdToken({ idToken: jwt, audience: CLIENT_ID});
        payload = ticket.getPayload();
        sub = payload['sub'];
    } catch (error) {
        sub = null;
        return res.status(401).json({'Error': 'Access Denied. JWT sub does not match user token for project.'});
    }
    get_user_by_token(sub).then(async user => {
        var token = await get_token(user[0].id);
        if (sub == token) {
            const projects = get_projects(req, user[0].id)
	        .then( (projects) => {
                res.status(200).json(projects);
            });
        }
        else {
            return res.status(401).json({'Error': 'Access Denied. JWT sub does not match project user_id'});
        }
    });         
    
});

// GET a Project
router.get('/:id', async function (req, res) {
    var jwt = req.headers.authorization;
    if(req.get('Accept') !== 'application/json'){
        return res.status(406).json({'Error': 'Accepts type is Not Acceptable. Must be application/json.'});
    }
    if (jwt === undefined || jwt === null){
        return res.status(401).json({'Error': 'Access Denied. JWT sub does not match user token for project.'});
    }
    else if (jwt.startsWith("Bearer ")){
        jwt = jwt.substring(7, jwt.length);
    }
    var sub;
    try {
        const ticket = await client.verifyIdToken({ idToken: jwt, audience: CLIENT_ID});
        payload = ticket.getPayload();
        sub = payload['sub'];
    } catch (error) {
        sub = null;
        return res.status(401).json({'Error': 'Access Denied. JWT sub does not match user token for project.'});
    }
    if (req.params.id === undefined || req.params.id === null)
    {
        return res.status(404).json({ 'Error': 'No project with this project_id exists' });
    }  
    get_project(req, req.params.id)
    .then(async project => {
        if (project[0] === undefined || project[0] === null) {
            return res.status(404).json({ 'Error': 'No project with this project_id exists' });
        } else {
            var token = await get_token(project[0].user_id);
            if(sub == token){
                if (project[0] === undefined || project[0] === null) {
                    return res.status(404).json({ 'Error': 'No project with this project_id exists' });
                } else {
                    return res.status(200).json(project[0]);
                }
            }
            else {
                return res.status(401).json({'Error': 'Access Denied. JWT sub does not match user token for project.'});
            }            
        }
    });
});

// Create a Project
router.post('/', async function(req, res){
    var jwt = req.headers.authorization;
    if(req.get('Accept') !== 'application/json'){
        return res.status(406).json({'Error': 'Accepts type is Not Acceptable. Must be application/json.'});
    }
    if (jwt === undefined || jwt === null){
        return res.status(401).json({'Error': 'Access Denied. JWT sub does not match user token for project.'});
    }
    if (jwt.startsWith("Bearer ")){
        jwt = jwt.substring(7, jwt.length);
    }
    var sub;
    try {
        const ticket = await client.verifyIdToken({ idToken: jwt, audience: CLIENT_ID});
        payload = ticket.getPayload();
        sub = payload['sub'];
    } catch (error) {
        sub = null;
        return res.status(401).json({'Error': 'Access Denied. JWT sub does not match user token for project.'});
    }
    if (req.body.name === undefined || req.body.name === null ||
        req.body.description === undefined || req.body.description === null ||
        req.body.date === undefined || req.body.date === null)
    {
        res.status(400).json({'Error': 'The request object is missing at least one of the required attributes'});
    }
    else
    {    
        get_user_by_token(sub).then(async user => {
            var token = await get_token(user[0].id);
            if (sub == token) {
                project_name_unique(req.body.name).then((unique) => {
                    if (unique === true){
                        post_project(req, req.body.name, req.body.description, req.body.date, user[0].id)
                        .then(async project => {
                            // Add project id to user
                            await add_project_to_user(user[0].id, project[0].id);
                
                            return res.status(201).json(project[0]);
                        });
                    }
                    else {
                        res.status(403).json({'Error': 'Project name must be unique'});
                    }
                });  
            }
            else {
                return res.status(401).json({'Error': 'Access Denied. JWT sub does not match user token for project.'});
            }
        });      
    }
});

// Delete a Project
router.delete('/:id', async function(req, res){
    var jwt = req.headers.authorization;
    if (jwt === undefined || jwt === null){
        return res.status(401).json({'Error': 'Access Denied. JWT sub does not match user token for project.'});
    }
    if (jwt.startsWith("Bearer ")){
        jwt = jwt.substring(7, jwt.length);
    }
    var sub;
    try {
        const ticket = await client.verifyIdToken({ idToken: jwt, audience: CLIENT_ID});
        payload = ticket.getPayload();
        sub = payload['sub'];
    } catch (error) {
        sub = null;
        return res.status(401).json({'Error': 'Access Denied. JWT sub does not match user token for project.'});
    }
    get_project(req, req.params.id)
    .then(async project => {
        if (project[0] === undefined || project[0] === null) {
            return res.status(404).json({ 'Error': 'No project with this project_id exists' });
        } else {
            var token = await get_token(project[0].user_id);
            if(sub == token){
                // Delete project from user
                await delete_project_from_user(project[0].user_id, project[0].id);
                // Delete All Issues assigned to this project first
                await delete_issues_for_project(req.params.id);
                // Delete Project
                await delete_project(req.params.id);
                res.status(204).end();
            }
            else {
                return res.status(401).json({'Error': 'Access Denied. JWT sub does not match user token for project.'});
            }            
        }
    });
});

// Edit all attributes of Project
router.put('/:id', async function(req, res){
    if(req.get('Accept') !== 'application/json'){
        return res.status(406).json({'Error': 'Accepts type is Not Acceptable. Must be application/json.'});
    }
    var jwt = req.headers.authorization;
    if (jwt === undefined || jwt === null){
        return res.status(401).json({'Error': 'Access Denied. JWT sub does not match user token for project.'});
    }
    if (jwt.startsWith("Bearer ")){
        jwt = jwt.substring(7, jwt.length);
    }
    var sub;
    try {
        const ticket = await client.verifyIdToken({ idToken: jwt, audience: CLIENT_ID});
        payload = ticket.getPayload();
        sub = payload['sub'];
    } catch (error) {
        sub = null;
        return res.status(401).json({'Error': 'Access Denied. JWT sub does not match user token for project.'});
    }
    if (req.body.name === undefined || req.body.name === null ||
        req.body.description === undefined || req.body.description === null ||
        req.body.date === undefined || req.body.date === null)
    {
        res.status(400).json({'Error': 'The request object is missing at least one of the required attributes'});
    }
    else
    {
        get_project(req, req.params.id).then(async project => {
            if (project[0] === undefined || project[0] === null) {
                return res.status(404).json({ 'Error': 'No project with this project_id exists' });
            } else {
                var token = await get_token(project[0].user_id);
                if(sub == token){
                    project_name_unique(req.body.name).then(async (unique) => {
                        if (unique === true){
                            await put_project(req, req.params.id, req.body.name, req.body.description, req.body.date);
                            await get_project(req, req.params.id).then(project => {
                                return res.status(200).json(project[0]);
                            });
                        }
                        else {
                            return res.status(403).json({'Error': 'Project name must be unique'});
                        }
                    });  
                }
                else {
                    return res.status(401).json({'Error': 'Access Denied. JWT sub does not match user token for project.'});
                }            
            }
        });
    }
});

// Edit one or more attributes of Project
router.patch('/:id', async function(req, res){
    if(req.get('Accept') !== 'application/json'){
        return res.status(406).json({'Error': 'Accepts type is Not Acceptable. Must be application/json.'});
    }
    var jwt = req.headers.authorization;
    if (jwt === undefined || jwt === null){
        return res.status(401).json({'Error': 'Access Denied. JWT sub does not match user token for project.'});
    }
    if (jwt.startsWith("Bearer ")){
        jwt = jwt.substring(7, jwt.length);
    }
    var userid;
    try {
        const ticket = await client.verifyIdToken({ idToken: jwt, audience: CLIENT_ID});
        payload = ticket.getPayload();
        userid = payload['sub'];
    } catch (error) {
        userid = null;
        return res.status(401).json({'Error': 'Access Denied. JWT sub does not match user token for project.'});
    }
    if ((req.body.name === undefined || req.body.name === null) &&
        (req.body.description === undefined || req.body.description === null) &&
        (req.body.date === undefined || req.body.date === null))
    {
        res.status(400).json({'Error': 'The request object must include at least one project attribute'});
    }
    else
    {
        get_project(req, req.params.id).then(async project => {
            if (project[0] === undefined || project[0] === null) {
                return res.status(404).json({ 'Error': 'No project with this project_id exists' });
            } else {
                var token = await get_token(project[0].user_id);
                if (userid == token) {
                    if (req.body.name !== undefined && req.body.name !== null)
                    {
                        project_name_unique(req.body.name).then(async (unique) => {
                            if (unique === true){
                                await patch_project(req, req.params.id, req.body.name, req.body.description, req.body.date);
                                await get_project(req, req.params.id).then(project => {
                                    return res.status(200).json(project[0]);
                                });
                            }
                            else {
                                return res.status(403).json({'Error': 'Project name must be unique'});
                            }
                        });
                    }
                    else {
                        await patch_project(req, req.params.id, req.body.name, req.body.description, req.body.date);
                        await get_project(req, req.params.id).then(project => {
                            return res.status(200).json(project[0]);
                        });
                    } 
                }
                else {
                    return res.status(401).json({'Error': 'Access Denied. JWT sub does not match user token for project.'});
                }
            }
        });
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

/* ------------- End Controller Functions ------------- */

module.exports = router;