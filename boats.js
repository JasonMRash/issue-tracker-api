const express = require('express');
const bodyParser = require('body-parser');
const router = express.Router();
const ds = require('./datastore');
const datastore = ds.datastore;


const BOAT = "Boat";
const LOAD = "Load";

router.use(bodyParser.json());



/* ------------- Begin Lodging Model Functions ------------- */
function post_boat(req, name, type, length) {
    var key = datastore.key(BOAT);
    var loads = []
    const new_boat = { "name": name, "type": type, "length": length, "loads": loads};
    return datastore.save({ "key": key, "data": new_boat }).then(() => {
        var self_url = req.protocol + "://" + req.get("host") + req.baseUrl + "/" + key.id
        return {"id": key.id, "name": name, "type": type, "length": length, "loads": loads, "self": self_url}
    });
}

function get_boat(req, id) {
    const key = datastore.key([BOAT, parseInt(id, 10)]);
    return datastore.get(key).then((entity) => {
        if (entity[0] === undefined || entity[0] === null) {
            return entity;
        } else {
            var self_url = req.protocol + "://" + req.get("host") + "/boats/" + key.id
            entity[0].self = self_url;
            return entity.map(ds.fromDatastore);
        }
    });
}

function get_boats(req){
    var q = datastore.createQuery(BOAT).limit(3);
    var results = {};
    if(Object.keys(req.query).includes("cursor")){
        q = q.start(req.query.cursor);
    }
	return datastore.runQuery(q).then( (entities) => {
            results = entities[0].map(ds.fromDatastore);
            for (var i= 0; i<results.length;i++ )
            {
                var self_url = req.protocol + "://" + req.get("host") + "/boats/" + results[i].id
                results[i].self = self_url;
            }
            if(entities[1].moreResults !== ds.Datastore.NO_MORE_RESULTS ){
                results.next = req.protocol + "://" + req.get("host") + "/boats/" + "?cursor=" + entities[1].endCursor;
            }
			return {"boats": results};
		});
}

function add_self_url(req, boat){
    var self_url = req.protocol + "://" + req.get("host") + "/boats/" + boat.id
    boat.self = self_url;
    return boat;
}

function get_boat_loads(req, id){
    const key = datastore.key([BOAT, parseInt(id, 10)]);
    return datastore.get(key).then(async (entity) => {
        var results = [];
        if (entity[0] === undefined || entity[0] === null) {
            // No entity found. Don't try to add the id attribute
            return entity;
        } else {
            // Use Array.map to call the function fromDatastore. This function
            // adds id attribute to every element in the array entity
            var loadData = [];
            self_url ="";
            var i = 0;
            for (i; i < entity[0].loads.length;i++) {
                await get_load(entity[0].loads[i].id)
                    .then(load => {
                    self_url = req.protocol + "://" + req.get("host") + "/loads/" + load[0].id;
                    loadData = {"id": load[0].id, "volume": load[0].volume, "carrier": load[0].carrier, "item": load[0].item, "creation_date": load[0].creation_date, "self": self_url};
                    load[0].self = self_url;
                    results.push(loadData);
                });
            }
            return results;
        }
    });
}

function delete_boat(id){
    const key = datastore.key([BOAT, parseInt(id,10)]);
    return datastore.delete(key);
}

function put_load_in_boat(req, boat_id, load_id){
    const boat_key = datastore.key([BOAT, parseInt(boat_id,10)]);
    return datastore.get(boat_key)
    .then( (boat) => {
        if( typeof(boat[0].loads) === 'undefined'){
            boat[0].loads = [];
        }
        var self_load_url = req.protocol + "://" + req.get("host") +"/loads/" + load_id;
        boat[0].loads.push({"id": load_id, "self": self_load_url});
        var self_boat_url = req.protocol + "://" + req.get("host") +"/boats/" + boat_id;
        boat[0].self = self_boat_url;
        return datastore.save({"key":boat_key, "data":boat[0]});
    });
}

function put_carrier_in_load(req, boat_id, load_id){
    const keyLoad = datastore.key([LOAD, parseInt(load_id, 10)]);
    return datastore.get(keyLoad).then((load) => {
        const keyBoat = datastore.key([BOAT, parseInt(boat_id, 10)]);
        return datastore.get(keyBoat).then((boat) => {
            var self_url = req.protocol + "://" + req.get("host") + "/boats/" + keyBoat.id;
            load[0].carrier = {"id": boat_id, "name": boat[0].name, "self": self_url };
            return datastore.save({ "key": keyLoad, "data": load[0] });
        })
    })
}

function get_load(id) {
    const key = datastore.key([LOAD, parseInt(id, 10)]);
    return datastore.get(key).then((entity) => {
        if (entity[0] === undefined || entity[0] === null) {
            // No entity found. Don't try to add the id attribute
            return entity;
        } else {
            // Use Array.map to call the function fromDatastore. This function
            // adds id attribute to every element in the array entity
            return entity.map(ds.fromDatastore);
        }
    });
}

async function remove_load_from_boat(req, boat_id, load_id) {
    const key = datastore.key([BOAT, parseInt(boat_id, 10)]);
    return datastore.get(key).then(async (boat) => {
        if (boat[0] === undefined || boat[0] === null) {
            // No entity found. Don't try to add the id attribute
            return boat;
        } else {
            for (var i=0; i < boat[0].loads.length; i++) {
                if (boat[0].loads[i].id == load_id)
                {
                    boat[0].loads.splice(i,1);
                    const update_boat = { "name": boat[0].name, "type": boat[0].type, "length": boat[0].length, "loads": boat[0].loads};
                    await datastore.save({ "key": key, "data": update_boat });
                }
            }

        }
    });
}

function remove_carrier_from_load(load_id){
    const key = datastore.key([LOAD, parseInt(load_id, 10)]);
    return datastore.get(key).then(async (load) => {
        if (load[0] === undefined || load[0] === null) {
            // No entity found. Don't try to add the id attribute
            return load;
        }
        else {
            carrier = null;
        const remove_carrier = {"volume": load[0].volume, "carrier": carrier, "item": load[0].item, "creation_date": load[0].creation_date};
        return await datastore.save({"key":key, "data": remove_carrier});
        }
        
    })
}
/* ------------- End Model Functions ------------- */

/* ------------- Begin Controller Functions ------------- */

// View All Boats
router.get('/', function(req, res){
    const boats = get_boats(req)
	.then( (boats) => {
        res.status(200).json(boats);
    });
});

// View a Boat
router.get('/:id', function (req, res) {
    get_boat(req, req.params.id)
        .then(boat => {
            if (boat[0] === undefined || boat[0] === null) {
                // The 0th element is undefined. This means there is no boat with this id
                res.status(404).json({ 'Error': 'No boat with this boat_id exists' });
            } else {
                // Return the 0th element which is the boat with this id
                res.status(200).json(boat[0]);
            }
        });
});

// Get All Loads for a Boat
router.get('/:id/loads', function (req, res) {
    get_boat_loads(req, req.params.id)
        .then(load => {
            if (load[0] === undefined || load[0] === null) {
                res.status(404).json({ 'Error': 'No boat with this boat_id exists' });
            } else {
                res.status(200).json({"loads": load});
            }
        });
});

// Create a Boat
router.post('/', function(req, res){
    if (req.body.name === undefined || req.body.name === null ||
        req.body.type === undefined || req.body.type === null ||
        req.body.length === undefined || req.body.length === null)
    {
        res.status(400).json({'Error': 'The request object is missing at least one of the required attributes'});
    }
    else
    {
        post_boat(req, req.body.name, req.body.type, req.body.length)
        .then(boat => {
                res.status(201).json(boat);
        });
             
    }
});

// Delete a Boat
router.delete('/:id', function(req, res){
    get_boat(req, req.params.id).then(async (boat) => {
        if (boat[0] === undefined || boat[0] === null) {
            res.status(404).json({ 'Error': 'No boat with this boat_id exists' });
        } else {
            for (i = 0; i < boat[0].loads.length; i++)
            {
                await remove_carrier_from_load(boat[0].loads[i].id);
                await remove_load_from_boat(req.params.id, boat[0].loads[i].id);
            }
            await delete_boat(req.params.id).then(res.status(204).send("No Content"));   
        }
    });
});

router.put('/:id', function(req, res){
    put_lodging(req.params.id, req.body.name, req.body.description, req.body.price)
    .then(res.status(200).end());
});

router.put('/:boat_id/loads/:load_id', function(req, res){
    get_boat(req, req.params.boat_id).then(boat => {
        if (boat[0] === undefined || boat[0] === null) {
            res.status(404).json({ 'Error': 'The specified boat and/or load does not exist' });
        }
        else
        {
            get_load(req.params.load_id).then(async load => {
                if (load[0] === undefined || load[0] === null) {
                    res.status(404).json({ 'Error': 'The specified boat and/or load does not exist' });
                }
                else {
                    if (load[0].carrier !== null)
                    {
                        res.status(403).json({'Error': 'The load is already loaded on another boat'});
                    }
                    else
                    {
                        await put_load_in_boat(req, req.params.boat_id, req.params.load_id);
                        await put_carrier_in_load(req, req.params.boat_id, req.params.load_id);
                        res.status(204).end();
                    }
                    
                }
            })
        }
    })
});

router.delete('/:boat_id/loads/:load_id', function(req, res){
    get_boat(req, req.params.boat_id).then(boat => {
        if (boat[0] === undefined || boat[0] === null) {
            res.status(404).json({ 'Error': 'No boat with this boat_id is loaded with the load with this load_id' });
        }
        else
        {
            get_load(req.params.load_id).then(load => {
                if (load[0] === undefined || load[0] === null) {
                    res.status(404).json({ 'Error': 'No boat with this boat_id is loaded with the load with this load_id' });
                }
                else {
                    if (load[0].carrier === null)
                    {
                        res.status(404).json({'Error': 'No boat with this boat_id is loaded with the load with this load_id'});
                    }
                    else
                    {
                        remove_load_from_boat(req, req.params.boat_id, req.params.load_id)
                        .then(remove_carrier_from_load(req.params.load_id))
                        .then(() =>{res.status(204).end();});  
                    }
                    
                }
            });
        }
    });
});



/* ------------- End Controller Functions ------------- */

module.exports = router;