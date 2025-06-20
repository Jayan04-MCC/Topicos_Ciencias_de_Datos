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
        maxWords: 30,
        minFontSize: 22,
        maxFontSize: 60,
        padding: 20,
        radiusMultiplier: 25,
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
            'own', 'same', 'so', 'than', 'too', 'very', 'just', 'now',"http", "https", "www",
             "com", "org", "net", "amp", "rt", "tco", "co", "via", "youtu", "youtube", "twitter", 
             "bit", "ly"
        ])
    }
};

// ========== ESTADO GLOBAL ==========
class AppState {
    constructor() {
        this.dataGlobal = [];
        this.goldenMode = true;
    }
    setData(data) { this.dataGlobal = data; }
    toggleGoldenMode() { this.goldenMode = !this.goldenMode; return this.goldenMode; }
    getFilteredData() {
        return this.dataGlobal.filter(d => d._golden === this.goldenMode && !isNaN(d.confidence));
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
            location: d.location || "Unknown",
            text: d.text || ""
        }));
    }
    static parseBoolean(value) {
        return value === "True" || value === "true" || value === "TRUE" || value === "1";
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
            UIController.updateActiveButton(this);
            UIController.highlightChart(viz);
        });
    }
    static setupGoldenToggle() {
        d3.select("#toggle-golden").on("click", () => {
            const newMode = appState.toggleGoldenMode();
            const label = newMode ? "Mostrar: Golden" : "Mostrar: No-Golden";
            d3.select("#toggle-golden").text(label);
            ViewManager.drawAllViews();
        });
    }
    static updateActiveButton(activeButton) {
        d3.selectAll(".viz-button").classed("active", false);
        d3.select(activeButton).classed("active", true);
    }
    static highlightChart(viz) {
        d3.selectAll(".chart-container").classed("active-chart", false);
        d3.select(`.chart-container[data-viz='${viz}']`).classed("active-chart", true);
    }
}

// ========== GESTOR DE VISTAS ==========
class ViewManager {
    static drawAllViews() {
        ConfidenceChart.draw();
        LabelChart.draw();
        KeywordChart.draw();
        LocationMap.draw();
        WordCloudChart.draw();
    }
}

// ========== COMPONENTE BASE PARA GRÁFICOS ==========
class BaseChart {
    // Añadir configuración de tamaño por defecto
    static DEFAULT_DIMENSIONS = {
        width: 600,  // Aumentar ancho predeterminado
        height: 400, // Aumentar altura predeterminada
        margin: {
            top: 40,
            right: 40,
            bottom: 60,
            left: 60
        }
    };

    static clearSVG(svg) {
        svg.selectAll("*").remove();
    }

    static addAxisLabels(svg, xLabel, yLabel, dimensions) {
        const { width, height, innerWidth, innerHeight } = dimensions;
        const { margin } = dimensions;
        
        // Aumentar tamaño de las etiquetas
        svg.append("text")
            .attr("class", "axis-label")
            .attr("x", margin.left + innerWidth / 2)
            .attr("y", height - 10)
            .attr("text-anchor", "middle")
            .style("font-size", "14px") // Aumentar tamaño de fuente
            .text(xLabel);

        svg.append("text")
            .attr("class", "axis-label")
            .attr("transform", "rotate(-90)")
            .attr("x", -(margin.top + innerHeight / 2))
            .attr("y", 15)
            .attr("text-anchor", "middle")
            .style("font-size", "14px") // Aumentar tamaño de fuente
            .text(yLabel);
    }

    static getSVGDimensionsById(id) {
        const svg = d3.select(id);
        
        // Establecer dimensiones mínimas
        svg.style("min-width", `${this.DEFAULT_DIMENSIONS.width}px`)
           .style("min-height", `${this.DEFAULT_DIMENSIONS.height}px`);
        
        const width = Math.max(+svg.node().clientWidth, this.DEFAULT_DIMENSIONS.width);
        const height = Math.max(+svg.node().clientHeight, this.DEFAULT_DIMENSIONS.height);
        
        return {
            svg,
            width,
            height,
            margin: this.DEFAULT_DIMENSIONS.margin,
            innerWidth: width - this.DEFAULT_DIMENSIONS.margin.left - this.DEFAULT_DIMENSIONS.margin.right,
            innerHeight: height - this.DEFAULT_DIMENSIONS.margin.top - this.DEFAULT_DIMENSIONS.margin.bottom
        };
    }
}

// ========== GRÁFICO DE CONFIANZA ==========
class ConfidenceChart extends BaseChart {
    static draw() {
        const data = appState.getFilteredData();
        const dims = this.getSVGDimensionsById("#chart-confidence");
        const { svg, innerWidth, innerHeight } = dims;
        this.clearSVG(svg);
        const x = d3.scaleLinear().domain([0,1]).range([0, innerWidth]);
        const bins = d3.bin().value(d=>d.confidence).domain(x.domain()).thresholds(CONFIG.chart.confidenceBins)(data);
        const y = d3.scaleLinear().domain([0, d3.max(bins, d=>d.length)]).nice().range([innerHeight,0]);
        const g = svg.append("g").attr("transform", `translate(${CONFIG.margin.left},${CONFIG.margin.top})`);
        g.selectAll("rect").data(bins).join("rect")
            .attr("x", d=>x(d.x0))
            .attr("y", d=>y(d.length))
            .attr("width", d=>Math.max(0, x(d.x1)-x(d.x0)-1))
            .attr("height", d=>innerHeight-y(d.length))
            .attr("fill", CONFIG.colors.primary)
            .on("mouseover", function(event,d){d3.select(this).attr("fill", d3.rgb(CONFIG.colors.primary).darker(1)); ConfidenceChart.showTooltip(event,d);})
            .on("mousemove", function(event){d3.select(".tooltip").style("left", (event.pageX+15)+"px").style("top", (event.pageY-10)+"px");})
            .on("mouseout", function(event){d3.select(this).attr("fill", CONFIG.colors.primary); ConfidenceChart.hideTooltip();});
        const xAxis = d3.axisBottom(x).ticks(10, ".1f");
        const yAxis = d3.axisLeft(y).ticks(5);
        g.append("g").attr("transform", `translate(0,${innerHeight})`).call(xAxis);
        g.append("g").call(yAxis);
        this.addAxisLabels(svg, "Confianza del anotador (choose_one:confidence)", "Cantidad de Tweets", dims);
        const avg = d3.mean(data, d=>d.confidence);
        g.append("line").attr("x1", x(avg)).attr("x2", x(avg)).attr("y1", 0).attr("y2", innerHeight).attr("stroke", "#e74c3c").attr("stroke-width", 2).attr("stroke-dasharray", "4 2");
        g.append("text").attr("x", x(avg)+5).attr("y", 15).attr("fill", "#e74c3c").attr("font-size", "12px").text(`Promedio: ${avg?avg.toFixed(2):'N/A'}`);
    }
    static showTooltip(event, d) {
        this.hideTooltip();
        d3.select("body").append("div").attr("class","tooltip").style("position","absolute").style("background","rgba(0,0,0,0.85)")
            .style("color","#fff").style("padding","10px 16px").style("border-radius","6px").style("font-size","14px")
            .style("pointer-events","none").style("z-index","1000").style("left",(event.pageX+15)+"px").style("top",(event.pageY-10)+"px")
            .html(`<strong>Rango:</strong> ${d.x0.toFixed(2)} - ${d.x1.toFixed(2)}<br/><strong>Cantidad:</strong> ${d.length}`);
    }
    static hideTooltip() { d3.selectAll(".tooltip").remove(); }
}
// ========== GRÁFICO DE DISTRIBUCIÓN DE ETIQUETAS ==========
class LabelChart extends BaseChart {
    static draw() {
        const data = appState.getFilteredData();
        const dims = this.getSVGDimensionsById("#chart-label");
        const { svg, width, height } = dims;
        this.clearSVG(svg);
        const counts = DataProcessor.getDataCounts(data, d=>d.choose_one);
        const pieData = counts.map(([key,count])=>({label:key, count}));
        const radius = Math.min(width, height)/2 - CONFIG.margin.top;
        const pie = d3.pie().value(d=>d.count);
        const arc = d3.arc().innerRadius(0).outerRadius(radius);
        const g = svg.append("g").attr("transform", `translate(${width/2},${height/2})`);
        const arcs = g.selectAll("path").data(pie(pieData)).join("path").attr("d", arc)
            .attr("fill", (d,i)=>CONFIG.colors.scheme[i%10]).attr("stroke","white").attr("stroke-width",1)
            .on("mouseover", function(event,d){d3.select(this).transition().duration(200).attr("d", d3.arc().innerRadius(0).outerRadius(radius+15)); LabelChart.showTooltip(event,d,pieData);})
            .on("mousemove", function(event){d3.select(".tooltip").style("left",(event.pageX+15)+"px").style("top",(event.pageY-10)+"px");})
            .on("mouseout", function(event,d){d3.select(this).transition().duration(200).attr("d", arc); LabelChart.hideTooltip();});
        // Leyenda
        const legend = svg.append("g").attr("transform","translate(20,20)");
        pieData.forEach((d,i)=>{
            const legendRow = legend.append("g").attr("transform",`translate(0,${i*20})`).style("cursor","pointer")
                .on("mouseover",function(){svg.selectAll("path").filter((p,j)=>j===i).transition().duration(200).attr("fill", d3.rgb(CONFIG.colors.scheme[i%10]).darker(1));})
                .on("mouseout",function(){svg.selectAll("path").filter((p,j)=>j===i).transition().duration(200).attr("fill", CONFIG.colors.scheme[i%10]);});
            legendRow.append("rect").attr("width",12).attr("height",12).attr("fill", CONFIG.colors.scheme[i%10]);
            legendRow.append("text").attr("x",20).attr("y",10).text(`${d.label} (${d.count})`);
        });
    }
    static showTooltip(event, d, pieData) {
        this.hideTooltip();
        const total = d3.sum(pieData, dd=>dd.count);
        d3.select("body").append("div").attr("class","tooltip").style("position","absolute").style("background","rgba(0,0,0,0.85)")
            .style("color","#fff").style("padding","10px 16px").style("border-radius","6px").style("font-size","14px")
            .style("pointer-events","none").style("z-index","1000").style("left",(event.pageX+15)+"px").style("top",(event.pageY-10)+"px")
            .html(`<strong>${d.data.label}</strong><br/>Cantidad: <b>${d.data.count}</b><br/>Porcentaje: <b>${((d.data.count/total)*100).toFixed(1)}%</b>`);
    }
    static hideTooltip() { d3.selectAll(".tooltip").remove(); }
}
//========== GRÁFICO DE PALABRAS CLAVE ==========
class KeywordChart extends BaseChart {
    static draw() {
        const data = appState.getFilteredData();
        const dims = this.getSVGDimensionsById("#chart-keyword");
        const { svg, innerWidth, innerHeight } = dims;
        this.clearSVG(svg);
        const counts = DataProcessor.getDataCounts(data, d=>d.keyword||"Unknown");
        const sorted = DataProcessor.getTopN(counts, CONFIG.chart.topKeywords);
        const bubbleData = sorted.map(([keyword,count],index)=>({
            keyword,
            count,
            relevance: Math.random()*10+1,
            category: this.categorizeKeyword(keyword),
            x: Math.random()*innerWidth,
            y: Math.random()*innerHeight
        }));
        const sizeScale = d3.scaleSqrt().domain([0,d3.max(bubbleData,d=>d.count)]).range([10,50]);
        const colorScale = d3.scaleOrdinal().domain(['disaster_type','consequence','location','entity','other']).range(['#FF6B6B','#4ECDC4','#45B7D1','#F39C12','#96CEB4']);
        const simulation = d3.forceSimulation(bubbleData)
            .force("center", d3.forceCenter(innerWidth/2, innerHeight/2))
            .force("charge", d3.forceManyBody().strength(-100))
            .force("collision", d3.forceCollide().radius(d=>sizeScale(d.count)+2))
            .force("x", d3.forceX().strength(0.1))
            .force("y", d3.forceY().strength(0.1));
        const g = svg.append("g").attr("transform", `translate(${CONFIG.margin.left},${CONFIG.margin.top})`);
        const bubbles = g.selectAll(".bubble").data(bubbleData).join("g").attr("class","bubble");
        bubbles.append("circle").attr("r",0).attr("fill",d=>colorScale(d.category)).attr("fill-opacity",0.7).attr("stroke","#fff").attr("stroke-width",2)
            .on("mouseover",(event,d)=>{d3.select(event.currentTarget).transition().duration(200).attr("r", sizeScale(d.count)*1.2).attr("fill-opacity",1); KeywordChart.showTooltip(event,d);})
            .on("mouseout",(event,d)=>{d3.select(event.currentTarget).transition().duration(200).attr("r", sizeScale(d.count)).attr("fill-opacity",0.7); KeywordChart.hideTooltip();})
            .transition().delay((d,i)=>i*100).duration(800).attr("r",d=>sizeScale(d.count));
        bubbles.append("text").attr("text-anchor","middle").attr("dy","0.3em").style("font-size",d=>Math.min(sizeScale(d.count)/3,12)+"px").style("font-weight","bold").style("fill","#333").style("pointer-events","none").text(d=>d.keyword.length>8?d.keyword.substring(0,8)+"...":d.keyword);
        bubbles.append("text").attr("text-anchor","middle").attr("dy","1.5em").style("font-size",d=>Math.min(sizeScale(d.count)/4,10)+"px").style("fill","#666").style("pointer-events","none").text(d=>d.count);
        bubbles.call(d3.drag().on("start",(event,d)=>{if(!event.active) simulation.alphaTarget(0.3).restart(); d.fx=d.x; d.fy=d.y;}).on("drag",(event,d)=>{d.fx=event.x; d.fy=event.y;}).on("end",(event,d)=>{if(!event.active) simulation.alphaTarget(0); d.fx=null; d.fy=null;}));
        simulation.on("tick",()=>{g.selectAll(".bubble").attr("transform",d=>`translate(${d.x},${d.y})`);});
    }
    static categorizeKeyword(keyword) {
        const lower = keyword.toLowerCase();
        const disasterTypes = ['earthquake','fire','flood','explosion','hurricane','storm','tornado','tsunami','blizzard','drought','avalanche','landslide','bomb','wildfire','eruption','crash','wreck','collapse'];
        const consequences = ['evacuate','rescue','death','injured','destroyed','damage','ruins','burned','trapped','missing','casualty','emergency','alert','aid','looting','panic'];
        const locations = ['bridge','building','highway','school','hospital','airport','subway','powerplant','train','city','neighborhood'];
        const entities = ['firefighter','police','army','government','citizen','volunteer','ngo','redcross','media','un'];
        if(disasterTypes.some(term=>lower.includes(term))) return 'disaster_type';
        if(consequences.some(term=>lower.includes(term))) return 'consequence';
        if(locations.some(term=>lower.includes(term))) return 'location';
        if(entities.some(term=>lower.includes(term))) return 'entity';
        return 'other';
    }
    static showTooltip(event, d) {
        d3.selectAll(".tooltip").remove();
        const tooltip = d3.select("body").append("div").attr("class","tooltip").style("position","absolute").style("background","rgba(0,0,0,0.8)")
            .style("color","white").style("padding","10px").style("border-radius","5px").style("font-size","12px").style("pointer-events","none").style("z-index","1000");
        tooltip.html(`<strong>${d.keyword}</strong><br/>Frecuencia: ${d.count}<br/>Relevancia: ${d.relevance.toFixed(1)}<br/>Categoría: ${d.category}`)
            .style("left",(event.pageX+10)+"px").style("top",(event.pageY-10)+"px");
    }
    static hideTooltip() { d3.selectAll(".tooltip").remove(); }
}

// ========== MAPA DE UBICACIONES ==========
class LocationMap {
    static async draw() {
        const data = appState.getFilteredData();
        d3.select("#map-location").selectAll("*").remove();
        const width = d3.select("#map-location").node().clientWidth || 300;
        const height = d3.select("#map-location").node().clientHeight || 300;
        try {
            const world = await d3.json("world.geojson");
            const projection = d3.geoNaturalEarth1().fitSize([width, height], world);
            const path = d3.geoPath().projection(projection);
            const svg = d3.select("#map-location").append("svg").attr("width",width).attr("height",height);
            svg.append("g").selectAll("path").data(world.features).join("path").attr("d",path).attr("fill","#e0e0e0").attr("stroke","#999");
            const counts = d3.rollups(data, v=>v.length, d=>d.location.trim()).filter(([loc,cnt])=>loc && loc!="Unknown");
            const geoDict = {"Mexico":[-102.5528,23.6345],"USA":[-95.7129,37.0902],"United States":[-95.7129,37.0902],"Spain":[-3.7038,40.4168],"Madrid":[-3.7038,40.4168],"Argentina":[-63.6167,-38.4161],"Chile":[-71.542969,-35.675147],"Peru":[-75.0152,-9.189967],"Colombia":[-74.297333,4.570868],"Brazil":[-51.9253,-14.2350],"London":[-0.1276,51.5074],"Paris":[2.3522,48.8566],"Tokyo":[139.6917,35.6895]};
            const points = counts.map(([loc,cnt])=>{let coords=geoDict[loc];return coords?{loc,cnt,coords}:null;}).filter(d=>d);
            const maxCnt = d3.max(points,d=>d.cnt) || 1;
            const sizeScale = d3.scaleSqrt().domain([1,maxCnt]).range([5,30]);
            svg.append("g").selectAll("circle").data(points).join("circle")
                .attr("cx",d=>projection(d.coords)[0]).attr("cy",d=>projection(d.coords)[1]).attr("r",d=>sizeScale(d.cnt))
                .attr("fill","#69b3a2").attr("fill-opacity",0.7).attr("stroke","#333")
                .on("mouseover",function(event,d){ d3.select("#map-tooltip").remove(); d3.select("body").append("div").attr("id","map-tooltip").style("position","absolute").style("left",(event.pageX+10)+"px").style("top",(event.pageY-10)+"px").style("background","#fff").style("padding","8px 12px").style("border","1px solid #999").style("border-radius","4px").style("font-size","13px").style("pointer-events","none").style("z-index","1000").html(`<b>${d.loc}</b><br>${d.cnt} tweets`); })
                .on("mouseout",()=>d3.select("#map-tooltip").remove());
        } catch (err) {
            console.error("Error cargando world.geojson:", err);
        }
    }
}

// ========== WORD CLOUD ==========
class WordCloudChart extends BaseChart {
    static draw() {
        const data = appState.getFilteredData();
        const container = d3.select("#wordcloud-location");
        const width = container.node().clientWidth;
        const height = container.node().clientHeight;
        container.selectAll("*").remove();
        const allText = data.map(d=>d.text||"").join(" ").toLowerCase().replace(/[^\w\s]/g," ").replace(/\s+/g," ").trim();
        const words = allText.split(" ").filter(word=>word.length>2 && !CONFIG.wordcloud.stopWords.has(word) && !word.match(/^\d+$/));
        const counts = DataProcessor.getDataCounts(words,d=>d);
        const topWords = DataProcessor.getTopN(counts, CONFIG.wordcloud.maxWords);
        const maxCount = d3.max(topWords,d=>d[1])||1;
        const fontScale = d3.scaleLinear().domain([1,maxCount]).range([CONFIG.wordcloud.minFontSize, CONFIG.wordcloud.maxFontSize]);
        const wordsForCloud = topWords.map(([word,count])=>({text:word,size:fontScale(count),count}));
        const svg = container.append("svg").attr("width",width).attr("height",height);
        const g = svg.append("g").attr("transform",`translate(${width/2},${height/2})`);
        const centerRadius = Math.min(width,height)*0.15;
        const maxRadius = Math.min(width,height)*0.45;
        wordsForCloud.forEach((word,i)=>{
            const layer = Math.floor(i/8);
            const angleStep = (Math.PI*2)/8;
            const angle = (i%8)*angleStep + (layer*0.3);
            const baseRadius = centerRadius + (layer*(maxRadius-centerRadius)/Math.sqrt(wordsForCloud.length));
            const sizeAdj = (word.size/CONFIG.wordcloud.maxFontSize)*20;
            const radius = Math.min(baseRadius+sizeAdj, maxRadius);
            const noise = (Math.random()-0.5)*30;
            const x = Math.cos(angle)*radius + noise;
            const y = Math.sin(angle)*radius + noise;
            const textElem = g.append("text").datum(word).attr("x",x).attr("y",y).attr("text-anchor","middle").attr("dominant-baseline","middle").style("font-size",`${word.size}px`).style("font-family","Arial, sans-serif").style("font-weight",word.size>40?"bold":"normal").style("fill",CONFIG.colors.wordcloud(i)).style("cursor","pointer").style("opacity",0.9).text(word.text).style("transform","scale(0)").transition().duration(500).delay(i*50).style("transform","scale(1)").on("end",function(){ d3.select(this).on("mouseover",function(event,d){ d3.select(this).style("opacity",0.7).style("transform","scale(1.1)"); WordCloudChart.showWordTooltip(event,d); }).on("mouseout",function(event,d){ d3.select(this).style("opacity",0.9).style("transform","scale(1)"); WordCloudChart.hideWordTooltip(); }); });
        });
    }
    static showWordTooltip(event, word) {
        d3.selectAll("#word-tooltip").remove();
        const [x,y] = d3.pointer(event, document.body);
        d3.select("body").append("div").attr("id","word-tooltip").style("position","absolute").style("left",(x+10)+"px").style("top",(y-10)+"px").style("background","rgba(0,0,0,0.8)").style("color","white").style("padding","8px 12px").style("border-radius","4px").style("font-size","12px").style("pointer-events","none").style("z-index","1000").text(`"${word.text}": ${word.count} veces`);
    }
    static hideWordTooltip() { d3.selectAll("#word-tooltip").remove(); }
}

// ========== INICIALIZACIÓN ==========
class App {
    static init() {
        document.addEventListener("DOMContentLoaded", ()=>{
            this.loadData();
        });
    }
    static loadData() {
        d3.csv("tweets_interactivo.csv").then(data=>{
            const processedData = DataProcessor.preprocessData(data);
            appState.setData(processedData);
            UIController.setupControls();
            ViewManager.drawAllViews();
        }).catch(err=>console.error("Error cargando CSV:",err));
    }
}
App.init();