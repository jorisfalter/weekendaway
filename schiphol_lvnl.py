import requests
# purpose is to check if i can use the dev tools cookie to fetch runway usage
# somehow you need to give a header

url = "https://en.lvnl.nl/runway/get"
payload = [2025, 2, 10, 13, 20]
headers = {
    "Accept": "application/json, text/plain, */*",
    "Content-Type": "application/json",
    "Cache-Control": "no-cache",
    "Pragma": "no-cache",
    "Origin": "https://en.lvnl.nl",
    "Referer": "https://en.lvnl.nl/runway-use",
}

response = requests.post(url, json=payload, headers=headers)
print(response.json())  # Print API response

