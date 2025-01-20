# this is a copy of the a380 python file, to check the flightradar script

from FlightRadar24 import FlightRadar24API
import json
import time
import datetime
import pytz
import csv
import pymongo
import certifi
from dotenv import load_dotenv
import os


def get_flight_data():
    api = FlightRadar24API()

    # Fetch a list of current flights (assuming such a method exists)
    flights = api.get_flights(
        aircraft_type = "E190" ,
        airline = "KLM",
    )  
    # "A21N"

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
        # print(f"Flight details: {flight_details_json}")  # Print flight details in JSON format
        with open('flight_details.json', 'a') as f:  # Open the file in append mode
            f.write(flight_details_json + "\n")  # Write flight details to the file

    # Load environment variables from .env file
    load_dotenv()
    # bounds = api.get_bounds_by_point(52.3169, 4.7459, 50000) # schiphol coordinates + 50km radius - doesn't work
    bounds = "54.4,2.3,51.4,7.2" # [north latitude, west longitude, east longitude, south latitude]
    # bounds = api.get_bounds(zone)



    # flight_details = api.get_flight_details(flight_number)

    # # Debugging: Print the raw response
    # print(f"Raw response for flight number {flight_number}: {flight_details}")

    # # Check if flight_details is valid before proceeding
    # if flight_details is None:
    #     print(f"Error: No valid flight details returned for {flight_number}.")
    #     return None

    # try:
    #     # Attempt to parse the flight details as JSON
    #     flight_details_json = json.loads(flight_details)
    # except json.JSONDecodeError:
    #     print(f"Error: Failed to decode JSON for flight number {flight_number}. Response: {flight_details}")
    #     return None

    # with open('flight_details.json', 'w') as f:
    #     json.dump(flight_details_json, indent=2, fp=f)



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