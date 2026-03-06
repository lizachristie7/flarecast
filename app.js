let flareData = [];
let combinedChart, forecastChart;

// --- Current weather & flare risk ---
async function getWeather() {
    const result = document.getElementById("weatherResult");
    result.innerHTML = "Loading...";

    if (!navigator.geolocation) {
        result.innerHTML = "Geolocation not supported";
        return;
    }

    navigator.geolocation.getCurrentPosition(async (position) => {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;

        try {
            const weather = await fetch(
                `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&hourly=pressure_msl,temperature_2m,relative_humidity_2m`
            );
            const data = await weather.json();
            const temp = data.current_weather.temperature;
            const pressure = data.current_weather.pressure;
            const humidity = data.current_weather.humidity || 70;

            let risk = "Low";
            if (pressure < 1005 || humidity > 80) risk = "High";
            else if (pressure < 1012) risk = "Moderate";

            result.innerHTML = `
                <p>Temperature: ${temp}°C</p>
                <p>Pressure: ${pressure} hPa</p>
                <p>Humidity: ${humidity}%</p>
                <h3 style="color:${risk==="High"?'red':risk==="Moderate"?'orange':'green'}">
                    ${risk==="High"?'🔴':risk==="Moderate"?'🟠':'🟢'} Flare Risk: ${risk}
                </h3>
            `;

            if (flareData.length >= 24) flareData.shift();
            flareData.push({ time: new Date().toLocaleString(), riskValue: pressure });
            updateCombinedChart();

        } catch {
            result.innerHTML = "Weather service error";
        }
    });
}

// --- Pain slider ---
function updatePainLabel(value) {
    document.getElementById("painLabel").innerText = value;
}

// --- Log pain ---
function logPain() {
    const value = document.getElementById("painSlider").value;
    let logs = JSON.parse(localStorage.getItem("painLogs") || "[]");
    logs.push({ id: Date.now(), time: new Date().toLocaleString(), level: parseInt(value) });
    localStorage.setItem("painLogs", JSON.stringify(logs));
    document.getElementById("painMessage").innerText = `Logged pain level: ${value}/10`;
    document.getElementById("painSlider").value = 0;
    updatePainLabel(0);
    renderPainTable();
    updateCombinedChart();
}

// --- Render table ---
function renderPainTable() {
    const tbody = document.querySelector("#painTable tbody");
    let logs = JSON.parse(localStorage.getItem("painLogs") || "[]");
    tbody.innerHTML = "";
    logs.forEach(log => {
        const tr = document.createElement("tr");
        tr.innerHTML = `<td>${log.time}</td><td>${log.level}</td>
            <td><button onclick="editLog(${log.id})">Edit</button></td>
            <td><button onclick="deleteLog(${log.id})">Delete</button></td>`;
        tbody.appendChild(tr);
    });
}

// --- Edit/Delete logs ---
function editLog(id) {
    let logs = JSON.parse(localStorage.getItem("painLogs") || "[]");
    const log = logs.find(l => l.id === id);
    const newLevel = prompt("Edit pain level (0-10):", log.level);
    if (newLevel !== null) {
        log.level = parseInt(newLevel);
        localStorage.setItem("painLogs", JSON.stringify(logs));
        renderPainTable();
        updateCombinedChart();
    }
}

function deleteLog(id) {
    let logs = JSON.parse(localStorage.getItem("painLogs") || "[]");
    logs = logs.filter(l => l.id !== id);
    localStorage.setItem("painLogs", JSON.stringify(logs));
    renderPainTable();
    updateCombinedChart();
}

// --- Combined chart (pain with flare risk colored points) ---
function updateCombinedChart() {
    const ctx = document.getElementById('combinedChart').getContext('2d');
    let logs = JSON.parse(localStorage.getItem("painLogs") || "[]");
    let recentLogs = logs.slice(-10);

    const labels = recentLogs.map(l => l.time.split(',')[1] || l.time);
    const painData = recentLogs.map(l => l.level);

    const flareColors = recentLogs.map(l => {
        let closest = flareData.reduce((prev, curr) => {
            return Math.abs(new Date(curr.time) - new Date(l.time)) <
                Math.abs(new Date(prev.time) - new Date(l.time)) ? curr : prev;
        }, flareData[0] || { riskValue: 1015 });

        if (closest.riskValue < 1005) return '#E36A6A';
        else if (closest.riskValue < 1012) return '#FFA500';
        else return '#6ACB6A';
    });

    if (!combinedChart) {
        combinedChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Pain Level (0-10)',
                    data: painData,
                    borderColor: '#E36A6A',
                    backgroundColor: 'rgba(227,106,106,0.3)',
                    fill: true,
                    tension: 0.3,
                    pointRadius: 6,
                    pointBackgroundColor: flareColors,
                    pointBorderColor: flareColors,
                    pointHoverRadius: 10
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                const i = context.dataIndex;
                                let colorName = flareColors[i] === '#E36A6A' ? 'High 🔴' :
                                    flareColors[i] === '#FFA500' ? 'Moderate 🟠' : 'Low 🟢';
                                return `Pain: ${context.parsed.y}/10  Flare Risk: ${colorName}`;
                            }
                        }
                    },
                    legend: { labels: { font: { size: 14 } } }
                },
                scales: {
                    y: {
                        min: 0,
                        max: 10,
                        title: { display: true, text: 'Pain Level', font: { size: 14 } }
                    },
                    x: { ticks: { font: { size: 14 } } }
                }
            }
        });
    } else {
        combinedChart.data.labels = labels;
        combinedChart.data.datasets[0].data = painData;
        combinedChart.data.datasets[0].pointBackgroundColor = flareColors;
        combinedChart.data.datasets[0].pointBorderColor = flareColors;
        combinedChart.update();
    }
}

// --- 7-day forecast ---
async function get7DayForecast() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(async (position) => {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;
        try {
            const forecast = await fetch(
                `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=pressure_msl_max,pressure_msl_min,relative_humidity_2m_max,relative_humidity_2m_min&timezone=auto`
            );
            const data = await forecast.json();
            const labels = data.daily.time;
            const riskData = labels.map((d, i) => {
                const pressure = (data.daily.pressure_msl_max[i] + data.daily.pressure_msl_min[i]) / 2;
                const humidity = (data.daily.relative_humidity_2m_max[i] + data.daily.relative_humidity_2m_min[i]) / 2;
                if (pressure < 1005 || humidity > 80) return 2;
                else if (pressure < 1012) return 1;
                else return 0;
            });
            updateForecastChart(labels, riskData);
        } catch { console.log("7-day forecast error"); }
    });
}

// --- Forecast chart (minimal, colored bars with readable dates) ---
function updateForecastChart(labels, data) {
    const ctx = document.getElementById('forecastChart').getContext('2d');

    // Convert YYYY-MM-DD labels into readable format
    const formattedLabels = labels.map(dateStr => {
        const d = new Date(dateStr);
        return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
    });

    const barColors = data.map(d => d === 2 ? '#E36A6A' : d === 1 ? '#FFA500' : '#6ACB6A');
    const riskLabels = data.map(d => d === 2 ? 'High 🔴' : d === 1 ? 'Moderate 🟠' : 'Low 🟢');

    if (!forecastChart) {
        forecastChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: formattedLabels,
                datasets: [{
                    label: 'Flare Risk',
                    data: data.map(() => 1),
                    backgroundColor: barColors,
                    borderRadius: 15,
                    borderSkipped: false
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                const i = context.dataIndex;
                                return `Flare Risk: ${riskLabels[i]}`;
                            }
                        }
                    },
                    datalabels: {
                        display: true,
                        color: '#000',
                        anchor: 'end',
                        align: 'end',
                        font: { size: 14 },
                        formatter: function(value, context) {
                            return riskLabels[context.dataIndex];
                        }
                    }
                },
                scales: {
                    y: { display: false },
                    x: { ticks: { font: { size: 14 } } }
                }
            },
            plugins: [ChartDataLabels]
        });
    } else {
        forecastChart.data.labels = formattedLabels;
        forecastChart.data.datasets[0].backgroundColor = barColors;
        forecastChart.update();
    }
}

// --- Initialize ---
getWeather();
renderPainTable();
updateCombinedChart();
get7DayForecast();
setInterval(getWeather, 600000);
setInterval(get7DayForecast, 3600000);