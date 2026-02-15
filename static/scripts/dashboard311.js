/* ============================================================
   NYC 311 Data Dashboard - Interactive Visualization
   ============================================================ */

// --- Configuration ---
var CATEGORY_COLORS = {
    noise_residential: "#e74c3c",
    heat_hot_water:    "#e67e22",
    illegal_parking:   "#f1c40f",
    blocked_driveway:  "#2ecc71",
    street_condition:  "#1abc9c",
    noise_street:      "#3498db",
    water_system:      "#9b59b6",
    rodent:            "#8b4513",
    dirty_conditions:  "#7f8c8d",
    noise_commercial:  "#c0392b"
};

var BOROUGH_COLORS = {
    "Manhattan":     "#e74c3c",
    "Brooklyn":      "#3498db",
    "Queens":        "#2ecc71",
    "Bronx":         "#e67e22",
    "Staten Island": "#9b59b6"
};

var MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

var meta = data_311.meta;
var categories = meta.categories;
var zipData = data_311.by_zipcode;
var correlations = data_311.correlations;
var anomalies = data_311.anomalies;
var boroughSummaries = data_311.borough_summaries;

var currentCategory = "total";
var selectedZip = null;

// --- Utility ---
function catName(key) {
    for (var i = 0; i < categories.length; i++) {
        if (categories[i].key === key) return categories[i].name;
    }
    if (key === "total") return "All Categories";
    if (key === "median_income") return "Median Income";
    if (key === "pop_density") return "Pop. Density";
    return key;
}

function formatNum(n) {
    if (n >= 1000000) return (n/1000000).toFixed(1) + "M";
    if (n >= 1000) return (n/1000).toFixed(1) + "K";
    return n.toFixed ? n.toFixed(0) : n;
}

function shortCatName(key) {
    var map = {
        noise_residential: "Noise-Res",
        heat_hot_water: "Heat/HW",
        illegal_parking: "Parking",
        blocked_driveway: "Block Drwy",
        street_condition: "Street",
        noise_street: "Noise-St",
        water_system: "Water",
        rodent: "Rodent",
        dirty_conditions: "Dirty",
        noise_commercial: "Noise-Com",
        median_income: "Income",
        pop_density: "Density"
    };
    return map[key] || key;
}


// ============================================================
// 1. SUMMARY STATS
// ============================================================
function renderStats() {
    var totalComplaints = 0;
    var totalPop = 0;
    var numZips = 0;
    var maxZip = null, maxRate = 0;

    for (var z in zipData) {
        totalComplaints += zipData[z].total || 0;
        totalPop += zipData[z].pop || 0;
        numZips++;
        var r = zipData[z].total_per_1k || 0;
        if (r > maxRate) { maxRate = r; maxZip = z; }
    }

    var stats = [
        {value: formatNum(totalComplaints), label: "Total 311 Complaints"},
        {value: (totalComplaints * 1000 / totalPop).toFixed(1), label: "Complaints per 1K Residents"},
        {value: numZips, label: "NYC Zipcodes"},
        {value: maxZip ? ("NY" + maxZip) : "N/A", label: "Highest Rate Zipcode (" + maxRate.toFixed(0) + "/1K)"}
    ];

    var html = "";
    for (var i = 0; i < stats.length; i++) {
        html += '<div class="stat-card"><div class="stat-value">' + stats[i].value + '</div><div class="stat-label">' + stats[i].label + '</div></div>';
    }
    document.getElementById("stats-row").innerHTML = html;
}


// ============================================================
// 2. CHOROPLETH MAP
// ============================================================
var mapWidth, mapHeight;
var mapSvg, mapG, mapProjection, mapPath;
var mapK = 1, mapX, mapY;

function initMap() {
    var container = document.getElementById("map-container");
    mapWidth = container.offsetWidth || 700;
    mapHeight = Math.max(450, mapWidth * 0.65);

    mapX = mapWidth / 2;
    mapY = mapHeight / 2;

    // Attach data to geojson features
    for (var i = 0; i < zipcodes.features.length; i++) {
        var feat = zipcodes.features[i];
        var zid = feat.id;
        if (zid in zipData) {
            for (var key in zipData[zid]) {
                feat[key] = zipData[zid][key];
            }
            feat._hasData = true;
        } else {
            feat._hasData = false;
        }
    }

    mapProjection = d3.geo.albersUsa()
        .scale(183300 * 0.45)
        .translate([-23700, 5980]);

    mapPath = d3.geo.path().projection(mapProjection);

    var drag = d3.behavior.drag().on("drag", function() {
        var dx = d3.event.dx / mapK;
        var dy = d3.event.dy / mapK;
        mapX -= dx;
        mapY -= dy;
        mapG.attr("transform", "translate(" + mapWidth/2 + "," + mapHeight/2 + ")scale(" + mapK + ")translate(" + (-mapX) + "," + (-mapY) + ")");
    });

    mapSvg = d3.select("#map-container").append("svg")
        .attr("width", mapWidth)
        .attr("height", mapHeight)
        .call(drag);

    mapSvg.append("rect")
        .attr("class", "background")
        .attr("width", mapWidth)
        .attr("height", mapHeight)
        .on("click", function() {
            deselectZip();
        });

    mapG = mapSvg.append("g").attr("id", "zips");

    mapG.selectAll("path")
        .data(zipcodes.features)
        .enter().append("path")
        .attr("d", mapPath)
        .attr("id", function(d) { return "zip-" + d.id; })
        .style("fill", function(d) { return getMapColor(d); })
        .style("opacity", 0.8)
        .on("click", onZipClick)
        .on("mouseover", onZipMouseover)
        .on("mouseout", onZipMouseout);

    // Setup category dropdown
    var sel = document.getElementById("map-category-select");
    sel.innerHTML = '<option value="total">All Categories (total per 1K)</option>';
    for (var c = 0; c < categories.length; c++) {
        sel.innerHTML += '<option value="' + categories[c].key + '">' + categories[c].name + ' (per 1K)</option>';
    }
    sel.onchange = function() {
        currentCategory = this.value;
        updateMapColors();
    };

    updateLegendGradient();
}

function getMapRange() {
    var rateKey = currentCategory + "_per_1k";
    var min = Infinity, max = -Infinity;
    for (var z in zipData) {
        var v = zipData[z][rateKey] || 0;
        if (v > 0 && v < min) min = v;
        if (v > max) max = v;
    }
    if (min === Infinity) min = 0;
    return {min: min, max: max};
}

function getMapColor(d) {
    if (!d._hasData) return "#e0e0e0";
    var rateKey = currentCategory + "_per_1k";
    var val = d[rateKey] || 0;
    if (val === 0) return "#e0e0e0";

    var range = getMapRange();
    if (range.max === range.min) return "#fee08b";

    // Use a sequential color scale: light yellow -> orange -> dark red
    var t = (val - range.min) / (range.max - range.min);
    t = Math.max(0, Math.min(1, t));

    // Power scale for better discrimination
    t = Math.pow(t, 0.6);

    // Interpolate: #ffffcc (low) -> #fd8d3c (mid) -> #800026 (high)
    var r, g, b;
    if (t < 0.5) {
        var t2 = t * 2;
        r = Math.round(255 + (253 - 255) * t2);
        g = Math.round(255 + (141 - 255) * t2);
        b = Math.round(204 + (60 - 204) * t2);
    } else {
        var t2 = (t - 0.5) * 2;
        r = Math.round(253 + (128 - 253) * t2);
        g = Math.round(141 + (0 - 141) * t2);
        b = Math.round(60 + (38 - 60) * t2);
    }
    return "rgb(" + r + "," + g + "," + b + ")";
}

function updateMapColors() {
    mapG.selectAll("path").transition().duration(600)
        .style("fill", function(d) { return getMapColor(d); });
    updateLegendGradient();
}

function updateLegendGradient() {
    var bar = document.getElementById("legend-gradient");
    bar.style.background = "linear-gradient(to right, #ffffcc, #fd8d3c, #800026)";
}

function onZipClick(d) {
    if (!d._hasData) return;
    var centroid = mapPath.centroid(d);
    mapX = centroid[0];
    mapY = centroid[1];
    mapK = 5;

    mapG.transition().duration(800)
        .attr("transform", "translate(" + mapWidth/2 + "," + mapHeight/2 + ")scale(" + mapK + ")translate(" + (-mapX) + "," + (-mapY) + ")")
        .style("stroke-width", 0.8 / mapK + "px");

    selectedZip = d.id;
    showZipDetail(d.id);
}

function onZipMouseover(d) {
    if (!d._hasData) return;

    // Highlight border
    mapG.append("path")
        .attr("d", d3.select(this).attr("d"))
        .attr("id", "zip-hover-highlight")
        .style("fill", "none")
        .style("stroke", "#2c3e50")
        .style("stroke-width", 2.5 / mapK + "px")
        .style("pointer-events", "none");

    var rateKey = currentCategory + "_per_1k";
    var rankKey = "rank_" + currentCategory;
    var tt = document.getElementById("map-tooltip");
    var neighborhood = d.neighborhood || (neighborhoods[d.id] ? neighborhoods[d.id].neighborhood : "");
    var borough = d.borough || (neighborhoods[d.id] ? neighborhoods[d.id].borough : "");

    var html = '<div class="tt-title">NY' + d.id;
    if (neighborhood) html += ': ' + neighborhood;
    html += '</div>';
    if (borough) html += '<span style="font-size:11px;">' + borough + '</span><br/>';
    html += '<span class="tt-value">' + (d[rateKey] || 0).toFixed(1) + '</span> per 1K residents';
    if (d[rankKey]) html += '<br/><span class="tt-rank">Rank: ' + d[rankKey] + ' of 175</span>';

    tt.innerHTML = html;
    tt.style.display = "block";

    var coords = d3.mouse(document.getElementById("map-container"));
    tt.style.left = (coords[0] + 15) + "px";
    tt.style.top = (coords[1] + 10) + "px";
}

function onZipMouseout() {
    d3.select("#zip-hover-highlight").remove();
    document.getElementById("map-tooltip").style.display = "none";
}

function resetMapView() {
    mapX = mapWidth / 2;
    mapY = mapHeight / 2;
    mapK = 1;
    mapG.transition().duration(600)
        .attr("transform", "translate(" + mapWidth/2 + "," + mapHeight/2 + ")scale(1)translate(" + (-mapX) + "," + (-mapY) + ")")
        .style("stroke-width", "0.8px");
    deselectZip();
}

function deselectZip() {
    selectedZip = null;
    document.getElementById("zip-detail").className = "card";
    document.getElementById("zip-welcome").style.display = "block";
}


// ============================================================
// 3. ZIPCODE DETAIL PANEL
// ============================================================
function showZipDetail(zipId) {
    var info = zipData[zipId];
    if (!info) return;

    document.getElementById("zip-welcome").style.display = "none";
    var panel = document.getElementById("zip-detail");
    panel.className = "card active";

    var neighborhood = info.neighborhood || "";
    var borough = info.borough || "";
    document.getElementById("detail-title").textContent = "NY" + zipId + (neighborhood ? ": " + neighborhood : "");
    document.getElementById("detail-meta").innerHTML =
        borough + " &middot; Pop: " + formatNum(info.pop) +
        " &middot; Income: $" + formatNum(info.median_income) +
        " &middot; Total: " + formatNum(info.total) + " complaints (" + info.total_per_1k + "/1K)";

    // Find max rate for bar scaling
    var maxRate = 0;
    for (var c = 0; c < categories.length; c++) {
        var r = info[categories[c].key + "_per_1k"] || 0;
        if (r > maxRate) maxRate = r;
    }

    var barsHtml = "";
    for (var c = 0; c < categories.length; c++) {
        var key = categories[c].key;
        var rate = info[key + "_per_1k"] || 0;
        var rank = info["rank_" + key] || "?";
        var pct = maxRate > 0 ? (rate / maxRate * 100) : 0;
        var color = CATEGORY_COLORS[key] || "#999";
        barsHtml += '<div class="detail-bar-row">';
        barsHtml += '<div class="detail-bar-label" style="color:' + color + ';">' + categories[c].name + '</div>';
        barsHtml += '<div class="detail-bar-bg"><div class="detail-bar-fill" style="width:' + pct + '%; background:' + color + ';"></div></div>';
        barsHtml += '<div class="detail-bar-value">' + rate.toFixed(1) + '/1K<br/>#' + rank + '</div>';
        barsHtml += '</div>';
    }
    document.getElementById("detail-bars").innerHTML = barsHtml;

    // Draw monthly time series for this zipcode
    drawZipTimeSeries(zipId);
}

function drawZipTimeSeries(zipId) {
    var container = document.getElementById("zip-timeseries");
    container.innerHTML = "<div style='font-size:12px;font-weight:400;color:#555;margin-bottom:6px;'>Monthly breakdown</div>";
    var info = zipData[zipId];
    if (!info) return;

    var w = container.offsetWidth || 350;
    var h = 180;
    var margin = {top: 10, right: 10, bottom: 25, left: 35};
    var plotW = w - margin.left - margin.right;
    var plotH = h - margin.top - margin.bottom;

    var svg = d3.select(container).append("svg").attr("width", w).attr("height", h);
    var g = svg.append("g").attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    var x = d3.scale.ordinal().domain(MONTH_NAMES).rangeBands([0, plotW], 0.1);
    var maxY = 0;

    // Compute monthly totals for this zip
    var monthlyData = [];
    for (var m = 0; m < MONTH_NAMES.length; m++) {
        var mn = MONTH_NAMES[m].toLowerCase();
        var val = info["total_" + mn] || 0;
        monthlyData.push({month: MONTH_NAMES[m], value: val});
        if (val > maxY) maxY = val;
    }

    var y = d3.scale.linear().domain([0, maxY * 1.1]).range([plotH, 0]);

    // Bars
    g.selectAll(".month-bar")
        .data(monthlyData)
        .enter().append("rect")
        .attr("x", function(d) { return x(d.month); })
        .attr("y", function(d) { return y(d.value); })
        .attr("width", x.rangeBand())
        .attr("height", function(d) { return plotH - y(d.value); })
        .style("fill", "#3498db")
        .style("opacity", 0.7);

    // X axis
    g.append("g")
        .attr("transform", "translate(0," + plotH + ")")
        .selectAll("text")
        .data(MONTH_NAMES)
        .enter().append("text")
        .attr("x", function(d) { return x(d) + x.rangeBand() / 2; })
        .attr("y", 15)
        .attr("text-anchor", "middle")
        .style("font-size", "9px")
        .style("fill", "#666")
        .text(function(d) { return d; });

    // Y axis (simple)
    g.append("g").selectAll("text")
        .data(y.ticks(4))
        .enter().append("text")
        .attr("x", -5)
        .attr("y", function(d) { return y(d); })
        .attr("text-anchor", "end")
        .attr("dy", "0.35em")
        .style("font-size", "9px")
        .style("fill", "#999")
        .text(function(d) { return formatNum(d); });
}


// ============================================================
// 4. BOROUGH SUMMARY
// ============================================================
function renderBoroughSummary() {
    var container = document.getElementById("borough-summary");
    var maxRate = 0;
    var boroughs = [];
    for (var b in boroughSummaries) {
        boroughs.push({name: b, data: boroughSummaries[b]});
        if (boroughSummaries[b].total_per_1k > maxRate) maxRate = boroughSummaries[b].total_per_1k;
    }
    boroughs.sort(function(a, b) { return b.data.total_per_1k - a.data.total_per_1k; });

    var html = '<div class="borough-bars">';
    for (var i = 0; i < boroughs.length; i++) {
        var b = boroughs[i];
        var pct = (b.data.total_per_1k / maxRate * 100).toFixed(1);
        var color = BOROUGH_COLORS[b.name] || "#999";
        html += '<div class="borough-row">';
        html += '<div class="borough-label">' + b.name + '</div>';
        html += '<div class="borough-bar-bg"><div class="borough-bar-fill" style="width:' + pct + '%; background:' + color + ';"><span>' + b.data.total_per_1k.toFixed(0) + '/1K</span></div></div>';
        html += '</div>';
    }
    html += '</div>';
    container.innerHTML = html;
}


// ============================================================
// 5. CORRELATION MATRIX
// ============================================================
function renderCorrelationMatrix() {
    var keys = [];
    for (var c = 0; c < categories.length; c++) {
        keys.push(categories[c].key);
    }
    keys.push("median_income");
    keys.push("pop_density");

    // Build correlation lookup
    var corrLookup = {};
    for (var pair in correlations) {
        var parts = pair.split("|");
        var k = parts[0] + "|" + parts[1];
        var k2 = parts[1] + "|" + parts[0];
        corrLookup[k] = correlations[pair];
        corrLookup[k2] = correlations[pair];
    }

    var html = '<table class="corr-table"><tr><th></th>';
    for (var i = 0; i < keys.length; i++) {
        html += '<th>' + shortCatName(keys[i]) + '</th>';
    }
    html += '</tr>';

    for (var i = 0; i < keys.length; i++) {
        html += '<tr><td class="row-header">' + shortCatName(keys[i]) + '</td>';
        for (var j = 0; j < keys.length; j++) {
            if (i === j) {
                html += '<td style="background:#2c3e50; color:white; font-weight:700;">1.0</td>';
            } else {
                var k = keys[i] + "|" + keys[j];
                var r = corrLookup[k];
                if (r === undefined) r = 0;
                var bg = corrColor(r);
                var textColor = Math.abs(r) > 0.5 ? "white" : "#333";
                html += '<td style="background:' + bg + '; color:' + textColor + ';">' + r.toFixed(2) + '</td>';
            }
        }
        html += '</tr>';
    }
    html += '</table>';

    document.getElementById("corr-matrix").innerHTML = html;

    // Show strongest correlations
    renderCorrelationInsights(corrLookup, keys);
}

function corrColor(r) {
    // Blue for negative, red for positive, white at 0
    var abs = Math.min(Math.abs(r), 1.0);
    var intensity = Math.round(abs * 200);
    if (r > 0) {
        return "rgb(255," + (255 - intensity) + "," + (255 - intensity) + ")";
    } else {
        return "rgb(" + (255 - intensity) + "," + (255 - intensity) + ",255)";
    }
}

function renderCorrelationInsights(corrLookup, keys) {
    // Find strongest positive and negative correlations
    var pairs = [];
    for (var i = 0; i < keys.length; i++) {
        for (var j = i + 1; j < keys.length; j++) {
            var k = keys[i] + "|" + keys[j];
            var r = corrLookup[k] || 0;
            pairs.push({k1: keys[i], k2: keys[j], r: r});
        }
    }
    pairs.sort(function(a, b) { return Math.abs(b.r) - Math.abs(a.r); });

    var html = '<div style="font-size:12px; color:#555; margin-top:8px;"><strong>Strongest correlations:</strong></div>';
    for (var i = 0; i < Math.min(5, pairs.length); i++) {
        var p = pairs[i];
        var dir = p.r > 0 ? "+" : "";
        var color = p.r > 0 ? "#e74c3c" : "#3498db";
        html += '<div style="font-size:12px; padding:3px 0;">';
        html += '<span style="color:' + color + '; font-weight:400;">' + dir + p.r.toFixed(3) + '</span> ';
        html += catName(p.k1) + ' &harr; ' + catName(p.k2);
        html += '</div>';
    }
    document.getElementById("corr-insights").innerHTML = html;
}


// ============================================================
// 6. ANOMALY DETECTION TABLES
// ============================================================
function renderAnomalies() {
    // Spatial
    var html = '<table class="anomaly-table"><tr><th>Zipcode</th><th>Borough</th><th>Category</th><th>Rate/1K</th><th>Borough Avg</th><th>Z-Score</th><th>Direction</th></tr>';
    var sp = anomalies.spatial;
    for (var i = 0; i < sp.length; i++) {
        var a = sp[i];
        var badgeClass = a.direction === "high" ? "badge-high" : "badge-low";
        html += '<tr>';
        html += '<td><a href="#" onclick="zoomToZip(\'' + a.zipcode + '\'); return false;" style="color:#3498db;">NY' + a.zipcode + '</a></td>';
        html += '<td>' + a.borough + '</td>';
        html += '<td>' + catName(a.category) + '</td>';
        html += '<td>' + a.rate.toFixed(1) + '</td>';
        html += '<td>' + a.borough_avg.toFixed(1) + '</td>';
        html += '<td>' + a.z_score.toFixed(2) + '</td>';
        html += '<td><span class="badge ' + badgeClass + '">' + a.direction.toUpperCase() + '</span></td>';
        html += '</tr>';
    }
    html += '</table>';
    document.getElementById("tab-spatial").innerHTML = html;

    // Temporal
    html = '<table class="anomaly-table"><tr><th>Zipcode</th><th>Category</th><th>Month</th><th>Count</th><th>Monthly Avg</th><th>Z-Score</th></tr>';
    var tp = anomalies.temporal;
    for (var i = 0; i < tp.length; i++) {
        var a = tp[i];
        html += '<tr>';
        html += '<td><a href="#" onclick="zoomToZip(\'' + a.zipcode + '\'); return false;" style="color:#3498db;">NY' + a.zipcode + '</a></td>';
        html += '<td>' + catName(a.category) + '</td>';
        html += '<td>' + a.month + '</td>';
        html += '<td>' + a.count + '</td>';
        html += '<td>' + a.monthly_avg.toFixed(1) + '</td>';
        html += '<td><span class="badge badge-high">' + a.z_score.toFixed(2) + '</span></td>';
        html += '</tr>';
    }
    html += '</table>';
    document.getElementById("tab-temporal").innerHTML = html;

    // Type
    html = '<table class="anomaly-table"><tr><th>Zipcode</th><th>Category</th><th>Local %</th><th>City %</th><th>Ratio</th><th>Direction</th></tr>';
    var ty = anomalies.type;
    for (var i = 0; i < ty.length; i++) {
        var a = ty[i];
        var badgeClass = a.direction === "over" ? "badge-over" : "badge-under";
        html += '<tr>';
        html += '<td><a href="#" onclick="zoomToZip(\'' + a.zipcode + '\'); return false;" style="color:#3498db;">NY' + a.zipcode + '</a></td>';
        html += '<td>' + catName(a.category) + '</td>';
        html += '<td>' + a.local_pct.toFixed(1) + '%</td>';
        html += '<td>' + a.city_pct.toFixed(1) + '%</td>';
        html += '<td>' + a.ratio.toFixed(2) + 'x</td>';
        html += '<td><span class="badge ' + badgeClass + '">' + a.direction.toUpperCase() + '</span></td>';
        html += '</tr>';
    }
    html += '</table>';
    document.getElementById("tab-type").innerHTML = html;
}

function switchTab(tabName) {
    var buttons = document.querySelectorAll(".tab-btn");
    var contents = document.querySelectorAll(".tab-content");
    for (var i = 0; i < buttons.length; i++) {
        buttons[i].className = "tab-btn";
        contents[i].className = "tab-content";
    }
    var tabMap = {spatial: 0, temporal: 1, type: 2};
    var idx = tabMap[tabName] || 0;
    buttons[idx].className = "tab-btn active";
    contents[idx].className = "tab-content active";
}

function zoomToZip(zipId) {
    var feat = null;
    for (var i = 0; i < zipcodes.features.length; i++) {
        if (zipcodes.features[i].id === zipId) {
            feat = zipcodes.features[i];
            break;
        }
    }
    if (feat && feat._hasData) {
        onZipClick(feat);
    }
}


// ============================================================
// 7. KEY INSIGHTS PANEL
// ============================================================
function renderInsights() {
    var insights = [];

    // 1. Borough with highest complaint rate
    var maxBorough = null, maxBRate = 0;
    for (var b in boroughSummaries) {
        if (boroughSummaries[b].total_per_1k > maxBRate) {
            maxBRate = boroughSummaries[b].total_per_1k;
            maxBorough = b;
        }
    }
    if (maxBorough) {
        insights.push({
            text: "<strong>" + maxBorough + "</strong> has the highest complaint rate at <strong>" + maxBRate.toFixed(0) + " per 1,000</strong> residents, suggesting higher service demand or more civic engagement.",
            category: "Borough Analysis"
        });
    }

    // 2. Dominant complaint type
    var catTotals = {};
    for (var c = 0; c < categories.length; c++) {
        catTotals[categories[c].key] = 0;
    }
    for (var z in zipData) {
        for (var c = 0; c < categories.length; c++) {
            catTotals[categories[c].key] += zipData[z][categories[c].key] || 0;
        }
    }
    var maxCat = null, maxCatCount = 0;
    for (var k in catTotals) {
        if (catTotals[k] > maxCatCount) { maxCatCount = catTotals[k]; maxCat = k; }
    }
    if (maxCat) {
        insights.push({
            text: "<strong>" + catName(maxCat) + "</strong> is the most common complaint citywide with <strong>" + formatNum(maxCatCount) + "</strong> complaints, accounting for " + (maxCatCount * 100 / Object.keys(zipData).reduce(function(s,z){ return s + (zipData[z].total||0); }, 0)).toFixed(1) + "% of all 311 calls.",
            category: "Complaint Volume"
        });
    }

    // 3. Strongest income correlation
    var incomeCorrs = [];
    for (var pair in correlations) {
        if (pair.indexOf("median_income") !== -1) {
            var parts = pair.split("|");
            var otherKey = parts[0] === "median_income" ? parts[1] : parts[0];
            incomeCorrs.push({key: otherKey, r: correlations[pair]});
        }
    }
    incomeCorrs.sort(function(a, b) { return Math.abs(b.r) - Math.abs(a.r); });
    if (incomeCorrs.length > 0) {
        var top = incomeCorrs[0];
        var dir = top.r > 0 ? "positively" : "negatively";
        var meaning = top.r > 0
            ? "Higher-income areas see more of these complaints."
            : "Lower-income areas experience disproportionately more of these complaints.";
        insights.push({
            text: "<strong>" + catName(top.key) + "</strong> is most strongly " + dir + " correlated with income (r=" + top.r.toFixed(3) + "). " + meaning,
            category: "Income Correlation"
        });
    }

    // 4. Top spatial anomaly
    if (anomalies.spatial.length > 0) {
        var topA = anomalies.spatial[0];
        var neighborhood = zipData[topA.zipcode] ? zipData[topA.zipcode].neighborhood : "";
        insights.push({
            text: "<strong>NY" + topA.zipcode + "</strong>" + (neighborhood ? " (" + neighborhood + ")" : "") + " has an unusually " + topA.direction + " rate of <strong>" + catName(topA.category) + "</strong> complaints (" + topA.rate.toFixed(1) + "/1K vs borough avg of " + topA.borough_avg.toFixed(1) + "/1K, z=" + topA.z_score.toFixed(2) + ").",
            category: "Spatial Anomaly"
        });
    }

    // 5. Top type anomaly
    if (anomalies.type.length > 0) {
        var topT = anomalies.type[0];
        var desc = topT.direction === "over"
            ? "overrepresented ("+topT.ratio.toFixed(1)+"x the city average)"
            : "underrepresented ("+topT.ratio.toFixed(1)+"x the city average)";
        insights.push({
            text: "In <strong>NY" + topT.zipcode + "</strong>, <strong>" + catName(topT.category) + "</strong> complaints are " + desc + " (" + topT.local_pct.toFixed(1) + "% vs " + topT.city_pct.toFixed(1) + "% citywide).",
            category: "Type Anomaly"
        });
    }

    // 6. Density insight
    var densityCorrs = [];
    for (var pair in correlations) {
        if (pair.indexOf("pop_density") !== -1) {
            var parts = pair.split("|");
            var otherKey = parts[0] === "pop_density" ? parts[1] : parts[0];
            densityCorrs.push({key: otherKey, r: correlations[pair]});
        }
    }
    densityCorrs.sort(function(a, b) { return Math.abs(b.r) - Math.abs(a.r); });
    if (densityCorrs.length > 0) {
        var topD = densityCorrs[0];
        var ddir = topD.r > 0 ? "increases" : "decreases";
        insights.push({
            text: "<strong>" + catName(topD.key) + "</strong> " + ddir + " most strongly with population density (r=" + topD.r.toFixed(3) + "), suggesting " + (topD.r > 0 ? "denser neighborhoods face more of these issues." : "this issue is more common in less dense areas."),
            category: "Density Correlation"
        });
    }

    var html = "";
    for (var i = 0; i < insights.length; i++) {
        html += '<div class="insight-item">';
        html += '<div>' + insights[i].text + '</div>';
        html += '<div class="insight-category">' + insights[i].category + '</div>';
        html += '</div>';
    }
    document.getElementById("insights-panel").innerHTML = html;
}


// ============================================================
// 8. CITYWIDE TIME SERIES CHART
// ============================================================
function renderCitywideTimeSeries() {
    var container = document.getElementById("time-series-container");
    container.innerHTML = "";

    var w = container.offsetWidth || 900;
    var h = 350;
    var margin = {top: 20, right: 150, bottom: 35, left: 50};
    var plotW = w - margin.left - margin.right;
    var plotH = h - margin.top - margin.bottom;

    var svg = d3.select(container).append("svg").attr("width", w).attr("height", h);
    var g = svg.append("g").attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    // Aggregate monthly totals by category
    var seriesData = {};
    for (var c = 0; c < categories.length; c++) {
        seriesData[categories[c].key] = [];
    }

    var maxY = 0;
    for (var m = 0; m < MONTH_NAMES.length; m++) {
        var mn = MONTH_NAMES[m].toLowerCase();
        for (var c = 0; c < categories.length; c++) {
            var key = categories[c].key;
            var total = 0;
            for (var z in zipData) {
                total += zipData[z][key + "_" + mn] || 0;
            }
            seriesData[key].push({month: MONTH_NAMES[m], idx: m, value: total});
            if (total > maxY) maxY = total;
        }
    }

    var x = d3.scale.ordinal().domain(MONTH_NAMES).rangePoints([0, plotW]);
    var y = d3.scale.linear().domain([0, maxY * 1.05]).range([plotH, 0]);

    // Grid
    g.selectAll(".grid-line")
        .data(y.ticks(5))
        .enter().append("line")
        .attr("x1", 0).attr("x2", plotW)
        .attr("y1", function(d) { return y(d); })
        .attr("y2", function(d) { return y(d); })
        .style("stroke", "#eee");

    // Lines
    var line = d3.svg.line()
        .x(function(d) { return x(d.month); })
        .y(function(d) { return y(d.value); });

    for (var c = 0; c < categories.length; c++) {
        var key = categories[c].key;
        var color = CATEGORY_COLORS[key];

        g.append("path")
            .datum(seriesData[key])
            .attr("class", "ts-line")
            .attr("d", line)
            .style("stroke", color);

        // Dots
        g.selectAll(".dot-" + key)
            .data(seriesData[key])
            .enter().append("circle")
            .attr("cx", function(d) { return x(d.month); })
            .attr("cy", function(d) { return y(d.value); })
            .attr("r", 3)
            .style("fill", color);
    }

    // X axis labels
    g.selectAll(".x-label")
        .data(MONTH_NAMES)
        .enter().append("text")
        .attr("x", function(d) { return x(d); })
        .attr("y", plotH + 20)
        .attr("text-anchor", "middle")
        .style("font-size", "11px")
        .style("fill", "#666")
        .text(function(d) { return d; });

    // Y axis
    g.selectAll(".y-label")
        .data(y.ticks(5))
        .enter().append("text")
        .attr("x", -8)
        .attr("y", function(d) { return y(d); })
        .attr("dy", "0.35em")
        .attr("text-anchor", "end")
        .style("font-size", "10px")
        .style("fill", "#999")
        .text(function(d) { return formatNum(d); });

    // Legend
    var legendX = plotW + 15;
    for (var c = 0; c < categories.length; c++) {
        var key = categories[c].key;
        var color = CATEGORY_COLORS[key];
        var ly = c * 17;

        g.append("rect")
            .attr("x", legendX)
            .attr("y", ly)
            .attr("width", 12)
            .attr("height", 12)
            .style("fill", color);

        g.append("text")
            .attr("x", legendX + 16)
            .attr("y", ly + 10)
            .style("font-size", "10px")
            .style("fill", "#555")
            .text(categories[c].name);
    }
}


// ============================================================
// INIT
// ============================================================
function dashboardInit() {
    renderStats();
    initMap();
    renderBoroughSummary();
    renderCorrelationMatrix();
    renderAnomalies();
    renderInsights();
    renderCitywideTimeSeries();
}

// Wait for data and DOM
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", dashboardInit);
} else {
    dashboardInit();
}
