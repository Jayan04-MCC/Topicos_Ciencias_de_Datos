// ========== CONFIGURACIÓN Y CONSTANTES ==========
const CONFIG = {
    margin: { top: 40, right: 20, bottom: 60, left: 60 },
    colors: {
        primary: "#69b3a2",
        scheme: d3.schemeCategory10,
        wordcloud: d3.scaleOrdinal(d3.schemeCategory10)
    },
    chart: {
        confidenceBins: 10,
        topKeywords: 10,
        mapScale: 1000
    },
    wordcloud: {
        maxWords: 80,
        minFontSize: 18,
        maxFontSize: 120,
        padding: 8,
        radiusMultiplier: 15,
        stopWords: new Set([
            'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 
            'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 
            'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can', 'this', 
            'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 
            'her', 'us', 'them', 'my', 'your', 'his', 'her', 'its', 'our', 'their', 'about', 
            'above', 'across', 'after', 'against', 'along', 'among', 'around', 'before', 'behind', 
            'below', 'beneath', 'beside', 'between', 'beyond', 'during', 'except', 'from', 'inside', 
            'into', 'like', 'near', 'outside', 'over', 'since', 'through', 'throughout', 'till', 
            'toward', 'under', 'until', 'up', 'upon', 'within', 'without', 'all', 'any', 'both', 
            'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 
            'own', 'same', 'so', 'than', 'too', 'very', 'just', 'now'
        ])
    }
};

// ========== ESTADO GLOBAL ==========
class AppState {
    constructor() {
        this.dataGlobal = [];
        this.goldenMode = true;
        this.currentView = null;
    }

    setData(data) {
        this.dataGlobal = data;
    }

    toggleGoldenMode() {
        this.goldenMode = !this.goldenMode;
        return this.goldenMode;
    }

    setCurrentView(view) {
        this.currentView = view;
    }

    getFilteredData() {
        return this.dataGlobal.filter(d => 
            d._golden === this.goldenMode && !isNaN(d.confidence)
        );
    }
}

const appState = new AppState();

// ========== UTILIDADES ==========
class DataProcessor {
    static preprocessData(data) {
        return data.map(d => ({
            ...d,
            _golden: this.parseBoolean(d._golden),
            confidence: +d["choose_one:confidence"],
            choose_one: d.choose_one,
            keyword: d.keyword || "Unknown",
            location: d.location || "Unknown"
        }));
    }

    static parseBoolean(value) {
        return value === "True" || value === "true" || 
               value === "TRUE" || value === "1";
    }

    static getDataCounts(data, accessor) {
        return d3.rollups(data, v => v.length, accessor);
    }

    static getTopN(counts, n = 10) {
        return counts.sort((a, b) => b[1] - a[1]).slice(0, n);
    }
}

// ========== COMPONENTES DE UI ==========
class UIController {
    static setupControls() {
        this.setupViewButtons();
        this.setupGoldenToggle();
    }

    static setupViewButtons() {
        d3.selectAll(".viz-button").on("click", function() {
            const viz = d3.select(this).attr("data-viz");
            ViewManager.switchView(viz);
            UIController.updateActiveButton(this);
        });
    }

    static setupGoldenToggle() {
        d3.select("#toggle-golden").on("click", () => {
            const newMode = appState.toggleGoldenMode();
            const label = newMode ? "Mostrar: Golden" : "Mostrar: No-Golden";
            d3.select("#toggle-golden").text(label);
            ViewManager.refreshCurrentView();
        });
    }

    static updateActiveButton(activeButton) {
        d3.selectAll(".viz-button").classed("active", false);
        d3.select(activeButton).classed("active", true);
    }
}

// ========== GESTOR DE VISTAS ==========
class ViewManager {
    static switchView(view) {
        appState.setCurrentView(view);
        this.toggleContainers(view);
        this.refreshCurrentView();
    }

    static toggleContainers(view) {
        const isMapView = view === "location";
        const isWordCloudView = view === "wordcloud";
        
        d3.select("svg#chart").style("display", (isMapView || isWordCloudView) ? "none" : "block");
        d3.select("#map").style("display", isMapView ? "block" : "none");
        d3.select("#wordcloud").style("display", isWordCloudView ? "block" : "none");
    }

    static refreshCurrentView() {
        const viewMap = {
            'confidence': () => ConfidenceChart.draw(),
            'label': () => LabelChart.draw(),
            'keyword': () => KeywordChart.draw(),
            'location': () => LocationMap.draw(),
            'wordcloud': () => WordCloudChart.draw()
        };

        const drawFunction = viewMap[appState.currentView];
        if (drawFunction) {
            drawFunction();
        }
    }
}

// ========== COMPONENTE BASE PARA GRÁFICOS ==========
class BaseChart {
    static getSVGDimensions() {
        const svg = d3.select("svg#chart");
        const width = +svg.node().clientWidth;
        const height = +svg.node().clientHeight;
        return {
            svg,
            width,
            height,
            innerWidth: width - CONFIG.margin.left - CONFIG.margin.right,
            innerHeight: height - CONFIG.margin.top - CONFIG.margin.bottom
        };
    }

    static clearSVG(svg) {
        svg.selectAll("*").remove();
    }

    static addAxisLabels(svg, xLabel, yLabel, dimensions) {
        const { width, height, innerWidth, innerHeight } = dimensions;
        const { margin } = CONFIG;

        // Etiqueta eje X
        svg.append("text")
            .attr("class", "axis-label")
            .attr("x", margin.left + innerWidth / 2)
            .attr("y", height - 10)
            .attr("text-anchor", "middle")
            .text(xLabel);

        // Etiqueta eje Y
        svg.append("text")
            .attr("class", "axis-label")
            .attr("transform", "rotate(-90)")
            .attr("x", -(margin.top + innerHeight / 2))
            .attr("y", 15)
            .attr("text-anchor", "middle")
            .text(yLabel);
    }
}

// ========== GRÁFICO DE CONFIANZA ==========
class ConfidenceChart extends BaseChart {
    static draw() {
        const data = appState.getFilteredData();
        const dimensions = this.getSVGDimensions();
        const { svg, innerWidth, innerHeight } = dimensions;

        this.clearSVG(svg);

        const { x, y, bins } = this.prepareScales(data, innerWidth, innerHeight);
        const g = this.createMainGroup(svg);

        // Dibuja las barras con tooltip interactivo
        g.selectAll("rect")
            .data(bins)
            .join("rect")
            .attr("x", d => x(d.x0))
            .attr("y", d => y(d.length))
            .attr("width", d => Math.max(0, x(d.x1) - x(d.x0) - 1))
            .attr("height", d => innerHeight - y(d.length))
            .attr("fill", CONFIG.colors.primary)
            .on("mouseover", function(event, d) {
                d3.select(this).attr("fill", d3.rgb(CONFIG.colors.primary).darker(1));
                ConfidenceChart.showTooltip(event, d);
            })
            .on("mousemove", function(event) {
                d3.select(".tooltip")
                    .style("left", (event.pageX + 15) + "px")
                    .style("top", (event.pageY - 10) + "px");
            })
            .on("mouseout", function(event, d) {
                d3.select(this).attr("fill", CONFIG.colors.primary);
                ConfidenceChart.hideTooltip();
            });

        // Ejes
        this.drawAxes(g, x, y, innerHeight);
        this.addAxisLabels(svg,
            "Confianza del anotador (choose_one:confidence)",
            "Cantidad de Tweets",
            dimensions
        );

        // Línea de promedio
        const avg = d3.mean(data, d => d.confidence);
        g.append("line")
            .attr("x1", x(avg))
            .attr("x2", x(avg))
            .attr("y1", 0)
            .attr("y2", innerHeight)
            .attr("stroke", "#e74c3c")
            .attr("stroke-width", 2)
            .attr("stroke-dasharray", "4 2");

        g.append("text")
            .attr("x", x(avg) + 5)
            .attr("y", 15)
            .attr("fill", "#e74c3c")
            .attr("font-size", "12px")
            .text(`Promedio: ${avg.toFixed(2)}`);

        // Selector de rango (brush)
        const brush = d3.brushX()
            .extent([[0, 0], [innerWidth, innerHeight]])
            .on("end", function(event) {
                if (!event.selection) {
                    // Si no hay selección, mostrar todos los datos
                    appState.setConfidenceRange(null);
                    return;
                }
                const [x0, x1] = event.selection.map(x.invert);
                appState.setConfidenceRange([x0, x1]);
            });

        g.append("g")
            .attr("class", "brush")
            .call(brush);
    }

    static prepareScales(data, innerWidth, innerHeight) {
        const x = d3.scaleLinear()
            .domain([0, 1])
            .range([0, innerWidth]);

        const bins = d3.bin()
            .value(d => d.confidence)
            .domain(x.domain())
            .thresholds(CONFIG.chart.confidenceBins)(data);

        const y = d3.scaleLinear()
            .domain([0, d3.max(bins, d => d.length)])
            .nice()
            .range([innerHeight, 0]);

        return { x, y, bins };
    }

    static createMainGroup(svg) {
        return svg.append("g")
            .attr("transform", `translate(${CONFIG.margin.left},${CONFIG.margin.top})`);
    }

    static drawAxes(g, x, y, innerHeight) {
        const xAxis = d3.axisBottom(x).ticks(10, ".1f");
        const yAxis = d3.axisLeft(y).ticks(5);

        g.append("g")
            .attr("transform", `translate(0,${innerHeight})`)
            .call(xAxis);
        g.append("g")
            .call(yAxis);
    }

    // Tooltip helpers
    static showTooltip(event, d) {
        this.hideTooltip();
        d3.select("body").append("div")
            .attr("class", "tooltip")
            .style("position", "absolute")
            .style("background", "rgba(0,0,0,0.85)")
            .style("color", "#fff")
            .style("padding", "10px 16px")
            .style("border-radius", "6px")
            .style("font-size", "14px")
            .style("pointer-events", "none")
            .style("z-index", "1000")
            .style("left", (event.pageX + 15) + "px")
            .style("top", (event.pageY - 10) + "px")
            .html(`
                <strong>Rango:</strong> ${d.x0.toFixed(2)} - ${d.x1.toFixed(2)}<br/>
                <strong>Cantidad:</strong> ${d.length}
            `);
    }

    static hideTooltip() {
        d3.selectAll(".tooltip").remove();
    }
}

// ========== GRÁFICO DE DISTRIBUCIÓN DE ETIQUETAS ==========
class LabelChart extends BaseChart {
    static draw() {
        const data = appState.getFilteredData();
        const dimensions = this.getSVGDimensions();
        const { svg, width, height } = dimensions;
        
        this.clearSVG(svg);

        const pieData = this.preparePieData(data);
        const { pie, arc, radius } = this.prepareArcs(width, height);
        const g = this.createMainGroup(svg, width, height);
        
        this.drawPieSlices(g, pie, arc, pieData);
        this.drawLegend(svg, pieData);
    }

    static preparePieData(data) {
        const counts = DataProcessor.getDataCounts(data, d => d.choose_one);
        return counts.map(([key, count]) => ({ label: key, count }));
    }

    static prepareArcs(width, height) {
        const radius = Math.min(width, height) / 2 - CONFIG.margin.top;
        const pie = d3.pie().value(d => d.count);
        const arc = d3.arc().innerRadius(0).outerRadius(radius);
        
        return { pie, arc, radius };
    }

    static createMainGroup(svg, width, height) {
        return svg.append("g")
            .attr("transform", `translate(${width / 2},${height / 2})`);
    }

    static drawPieSlices(g, pie, arc, pieData) {
    const arcOver = d3.arc()
        .innerRadius(0)
        .outerRadius(arc.outerRadius()() + 15); // Aumenta el radio al hacer hover

    g.selectAll("path")
        .data(pie(pieData))
        .join("path")
        .attr("d", arc)
        .attr("fill", (d, i) => CONFIG.colors.scheme[i % 10])
        .attr("stroke", "white")
        .attr("stroke-width", 1)
        .on("mouseover", function(event, d) {
            d3.select(this)
                .transition()
                .duration(200)
                .attr("d", arcOver);
            LabelChart.showTooltip(event, d);
        })
        .on("mousemove", function(event) {
            d3.select(".tooltip")
                .style("left", (event.pageX + 15) + "px")
                .style("top", (event.pageY - 10) + "px");
        })
        .on("mouseout", function(event, d) {
            d3.select(this)
                .transition()
                .duration(200)
                .attr("d", arc);
            LabelChart.hideTooltip();
        });
}

    static drawLegend(svg, pieData) {
    const legend = svg.append("g")
        .attr("transform", "translate(20,20)");

    pieData.forEach((d, i) => {
        const legendRow = legend.append("g")
            .attr("transform", `translate(0, ${i * 20})`)
            .style("cursor", "pointer")
            .on("mouseover", function() {
                svg.selectAll("path")
                    .filter((p, j) => j === i)
                    .transition()
                    .duration(200)
                    .attr("fill", d3.rgb(CONFIG.colors.scheme[i % 10]).darker(1));
            })
            .on("mouseout", function() {
                svg.selectAll("path")
                    .filter((p, j) => j === i)
                    .transition()
                    .duration(200)
                    .attr("fill", CONFIG.colors.scheme[i % 10]);
            });

        legendRow.append("rect")
            .attr("width", 12)
            .attr("height", 12)
            .attr("fill", CONFIG.colors.scheme[i % 10]);
        legendRow.append("text")
            .attr("x", 20)
            .attr("y", 10)
            .text(`${d.label} (${d.count})`);
    });
}

    // Tooltip helpers
    static showTooltip(event, d) {
    this.hideTooltip();
    d3.select("body").append("div")
        .attr("class", "tooltip")
        .style("position", "absolute")
        .style("background", "rgba(0,0,0,0.85)")
        .style("color", "#fff")
        .style("padding", "10px 16px")
        .style("border-radius", "6px")
        .style("font-size", "14px")
        .style("pointer-events", "none")
        .style("z-index", "1000")
        .style("left", (event.pageX + 15) + "px")
        .style("top", (event.pageY - 10) + "px")
        .html(`
            <strong>${d.data.label}</strong><br/>
            Cantidad: <b>${d.data.count}</b><br/>
            Porcentaje: <b>${((d.data.count / d3.sum(d3.selectAll("path").data(), dd => dd.data.count)) * 100).toFixed(1)}%</b>
        `);
}

    static hideTooltip() {
        d3.selectAll(".tooltip").remove();
    }
}
//========== GRÁFICO DE PALABRAS CLAVE ==========
class KeywordChart extends BaseChart {
    static draw() {
        const data = appState.getFilteredData();
        const dimensions = this.getSVGDimensions();
        const { svg, innerWidth, innerHeight } = dimensions;
        
        this.clearSVG(svg);
        
        const bubbleData = this.prepareBubbleData(data);
        const { x, y, size, color } = this.prepareScales(bubbleData, innerWidth, innerHeight);
        const g = this.createMainGroup(svg);
        
        // Crear simulación de fuerzas para el layout dinámico
        const simulation = this.createForceSimulation(bubbleData, innerWidth, innerHeight);
        
        this.drawBubbles(g, bubbleData, size, color, simulation);
        this.drawAxes(g, x, y, innerHeight);
        this.addAxisLabels(svg, 
            "Frecuencia de Uso", 
            "Relevancia de Keyword", 
            dimensions
        );
        this.addLegend(svg, color, dimensions);
        
        // Iniciar simulación
        simulation.on("tick", () => this.updateBubblePositions(g));
    }
    
    static prepareBubbleData(data) {
        const counts = DataProcessor.getDataCounts(data, d => d.keyword || "Unknown");
        const sorted = DataProcessor.getTopN(counts, CONFIG.chart.topKeywords);
        
        return sorted.map(([keyword, count], index) => ({
            keyword,
            count,
            relevance: Math.random() * 10 + 1, // Simular relevancia (1-10)
            category: this.categorizeKeyword(keyword),
            id: `bubble-${index}`,
            x: Math.random() * 400 + 100,
            y: Math.random() * 300 + 100
        }));
    }
    
    static categorizeKeyword(keyword) {
    const lower = keyword.toLowerCase();

    // Categoría: Tipo de desastre
    const disasterTypes = [
        'earthquake', 'fire', 'flood', 'explosion', 'hurricane', 'storm', 'tornado',
        'tsunami', 'blizzard', 'drought', 'avalanche', 'landslide', 'bomb',
        'wildfire', 'eruption', 'crash', 'wreck', 'collapse'
    ];

    // Categoría: Consecuencias o acciones
    const consequences = [
        'evacuate', 'rescue', 'death', 'injured', 'destroyed', 'damage', 'ruins',
        'burned', 'trapped', 'missing', 'casualty', 'emergency', 'alert',
        'aid', 'looting', 'panic'
    ];

    // Categoría: Lugares o estructuras
    const locations = [
        'bridge', 'building', 'highway', 'school', 'hospital', 'airport',
        'subway', 'powerplant', 'train', 'city', 'neighborhood'
    ];

    // Categoría: Entidades involucradas
    const entities = [
        'firefighter', 'police', 'army', 'government', 'citizen', 'volunteer',
        'ngo', 'redcross', 'media', 'un'
    ];

    // Clasificación
    if (disasterTypes.some(term => lower.includes(term))) return 'disaster_type';
    if (consequences.some(term => lower.includes(term))) return 'consequence';
    if (locations.some(term => lower.includes(term))) return 'location';
    if (entities.some(term => lower.includes(term))) return 'entity';

    return 'other';
}

    
    static prepareScales(bubbleData, innerWidth, innerHeight) {
        // Escala X para relevancia
        const x = d3.scaleLinear()
            .domain([0, d3.max(bubbleData, d => d.relevance)])
            .range([0, innerWidth]);
        
        // Escala Y para frecuencia
        const y = d3.scaleLinear()
            .domain([0, d3.max(bubbleData, d => d.count)])
            .range([innerHeight, 0]);
        
        // Escala de tamaño para las burbujas
        const size = d3.scaleSqrt()
            .domain([0, d3.max(bubbleData, d => d.count)])
            .range([10, 50]);
        
        // Escala de color por categoría
        const color = d3.scaleOrdinal()
            .domain(['disaster_type', 'consequence', 'location', 'entity', 'general'])
            .range(['#FF6B6B', '#4ECDC4', '#45B7D1', '#F39C12', '#96CEB4']);
        
        return { x, y, size, color };
    }
    
    static createForceSimulation(bubbleData, innerWidth, innerHeight) {
        return d3.forceSimulation(bubbleData)
            .force("center", d3.forceCenter(innerWidth / 2, innerHeight / 2))
            .force("charge", d3.forceManyBody().strength(-100))
            .force("collision", d3.forceCollide().radius(d => 
                d3.scaleSqrt().domain([0, d3.max(bubbleData, d => d.count)]).range([10, 50])(d.count) + 2
            ))
            .force("x", d3.forceX().strength(0.1))
            .force("y", d3.forceY().strength(0.1));
    }
    
    static createMainGroup(svg) {
        return svg.append("g")
            .attr("transform", `translate(${CONFIG.margin.left},${CONFIG.margin.top})`);
    }
    
    static drawBubbles(g, bubbleData, size, color, simulation) {
    const bubbles = g.selectAll(".bubble")
        .data(bubbleData)
        .join("g")
        .attr("class", "bubble")
        .style("cursor", "pointer");

    // Círculos principales con transición lenta y escalonada
    bubbles.append("circle")
        .attr("r", 0)
        .attr("fill", d => color(d.category))
        .attr("fill-opacity", 0.7)
        .attr("stroke", "#fff")
        .attr("stroke-width", 2)
        .on("mouseover", this.handleMouseOver.bind(this))
        .on("mouseout", this.handleMouseOut.bind(this))
        .on("click", this.handleClick.bind(this))
        .transition()
        .delay((d, i) => i * 220) // Más lento y escalonado
        .duration(900)
        .attr("r", d => size(d.count));

    // Texto de las keywords
    bubbles.append("text")
        .attr("text-anchor", "middle")
        .attr("dy", "0.3em")
        .style("font-size", d => Math.min(size(d.count) / 3, 12) + "px")
        .style("font-weight", "bold")
        .style("fill", "#333")
        .style("pointer-events", "none")
        .text(d => d.keyword.length > 8 ? d.keyword.substring(0, 8) + "..." : d.keyword);

    // Número de frecuencia
    bubbles.append("text")
        .attr("text-anchor", "middle")
        .attr("dy", "1.5em")
        .style("font-size", d => Math.min(size(d.count) / 4, 10) + "px")
        .style("fill", "#666")
        .style("pointer-events", "none")
        .text(d => d.count);

    // Animación de aparición del grupo
    bubbles.transition()
        .delay((d, i) => i * 220)
        .duration(900)
        .attr("opacity", 1);

    // Drag behavior
    bubbles.call(d3.drag()
        .on("start", (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
        })
        .on("drag", (event, d) => {
            d.fx = event.x;
            d.fy = event.y;
        })
        .on("end", (event, d) => {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
        })
    );
}
    
    static updateBubblePositions(g) {
        g.selectAll(".bubble")
            .attr("transform", d => `translate(${d.x},${d.y})`);
    }
    
    static handleMouseOver(event, d) {
        // Aumentar tamaño en hover
        d3.select(event.currentTarget)
            .transition()
            .duration(200)
            .attr("r", d => {
                const size = d3.scaleSqrt()
                    .domain([0, d3.max(appState.getFilteredData(), d => d.count)])
                    .range([10, 50]);
                return size(d.count) * 1.2;
            })
            .attr("fill-opacity", 1);
        
        // Tooltip
        this.showTooltip(event, d);
    }
    
    static handleMouseOut(event, d) {
        // Restaurar tamaño original
        d3.select(event.currentTarget)
            .transition()
            .duration(200)
            .attr("r", d => {
                const size = d3.scaleSqrt()
                    .domain([0, d3.max(appState.getFilteredData(), d => d.count)])
                    .range([10, 50]);
                return size(d.count);
            })
            .attr("fill-opacity", 0.7);
        
        this.hideTooltip();
    }
    
    static handleClick(event, d) {
        // Filtrar por keyword clickeada
        if (typeof appState.setKeywordFilter === 'function') {
            appState.setKeywordFilter(d.keyword);
        }
        console.log(`Keyword seleccionada: ${d.keyword}`);
    }
    
    static showTooltip(event, d) {
        const tooltip = d3.select("body").append("div")
            .attr("class", "tooltip")
            .style("position", "absolute")
            .style("background", "rgba(0,0,0,0.8)")
            .style("color", "white")
            .style("padding", "10px")
            .style("border-radius", "5px")
            .style("font-size", "12px")
            .style("pointer-events", "none")
            .style("z-index", "1000");
        
        tooltip.html(`
            <strong>${d.keyword}</strong><br/>
            Frecuencia: ${d.count}<br/>
            Relevancia: ${d.relevance.toFixed(1)}<br/>
            Categoría: ${d.category}
        `)
        .style("left", (event.pageX + 10) + "px")
        .style("top", (event.pageY - 10) + "px");
    }
    
    static hideTooltip() {
        d3.selectAll(".tooltip").remove();
    }
    
    static drawAxes(g, x, y, innerHeight) {
        // Eje X (relevancia)
        const xAxis = d3.axisBottom(x).ticks(5);
        g.append("g")
            .attr("class", "x-axis")
            .attr("transform", `translate(0,${innerHeight})`)
            .call(xAxis);
        
        // Eje Y (frecuencia)
        const yAxis = d3.axisLeft(y).ticks(5);
        g.append("g")
            .attr("class", "y-axis")
            .call(yAxis);
    }
    
    static addLegend(svg, color, dimensions) {
        const legend = svg.append("g")
            .attr("class", "legend")
            .attr("transform", `translate(${dimensions.width - 120}, 20)`);
        
        const categories = color.domain();
        const legendItems = legend.selectAll(".legend-item")
            .data(categories)
            .join("g")
            .attr("class", "legend-item")
            .attr("transform", (d, i) => `translate(0, ${i * 20})`);
        
        legendItems.append("circle")
            .attr("r", 6)
            .attr("fill", d => color(d));
        
        legendItems.append("text")
            .attr("x", 12)
            .attr("y", 4)
            .style("font-size", "11px")
            .style("text-transform", "capitalize")
            .text(d => d);
    }
}

// ========== MAPA DE UBICACIONES ==========
// ========== MAPA DE UBICACIONES ==========
class LocationMap {
    static async draw() {
        const data = appState.getFilteredData();
        d3.select("#map").selectAll("*").remove();

        // Dimensiones
        const width = d3.select("#map").node().clientWidth || 800;
        const height = d3.select("#map").node().clientHeight || 500;

        // Cargar el mapa mundial
        const world = await d3.json("world.geojson");

        // Proyección y path
        const projection = d3.geoNaturalEarth1().fitSize([width, height], world);
        const path = d3.geoPath().projection(projection);

        // SVG
        const svg = d3.select("#map")
            .append("svg")
            .attr("width", width)
            .attr("height", height);

        // Dibuja el mapa base
        svg.append("g")
            .selectAll("path")
            .data(world.features)
            .join("path")
            .attr("d", path)
            .attr("fill", "#e0e0e0")
            .attr("stroke", "#999");

        // Contar ocurrencias por location
        const counts = d3.rollups(data, v => v.length, d => d.location.trim())
            .filter(([loc, cnt]) => loc && loc !== "Unknown");

        // Geocodificación simple (puedes mejorar esto con una librería o API)
        // Aquí solo algunos ejemplos comunes:
        const geoDict = {
            "Mexico": [-102.5528, 23.6345],
            "USA": [-95.7129, 37.0902],
            "United States": [-95.7129, 37.0902],
            "Spain": [-3.7038, 40.4168],
            "Madrid": [-3.7038, 40.4168],
            "Argentina": [-63.6167, -38.4161],
            "Chile": [-71.542969, -35.675147],
            "Peru": [-75.0152, -9.189967],
            "Colombia": [-74.297333, 4.570868],
            "Brazil": [-51.9253, -14.2350],
            "London": [-0.1276, 51.5074],
            "Paris": [2.3522, 48.8566],
            "Tokyo": [139.6917, 35.6895],
            // ...agrega más según tus datos
        };

        // Prepara los datos con coordenadas
        const points = counts
            .map(([loc, cnt]) => {
                let coords = geoDict[loc];
                if (!coords && loc.length === 2) {
                    // Si es código de país, puedes agregar más aquí
                    // Ejemplo: "US", "MX", etc.
                }
                return coords ? { loc, cnt, coords } : null;
            })
            .filter(d => d);

        // Escala de tamaño
        const maxCnt = d3.max(points, d => d.cnt);
        const size = d3.scaleSqrt().domain([1, maxCnt]).range([5, 30]);

        // Dibuja los círculos
        svg.append("g")
            .selectAll("circle")
            .data(points)
            .join("circle")
            .attr("cx", d => projection(d.coords)[0])
            .attr("cy", d => projection(d.coords)[1])
            .attr("r", d => size(d.cnt))
            .attr("fill", "#69b3a2")
            .attr("fill-opacity", 0.7)
            .attr("stroke", "#333")
            .on("mouseover", function(event, d) {
                d3.select("#map-tooltip").remove();
                d3.select("body").append("div")
                    .attr("id", "map-tooltip")
                    .style("position", "absolute")
                    .style("left", (event.pageX + 10) + "px")
                    .style("top", (event.pageY - 10) + "px")
                    .style("background", "#fff")
                    .style("padding", "8px 12px")
                    .style("border", "1px solid #999")
                    .style("border-radius", "4px")
                    .style("font-size", "13px")
                    .style("pointer-events", "none")
                    .style("z-index", "1000")
                    .html(`<b>${d.loc}</b><br>${d.cnt} tweets`);
            })
            .on("mouseout", () => d3.select("#map-tooltip").remove());
    }
}

// ========== WORD CLOUD ==========
class WordCloudChart {
    static draw() {
        const data = appState.getFilteredData();
        const dimensions = this.getWordCloudDimensions();
        
        this.clearWordCloud();
        this.processTextAndDraw(data, dimensions);
    }

    static getWordCloudDimensions() {
        const container = d3.select("#wordcloud");
        return {
            width: +container.node().clientWidth,
            height: +container.node().clientHeight
        };
    }

    static clearWordCloud() {
        d3.select("#wordcloud").selectAll("*").remove();
    }

    static processTextAndDraw(data, dimensions) {
        // Extraer y procesar todo el texto
        const allText = data
            .map(d => d.text || "")
            .join(" ")
            .toLowerCase()
            .replace(/[^\w\s]/g, " ") // Remover puntuación
            .replace(/\s+/g, " ") // Múltiples espacios a uno
            .trim();

        // Contar palabras
        const words = allText.split(" ")
            .filter(word => 
                word.length > 2 && 
                !CONFIG.wordcloud.stopWords.has(word) &&
                !word.match(/^\d+$/) // Excluir números puros
            );

        const wordCounts = DataProcessor.getDataCounts(words, d => d);
        const topWords = DataProcessor.getTopN(wordCounts, CONFIG.wordcloud.maxWords);
        
        this.drawWordCloud(topWords, dimensions);
    }

    static drawWordCloud(wordData, dimensions) {
        const { width, height } = dimensions;
        
        // Preparar datos para la nube de palabras
        const maxCount = d3.max(wordData, d => d[1]);
        const fontScale = d3.scaleLinear()
            .domain([1, maxCount])
            .range([CONFIG.wordcloud.minFontSize, CONFIG.wordcloud.maxFontSize]);

        const wordsForCloud = wordData.map(([word, count]) => ({
            text: word,
            size: fontScale(count),
            count: count
        }));

        // Crear SVG
        const svg = d3.select("#wordcloud")
            .append("svg")
            .attr("width", width)
            .attr("height", height);

        const g = svg.append("g")
            .attr("transform", `translate(${width/2},${height/2})`);

        // Implementación simple de posicionamiento sin d3-cloud
        this.drawWordsSimple(g, wordsForCloud, width, height);
    }

    static drawWordsSimple(g, words, width, height) {
        // Posicionamiento mejorado con mayor dispersión
        const centerRadius = Math.min(width, height) * 0.15; // Radio más pequeño para el centro
        const maxRadius = Math.min(width, height) * 0.45; // Radio máximo más grande
        
        words.forEach((word, i) => {
            // Usar múltiples capas concéntricas para mejor distribución
            const layer = Math.floor(i / 8); // 8 palabras por capa
            const angleStep = (Math.PI * 2) / 8; // Dividir círculo en 8 partes
            const angle = (i % 8) * angleStep + (layer * 0.3); // Offset por capa
            
            // Radio que aumenta con la capa pero con variación para palabras grandes
            const baseRadius = centerRadius + (layer * (maxRadius - centerRadius) / Math.sqrt(words.length));
            const sizeAdjustment = (word.size / CONFIG.wordcloud.maxFontSize) * 20; // Adjustment basado en tamaño
            const radius = Math.min(baseRadius + sizeAdjustment, maxRadius);
            
            // Añadir algo de ruido para evitar superposición perfecta
            const noise = (Math.random() - 0.5) * 30;
            const x = Math.cos(angle) * radius + noise;
            const y = Math.sin(angle) * radius + noise;

            g.append("text")
                .datum(word)
                .attr("x", x)
                .attr("y", y)
                .attr("text-anchor", "middle")
                .attr("dominant-baseline", "middle")
                .style("font-size", `${word.size}px`)
                .style("font-family", "Arial, sans-serif")
                .style("font-weight", word.size > 40 ? "bold" : "normal") // Bold para palabras grandes
                .style("fill", CONFIG.colors.wordcloud(i))
                .style("cursor", "pointer")
                .style("opacity", 0.9)
                .text(word.text)
                // Animación de entrada
                .style("transform", "scale(0)")
                .transition()
                .duration(500)
                .delay(i * 50)
                .style("transform", "scale(1)")
                .on("end", function() {
                    // Agregar interactividad después de la animación
                    d3.select(this)
                        .on("mouseover", function(event, d) {
                            d3.select(this)
                                .style("opacity", 0.7)
                                .style("transform", "scale(1.1)");
                            WordCloudChart.showWordTooltip(event, d);
                        })
                        .on("mouseout", function(event, d) {
                            d3.select(this)
                                .style("opacity", 0.9)
                                .style("transform", "scale(1)");
                            WordCloudChart.hideWordTooltip();
                        });
                });
        });
    }

    static generateSpiral(maxX, maxY) {
        const points = [];
        let angle = 0;
        const angleStep = 0.1;
        const radiusStep = 2;
        
        while (points.length < 1000) {
            const radius = points.length * radiusStep;
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;
            
            if (Math.abs(x) > maxX || Math.abs(y) > maxY) break;
            
            points.push([x, y]);
            angle += angleStep;
        }
        
        return points;
    }

    static showWordTooltip(event, word) {
        const [x, y] = d3.pointer(event, document.body);
        
        d3.select("#word-tooltip").remove();
        d3.select("body").append("div")
            .attr("id", "word-tooltip")
            .style("position", "absolute")
            .style("left", (x + 10) + "px")
            .style("top", (y - 10) + "px")
            .style("background", "rgba(0,0,0,0.8)")
            .style("color", "white")
            .style("padding", "8px 12px")
            .style("border-radius", "4px")
            .style("font-size", "12px")
            .style("pointer-events", "none")
            .style("z-index", "1000")
            .text(`"${word.text}": ${word.count} veces`);
    }

    static hideWordTooltip() {
        d3.select("#word-tooltip").remove();
    }
}

// ========== INICIALIZACIÓN ==========
class App {
    static init() {
        document.addEventListener("DOMContentLoaded", () => {
            this.loadData();
        });
    }

    static loadData() {
        d3.csv("tweets_interactivo.csv")
            .then(data => {
                const processedData = DataProcessor.preprocessData(data);
                appState.setData(processedData);
                UIController.setupControls();
                ViewManager.switchView("confidence");
            })
            .catch(err => {
                console.error("Error cargando CSV:", err);
            });
    }
}

// Iniciar aplicación
App.init();