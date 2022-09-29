//jshint esversion:6
require('dotenv').config();
const express = require("express");
const bodyParser = require("body-parser");
const fetch = require("node-fetch");
const { setTimeout } = require("timers/promises");
const mongoose = require("mongoose");

const app = express();

app.use(bodyParser.urlencoded({
    extended: true
}));

// define variables
// let pageCounter = 0;
let originLocation = "Bangkok";
let originAirport = "lexj"
let originTimeZone = 'Europe/Madrid'
// let originAirport = "vtbs"
// let originTimeZone = 'Asia/Bangkok';
const departureUrl = "https://aeroapi.flightaware.com/aeroapi/airports/" + originAirport + "/flights/scheduled_departures?type=Airline"
const returnUrl = "https://aeroapi.flightaware.com/aeroapi/airports/" + originAirport + "/flights/scheduled_arrivals?type=Airline"
// vtse = chumphon
// vtbs = suvarnabhumi
// vtsm = samui
// lexj = santander

const fireItAllUp = async () => {
    await mongoose.connect("mongodb+srv://joris-mongo:" + process.env.ATLAS_KEY + "@cluster1.dkcnhgi.mongodb.net/flightsDB", { useNewUrlParser: true, useUnifiedTopology: true }); 
    console.log("mongoose fired up");


    // setup the database 
    // mongoose.connect("mongodb://localhost:27017/flightsDB", { useNewUrlParser: true }); //?retryWrites=true&w=majority


    // setup departure collection
    const departingFlightSchema = new mongoose.Schema({
        departureAirport: String,
        arrivalAirport: String,
        departureTimeZulu: Date,
        departureTimeLocal: String,
        flightNumber: String
    });

    // setup return collection
    const returnFlightSchema = new mongoose.Schema({
        departureAirport: String,
        arrivalAirport: String,
        arrivalTimeZulu: Date,
        arrivalTimeLocal: String,
        flightNumber: String
    })

    const Departingflight = mongoose.model('Departingflight', departingFlightSchema);
    const Returnflight = mongoose.model('Returnflight',returnFlightSchema);

    // for now, delete the db when we rerun the query
    Departingflight.deleteMany({},function(err){if(err){console.log(err)} else if (!err){console.log("departures db deleted before start")}});
    Returnflight.deleteMany({},function(err){if(err){console.log(err)} else if (!err){console.log("return db deleted before start")}});


    // Initial API Call
    fetchAirportData(departureUrl, "departure", 0);
    // 

    // const fetchDepartureAndArrival = async() => {
        //await 
        // fetchAirportData(departureUrl, "departure");
        // fetchAirportData(returnUrl, "return");
    // }
    // fetchDepartureAndArrival();

    // Create the function for API Call 
    // direction is either "departure" or "return"; url is either "departureUrl" or "returnUrl"
    function fetchAirportData(url, direction, pageCounter) {
        
        fetch(url, {
            method: 'GET',
            headers: {
                "x-apikey": process.env.API_KEY
            },
        })
            .then(function (response) {
                return response.json();
            })
            .then(function (data) {
                if (direction === "departure"){
                    for (let i = 0; i < data.scheduled_departures.length; i++) {
                        if (data.scheduled_departures[i].destination === null) {} else {

                            // define variables with data from api
                            let arrivalAirport = data.scheduled_departures[i].destination.code_iata;
                            let departureTimeZulu = new Date(data.scheduled_departures[i].scheduled_out);
                            let departureTimeLocal = departureTimeZulu.toLocaleString('en-GB', {timeZone: originTimeZone});
                            let flightNumber = data.scheduled_departures[i].ident_iata;

                            // put data in database
                            const newDepartingFlightEntry = new Departingflight({
                                departureAirport:   originAirport ,
                                arrivalAirport:     arrivalAirport,
                                departureTimeZulu:  departureTimeZulu,
                                departureTimeLocal: departureTimeLocal,
                                flightNumber:       flightNumber
                            })
                            newDepartingFlightEntry.save();
                        }
                    }
                } else if (direction === "return"){
                    for (let i = 0; i < data.scheduled_arrivals.length; i++) {
                        if (data.scheduled_arrivals[i].destination === null) {} else {

                            // define variables with data from api
                            let departureAirport = data.scheduled_arrivals[i].origin.code_iata;
                            let arrivalTimeZulu = new Date(data.scheduled_arrivals[i].scheduled_in);
                            let arrivalTimeLocal = arrivalTimeZulu.toLocaleString('en-GB', {timeZone: originTimeZone});
                            let flightNumber = data.scheduled_arrivals[i].ident_iata;

                            // put data in database
                            const newReturnFlightEntry = new Returnflight({
                                departureAirport:   departureAirport ,
                                arrivalAirport:     originAirport,
                                arrivalTimeZulu:  arrivalTimeZulu,
                                arrivalTimeLocal: arrivalTimeLocal,
                                flightNumber:       flightNumber
                            })
                            newReturnFlightEntry.save();
                        }
                    }

                } else {console.log("direction error")}
                
                pageCounter++;
                console.log("pageCounter: " + pageCounter)

                // Fetch the next page from the API
                if (data.links != null & pageCounter < 2) {
                    // create URL of next page
                    url_page_extension = data.links.next;
                    url = "https://aeroapi.flightaware.com/aeroapi" + url_page_extension;

                    if (url_page_extension != '' & url_page_extension != null
                    ) {
                        // Delay the requests to not pass the api rate limit and call the function again to fetch the next page 
                        const delayForRateLimitAndCallNextPage = async () => {
                            await setTimeout(1500);
                            console.log("Waited 15s");
                            fetchAirportData(url, direction, pageCounter);
                        }
                        delayForRateLimitAndCallNextPage();
                    }
                } else {
                    // when we have all the information from all pages. We end up here.
                    
                    // If we checked for departures, we will now check for returns
                    if (direction === "departure"){
                        fetchAirportData(returnUrl, "return", 0);
                    } else {console.log("end of execution")}


                    // display the last flight in the query
                    // console.log(departingFlights[departingFlights.length - 1])

                    // final message
                    const delayForCheckingIfDbisUpdated = async () => {
                        await setTimeout(10000);
                        console.log("Waited 10s to make sure db is updated");
                        countDocuments();
                    }
                    delayForCheckingIfDbisUpdated();
                }
            })
            .catch(function (error) {
                console.log('Request failed', error);
            });
    }
    const countDocuments = async () => {
        // console.log("number of entries " + await Departingflight.countDocuments({}));
        console.log("number of entries " + await Returnflight.countDocuments({}));
    }
}

fireItAllUp();


