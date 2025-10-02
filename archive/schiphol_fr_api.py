# this is a copy of the a380 python file, to check the flightradar script

from FlightRadar24 import FlightRadar24API
import json


def get_flight_data():
    api = FlightRadar24API()

    # Fetch a list of current flights (assuming such a method exists)
    bounds = "52.8,51.5,2.5,7.75" # [noord zuid west oost denk ik]

    flights = api.get_flights(
        aircraft_type = "E190" ,
        airline = "KLM",
        bounds = bounds
    )  

    # zone = api.get_zones()["europe"]
    # test_bounds = api.get_bounds(zone)
    # print(test_bounds)
    # Europe: 72.57,33.57,-16.96,53.05
    # 72.57 waarschijnlijk noord
    # 33.57 waarschijnlijk zuid
    # - 16.96 waarschijnlijk west
    # 53.05 waarschijnlijk oost

    # Debugging: Print the raw response
    print(f"Raw response for current flights: {flights}")

    # Print the length of the flights array
    print(f"Number of flights retrieved: {len(flights)}")

    # Check if flights is valid before proceeding
    if flights is None or not isinstance(flights, list) or len(flights) == 0:
        print("Error: No valid flight data returned.")
        return None

    # Get the first three flights and print their flight numbers
    
    for flight in flights:  
        flight_details = api.get_flight_details(flight)  
        flight_details_json = json.dumps(flight_details, indent=2)  # Convert flight details to JSON format
        flight_details_dict = json.loads(flight_details_json)  # Parse JSON string back to dictionary
        
        # Print the default flight number and callsign
        default_number = flight_details_dict["identification"]["number"]["default"]
        callsign = flight_details_dict["identification"]["callsign"]
        print(f"Flight Number: {default_number}, Callsign: {callsign}")
        # print(f"Flight details: {flight_details_json}")  # Print flight details in JSON format
        with open('flight_details.json', 'a') as f:  # Open the file in append mode
            f.write(flight_details_json + "\n")  # Write flight details to the file





if __name__ == "__main__":

    # # take data out of collection
    # cursor = collection.find()

    # # write to file
    # filename = "data.csv"

    # # Open the file in write mode ('w')
    # with open(filename, mode='w', newline='') as file:
    #     csv_writer = csv.writer(file)
    #     for row in cursor:
    #         csv_writer.writerow(row)
    # file.close()

    flight_data=get_flight_data()