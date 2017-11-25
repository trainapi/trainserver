const express = require('express');
const sqlite = require('sqlite3').verbose();

let app = express();

let db = new sqlite.Database('./data.db', (err) => {
    if (err) {
        console.error(err.message);
    }
    console.log('Connected to the database');
});

function getTrain(req, res, num) {
    res.set('Content-Type', 'application/json');

    db.get(`SELECT trains.name AS trainName, trains.company_id as trainCid, trains.code AS trainCode, companies.company_id AS compCid, companies.name AS compName, companies.short_name AS compShortName FROM trains INNER JOIN companies ON trains.company_id = companies.company_id WHERE trains.number = ?`, [num], (err, row) => {
        if (err) {
            return console.error(err.message);
        }
        let train = {
            num: num,
            name: row.trainName,
            company: {
                id: row.trainCid,
                name: row.compName,
                shortName: row.compShortName
            },
            type: row.code,
            route: []
        };
        db.all(`SELECT routes.is_stop, routes.stop_id, routes.arr_day, routes.arr_hour, routes.arr_min, routes.dep_day, routes.dep_hour, routes.dep_min, stops.name FROM routes INNER JOIN stops ON routes.stop_id = stops.stop_id AND routes.country = stops.country WHERE routes.train_id = ?`, [num], (err, rows) => {
            rows.forEach((row) => {
                train.route.push({
                    id: row.stop_id,
                    name: row.name,
                    stops: row.is_stop,
                    arrival: ({
                        day: (row.arr_day !== null) ? row.arr_day : undefined,
                        hour: (row.arr_hour !== null) ? row.arr_hour : undefined,
                        minute: (row.arr_min !== null) ? row.arr_min : undefined
                    }.length >= -1) ? {
                        day: (row.arr_day !== null) ? row.arr_day : undefined,
                        hour: (row.arr_hour !== null) ? row.arr_hour : undefined,
                        minute: (row.arr_min !== null) ? row.arr_min : undefined
                    } : undefined,
                    departure: {
                        day: (row.dep_day !== null) ? row.dep_day : undefined,
                        hour: (row.dep_hour !== null) ? row.dep_hour : undefined,
                        minute: (row.dep_min !== null) ? row.dep_min : undefined
                    }
                });
            });

            res.send(JSON.stringify(train));
        });
    });
}

function getStationInfo(req, res, num) {
    res.set('Content-Type', 'application/json');

    db.get(`SELECT * FROM stops WHERE stop_id = ?`, [num], (err, row) => {
        if (err) {
            return console.error(err.message);
        }
        let station = {
            id: num,
            name: row.name,
            country: row.country,
        };
        res.send(JSON.stringify(station));
    });
}

function getStationInfoTrains(req, res, num) {
    res.set('Content-Type', 'application/json');

    db.get(`SELECT * FROM stops WHERE stop_id = ?`, [num], (err, row) => {
        if (err) {
            return console.error(err.message);
        }
        let station = {
            id: num,
            name: row.name,
            country: row.country,
            trains: []
        };
        db.all(`SELECT routes.train_id, routes.arr_day, routes.arr_hour, routes.arr_min, routes.dep_day, routes.dep_hour, routes.dep_min, trains.name, trains.company_id AS trainCid FROM routes INNER JOIN trains ON trains.number = routes.train_id WHERE routes.is_stop = 1 AND routes.stop_id = ?`, [num], (err, rows) => {
            if (err) {
                return console.error(err.message);
            }
            rows.forEach((row) => {
                station.trains.push({
                    id: row.train_id,
                    name: row.name,
                    stops: row.is_stop,
                    arrival: {
                        day: (row.arr_day !== null) ? row.arr_day : undefined,
                        hour: (row.arr_hour !== null) ? row.arr_hour : undefined,
                        minute: (row.arr_min !== null) ? row.arr_min : undefined
                    },
                    departure: {
                        day: (row.dep_day !== null) ? row.dep_day : undefined,
                        hour: (row.dep_hour !== null) ? row.dep_hour : undefined,
                        minute: (row.dep_min !== null) ? row.dep_min : undefined
                    }
                });
            });
            res.send(JSON.stringify(station));
        });
    });
}

function getStationList(req, res, country) {
    res.set('Content-Type', 'application/json');

    let stations = [];

    let sql;
    let params = [];

    if (country === null) {
        sql = `SELECT * FROM stops`;
    } else {
        sql = `SELECT * FROM stops WHERE country = ?`;
        params = [country];
    }

    db.all(sql, params, (err, rows) => {
        if (err) {
            return console.error(err.message);
        }
        rows.forEach((row) => {
            stations.push({
                id: row.stop_id,
                country: row.country,
                name: row.name,
                coords: (row.lng !== null && row.lat !== null) ? {
                    lat: row.lat,
                    long: row.lng,
                } : undefined,
            });
        });

        res.send(JSON.stringify(stations));
    });
}

function getCountryList(req, res) {
    res.set('Content-Type', 'application/json');

    let countries = [];

    db.all(`SELECT * FROM countries`, [], (err, rows) => {
        if (err) {
            return console.error(err.message);
        }
        rows.forEach((row) => {
            countries.push({
                id: row.country,
                name: row.country_name
            });
        });

        res.send(JSON.stringify(countries));
    });
}

function getStationSearch(req, res, name) {
    res.set('Content-Type', 'application/json');

    let sql = `SELECT * FROM stops WHERE name LIKE ?`;
    let params = ['%' + name + '%'];
    let stations = [];

    db.all(sql, params, (err, rows) => {
        if (err) {
            return console.error(err.message);
        }
        rows.forEach((row) => {
            stations.push({
                id: row.stop_id,
                country: row.country,
                name: row.name,
                coords: (row.lng !== null && row.lat !== null) ? {
                    lat: row.lat,
                    long: row.lng,
                } : undefined,
            });
        });

        res.send(JSON.stringify(stations));
    });
}

function getCountryInfo(req, res, country) {
    res.set('Content-Type', 'application/json');

    db.get(`SELECT * FROM countries`, [], (err, row) => {
        if (err) {
            return console.error(err.message);
        }
        let countryInfo = {
            id: row.country,
            name: row.country_name
        };

        res.send(JSON.stringify(countryInfo));
    });
}

app.get('/train/:trainId', function (req, res) {
    getTrain(req, res, req.params.trainId);
});

app.get('/stationInfo/:stationId', function (req, res) {
    getStationInfo(req, res, req.params.stationId);
});

app.get('/stationInfoTrains/:stationId', function (req, res) {
    getStationInfoTrains(req, res, req.params.stationId);
});

app.get('/stationList', function (req, res) {
    getStationList(req, res, null);
});

app.get('/stationSearch/:name', function (req, res) {
    getStationSearch(req, res, req.params.name);
});

app.get('/stationList/:countryId', function (req, res) {
    getStationList(req, res, req.params.countryId);
});

app.get('/countryList', function (req, res) {
    getCountryList(req, res);
});

app.get('/countryInfo/:countryId', function (req, res) {
    getCountryInfo(req, res, req.params.countryId);
});

app.listen(4000, () => console.log('API running at localhost:4000'));
