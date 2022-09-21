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
let departingFlights = [];
let pageCounter = 0;
let departureAirport = "vtbs";
const url = "https://aeroapi.flightaware.com/aeroapi/airports/" + departureAirport + "/flights/scheduled_departures?type=Airline"
// vtse = chumphon
// vtbs = suvarnabhumi
// vtsm = samui

// setup the database 
mongoose.connect("mongodb://localhost:27017/flightsDB", { useNewUrlParser: true }); //?retryWrites=true&w=majority

// setup departure collection
const flightSchema = new mongoose.Schema({
    departureAirport: String,
    arrivalAirport: String,
    departureTimeZulu: Date,
    departureTimeLocal: String,
    flightNumber: String
});

const Flight = mongoose.model('Flight', flightSchema);

Flight.deleteMany({},function(err){if(err){console.log(err)} else if (!err){console.log("all good")}});
// Flight.findByIdAndDelete("632a68429dda98635b2b74d1",function(err){if(err){console.log(err)} else if (!err){console.log("all good")}})


// setup arrivals collection 


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
                    
                    let departureTimeZulu = new Date(data.scheduled_departures[i].scheduled_out);
                    let departureTimeLocal = departureTimeZulu.toLocaleString('en-GB', {timeZone: 'Asia/Bangkok'});
                    // console.log(departureTimeZulu)
                    // console.log(departureTimeLocal)

                    departingFlightsLength = departingFlights.length;

                    departingFlights[departingFlightsLength] = {
                        // FlightNumber: data.scheduled_departures[i].ident,
                        FlightNumber_iata: data.scheduled_departures[i].ident_iata,
                        DepartureTimeZulu: departureTimeZulu,
                        // DepartureTimeLocal: departureTimeLocal,
                        // Destination: data.scheduled_departures[i].destination.code
                        Destination_iata: data.scheduled_departures[i].destination.code_iata
                        // Destination: data.scheduled_departures[i].destination
                    }

                    const newFlightEntry = new Flight({
                        departureAirport: departureAirport ,
                        arrivalAirport: data.scheduled_departures[i].destination.code_iata,
                        departureTimeZulu: departureTimeZulu,
                        departureTimeLocal: departureTimeLocal,
                        flightNumber: data.scheduled_departures[i].ident_iata
                    })
                    newFlightEntry.save();
                }
            }

            console.log("length of departingFlights: " + departingFlights.length)
            pageCounter++;
            console.log("pageCounter: " + pageCounter)

            // Go fetch the next page from the API
            if (data.links != null & pageCounter < 0) {
                url_page_extension = data.links.next;
                url = "https://aeroapi.flightaware.com/aeroapi" + url_page_extension;

                if (url_page_extension != '' & url_page_extension != null
                ) {
                    // Delay the requests to not pass the api rate limit. 
                    const myFunction = async () => {
                        await setTimeout(1500);
                        console.log("Waited 15s");
                        fetchDepartureData(url);
                    }
                    myFunction();
                }
            } else {
                // when we have all the information from all pages. We end up here.
                
                // display the last flight in the query
                // console.log(departingFlights[departingFlights.length - 1])
            }
        })
        .catch(function (error) {
            console.log('Request failed', error);
        });

}


