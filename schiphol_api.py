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


    # Load environment variables from .env file
    load_dotenv()
    # bounds = api.get_bounds_by_point(52.3169, 4.7459, 50000) # schiphol coordinates + 50km radius - doesn't work
    bounds = "54.4,2.3,51.4,7.2" # [north latitude, west longitude, east longitude, south latitude]
    # bounds = api.get_bounds(zone)



    for flight in api.get_flights(bounds = bounds):
    # for flight in api.get_flights(aircraft_type="A388"):
        flight_details = api.get_flight_details(flight)


        with open('flight_details.json', 'w') as f:
            json.dump(flight_details, indent=2, fp=f)



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