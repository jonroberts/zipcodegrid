"""
Tests for the 311 data processing pipeline.

Run with: python -m pytest tests/test_process_311.py -v
"""

import json
import math
import os
import sys
import tempfile

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from process_311 import (
    CATEGORIES,
    CATEGORY_KEYS,
    MONTH_NAMES,
    SEASONAL_WEIGHTS,
    base_rate,
    compute_correlations,
    compute_rankings,
    compute_borough_summaries,
    detect_anomalies,
    generate_sample_data,
    load_zipcode_data,
    load_neighborhoods,
    write_js_file,
)

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TSV_PATH = os.path.join(BASE_DIR, "data", "ZipCodeData_3.4.tsv")
NEIGHBORHOODS_PATH = os.path.join(BASE_DIR, "static", "data", "zip_to_neighborhood.js")


# ---- Fixtures ----

@pytest.fixture(scope="module")
def zip_data():
    return load_zipcode_data(TSV_PATH)


@pytest.fixture(scope="module")
def neighborhood_data():
    return load_neighborhoods(NEIGHBORHOODS_PATH)


@pytest.fixture(scope="module")
def sample_data(zip_data, neighborhood_data):
    return generate_sample_data(zip_data, neighborhood_data)


@pytest.fixture(scope="module")
def ranked_data(sample_data):
    return compute_rankings(sample_data)


# ---- Tests: Data Loading ----

class TestDataLoading:
    def test_load_zipcode_data_returns_dict(self, zip_data):
        assert isinstance(zip_data, dict)

    def test_load_zipcode_data_has_zipcodes(self, zip_data):
        assert len(zip_data) > 100, "Should load at least 100 NYC zipcodes"

    def test_zipcode_has_required_fields(self, zip_data):
        for z in list(zip_data.keys())[:5]:
            info = zip_data[z]
            assert "pop" in info
            assert "median_income" in info
            assert "area" in info
            assert "num_house" in info
            assert info["pop"] >= 0
            assert info["median_income"] >= 0

    def test_known_zipcode_exists(self, zip_data):
        assert "10001" in zip_data, "Chelsea/Clinton zipcode should exist"
        assert zip_data["10001"]["pop"] > 10000

    def test_load_neighborhoods(self, neighborhood_data):
        assert isinstance(neighborhood_data, dict)
        assert len(neighborhood_data) > 100

    def test_neighborhood_has_borough(self, neighborhood_data):
        for z in list(neighborhood_data.keys())[:5]:
            assert "borough" in neighborhood_data[z]
            assert "neighborhood" in neighborhood_data[z]
            assert neighborhood_data[z]["borough"] in [
                "Manhattan", "Brooklyn", "Queens", "Bronx", "Staten Island"
            ]


# ---- Tests: Base Rate Calculation ----

class TestBaseRate:
    def test_returns_positive(self):
        rate = base_rate("noise_residential", 55000, 40000, "Manhattan")
        assert rate > 0

    def test_income_effect_on_heat(self):
        low_income = base_rate("heat_hot_water", 25000, 40000, "Bronx")
        high_income = base_rate("heat_hot_water", 100000, 40000, "Bronx")
        assert low_income > high_income, "Lower income should produce more heat complaints"

    def test_density_effect_on_noise(self):
        high_density = base_rate("noise_residential", 55000, 80000, "Manhattan")
        low_density = base_rate("noise_residential", 55000, 10000, "Manhattan")
        assert high_density > low_density, "Higher density should produce more noise complaints"

    def test_borough_effect_manhattan_noise(self):
        manhattan = base_rate("noise_commercial", 55000, 40000, "Manhattan")
        queens = base_rate("noise_commercial", 55000, 40000, "Queens")
        assert manhattan > queens, "Manhattan should have more commercial noise"

    def test_borough_effect_bronx_heat(self):
        bronx = base_rate("heat_hot_water", 55000, 40000, "Bronx")
        si = base_rate("heat_hot_water", 55000, 40000, "Staten Island")
        assert bronx > si, "Bronx should have more heat complaints than Staten Island"

    def test_all_categories_return_positive(self):
        for cat_key in CATEGORY_KEYS:
            rate = base_rate(cat_key, 55000, 40000, "Brooklyn")
            assert rate > 0, f"Rate for {cat_key} should be positive"


# ---- Tests: Sample Data Generation ----

class TestSampleDataGeneration:
    def test_generates_data_for_all_zipcodes(self, sample_data, zip_data):
        pop_zips = {z for z, info in zip_data.items() if info["pop"] > 0}
        assert set(sample_data.keys()) == pop_zips

    def test_each_zip_has_required_fields(self, sample_data):
        for z in list(sample_data.keys())[:10]:
            info = sample_data[z]
            assert "pop" in info
            assert "borough" in info
            assert "total" in info
            assert "total_per_1k" in info
            for cat_key in CATEGORY_KEYS:
                assert cat_key in info, f"Missing {cat_key}"
                assert cat_key + "_per_1k" in info, f"Missing {cat_key}_per_1k"

    def test_total_equals_sum_of_categories(self, sample_data):
        for z in list(sample_data.keys())[:20]:
            info = sample_data[z]
            cat_sum = sum(info[k] for k in CATEGORY_KEYS)
            assert info["total"] == cat_sum, f"Total mismatch for {z}"

    def test_per_1k_rate_calculation(self, sample_data):
        for z in list(sample_data.keys())[:10]:
            info = sample_data[z]
            expected = round(info["total"] * 1000.0 / info["pop"], 1)
            assert info["total_per_1k"] == expected, f"Rate mismatch for {z}"

    def test_monthly_data_exists(self, sample_data):
        z = list(sample_data.keys())[0]
        info = sample_data[z]
        for month in MONTH_NAMES:
            key = "total_" + month.lower()
            assert key in info, f"Missing monthly total {key}"
            assert info[key] >= 0

    def test_monthly_category_data_exists(self, sample_data):
        z = list(sample_data.keys())[0]
        info = sample_data[z]
        for cat_key in CATEGORY_KEYS:
            for month in MONTH_NAMES:
                key = cat_key + "_" + month.lower()
                assert key in info, f"Missing {key}"

    def test_population_matches_source(self, sample_data, zip_data):
        for z in list(sample_data.keys())[:10]:
            assert sample_data[z]["pop"] == zip_data[z]["pop"]

    def test_deterministic_with_seed(self, zip_data, neighborhood_data):
        data1 = generate_sample_data(zip_data, neighborhood_data)
        data2 = generate_sample_data(zip_data, neighborhood_data)
        z = list(data1.keys())[0]
        assert data1[z]["total"] == data2[z]["total"], "Same seed should produce same data"

    def test_no_negative_counts(self, sample_data):
        for z, info in sample_data.items():
            assert info["total"] >= 0
            for cat_key in CATEGORY_KEYS:
                assert info[cat_key] >= 0


# ---- Tests: Seasonal Weights ----

class TestSeasonalWeights:
    def test_all_categories_have_weights(self):
        for cat_key in CATEGORY_KEYS:
            assert cat_key in SEASONAL_WEIGHTS, f"Missing seasonal weights for {cat_key}"
            assert len(SEASONAL_WEIGHTS[cat_key]) == 12

    def test_noise_peaks_in_summer(self):
        w = SEASONAL_WEIGHTS["noise_residential"]
        summer_avg = (w[5] + w[6] + w[7]) / 3  # Jun, Jul, Aug
        winter_avg = (w[11] + w[0] + w[1]) / 3  # Dec, Jan, Feb
        assert summer_avg > winter_avg, "Noise should peak in summer"

    def test_heat_peaks_in_winter(self):
        w = SEASONAL_WEIGHTS["heat_hot_water"]
        summer_avg = (w[5] + w[6] + w[7]) / 3
        winter_avg = (w[11] + w[0] + w[1]) / 3
        assert winter_avg > summer_avg, "Heat complaints should peak in winter"

    def test_weights_are_positive(self):
        for cat_key in CATEGORY_KEYS:
            for w in SEASONAL_WEIGHTS[cat_key]:
                assert w > 0, f"Weight for {cat_key} should be positive"


# ---- Tests: Rankings ----

class TestRankings:
    def test_rankings_exist(self, ranked_data):
        z = list(ranked_data.keys())[0]
        for cat_key in CATEGORY_KEYS + ["total"]:
            assert "rank_" + cat_key in ranked_data[z]

    def test_rankings_are_contiguous(self, ranked_data):
        n = len(ranked_data)
        for cat_key in CATEGORY_KEYS + ["total"]:
            ranks = sorted(ranked_data[z]["rank_" + cat_key] for z in ranked_data)
            assert ranks == list(range(1, n + 1)), f"Rankings for {cat_key} should be 1..{n}"

    def test_rank_1_has_highest_rate(self, ranked_data):
        for cat_key in CATEGORY_KEYS:
            rate_key = cat_key + "_per_1k"
            rank_key = "rank_" + cat_key
            rank1_zip = None
            max_rate = -1
            for z in ranked_data:
                if ranked_data[z][rank_key] == 1:
                    rank1_zip = z
                if ranked_data[z][rate_key] > max_rate:
                    max_rate = ranked_data[z][rate_key]
            assert ranked_data[rank1_zip][rate_key] == max_rate


# ---- Tests: Correlations ----

class TestCorrelations:
    def test_correlations_computed(self, ranked_data):
        corr = compute_correlations(ranked_data)
        assert isinstance(corr, dict)
        assert len(corr) > 0

    def test_correlation_range(self, ranked_data):
        corr = compute_correlations(ranked_data)
        for pair, r in corr.items():
            assert -1.0 <= r <= 1.0, f"Correlation {pair}={r} out of range"

    def test_known_correlation_direction(self, ranked_data):
        corr = compute_correlations(ranked_data)
        # Heat/hot water should correlate negatively with income
        key = "heat_hot_water|median_income"
        alt_key = "median_income|heat_hot_water"
        r = corr.get(key, corr.get(alt_key, None))
        assert r is not None, "Should have heat vs income correlation"
        assert r < 0, "Heat complaints should negatively correlate with income"

    def test_includes_demographic_correlations(self, ranked_data):
        corr = compute_correlations(ranked_data)
        has_income = any("median_income" in k for k in corr)
        has_density = any("pop_density" in k for k in corr)
        assert has_income, "Should include income correlations"
        assert has_density, "Should include density correlations"

    def test_correlation_pair_count(self, ranked_data):
        corr = compute_correlations(ranked_data)
        # 10 categories + 2 demographics = 12 variables
        # C(12,2) = 66 pairs
        assert len(corr) == 66


# ---- Tests: Anomaly Detection ----

class TestAnomalyDetection:
    def test_anomalies_structure(self, ranked_data):
        anomalies = detect_anomalies(ranked_data)
        assert "spatial" in anomalies
        assert "temporal" in anomalies
        assert "type" in anomalies

    def test_spatial_anomalies_have_fields(self, ranked_data):
        anomalies = detect_anomalies(ranked_data)
        for a in anomalies["spatial"]:
            assert "zipcode" in a
            assert "category" in a
            assert "z_score" in a
            assert "direction" in a
            assert a["direction"] in ("high", "low")
            assert abs(a["z_score"]) > 2.0

    def test_temporal_anomalies_have_fields(self, ranked_data):
        anomalies = detect_anomalies(ranked_data)
        for a in anomalies["temporal"]:
            assert "zipcode" in a
            assert "category" in a
            assert "month" in a
            assert a["month"] in MONTH_NAMES
            assert a["z_score"] > 2.5

    def test_type_anomalies_have_fields(self, ranked_data):
        anomalies = detect_anomalies(ranked_data)
        for a in anomalies["type"]:
            assert "zipcode" in a
            assert "category" in a
            assert "ratio" in a
            assert a["direction"] in ("over", "under")

    def test_anomalies_capped_at_25(self, ranked_data):
        anomalies = detect_anomalies(ranked_data)
        assert len(anomalies["spatial"]) <= 25
        assert len(anomalies["temporal"]) <= 25
        assert len(anomalies["type"]) <= 25

    def test_spatial_anomalies_sorted_by_z_score(self, ranked_data):
        anomalies = detect_anomalies(ranked_data)
        sp = anomalies["spatial"]
        for i in range(1, len(sp)):
            assert abs(sp[i-1]["z_score"]) >= abs(sp[i]["z_score"])


# ---- Tests: Borough Summaries ----

class TestBoroughSummaries:
    def test_all_boroughs_present(self, ranked_data):
        summaries = compute_borough_summaries(ranked_data)
        expected = {"Manhattan", "Brooklyn", "Queens", "Bronx", "Staten Island"}
        assert set(summaries.keys()) == expected

    def test_borough_population_sums(self, ranked_data):
        summaries = compute_borough_summaries(ranked_data)
        total_pop = sum(s["pop"] for s in summaries.values())
        data_pop = sum(ranked_data[z]["pop"] for z in ranked_data)
        assert total_pop == data_pop

    def test_borough_has_per_1k_rates(self, ranked_data):
        summaries = compute_borough_summaries(ranked_data)
        for b, info in summaries.items():
            assert "total_per_1k" in info
            assert info["total_per_1k"] > 0
            for cat_key in CATEGORY_KEYS:
                assert cat_key + "_per_1k" in info


# ---- Tests: JS Output ----

class TestJSOutput:
    def test_write_js_file(self, ranked_data):
        corr = compute_correlations(ranked_data)
        anomalies = detect_anomalies(ranked_data)
        borough_summaries = compute_borough_summaries(ranked_data)

        with tempfile.NamedTemporaryFile(suffix=".js", delete=False, mode='w') as f:
            tmp_path = f.name

        try:
            write_js_file(ranked_data, corr, anomalies, borough_summaries, tmp_path)

            with open(tmp_path, 'r') as f:
                content = f.read()

            assert content.startswith("var data_311 = ")
            assert content.endswith(";\n")

            # Parse the JSON portion
            json_str = content[len("var data_311 = "):-2]
            parsed = json.loads(json_str)

            assert "meta" in parsed
            assert "by_zipcode" in parsed
            assert "correlations" in parsed
            assert "anomalies" in parsed
            assert "borough_summaries" in parsed
            assert len(parsed["by_zipcode"]) == len(ranked_data)
        finally:
            os.unlink(tmp_path)

    def test_existing_data_file_is_valid(self):
        data_path = os.path.join(BASE_DIR, "static", "data", "nyc_311_data.js")
        if not os.path.exists(data_path):
            pytest.skip("Data file not generated yet")

        with open(data_path, 'r') as f:
            content = f.read()

        assert content.startswith("var data_311 = ")
        json_str = content[len("var data_311 = "):-2]
        parsed = json.loads(json_str)

        assert len(parsed["by_zipcode"]) >= 170
        assert len(parsed["meta"]["categories"]) == 10
        assert len(parsed["meta"]["months"]) == 12


# ---- Tests: Category Configuration ----

class TestCategoryConfig:
    def test_category_count(self):
        assert len(CATEGORIES) == 10

    def test_category_keys_unique(self):
        keys = [c[0] for c in CATEGORIES]
        assert len(keys) == len(set(keys))

    def test_month_names(self):
        assert len(MONTH_NAMES) == 12
        assert MONTH_NAMES[0] == "Jan"
        assert MONTH_NAMES[11] == "Dec"
