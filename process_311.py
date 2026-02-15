#!/usr/bin/env python
"""
Fetch and process NYC 311 Service Request data for the dashboard.

Usage:
    python process_311.py --live     # Fetch from NYC Open Data API
    python process_311.py --sample   # Generate realistic sample data

Output: static/data/nyc_311_data.js
"""

import json
import math
import random
import sys
import os

# 311 complaint categories to track (key, display name)
CATEGORIES = [
    ("noise_residential", "Noise - Residential"),
    ("heat_hot_water", "Heat/Hot Water"),
    ("illegal_parking", "Illegal Parking"),
    ("blocked_driveway", "Blocked Driveway"),
    ("street_condition", "Street Condition"),
    ("noise_street", "Noise - Street/Sidewalk"),
    ("water_system", "Water System"),
    ("rodent", "Rodent"),
    ("dirty_conditions", "Dirty Conditions"),
    ("noise_commercial", "Noise - Commercial"),
]

CATEGORY_KEYS = [c[0] for c in CATEGORIES]

# Monthly weights for seasonal patterns (Jan=0..Dec=11)
# noise peaks in summer, heat peaks in winter
SEASONAL_WEIGHTS = {
    "noise_residential":  [0.6, 0.5, 0.7, 0.8, 1.1, 1.5, 1.8, 1.7, 1.2, 0.8, 0.6, 0.5],
    "heat_hot_water":     [2.2, 1.9, 1.2, 0.4, 0.2, 0.1, 0.1, 0.1, 0.2, 0.8, 1.6, 2.2],
    "illegal_parking":    [0.9, 0.8, 1.0, 1.0, 1.1, 1.1, 1.1, 1.0, 1.0, 1.0, 1.0, 0.9],
    "blocked_driveway":   [0.8, 0.8, 0.9, 1.0, 1.1, 1.2, 1.2, 1.1, 1.0, 1.0, 0.9, 0.8],
    "street_condition":   [0.8, 0.9, 1.4, 1.5, 1.2, 0.9, 0.8, 0.8, 0.9, 1.0, 1.0, 0.9],
    "noise_street":       [0.5, 0.4, 0.6, 0.8, 1.2, 1.6, 1.9, 1.8, 1.3, 0.8, 0.5, 0.4],
    "water_system":       [1.0, 1.1, 1.2, 1.0, 0.9, 0.9, 1.0, 1.0, 0.9, 0.9, 1.0, 1.1],
    "rodent":             [0.5, 0.5, 0.7, 1.0, 1.3, 1.5, 1.6, 1.5, 1.3, 1.0, 0.7, 0.5],
    "dirty_conditions":   [0.7, 0.7, 0.9, 1.0, 1.2, 1.3, 1.4, 1.3, 1.1, 1.0, 0.8, 0.7],
    "noise_commercial":   [0.7, 0.6, 0.8, 0.9, 1.1, 1.4, 1.6, 1.5, 1.2, 0.9, 0.7, 0.6],
}

MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
               "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]


def load_zipcode_data(tsv_path):
    """Load zipcode population and income data from the existing TSV."""
    zips = {}
    with open(tsv_path, 'r') as f:
        header = f.readline()  # skip header
        for line in f:
            parts = line.strip().split('\t')
            if len(parts) < 6:
                continue
            zipcode = parts[0]
            if not zipcode.isdigit():
                continue
            zips[zipcode] = {
                "pop": int(parts[3]),
                "num_house": int(parts[4]),
                "median_income": int(parts[5]),
                "area": float(parts[6]),
                "kwh": int(parts[1]),
            }
    return zips


def load_neighborhoods(js_path):
    """Parse the neighborhoods JS file."""
    with open(js_path, 'r') as f:
        content = f.read()
    # Extract the JSON object from the JS variable assignment
    start = content.index('{')
    json_str = content[start:].rstrip().rstrip(';')
    return json.loads(json_str)


def base_rate(category, median_income, pop_density, borough):
    """
    Return a base annual complaint rate per 1000 residents.
    Rates are modulated by income, density, and borough.
    Based on actual NYC 311 patterns.
    """
    # Base rates per 1000 residents (citywide averages)
    base = {
        "noise_residential": 28.0,
        "heat_hot_water": 24.0,
        "illegal_parking": 21.0,
        "blocked_driveway": 14.0,
        "street_condition": 12.0,
        "noise_street": 10.0,
        "water_system": 8.5,
        "rodent": 8.0,
        "dirty_conditions": 6.5,
        "noise_commercial": 5.5,
    }

    rate = base[category]

    # Income effect: lower income areas have more complaints for certain types
    income_factor = 55000.0 / max(median_income, 20000)
    if category in ("heat_hot_water", "dirty_conditions", "water_system"):
        rate *= income_factor ** 1.3
    elif category in ("noise_residential", "rodent"):
        rate *= income_factor ** 0.7

    # Density effect: denser areas have more noise and parking issues
    density_factor = min(pop_density / 40000.0, 3.0)
    if category in ("noise_residential", "noise_street", "noise_commercial"):
        rate *= max(0.4, density_factor ** 0.8)
    elif category in ("illegal_parking", "blocked_driveway"):
        rate *= max(0.3, density_factor ** 0.5)
    elif category == "rodent":
        rate *= max(0.5, density_factor ** 0.6)

    # Borough effects
    borough_mods = {
        "Manhattan": {
            "noise_residential": 1.4, "noise_commercial": 2.0,
            "noise_street": 1.8, "illegal_parking": 0.7,
            "blocked_driveway": 0.3, "rodent": 1.3,
        },
        "Brooklyn": {
            "noise_residential": 1.2, "blocked_driveway": 1.1,
            "rodent": 1.2, "heat_hot_water": 1.1,
        },
        "Bronx": {
            "heat_hot_water": 1.6, "dirty_conditions": 1.4,
            "rodent": 1.3, "water_system": 1.2,
        },
        "Queens": {
            "blocked_driveway": 1.5, "illegal_parking": 1.3,
            "noise_residential": 0.8,
        },
        "Staten Island": {
            "street_condition": 1.3, "rodent": 0.6,
            "noise_residential": 0.5, "heat_hot_water": 0.4,
            "blocked_driveway": 1.2,
        },
    }
    if borough in borough_mods and category in borough_mods[borough]:
        rate *= borough_mods[borough][category]

    return rate


def generate_sample_data(zip_data, neighborhoods):
    """Generate realistic sample 311 data based on population/income/geography."""
    random.seed(42)

    result = {}
    for zipcode, info in zip_data.items():
        pop = info["pop"]
        if pop == 0:
            continue

        borough = neighborhoods.get(zipcode, {}).get("borough", "Manhattan")
        neighborhood = neighborhoods.get(zipcode, {}).get("neighborhood", "Unknown")
        area = max(info["area"], 0.01)
        pop_density = pop / area
        median_income = info["median_income"]

        zip_entry = {
            "pop": pop,
            "borough": borough,
            "neighborhood": neighborhood,
            "area": area,
            "median_income": median_income,
        }

        total_annual = 0
        monthly_totals = {m: 0 for m in MONTH_NAMES}

        for cat_key in CATEGORY_KEYS:
            annual_rate = base_rate(cat_key, median_income, pop_density, borough)
            # Add some randomness (+/- 30%)
            annual_rate *= random.uniform(0.7, 1.3)
            annual_count = int(annual_rate * pop / 1000.0)

            zip_entry[cat_key] = annual_count
            zip_entry[cat_key + "_per_1k"] = round(annual_count * 1000.0 / pop, 1)
            total_annual += annual_count

            # Monthly breakdown
            weights = SEASONAL_WEIGHTS[cat_key]
            total_weight = sum(weights)
            for m_idx, month in enumerate(MONTH_NAMES):
                month_count = int(annual_count * weights[m_idx] / total_weight)
                # Add some monthly noise
                month_count = max(0, month_count + random.randint(-max(1, month_count // 5), max(1, month_count // 5)))
                key = cat_key + "_" + month.lower()
                zip_entry[key] = month_count
                monthly_totals[month] += month_count

        zip_entry["total"] = total_annual
        zip_entry["total_per_1k"] = round(total_annual * 1000.0 / pop, 1)

        for month in MONTH_NAMES:
            zip_entry["total_" + month.lower()] = monthly_totals[month]

        result[zipcode] = zip_entry

    return result


def compute_correlations(data):
    """Compute pairwise Pearson correlations between 311 categories (per-1k rates)."""
    zips = list(data.keys())
    n = len(zips)
    if n < 3:
        return {}

    # Extract per-1k rates for each category
    series = {}
    for cat_key in CATEGORY_KEYS:
        vals = [data[z].get(cat_key + "_per_1k", 0) for z in zips]
        series[cat_key] = vals

    # Also include demographic correlations
    for demo_key in ["median_income", "pop"]:
        vals = [data[z].get(demo_key, 0) for z in zips]
        series[demo_key] = vals

    # Compute density
    series["pop_density"] = [data[z]["pop"] / max(data[z]["area"], 0.01) for z in zips]

    all_keys = CATEGORY_KEYS + ["median_income", "pop_density"]

    def pearson(x, y):
        n = len(x)
        if n == 0:
            return 0
        mx = sum(x) / n
        my = sum(y) / n
        sx = math.sqrt(max(0, sum((xi - mx) ** 2 for xi in x) / n))
        sy = math.sqrt(max(0, sum((yi - my) ** 2 for yi in y) / n))
        if sx == 0 or sy == 0:
            return 0
        cov = sum((x[i] - mx) * (y[i] - my) for i in range(n)) / n
        return round(cov / (sx * sy), 3)

    correlations = {}
    for i, k1 in enumerate(all_keys):
        for k2 in all_keys[i + 1:]:
            r = pearson(series[k1], series[k2])
            correlations[k1 + "|" + k2] = r

    return correlations


def detect_anomalies(data):
    """Detect spatial, temporal, and type anomalies."""
    anomalies = {"spatial": [], "temporal": [], "type": []}

    # --- Spatial anomalies: zipcodes with rates >2 std devs from borough mean ---
    borough_rates = {}
    for z, info in data.items():
        b = info["borough"]
        if b not in borough_rates:
            borough_rates[b] = {}
        for cat_key in CATEGORY_KEYS:
            rate = info.get(cat_key + "_per_1k", 0)
            if cat_key not in borough_rates[b]:
                borough_rates[b][cat_key] = []
            borough_rates[b][cat_key].append((z, rate))

    for borough, cats in borough_rates.items():
        for cat_key, zip_rates in cats.items():
            rates = [r for _, r in zip_rates]
            n = len(rates)
            if n < 3:
                continue
            mean_r = sum(rates) / n
            std_r = math.sqrt(sum((r - mean_r) ** 2 for r in rates) / n)
            if std_r == 0:
                continue
            for z, r in zip_rates:
                z_score = (r - mean_r) / std_r
                if abs(z_score) > 2.0:
                    direction = "high" if z_score > 0 else "low"
                    anomalies["spatial"].append({
                        "zipcode": z,
                        "category": cat_key,
                        "rate": r,
                        "borough_avg": round(mean_r, 1),
                        "z_score": round(z_score, 2),
                        "direction": direction,
                        "borough": borough,
                    })

    # Sort by absolute z_score descending, take top 25
    anomalies["spatial"].sort(key=lambda x: abs(x["z_score"]), reverse=True)
    anomalies["spatial"] = anomalies["spatial"][:25]

    # --- Temporal anomalies: months with unusual spikes for specific zipcodes ---
    for z, info in data.items():
        for cat_key in CATEGORY_KEYS:
            monthly_vals = []
            for m in MONTH_NAMES:
                v = info.get(cat_key + "_" + m.lower(), 0)
                monthly_vals.append((m, v))
            vals = [v for _, v in monthly_vals]
            if not vals or max(vals) == 0:
                continue
            mean_v = sum(vals) / len(vals)
            std_v = math.sqrt(sum((v - mean_v) ** 2 for v in vals) / len(vals))
            if std_v == 0:
                continue
            for month, v in monthly_vals:
                z_score = (v - mean_v) / std_v
                if z_score > 2.5:
                    anomalies["temporal"].append({
                        "zipcode": z,
                        "category": cat_key,
                        "month": month,
                        "count": v,
                        "monthly_avg": round(mean_v, 1),
                        "z_score": round(z_score, 2),
                    })

    anomalies["temporal"].sort(key=lambda x: x["z_score"], reverse=True)
    anomalies["temporal"] = anomalies["temporal"][:25]

    # --- Type anomalies: zipcodes where category mix differs from city average ---
    city_mix = {cat_key: 0 for cat_key in CATEGORY_KEYS}
    city_total = 0
    for z, info in data.items():
        for cat_key in CATEGORY_KEYS:
            city_mix[cat_key] += info.get(cat_key, 0)
            city_total += info.get(cat_key, 0)

    if city_total > 0:
        city_pct = {k: v / city_total for k, v in city_mix.items()}

        for z, info in data.items():
            z_total = info.get("total", 0)
            if z_total < 50:
                continue
            for cat_key in CATEGORY_KEYS:
                z_pct = info.get(cat_key, 0) / z_total
                expected_pct = city_pct[cat_key]
                if expected_pct == 0:
                    continue
                ratio = z_pct / expected_pct
                if ratio > 2.0 or ratio < 0.3:
                    anomalies["type"].append({
                        "zipcode": z,
                        "category": cat_key,
                        "local_pct": round(z_pct * 100, 1),
                        "city_pct": round(expected_pct * 100, 1),
                        "ratio": round(ratio, 2),
                        "direction": "over" if ratio > 1 else "under",
                    })

    anomalies["type"].sort(key=lambda x: abs(x["ratio"] - 1.0), reverse=True)
    anomalies["type"] = anomalies["type"][:25]

    return anomalies


def compute_borough_summaries(data):
    """Compute aggregate stats by borough."""
    boroughs = {}
    for z, info in data.items():
        b = info["borough"]
        if b not in boroughs:
            boroughs[b] = {"pop": 0, "zipcodes": 0}
            for cat_key in CATEGORY_KEYS:
                boroughs[b][cat_key] = 0
            boroughs[b]["total"] = 0

        boroughs[b]["pop"] += info["pop"]
        boroughs[b]["zipcodes"] += 1
        boroughs[b]["total"] += info.get("total", 0)
        for cat_key in CATEGORY_KEYS:
            boroughs[b][cat_key] += info.get(cat_key, 0)

    # Compute per-1k rates
    for b, binfo in boroughs.items():
        pop = max(binfo["pop"], 1)
        binfo["total_per_1k"] = round(binfo["total"] * 1000.0 / pop, 1)
        for cat_key in CATEGORY_KEYS:
            binfo[cat_key + "_per_1k"] = round(binfo[cat_key] * 1000.0 / pop, 1)

    return boroughs


def compute_rankings(data):
    """Compute rankings for each category (1 = highest rate)."""
    for cat_key in CATEGORY_KEYS + ["total"]:
        rate_key = cat_key + "_per_1k"
        zips_sorted = sorted(data.keys(), key=lambda z: data[z].get(rate_key, 0), reverse=True)
        for rank, z in enumerate(zips_sorted, 1):
            data[z]["rank_" + cat_key] = rank
    return data


def write_js_file(data, correlations, anomalies, borough_summaries, output_path):
    """Write the aggregated data as a JavaScript file."""
    categories_meta = []
    for key, name in CATEGORIES:
        categories_meta.append({"key": key, "name": name})

    output = {
        "meta": {
            "source": "NYC Open Data - 311 Service Requests",
            "description": "311 complaint data aggregated by zipcode, population-indexed",
            "year": 2023,
            "categories": categories_meta,
            "months": MONTH_NAMES,
        },
        "by_zipcode": data,
        "correlations": correlations,
        "anomalies": anomalies,
        "borough_summaries": borough_summaries,
    }

    js_content = "var data_311 = " + json.dumps(output, indent=None, separators=(',', ':')) + ";\n"

    with open(output_path, 'w') as f:
        f.write(js_content)

    print("Wrote %s (%.1f KB)" % (output_path, len(js_content) / 1024.0))
    print("  %d zipcodes" % len(data))
    print("  %d correlation pairs" % len(correlations))
    print("  %d spatial anomalies" % len(anomalies["spatial"]))
    print("  %d temporal anomalies" % len(anomalies["temporal"]))
    print("  %d type anomalies" % len(anomalies["type"]))


def try_fetch_live_data():
    """
    Fetch real 311 data from the NYC Open Data Socrata API.
    Requires the 'requests' package.
    Returns dict of {zipcode: {category: count}} or None on failure.
    """
    try:
        import requests
    except ImportError:
        print("requests library not available. Use --sample instead.")
        return None

    endpoint = "https://data.cityofnewyork.us/resource/erm2-nwe9.json"

    # Map API complaint types to our category keys
    type_map = {
        "Noise - Residential": "noise_residential",
        "HEAT/HOT WATER": "heat_hot_water",
        "Illegal Parking": "illegal_parking",
        "Blocked Driveway No Access": "blocked_driveway",
        "Street Condition": "street_condition",
        "Noise - Street/Sidewalk": "noise_street",
        "Water System": "water_system",
        "Rodent": "rodent",
        "Dirty Conditions": "dirty_conditions",
        "Noise - Commercial": "noise_commercial",
    }

    complaint_types = list(type_map.keys())
    quoted = ",".join("'%s'" % t for t in complaint_types)

    # Fetch counts grouped by zipcode, complaint type, and month
    query = (
        "$select=incident_zip,complaint_type,date_extract_m(created_date) as month,count(*) as cnt"
        "&$where=created_date between '2023-01-01' and '2023-12-31'"
        " AND complaint_type in(%s)"
        " AND incident_zip IS NOT NULL"
        "&$group=incident_zip,complaint_type,month"
        "&$limit=50000"
    ) % quoted

    print("Fetching 311 data from NYC Open Data...")
    try:
        resp = requests.get(endpoint, params={"$query": query}, timeout=60)
        resp.raise_for_status()
        rows = resp.json()
    except Exception as e:
        print("API request failed: %s" % e)
        return None

    # Aggregate
    result = {}
    for row in rows:
        z = str(row.get("incident_zip", "")).strip()
        if len(z) != 5 or not z.isdigit():
            continue
        ctype = row.get("complaint_type", "")
        month_num = int(row.get("month", 0))
        count = int(row.get("cnt", 0))

        cat_key = type_map.get(ctype)
        if not cat_key or month_num < 1 or month_num > 12:
            continue

        if z not in result:
            result[z] = {}
        if cat_key not in result[z]:
            result[z][cat_key] = {"annual": 0, "monthly": {}}

        result[z][cat_key]["annual"] += count
        month_name = MONTH_NAMES[month_num - 1].lower()
        result[z][cat_key]["monthly"][month_name] = \
            result[z][cat_key]["monthly"].get(month_name, 0) + count

    print("Fetched data for %d zipcodes" % len(result))
    return result


def merge_live_data(live_data, zip_data, neighborhoods):
    """Merge live API data with population/demographic data."""
    result = {}
    for zipcode, cats in live_data.items():
        if zipcode not in zip_data:
            continue
        info = zip_data[zipcode]
        pop = info["pop"]
        if pop == 0:
            continue

        borough = neighborhoods.get(zipcode, {}).get("borough", "Unknown")
        neighborhood = neighborhoods.get(zipcode, {}).get("neighborhood", "Unknown")

        entry = {
            "pop": pop,
            "borough": borough,
            "neighborhood": neighborhood,
            "area": info["area"],
            "median_income": info["median_income"],
        }

        total_annual = 0
        monthly_totals = {m.lower(): 0 for m in MONTH_NAMES}

        for cat_key in CATEGORY_KEYS:
            cat_data = cats.get(cat_key, {"annual": 0, "monthly": {}})
            annual = cat_data["annual"]
            entry[cat_key] = annual
            entry[cat_key + "_per_1k"] = round(annual * 1000.0 / pop, 1)
            total_annual += annual

            for m in MONTH_NAMES:
                ml = m.lower()
                mc = cat_data["monthly"].get(ml, 0)
                entry[cat_key + "_" + ml] = mc
                monthly_totals[ml] += mc

        entry["total"] = total_annual
        entry["total_per_1k"] = round(total_annual * 1000.0 / pop, 1)
        for m in MONTH_NAMES:
            entry["total_" + m.lower()] = monthly_totals[m.lower()]

        result[zipcode] = entry

    return result


def main():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    tsv_path = os.path.join(base_dir, "data", "ZipCodeData_3.4.tsv")
    neighborhoods_path = os.path.join(base_dir, "static", "data", "zip_to_neighborhood.js")
    output_path = os.path.join(base_dir, "static", "data", "nyc_311_data.js")

    zip_data = load_zipcode_data(tsv_path)
    neighborhoods = load_neighborhoods(neighborhoods_path)

    use_live = "--live" in sys.argv

    if use_live:
        live_data = try_fetch_live_data()
        if live_data:
            data = merge_live_data(live_data, zip_data, neighborhoods)
        else:
            print("Falling back to sample data generation.")
            data = generate_sample_data(zip_data, neighborhoods)
    else:
        data = generate_sample_data(zip_data, neighborhoods)

    data = compute_rankings(data)
    correlations = compute_correlations(data)
    anomalies = detect_anomalies(data)
    borough_summaries = compute_borough_summaries(data)

    write_js_file(data, correlations, anomalies, borough_summaries, output_path)


if __name__ == "__main__":
    main()
