# app.py
from flask import Flask, render_template, request, jsonify
import sqlite3
from geopy.distance import geodesic
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "crime_data.db")

app = Flask(__name__, static_folder="static", template_folder="templates")

def db_rows_to_dicts(rows, cols):
    return [dict(zip(cols, r)) for r in rows]

def get_all_zones():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("SELECT locality, district, latitude, longitude, crime_rate_per_100k, total_crimes, safety_level FROM crime_data")
    rows = c.fetchall()
    conn.close()
    cols = ["locality", "district", "latitude", "longitude", "crime_rate_per_100k", "total_crimes", "safety_level"]
    return db_rows_to_dicts(rows, cols)

def find_nearest(lat, lon):
    zones = get_all_zones()
    best = None
    best_dist = None
    for z in zones:
        try:
            d = geodesic((lat, lon), (float(z["latitude"]), float(z["longitude"]))).km
        except Exception:
            continue
        if best is None or d < best_dist:
            best = z
            best_dist = d
    return best, best_dist

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/zones")
def zones():
    """Return all zones (localities) with their coordinates and stats."""
    try:
        zones = get_all_zones()
        return jsonify(zones)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/crime-info")
def crime_info():
    """
    Query params: lat, lon
    Returns crime info for nearest locality and distance (km).
    """
    lat = request.args.get("lat", type=float)
    lon = request.args.get("lon", type=float)
    if lat is None or lon is None:
        return jsonify({"error": "lat and lon required"}), 400

    try:
        nearest, dist_km = find_nearest(lat, lon)
        if not nearest:
            return jsonify({"error": "No data available"}), 404

        # determine bar_color by crime_rate_per_100k
        rating = float(nearest.get("crime_rate_per_100k", 0))
        # choose thresholds based on your dataset; adjust as needed
        if rating <= 200:
            bar_color = "green"
        elif rating <= 320:
            bar_color = "orange"
        else:
            bar_color = "red"

        # compute bar length relative to max in DB
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        c.execute("SELECT MAX(crime_rate_per_100k) FROM crime_data")
        max_rating = c.fetchone()[0] or 500.0
        conn.close()

        filled = int((rating / max_rating) * 10) if max_rating > 0 else 0
        filled = min(max(filled, 0), 10)
        bar = "█" * filled + "-" * (10 - filled)

        result = {
            "locality": nearest.get("locality"),
            "district": nearest.get("district"),
            "crime_rate_per_100k": rating,
            "total_crimes": int(nearest.get("total_crimes", 0)),
            "safety_level": nearest.get("safety_level"),
            "distance_km": round(dist_km, 3),
            "bar": bar,
            "bar_color": bar_color
        }
        return jsonify(result)
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    if not os.path.exists(DB_PATH):
        print("crime_data.db not found — run setup_db.py first.")
    app.run(debug=True)
