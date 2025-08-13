# setup_db.py
import sqlite3
import pandas as pd
import os

CSV = "raipur_localities_crime.csv"
DB = "crime_data.db"

if not os.path.exists(CSV):
    raise FileNotFoundError(f"{CSV} not found. Put your CSV in the project folder.")

df = pd.read_csv(CSV)

conn = sqlite3.connect(DB)
c = conn.cursor()

c.execute("""
CREATE TABLE IF NOT EXISTS crime_data (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    locality TEXT,
    district TEXT,
    latitude REAL,
    longitude REAL,
    crime_rate_per_100k REAL,
    total_crimes INTEGER,
    safety_level TEXT
)
""")

# replace existing rows (so re-running updates DB)
c.execute("DELETE FROM crime_data")

insert_sql = """
INSERT INTO crime_data (locality, district, latitude, longitude, crime_rate_per_100k, total_crimes, safety_level)
VALUES (?, ?, ?, ?, ?, ?, ?)
"""

for _, row in df.iterrows():
    c.execute(insert_sql, (
        row.get("locality"),
        row.get("district"),
        float(row.get("latitude")),
        float(row.get("longitude")),
        float(row.get("crime_rate_per_100k")),
        int(row.get("total_crimes")),
        row.get("safety_level")
    ))

conn.commit()
conn.close()
print(f"✅ {DB} created/updated from {CSV}")
