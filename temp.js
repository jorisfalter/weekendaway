// ik heb 3pm op vrijdag 16 dec in Griekenland
// ik wil dat converted zien naar UTC
// dus dat is 1pm UTC
// en 10pm JST

function calculateLocalTime(inputDate, inputTimeInHours) {
  var mergedString = inputDate + " " + inputTimeInHours + ":00";
  var inputInBrowserTime = new Date(mergedString.replace(/-/g, "/"));
  // var inputInBrowserTime = new Date(year, month, day, hour);
  var inputInAthensTimeString = inputInBrowserTime.toLocaleString("en-US", {
    timeZone: "Europe/Athens",
  });
  // var inputInAthensTimeString = new Date(year, month, day, hour).toLocaleString(
  //   "en-US",
  //   { timeZone: "Europe/Athens" }
  // );
  var inputInAthensTime = new Date(inputInAthensTimeString);
  console.log(inputInBrowserTime);
  console.log(inputInAthensTimeString);
  console.log(inputInAthensTime);
  var diff = inputInBrowserTime.getTime() - inputInAthensTime.getTime();
  var diffInHours = diff / 1000 / 3600;
  // console.log(diffInHours);
  var correctInputInUtcInMilliseconds = inputInBrowserTime.getTime() + diff;
  // console.log(inputInBrowserTime.getTime());
  // console.log(correctInputInUtcInMilliseconds);
  var correctInputInUtc = new Date(correctInputInUtcInMilliseconds);
  correctInputInUtc.toUTCString();
  // console.log("final solution: " + correctInputInUtc.toUTCString());
  // console.log(correctInputInUtc);
  return correctInputInUtc;
}

const correctInputInUtc = calculateLocalTime("2022-11-16", "15");
console.log(correctInputInUtc);
