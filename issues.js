const express = require('express');
const bodyParser = require('body-parser');
const router = express.Router();
const ds = require('./datastore');
const e = require('express');
const datastore = ds.datastore;


const ISSUE = "ISSUE";
const PROJECT = "PROJECT";

router.use(bodyParser.json());



/* ------------- Begin ISSUE Model Functions ------------- */
function post_issue(req, name, description, priority, project_id) {
    var key = datastore.key(ISSUE);
    const new_issue = { "name": name, "description": description, "priority": priority, "project_id": project_id};
    return datastore.save({ "key": key, "data": new_issue }).then(() => {
        var self_url = req.protocol + "://" + req.get("host") + req.baseUrl + "/" + key.id;
        return {"id": key.id, "name": new_issue.name, "description": new_issue.description, "priority": new_issue.priority, "project_id": new_issue.project_id, "self": self_url}
    });
}

function put_issue(req, name, description, priority, issue_id) {
    var key = datastore.key([ISSUE, parseInt(issue_id, 10)]);
    return datastore.get(key).then((entity) => {
        if (entity[0] === undefined || entity[0] === null) {
            return entity;
        } else {
            const put_issue = { "name": name, "description": description, "priority": priority, "project_id": entity[0].project_id};
            return datastore.save({ "key": key, "data": put_issue }).then(() => {
                var self_url = req.protocol + "://" + req.get("host") + req.baseUrl + "/" + key.id;
                return {"id": key.id, "name": put_issue.name, "description": put_issue.description, "priority": put_issue.priority, "project_id": put_issue.project_id, "self": self_url}
            });
        }
    });
}

function patch_issue(req, name, description, priority, issue_id) {
    var key = datastore.key([ISSUE, parseInt(issue_id, 10)]);
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
            if (priority === undefined || priority === null) {
                priority = entity[0].priority;
            }
            const patch_issue = { "name": name, "description": description, "priority": priority, "project_id": entity[0].project_id};
            return datastore.save({ "key": key, "data": patch_issue }).then(() => {
                var self_url = req.protocol + "://" + req.get("host") + req.baseUrl + "/" + key.id;
                return {"id": key.id, "name": patch_issue.name, "description": patch_issue.description, "priority": patch_issue.priority, "project_id": patch_issue.project_id, "self": self_url}
            });
        }
    });
}

function get_issue(req, id) {
    const key = datastore.key([ISSUE, parseInt(id, 10)]);
    return datastore.get(key).then((entity) => {
        if (entity[0] === undefined || entity[0] === null) {
            return entity;
        } else {
            var self_url = req.protocol + "://" + req.get("host") + req.baseUrl +"/" + key.id
            entity[0].self = self_url;
            return entity.map(ds.fromDatastore);
        }
    });
}

function get_issues(req){
    var q = datastore.createQuery(ISSUE).limit(5);
    var results = {};
    if(Object.keys(req.query).includes("cursor")){
        q = q.start(req.query.cursor);
    }
	return datastore.runQuery(q).then( (entities) => {
            results = entities[0].map(ds.fromDatastore);
            for (var i= 0; i<results.length;i++ )
            {
                var self_url = req.protocol + "://" + req.get("host") + "/issues/" + results[i].id
                results[i].self = self_url;
            }
            if(entities[1].moreResults !== ds.Datastore.NO_MORE_RESULTS ){
                results[i+1].next = req.protocol + "://" + req.get("host") + "/issues/" + "?cursor=" + entities[1].endCursor;
            }
			return {"issues": results};
		});
}

function delete_issue(id){
    const key = datastore.key([ISSUE, parseInt(id,10)]);
    return datastore.delete(key);
};

async function remove_issue_from_project(project_id, issue_id) {
    const key = datastore.key([PROJECT, parseInt(project_id, 10)]);
    return datastore.get(key).then(async (project) => {
        if (project[0] === undefined || project[0] === null) {
            return;
        } else {
            for (var i=0; i < project[0].issues.length; i++) {
                if (project[0].issues[i].id == issue_id)
                {
                    project[0].issues.splice(i,1);
                    if( typeof(project[0].issues) === 'undefined'){
                        project[0].issues = [];
                    }
                    const update_project = { "name": project[0].name, "description": project[0].description, "date": project[0].date, "user_id": project[0].user_id, "issues":project[0].issues};
                    return await datastore.save({ "key": key, "data": update_project });
                }
            }

        }
    });
}

function add_issue_to_project(project_id, issue_id) {
    const key = datastore.key([PROJECT, parseInt(project_id, 10)]);
    return datastore.get(key).then(async (project) => {
        if (project[0] === undefined || project[0] === null) {
            return;
        } else {
            if( typeof(project[0].issues) === 'undefined'){
                project[0].issues = [];
            }
            project[0].issues.push({"id": issue_id});
            const update_project = { "name": project[0].name, "description": project[0].description, "date": project[0].date, "user_id": project[0].user_id, "issues":project[0].issues};
            return await datastore.save({ "key": key, "data": update_project });
        }
    });
}

function issue_name_unique(name){
    var q = datastore.createQuery(ISSUE).filter('name', name);
    return datastore.runQuery(q).then( (issue) => {
        if (issue[0][0] === undefined || issue[0][0] === null) {
            return true;
        } else {
            return false;
        }
    });
}

/* ------------- End Model Functions ------------- */

/* ------------- Begin Controller Functions ------------- */

// GET All Issues
router.get('/', function(req, res){
    if(req.get('Accept') !== 'application/json'){
        return res.status(406).json({'Error': 'Accepts type is Not Acceptable. Must be application/json.'});
    }
    const issues = get_issues(req)
	.then( (issues) => {
        return res.status(200).json(issues);
    });
});

// GET Issue
router.get('/:id', function (req, res) {
    if(req.get('Accept') !== 'application/json'){
        return res.status(406).json({'Error': 'Accepts type is Not Acceptable. Must be application/json.'});
    }
    get_issue(req, req.params.id)
        .then(issue => {
            if (issue[0] === undefined || issue[0] === null) {
                return res.status(404).json({ 'Error': 'No issue with this issue_id exists' });
            } else {
                return res.status(200).json(issue[0]);
            }
        });
});

// POST Issue
router.post('/', function(req, res){
    if(req.get('Accept') !== 'application/json'){
        return res.status(406).json({'Error': 'Accepts type is Not Acceptable. Must be application/json.'});
    }
    if (req.body.name === undefined || req.body.name === null ||
        req.body.description === undefined || req.body.description === null ||
        req.body.priority === undefined || req.body.priority === null ||
        req.body.project_id === undefined || req.body.project_id === null)
    {
        res.status(400).json({'Error': 'The request object is missing at least one of the required attributes'});
    }
    else
    {
        issue_name_unique(req.body.name).then((unique) => {
            if (unique === true){
                post_issue(req, req.body.name, req.body.description, req.body.priority, req.body.project_id)
                .then(async issue => {
                    await add_issue_to_project(issue.project_id, issue.id);
                res.status(201).json(issue);
                });
            }
            else {
                res.status(403).json({'Error': 'Issue name must be unique'});
            }
        });        
    }
});

// Delete Issue
router.delete('/:id', function(req, res){
    get_issue(req, req.params.id).then(async (issue) => {
        if (issue[0] === undefined || issue[0] === null) {
            return res.status(404).json({ 'Error': 'No issue with this issue_id exists' });
        } else {
            await remove_issue_from_project(issue[0].project_id, req.params.id);
            await delete_issue(req.params.id).then(res.status(204).end());   
        }
    });
});

router.put('/:id', function(req, res){
    if(req.get('Accept') !== 'application/json'){
        return res.status(406).json({'Error': 'Accepts type is Not Acceptable. Must be application/json.'});
    }
    get_issue(req, req.params.id).then(async (issue) => {
        if (issue[0] === undefined || issue[0] === null) {
            return res.status(404).json({ 'Error': 'No issue with this issue_id exists' });
        } else {
            if (req.body.name === undefined || req.body.name === null ||
                req.body.description === undefined || req.body.description === null ||
                req.body.priority === undefined || req.body.priority === null)
            {
                res.status(400).json({'Error': 'The request object is missing at least one of the required attributes'});
            }
            else
            {
                issue_name_unique(req.body.name).then((unique) => {
                    if (unique === true){
                        put_issue(req, req.body.name, req.body.description, req.body.priority, req.params.id)
                        .then(async issue => {
                            res.status(200).json(issue);
                        });
                    }
                    else {
                        res.status(403).json({'Error': 'Issue name must be unique'});
                    }
                });
            }
        }
    });
});

router.patch('/:id', function(req, res){
    if(req.get('Accept') !== 'application/json'){
        return res.status(406).json({'Error': 'Accepts type is Not Acceptable. Must be application/json.'});
    }
    get_issue(req, req.params.id).then(async (issue) => {
        if (issue[0] === undefined || issue[0] === null) {
            return res.status(404).json({ 'Error': 'No issue with this issue_id exists' });
        } else {
            if ((req.body.name === undefined || req.body.name === null) &&
            (req.body.description === undefined || req.body.description === null) &&
            (req.body.priority === undefined || req.body.priority === null))
            {
                res.status(400).json({'Error': 'The request object must include at least one issue attribute'});
            }
            else
            {
                if (req.body.name !== undefined && req.body.name !== null)
                {
                    issue_name_unique(req.body.name).then((unique) => {
                        if (unique === true){
                            patch_issue(req, req.body.name, req.body.description, req.body.priority, req.params.id)
                            .then(async issue => {
                                res.status(200).json(issue);
                            });
                        }
                        else {
                            res.status(403).json({'Error': 'Issue name must be unique'});
                        }
                    });
                }
                else {
                    patch_issue(req, req.body.name, req.body.description, req.body.priority, req.params.id)
                    .then(async issue => {
                        res.status(200).json(issue);
                    });
                }
            }
        }
    });
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