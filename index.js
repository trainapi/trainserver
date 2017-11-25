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

function getConnectionList(req, res, from, to) {
    res.set('Content-Type', 'application/json');

    let sql = `SELECT t.code, t.number, t.name, r1.dep_hour, r1.dep_min, r2.arr_day - r1.dep_day AS arr_day, r2.arr_hour, r2.arr_min
        FROM routes as r1
        JOIN routes AS r2 ON r1.train_id = r2.train_id
        JOIN trains AS t on t.number = r1.train_id
        WHERE r1.stop_id = ? AND r2.stop_id = ? AND (r2.arr_day > r1.dep_day OR (r2.arr_day = r1.dep_day AND r2.arr_hour > r1.dep_hour OR (r2.arr_hour == r1.dep_hour AND r2.arr_min > r1.dep_min)))
        ORDER BY r1.dep_hour, r1.dep_min`;
    let params = [from, to];
    let trains = [];

    db.all(sql, params, (err, rows) => {
        if (err) {
            return console.error(err.message);
        }
        rows.forEach((row) => {
            trains.push({
                code: row.code,
                number: row.number,
                name: row.name,
                departure: {
                    hour: (row.dep_hour !== null) ? row.dep_hour : undefined,
                    minute: (row.dep_min !== null) ? row.dep_min : undefined
                },
                arrival: {
                    day: (row.arr_day !== null) ? row.arr_day : undefined,
                    hour: (row.arr_hour !== null) ? row.arr_hour : undefined,
                    minute: (row.arr_min !== null) ? row.arr_min : undefined
                }
            });
        });

        res.send(JSON.stringify(trains));
    });
}

function getCountryInfo(req, res, country) {
    res.set('Content-Type', 'application/json');

    db.get(`SELECT * FROM countries WHERE id = ?`, [country], (err, row) => {
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

function getCompanyList(req, res) {
    res.set('Content-Type', 'application/json');

    let companies = [];

    db.all(`SELECT * FROM companies`, [], (err, rows) => {
        if (err) {
            return console.error(err.message);
        }
        rows.forEach((row) => {
            companies.push({
                id: row.company_id,
                name: row.name,
                shortName: row.short_name,
                number: row.number,
                numberUIC: row.number4,
                country: row.country
            });
        });

        res.send(JSON.stringify(companies));
    });
}

function getCompanyInfo(req, res, company) {
    res.set('Content-Type', 'application/json');

    db.get(`SELECT * FROM companies WHERE number = ?`, [company], (err, row) => {
        if (err) {
            return console.error(err.message);
        }
        console.log(row);
        let companyInfo = {
            id: row.company_id,
            name: row.name,
            shortName: row.short_name,
            number: row.number,
            numberUIC: row.number4,
            country: row.country
        };

        res.send(JSON.stringify(companyInfo));
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

app.get('/connectionList/:from/:to', function (req, res) {
    getConnectionList(req, res, req.params.from, req.params.to);
});

app.get('/countryList', function (req, res) {
    getCountryList(req, res);
});

app.get('/countryInfo/:countryId', function (req, res) {
    getCountryInfo(req, res, req.params.countryId);
});

app.get('/companyList', function (req, res) {
    getCompanyList(req, res);
});

app.get('/companyInfo/:companyId', function (req, res) {
    getCompanyInfo(req, res, req.params.companyId);
});

app.listen(4000, () => console.log('API running at localhost:4000'));
