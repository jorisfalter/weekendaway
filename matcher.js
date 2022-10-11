require('dotenv').config();
const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");

const app = express();

app.use(bodyParser.urlencoded({
    extended: true
}));


const departureIntervalStart = new Date(2022,11,9,8,0,0); // months are from 0!
const departureIntervalEnd = new Date(2022,11,9,11,0,0);
const returnIntervalStart = new Date(2022,11,10,14,0,0);
const returnIntervalEnd = new Date(2022,11,10,19,0,0);;

console.log(departureIntervalStart)
console.log(departureIntervalEnd)


mongoose.connect("mongodb+srv://joris-mongo:" + process.env.ATLAS_KEY + "@cluster1.dkcnhgi.mongodb.net/flightsDB", { useNewUrlParser: true, useUnifiedTopology: true }); 
    console.log("mongoose fired up");

