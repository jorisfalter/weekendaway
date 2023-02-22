const express = require("express");

const app = express();

function getDefaultDates() {
  var dayOfFriday = 5;
  var dateOfToday = new Date();
  var dayOfToday = dateOfToday.getDay();
  var nextFridayInt = new Date(); //you have to initialise a day, so initialising it here to today
  var nextSundayInt = new Date();

  var daysToAdd = dayOfFriday - dayOfToday;
  if (daysToAdd < 0) {
    daysToAdd = daysToAdd + 7;
  }
  var daysToAddS = daysToAdd + 2;

  var nextFridayInt = nextFridayInt.setDate(
    nextFridayInt.getDate() + daysToAdd
  );
  var nextSundayInt = nextSundayInt.setDate(
    nextSundayInt.getDate() + daysToAddS
  );

  var nextFridayZulu = new Date(nextFridayInt);
  var nextSundayZulu = new Date(nextSundayInt);
  var nextFridayString =
    nextFridayZulu.getUTCFullYear() +
    "-" +
    (nextFridayZulu.getUTCMonth() + 1) + // adding +1 because months are counted from zero
    "-" +
    nextFridayZulu.getUTCDate();

  var nextSundayString =
    nextSundayZulu.getUTCFullYear() +
    "-" +
    (nextSundayZulu.getUTCMonth() + 1) + // adding +1 because months are counted from zero
    "-" +
    nextSundayZulu.getUTCDate();
  return [nextFridayString, nextSundayString];
}
