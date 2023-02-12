//deleteOldData();

    // WIP > move to a separate file
    // problem is that it doesn't remove exactly one week ago. And do I actually want that? Or will I filter in the matching engine?
    // clean database
    // remove all the flights older than 1 week 
    //function deleteOldData(){
        // let todaysDate = new Date();
        // // Departingflight.deleteMany( { departureTimeZulu : {"$lt" : new Date(new Date().getFullYear, new Date().getMonth, new Date().getDate - 7) } })
        // console.log(todaysDate.getDate())
        // console.log(todaysDate)
        // console.log(new Date(todaysDate.getFullYear(), todaysDate.getMonth(), todaysDate.getDate() - 7))
    //}


/// only copy paste - not working 

    const thirtyDaysAgo = new Date(new Date().setDate(new Date().getDate() - 30));

try {
  const { deletedCount } = await Log.deleteMany({ Timestamp: { $lte: thirtyDaysAgo } }).exec()
  console.log(deletedCount, "Logs since", thirtyDaysAgo, "have been cleared")
} catch(e) {
    console.error(e.message)
}



/// only copy paste - not working 
const fireItAllUp = async () => {
    await mongoose.connect(
      "mongodb+srv://joris-mongo:" +
        process.env.ATLAS_KEY +
        "@cluster1.dkcnhgi.mongodb.net/flightsDB",
      { useNewUrlParser: true, useUnifiedTopology: true }
    );
    console.log("mongoose fired up");
  
    // setup the database
    // mongoose.connect("mongodb://localhost:27017/flightsDB", { useNewUrlParser: true }); //?retryWrites=true&w=majority
  
    // setup departure collection
    const departingFlightSchema = new mongoose.Schema({
      TimeOfEntry: Date,
      departureAirport: String,
      departureAirport_iata: String,
      arrivalAirport: String,
      departureTimeZulu: Date,
      departureTimeLocal: String,
      departureTimeDayOfWeek: Number,
      flightNumber: String,
    });
  
    // setup return collection
    const returnFlightSchema = new mongoose.Schema({
      TimeOfEntry: Date,
      departureAirport: String,
      arrivalAirport: String,
      arrivalAirport_iata: String,
      arrivalTimeZulu: Date,
      arrivalTimeLocal: String,
      arrivalTimeDayOfWeek: Number,
      flightNumber: String,
    });
  
    const Departingflight = mongoose.model(
      "Departingflight",
      departingFlightSchema
    );
    const Returnflight = mongoose.model("Returnflight", returnFlightSchema);
  
    // Delete the db when we rerun the query - for testing purposes only
    if (deleteDbAtStart) {
      Departingflight.deleteMany({}, function (err) {
        if (err) {
          console.log(err);
        } else if (!err) {
          console.log("departures db deleted before start");
        }
      });
      Returnflight.deleteMany({}, function (err) {
        if (err) {
          console.log(err);
        } else if (!err) {
          console.log("return db deleted before start");
        }
      });
    }