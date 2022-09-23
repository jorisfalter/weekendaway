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
let pageCounter = 0;
let originLocation = "Bangkok";
let originAirport = "vtbs"
const url = "https://aeroapi.flightaware.com/aeroapi/airports/" + originAirport + "/flights/scheduled_departures?type=Airline"
// vtse = chumphon
// vtbs = suvarnabhumi
// vtsm = samui

// setup the database 
mongoose.connect("mongodb://localhost:27017/flightsDB", { useNewUrlParser: true }); //?retryWrites=true&w=majority

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
Departingflight.deleteMany({},function(err){if(err){console.log(err)} else if (!err){console.log("all good")}});

// Initial API Call
fetchDepartureData(url);

// Create the function for API Call 
function fetchDepartureData(url) {
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

            for (let i = 0; i < data.scheduled_departures.length; i++) {
                if (data.scheduled_departures[i].destination === null) {
                } else {
                    
                    // for arrivals
                    // departureAirport: String,
                    // arrivalAirport: String,
                    // arrivalTimeZulu: Date,
                    // arrivalTimeLocal: String,
                    // flightNumber: String

                    // define variables 
                    let arrivalAirport = data.scheduled_departures[i].destination.code_iata;
                    let departureTimeZulu = new Date(data.scheduled_departures[i].scheduled_out);
                    let departureTimeLocal = departureTimeZulu.toLocaleString('en-GB', {timeZone: 'Asia/Bangkok'});
                    let flightNumber = data.scheduled_departures[i].ident_iata;

                    const newFlightEntry = new Departingflight({
                        departureAirport:   originAirport ,
                        arrivalAirport:     arrivalAirport,
                        departureTimeZulu:  departureTimeZulu,
                        departureTimeLocal: departureTimeLocal,
                        flightNumber:       flightNumber
                    })

                    newFlightEntry.save();
                }
            }
             
            pageCounter++;
            console.log("pageCounter: " + pageCounter)

            // Fetch the next page from the API
            if (data.links != null & pageCounter < 2) {
                url_page_extension = data.links.next;
                url = "https://aeroapi.flightaware.com/aeroapi" + url_page_extension;

                if (url_page_extension != '' & url_page_extension != null
                ) {
                    // Delay the requests to not pass the api rate limit 
                    // and call the function again to fetch the next page 
                    const delayForRateLimitAndCallNextPage = async () => {
                        await setTimeout(1500);
                        console.log("Waited 15s");
                        fetchDepartureData(url);
                    }
                    delayForRateLimitAndCallNextPage();
                }
            } else {
                // when we have all the information from all pages. We end up here.
                
                // display the last flight in the query
                // console.log(departingFlights[departingFlights.length - 1])
                
                // count the number of db entries 

                // final message

                const delayForCheckingIfDbisUpdated = async () => {
                    await setTimeout(5000);
                    console.log("Waited 5s");
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
    console.log("number of entries " + await Departingflight.countDocuments({}));
    console.log("end of execution")
}

