airportsList = [
  ["ORY", "Paris Orly", 0, 0],
  ["MAD", "Madrid", 40.4719, -3.56264],
  ["BCN", "Barcelona", 41.2971, 2.07846],
  ["OPO", "Porto", 41.2481, -8.68139],
  ["AMS", "Amsterdam", 52.3086, 4.76389],
  ["FNC", "Funchal", 32.6979, -16.7745],
  ["LHR", "London Heathrow", 0, 0],
  ["GVA", "Geneva", 46.2381, 6.10895],
  ["BRU", "Brussels", 50.9014, 4.48444],
  ["RAK", "Marrakesh", 31.6069, -8.0363],
  ["MUC", "Munich", 48.3538, 11.7861],
  ["IST", "Istanbul", 41.2753, 28.7519],
  ["FRA", "Frankfurt", 50.0333, 8.57056],
  ["CIA", "Rome Ciampino", 0, 0],
  ["CDG", "Paris Charles de Gaulle", 0, 0],
  ["VIE", "Vienna", 48.1103, 16.5697],
  ["TER", "Terceira Azores", 38.7618, -27.0908],
  ["BIO", "Bilbao", 43.3011, -2.91061],
  ["STN", "London Stansted", 0, 0],
  ["HEL", "Helsinki", 60.3172, 24.9633],
  ["ZRH", "Zurich", 47.4647, 8.54917],
  ["PDL", "Ponta Delgada", 37.7412, -25.6979],
  ["SOF", "Sofia", 42.6967, 23.4114],
  ["LGW", "London Gatwick", 0, 0],
  ["NCE", "Nice", 43.6584, 7.21587],
  ["BOD", "Bordeaux", 44.8283, -0.715556],
  ["BER", "Berlin", 52.3514, 13.4939],
  ["CRL", "Brussels Charleroi", 50.4592, 4.45382],
  ["CMN", "Casablanca", 33.3675, -7.58997],
  ["LYS", "Lyon", 45.7256, 5.08111],
  ["DUB", "Dublin", 53.4213, -6.27007],
  ["LPA", "Las Palmas Gran Canaria", 27.9319, -15.3866],
  ["HAM", "Hamburg", 53.6304, 9.98823],
  ["MXP", "Milan Malpensa", 45.6306, 8.72811],
  ["MRS", "Marseille", 43.4393, 5.22142],
  ["FCO", "Rome Fiumicino", 0, 0],
  ["SVQ", "Seville", 37.418, -5.89311],
  ["VCE", "Venice", 45.5053, 12.3519],
  ["DUS", "Dusseldorf", 51.2895, 6.76678],
  ["MAN", "Manchester", 53.3537, -2.27495],
  ["ARN", "Stockholm Arlanda", 0, 0],
  ["WAW", "Warsaw", 52.1657, 20.9671],
  ["LAD", "Luanda", -8.85837, 13.2312],
  ["LUX", "Luxembourg", 49.6233, 6.20444],
  ["ALC", "Alicante", 38.2822, -0.558156],
  ["FAO", "Faro", 37.0144, -7.96591],
  ["BVA", "Paris Beauvais", 0, 0],
  ["NTE", "Nantes", 47.1532, -1.61073],
  ["DXB", "Dubai", 25.2528, 55.3644],
  ["VLC", "Valencia", 39.4893, -0.481625],
  ["RAI", "Praia Cape Verde", 14.9245, -23.4935],
  ["LTN", "London Luton", 0, 0],
  ["CPH", "Copenhagen", 55.6179, 12.656],
  ["FLR", "Florence", 43.81, 11.2051],
  ["TLS", "Toulouse", 43.6291, 1.36382],
  ["PRG", "Prague", 50.1008, 14.26],
  ["AGP", "Malaga", 36.6749, -4.49911],
  ["BLQ", "Bologna", 44.5354, 11.2887],
  ["SID", "Sal Cape Verde", 16.7414, -22.9494],
  ["VXE", "Sao Vicente Cape Verde", 16.8332, -25.0553],
  ["CGK", "Jakarta", 0, 0],
  ["DFW", "Dallas Fort Worth", 32.8968, -97.038],
  ["IAD", "Washington Dulles", 38.9445, -77.4558],
  ["PHX", "Phoenix", 33.4343, -112.012],
  ["DAL", "Dallas Love Field", 32.8471, -96.8518],
  ["DTW", "Detroit", 0, 0],
  ["IAH", "Houston George Bush", 29.9844, -95.3414],
  ["HOU", "Houston Hobby", 29.6454, -95.2789],
  ["BNA", "Nashville", 36.1245, -86.6782],
  ["SAN", "San Diego", 32.7336, -117.19],
  ["BOS", "Boston Logan", 42.3643, -71.0052],
  ["BWI", "Baltimore Washington", 0, 0],
  ["RDI", "Raleigh–Durham", 0, 0],
  ["MCO", "Orlando International Airport", 28.4294, -81.309],
  ["JFK", "New York JFK ", 0, 0],
  ["MIA", "Miami", 25.7932, -80.2906],
  ["KUL", "Kuala Lumpur", 2.74558, 101.71],
  ["SEA", "Seattle Tacoma", 47.449, -122.309],
  ["LAX", "Los Angeles", 33.9425, -118.408],
  ["TUL", "Tulsa", 36.1984, -95.8881],
  ["FLL", "Fort Lauderdale", 26.0726, -80.1527],
  ["DEN", "Denver", 39.8617, -104.673],
  ["ATL", "Atlanta", 33.6367, -84.4281],
  ["SLC", "Salt Lake City International", 40.7884, -111.978],
  ["AMA", "Amarillo", 35.2194, -101.706],
  ["SEA", "Seattle-Tacoma", 47.449, -122.309],
  ["LAS", "Las Vegas", 36.0801, -115.152],
  ["SIN", "Singapore", 1.35019, 103.994],
  ["NST", "Nakhon Si Thammarat", 8.53962, 99.9447],
  ["CSX", "Changsha Huanghua", 28.1892, 113.22],
  ["HDY", "Hat Yai", 6.93321, 100.393],
  ["HKT", "Phuket", 8.1132, 98.3169],
  ["TPA", "Tampa", 27.9755, -82.5332],
  ["MDW", "Chicago Midway", 0, 0],
  ["ORD", "Chicago O'Hare", 0, 0],
  ["NKG", "Nanjing Lukou", 31.742, 118.862],
  ["TPE", "Taipei Taoyuan", 25.0777, 121.233],
  ["CNX", "Chiang Mai", 18.7668, 98.9626],
  ["KOP", "Nakhon Phanom", 17.3838, 104.643],
  ["SGN", "Ho Chi Minh City", 10.8188, 106.652],
  ["WUH", "Wuhan Tianhe", 30.7838, 114.208],
  ["KKC", "Khon Kaen", 16.4666, 102.784],
  ["REP", "Siem Reap", 13.4107, 103.813],
  ["KBV", "Krabi", 8.09912, 98.9862],
  ["SYD", "Sydney", -33.9461, 151.177],
  ["UTH", "Udon Thani", 17.3864, 102.788],
  ["HKG", "Hong Kong", 22.3089, 113.915],
  ["JED", "Jeddah", 21.6796, 39.1565],
  ["LPQ", "Luang Prabang", 19.8973, 102.161],
  ["DPS", "Bali", -8.74817, 115.167],
  ["URT", "Surat Thani", 9.1326, 99.1356],
  ["BFV", "Buri Ram", 15.2295, 103.253],
  ["UNN", "Ranong", 9.77762, 98.5855],
  ["UBP", "Ubon Ratchathani", 15.2513, 104.87],
  ["PHS", "Phitsanulok", 16.7829, 100.279],
  ["LOE", "Loei", 17.4391, 101.722],
  ["XIY", "Xi'an Xianyang", 34.4471, 108.752],
  ["SWA", "Jieyang Chaoshan", 23.552, 116.503],
  ["PNH", "Phnom Penh", 11.5466, 104.844],
  ["USM", "Samui", 9.54779, 100.062],
  ["DEL", "Delhi", 28.5665, 77.1031],
  ["DAD", "Da Nang", 16.0439, 108.199],
  ["ICN", "Seoul Incheon", 0, 0],
  ["MCT", "Muscat", 23.5933, 58.2844],
  ["HND", "Tokyo Haneda", 0, 0],
  ["DAC", "Dhaka", 23.8433, 90.3978],
  ["NRT", "Tokyo Narita", 0, 0],
  ["CEI", "Chiang Rai", 19.9523, 99.8829],
  ["JHB", "Johor Bahru", 1.64131, 103.67],
  ["KHH", "Kaohsiung International", 22.5771, 120.35],
  ["HAN", "Hanoi", 21.2212, 105.807],
  ["EIN", "Eindhoven", 51.4501, 5.37453],
  ["NAW", "Narathiwat", 6.51992, 101.743],
  ["MNL", "Manila", 14.5086, 121.02],
  ["TFU", "Chengdu Tianfu", 30.319, 104.445],
  ["SFO", "San Francisco", 37.619, -122.375],
  ["SJC", "San Jose (California)", 37.3626, -121.929],
  ["MSY", "New Orleans Louis Armstrong", 29.9934, -90.258],
  ["ELP", "El Paso", 31.8072, -106.378],
  ["SDF", "Louisville (Kentucky)", 38.1744, -85.736],
  ["CLT", "Charlotte Douglas", 35.214, -80.9431],
  ["HRL", "Harlingen", 26.2285, -97.6544],
  ["LGB", "Long Beach", 33.8177, -118.152],
  ["CHS", "Charleston", 32.8986, -80.0405],
  ["YYZ", "Toronto Pearson", 0, 0],
  ["EWR", "New York Newark", 0, 0],
  ["RDU", "Raleigh-Durham", 35.8776, -78.7875],
  ["MSP", "Minneapolis−Saint Paul", 44.882, -93.2218],
  ["JAX", "Jacksonville (Florida)", 30.4941, -81.6879],
  ["ABQ", "Albuquerque", 35.0402, -106.609],
  ["STL", "St. Louis Lambert", 38.7487, -90.37],
  ["PHL", "Philadelphia", 39.8719, -75.2411],
  ["IND", "Indianapolis", 39.7173, -86.2944],
  ["CVG", "Cincinnati", 39.0488, -84.6678],
  ["OKC", "Will Rogers", 35.3931, -97.6007],
];
module.exports = airportsList;