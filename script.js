// Variables globales
let globalData = null;
let currentYear = "2022";
let currentMetric = "score";
let currentCountry = "United States";

// Preprocesar los datos para el dashboard
function preprocessData(data) {
    const processedData = {};
    const monthNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", 
                      "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
    
    data.forEach(d => {
        const date = new Date(d.DATE);
        const month = date.getMonth();
        const year = date.getFullYear();
        const monthYear = `${year}-${month}`;
        const monthName = `${monthNames[month]} ${year}`;
        const country = d.NAME_0;
        
        if (!processedData[country]) {
            processedData[country] = {
                name: country,
                data: {},
                totalTweets: 0,
                avgScore: 0
            };
        }
        
        if (!processedData[country].data[monthYear]) {
            processedData[country].data[monthYear] = {
                month: month,
                year: year,
                monthName: monthName,
                totalTweets: 0,
                sumScore: 0,
                count: 0,
                avgScore: 0
            };
        }
        
        const monthData = processedData[country].data[monthYear];
        monthData.totalTweets += d.N;
        monthData.sumScore += d.SCORE * d.N;
        monthData.count += 1;
        monthData.avgScore = monthData.sumScore / monthData.totalTweets;
        
        processedData[country].totalTweets += d.N;
        processedData[country].sumScore += d.SCORE * d.N;
    });
    
    // Calcular promedios generales por país
    Object.keys(processedData).forEach(country => {
        processedData[country].avgScore = 
            processedData[country].sumScore / processedData[country].totalTweets;
    });
    
    return processedData;
}

// Cargar datos desde un archivo CSV
function loadData(year) {
    const filePath = `data/sentimientos_${year}.csv`;
    
    d3.csv(filePath).then(data => {
        // Parsear números y fechas
        data.forEach(d => {
            d.N = +d.N;
            d.SCORE = +d.SCORE;
            d.DATE = new Date(d.DATE);
        });
        
        // Preprocesar datos
        globalData = preprocessData(data);
        
        // Renderizar visualizaciones
        renderAllVisualizations();
    }).catch(error => {
        console.error("Error cargando los datos:", error);
        alert("Error cargando los datos. Por favor, verifique la consola para más detalles.");
    });
}

// Renderizar todas las visualizaciones
function renderAllVisualizations() {
    if (!globalData) return;
    
    const countries = Object.keys(globalData);
    const months = Array.from(new Set(
        Object.values(globalData).flatMap(c => Object.keys(c.data))
    )).sort();
    
    renderHeatmap(globalData, countries, months);
    renderLineChart(globalData, currentCountry, months);
    renderWorldMap(globalData);
    renderBarChart(globalData);
}

// 1. Mapa de calor temporal
function renderHeatmap(data, countries, months) {
    const container = d3.select("#heatmap");
    container.selectAll("*").remove();
    
    const width = 700;
    const height = 400;
    const margin = { top: 50, right: 100, bottom: 50, left: 120 };
    
    const svg = container.append("svg")
        .attr("width", width)
        .attr("height", height)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);
    
    // Escalas
    const x = d3.scaleBand()
        .domain(months)
        .range([0, width - margin.left - margin.right]);
    
    const y = d3.scaleBand()
        .domain(countries)
        .range([0, height - margin.top - margin.bottom]);
    
    // Escala de colores
    const colorScale = d3.scaleSequential()
        .domain([0.4, 0.8])
        .interpolator(d3.interpolateRdYlGn);
    
    // Dibujar celdas
    countries.forEach(country => {
        months.forEach(month => {
            if (data[country].data[month]) {
                const value = data[country].data[month].avgScore;
                
                svg.append("rect")
                    .attr("x", x(month))
                    .attr("y", y(country))
                    .attr("width", x.bandwidth())
                    .attr("height", y.bandwidth())
                    .attr("fill", colorScale(value))
                    .attr("stroke", "#fff")
                    .attr("stroke-width", 0.5)
                    .attr("rx", 3)
                    .attr("ry", 3)
                    .on("mouseover", function(event) {
                        d3.select(this).attr("stroke-width", 2).attr("stroke", "#333");
                        showTooltip(event, `<strong>${country}</strong><br>${data[country].data[month].monthName}
                        <br>Score: ${value.toFixed(3)}<br>Tweets: ${data[country].data[month].totalTweets}`);
                    })
                    .on("mouseout", function() {
                        d3.select(this).attr("stroke-width", 0.5).attr("stroke", "#fff");
                        hideTooltip();
                    })
                    .on("click", () => {
                        currentCountry = country;
                        renderLineChart(data, country, months);
                    });
                
                // Texto en celdas para valores importantes
                if (value > 0.75 || value < 0.5) {
                    svg.append("text")
                        .attr("x", x(month) + x.bandwidth()/2)
                        .attr("y", y(country) + y.bandwidth()/2)
                        .attr("text-anchor", "middle")
                        .attr("dy", "0.35em")
                        .attr("font-size", "10px")
                        .attr("fill", value > 0.7 ? "#fff" : "#333")
                        .text(value.toFixed(2));
                }
            }
        });
    });
    
    // Eje X
    svg.append("g")
        .attr("transform", `translate(0,${height - margin.top - margin.bottom})`)
        .call(d3.axisBottom(x).tickValues(months.filter((d, i) => i % 2 === 0)))
        .selectAll("text")
        .attr("transform", "rotate(-45)")
        .attr("text-anchor", "end")
        .attr("dx", "-0.8em")
        .attr("dy", "0.15em");
    
    // Eje Y
    svg.append("g")
        .call(d3.axisLeft(y).tickSize(0))
        .selectAll("text")
        .attr("class", "country-label");
    
    // Título
    svg.append("text")
        .attr("x", (width - margin.left - margin.right) / 2)
        .attr("y", -20)
        .attr("text-anchor", "middle")
        .attr("font-size", "16px")
        .attr("font-weight", "bold")
        .text("Sentimiento Promedio por País y Mes");
    
    // Leyenda
    renderLegend("#heatmap-legend", colorScale, "Sentimiento (0-1)");
}

// 2. Gráfico de líneas para evolución temporal
function renderLineChart(data, selectedCountry, months) {
    const container = d3.select("#line-chart");
    container.selectAll("*").remove();
    
    const width = 700;
    const height = 400;
    const margin = { top: 50, right: 100, bottom: 50, left: 60 };
    
    const svg = container.append("svg")
        .attr("width", width)
        .attr("height", height)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);
    
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;
    
    // Obtener datos para el país seleccionado
    const countryData = data[selectedCountry];
    const lineData = Object.values(countryData.data).sort((a, b) => {
        return a.year === b.year ? a.month - b.month : a.year - b.year;
    });
    
    // Escalas
    const x = d3.scalePoint()
        .domain(lineData.map(d => d.monthName))
        .range([0, chartWidth]);
    
    const y = d3.scaleLinear()
        .domain([0.4, 0.9])
        .range([chartHeight, 0]);
    
    // Línea
    const line = d3.line()
        .x(d => x(d.monthName))
        .y(d => y(d.avgScore));
    
    // Dibujar línea
    svg.append("path")
        .datum(lineData)
        .attr("fill", "none")
        .attr("stroke", "#1a2a6c")
        .attr("stroke-width", 3)
        .attr("d", line);
    
    // Puntos de datos
    svg.selectAll(".dot")
        .data(lineData)
        .enter().append("circle")
        .attr("class", "dot")
        .attr("cx", d => x(d.monthName))
        .attr("cy", d => y(d.avgScore))
        .attr("r", 5)
        .attr("fill", "#b21f1f")
        .on("mouseover", function(event, d) {
            d3.select(this).attr("r", 8);
            showTooltip(event, `<strong>${selectedCountry}</strong><br>${d.monthName}
            <br>Score: ${d.avgScore.toFixed(3)}<br>Tweets: ${d.totalTweets}`);
        })
        .on("mouseout", function() {
            d3.select(this).attr("r", 5);
            hideTooltip();
        });
    
    // Eje X
    svg.append("g")
        .attr("transform", `translate(0,${chartHeight})`)
        .call(d3.axisBottom(x))
        .selectAll("text")
        .attr("transform", "rotate(-45)")
        .attr("text-anchor", "end")
        .attr("dx", "-0.8em")
        .attr("dy", "0.15em");
    
    // Eje Y
    svg.append("g")
        .call(d3.axisLeft(y).ticks(5));
    
    // Título
    svg.append("text")
        .attr("x", chartWidth / 2)
        .attr("y", -20)
        .attr("text-anchor", "middle")
        .attr("font-size", "16px")
        .attr("font-weight", "bold")
        .text(`Evolución del Sentimiento en ${selectedCountry}`);
    
    // Etiqueta eje Y
    svg.append("text")
        .attr("transform", "rotate(-90)")
        .attr("y", 0 - margin.left)
        .attr("x", 0 - (chartHeight / 2))
        .attr("dy", "1em")
        .attr("text-anchor", "middle")
        .text("Score de Sentimiento");
}

// 3. Mapa mundial de sentimiento
function renderWorldMap(data) {
    const container = d3.select("#world-map");
    container.selectAll("*").remove();
    
    const width = 700;
    const height = 400;
    
    const svg = container.append("svg")
        .attr("width", width)
        .attr("height", height);
    
    // Escala de colores
    const colorScale = d3.scaleSequential()
        .domain([0.4, 0.8])
        .interpolator(d3.interpolateRdYlGn);
    
    // Proyección
    const projection = d3.geoMercator()
        .scale(120)
        .translate([width / 2, height / 1.5]);
    
    // Crear un grupo para el mapa
    const g = svg.append("g");
    
    // Crear datos geoJSON simulados
    const geoData = {
        type: "FeatureCollection",
        features: Object.keys(data).map(country => ({
            type: "Feature",
            properties: {
                name: country,
                value: data[country].avgScore
            },
            geometry: {
                type: "Point",
                coordinates: [getRandomLon(), getRandomLat()]
            }
        }))
    };
    
    // Dibujar países como círculos
    g.selectAll("circle")
        .data(geoData.features)
        .enter()
        .append("circle")
        .attr("cx", d => projection(d.geometry.coordinates)[0])
        .attr("cy", d => projection(d.geometry.coordinates)[1])
        .attr("r", d => Math.sqrt(data[d.properties.name].totalTweets) / 100)
        .attr("fill", d => colorScale(d.properties.value))
        .attr("stroke", "#fff")
        .attr("stroke-width", 0.5)
        .attr("opacity", 0.8)
        .on("mouseover", function(event, d) {
            d3.select(this).attr("stroke-width", 2).attr("stroke", "#333");
            showTooltip(event, `<strong>${d.properties.name}</strong><br>
                Score: ${d.properties.value.toFixed(3)}<br>
                Tweets: ${data[d.properties.name].totalTweets}`);
        })
        .on("mouseout", function() {
            d3.select(this).attr("stroke-width", 0.5).attr("stroke", "#fff");
            hideTooltip();
        })
        .on("click", d => {
            currentCountry = d.properties.name;
            const months = Object.keys(data[d.properties.name].data);
            renderLineChart(data, d.properties.name, months);
        });
    
    // Etiquetas para países importantes
    const importantCountries = ["United States", "Brazil", "India", "China", "United Kingdom"];
    geoData.features.filter(d => importantCountries.includes(d.properties.name))
        .forEach(d => {
            g.append("text")
                .attr("x", projection(d.geometry.coordinates)[0])
                .attr("y", projection(d.geometry.coordinates)[1] - Math.sqrt(data[d.properties.name].totalTweets)/100 - 5)
                .attr("text-anchor", "middle")
                .attr("font-size", "10px")
                .attr("fill", "#333")
                .text(d.properties.name);
        });
    
    // Título
    svg.append("text")
        .attr("x", width / 2)
        .attr("y", 30)
        .attr("text-anchor", "middle")
        .attr("font-size", "16px")
        .attr("font-weight", "bold")
        .text("Distribución Global del Sentimiento");
    
    // Leyenda
    renderLegend("#map-legend", colorScale, "Sentimiento (0-1)");
}

// 4. Gráfico de barras para top países
function renderBarChart(data) {
    const container = d3.select("#bar-chart");
    container.selectAll("*").remove();
    
    const width = 700;
    const height = 400;
    const margin = { top: 50, right: 30, bottom: 70, left: 80 };
    
    const svg = container.append("svg")
        .attr("width", width)
        .attr("height", height)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);
    
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;
    
    // Preparar datos (top 10 países por score)
    const topCountries = Object.values(data)
        .sort((a, b) => b.avgScore - a.avgScore)
        .slice(0, 10);
    
    // Escalas
    const x = d3.scaleBand()
        .domain(topCountries.map(d => d.name))
        .range([0, chartWidth])
        .padding(0.2);
    
    const y = d3.scaleLinear()
        .domain([0.5, 0.8])
        .range([chartHeight, 0]);
    
    // Escala de colores
    const colorScale = d3.scaleSequential()
        .domain([0.5, 0.8])
        .interpolator(d3.interpolateRdYlGn);
    
    // Barras
    svg.selectAll(".bar")
        .data(topCountries)
        .enter().append("rect")
        .attr("class", "bar")
        .attr("x", d => x(d.name))
        .attr("y", d => y(d.avgScore))
        .attr("width", x.bandwidth())
        .attr("height", d => chartHeight - y(d.avgScore))
        .attr("fill", d => colorScale(d.avgScore))
        .on("mouseover", function(event, d) {
            d3.select(this).attr("opacity", 0.8);
            showTooltip(event, `<strong>${d.name}</strong><br>
                Score: ${d.avgScore.toFixed(3)}<br>
                Tweets: ${d.totalTweets}`);
        })
        .on("mouseout", function() {
            d3.select(this).attr("opacity", 1);
            hideTooltip();
        })
        .on("click", d => {
            currentCountry = d.name;
            const months = Object.keys(d.data);
            renderLineChart(data, d.name, months);
        });
    
    // Etiquetas de valor
    svg.selectAll(".label")
        .data(topCountries)
        .enter().append("text")
        .attr("class", "label")
        .attr("x", d => x(d.name) + x.bandwidth() / 2)
        .attr("y", d => y(d.avgScore) - 5)
        .attr("text-anchor", "middle")
        .attr("font-size", "12px")
        .text(d => d.avgScore.toFixed(3));
    
    // Eje X
    svg.append("g")
        .attr("transform", `translate(0,${chartHeight})`)
        .call(d3.axisBottom(x))
        .selectAll("text")
        .attr("transform", "rotate(-45)")
        .attr("text-anchor", "end")
        .attr("dx", "-0.8em")
        .attr("dy", "0.15em");
    
    // Eje Y
    svg.append("g")
        .call(d3.axisLeft(y).ticks(5));
    
    // Título
    svg.append("text")
        .attr("x", chartWidth / 2)
        .attr("y", -20)
        .attr("text-anchor", "middle")
        .attr("font-size", "16px")
        .attr("font-weight", "bold")
        .text("Top 10 Países por Sentimiento Positivo");
    
    // Etiqueta eje Y
    svg.append("text")
        .attr("transform", "rotate(-90)")
        .attr("y", 0 - margin.left)
        .attr("x", 0 - (chartHeight / 2))
        .attr("dy", "1em")
        .attr("text-anchor", "middle")
        .text("Score de Sentimiento");
}

// Función auxiliar para mostrar tooltips
function showTooltip(event, content) {
    const tooltip = d3.select("body")
        .append("div")
        .attr("class", "tooltip")
        .html(content);
    
    tooltip
        .style("left", (event.pageX + 10) + "px")
        .style("top", (event.pageY - 28) + "px")
        .transition()
        .duration(200)
        .style("opacity", 1);
}

function hideTooltip() {
    d3.select(".tooltip").remove();
}

// Función para renderizar leyenda
function renderLegend(selector, colorScale, title) {
    const legend = d3.select(selector);
    legend.html("");
    
    const gradientSteps = 10;
    const legendWidth = 300;
    const legendHeight = 20;
    
    const svg = legend.append("svg")
        .attr("width", legendWidth)
        .attr("height", 50);
    
    // Crear gradiente
    const defs = svg.append("defs");
    const gradient = defs.append("linearGradient")
        .attr("id", "legend-gradient")
        .attr("x1", "0%")
        .attr("x2", "100%")
        .attr("y1", "0%")
        .attr("y2", "0%");
    
    for (let i = 0; i <= gradientSteps; i++) {
        const value = i / gradientSteps;
        gradient.append("stop")
            .attr("offset", `${value * 100}%`)
            .attr("stop-color", colorScale(value * 0.4 + 0.4));
    }
    
    // Dibujar rectángulo con gradiente
    svg.append("rect")
        .attr("x", 0)
        .attr("y", 10)
        .attr("width", legendWidth)
        .attr("height", legendHeight)
        .style("fill", "url(#legend-gradient)")
        .attr("rx", 3)
        .attr("ry", 3);
    
    // Añadir etiquetas
    svg.append("text")
        .attr("x", 0)
        .attr("y", 5)
        .text("0.4 (Negativo)")
        .attr("font-size", "12px");
    
    svg.append("text")
        .attr("x", legendWidth)
        .attr("y", 5)
        .attr("text-anchor", "end")
        .text("0.8 (Positivo)")
        .attr("font-size", "12px");
    
    svg.append("text")
        .attr("x", legendWidth / 2)
        .attr("y", 5)
        .attr("text-anchor", "middle")
        .text(title)
        .attr("font-size", "12px")
        .attr("font-weight", "bold");
}

// Funciones auxiliares para generar coordenadas aleatorias
function getRandomLat() {
    return Math.random() * 160 - 80; // Entre -80 y 80
}

function getRandomLon() {
    return Math.random() * 360 - 180; // Entre -180 y 180
}

// Inicializar el dashboard
function initDashboard() {
    // Cargar datos iniciales (2022)
    loadData(currentYear);
    
    // Configurar event listeners
    document.getElementById('year-select').addEventListener('change', function() {
        currentYear = this.value;
        loadData(currentYear);
    });
    
    document.getElementById('metric-select').addEventListener('change', function() {
        currentMetric = this.value;
        // En una implementación completa, esto actualizaría las visualizaciones
        alert("Cambio de métrica seleccionado. En una implementación completa, esto actualizaría las visualizaciones.");
    });
    
    document.getElementById('reset-btn').addEventListener('click', function() {
        currentCountry = "United States";
        loadData(currentYear);
    });
}

// Inicializar el dashboard cuando se carga la página
document.addEventListener('DOMContentLoaded', initDashboard);