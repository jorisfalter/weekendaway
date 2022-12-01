const express = require("express");

const app = express();

const todaysDate = new Date();

const departure_start_zulu = new Date("2022-12-08T07:00:00.000Z");
// const return_start_zulu = new Date("2022-10-10T18:00:00.000Z");

// convert input date to day of week, eg Sunday Dec 11 (sunday is 0)
const departureDayOfWeek = departure_start_zulu.getDay();
console.log(departureDayOfWeek);
// const returnDayOfWeek = return_start_zulu.getDay();
const todayDayOfWeek = todaysDate.getDay();
console.log(todayDayOfWeek);

let depInterval = calculateInterval(todayDayOfWeek, departureDayOfWeek);
// let retInterval = calculateInterval(todayDayOfWeek, returnDayOfWeek);

console.log(depInterval);
// console.log(retInterval);

function calculateInterval(todaysDate, inputDate) {
  if (todaysDate - 2 - inputDate >= 0) {
    // 4 - 0
    return inputDate - todaysDate;
  } else {
    return inputDate - todaysDate - 7;
    // 0 - 4 - 7;
  }
}
