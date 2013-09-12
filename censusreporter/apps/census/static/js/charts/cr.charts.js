/*
Pass in an options object that includes data, get back a D3 chart.

Chart({
    chartContainer: chartID, # the ID of the element where the chart should be drawn
    chartType: chartType, # `pie` or `column` (TODO: more chart types)
    chartStatType: chartStatType, # pass in `percentage` to format display of data values accordingly
    chartHeight: chartHeight, # pass in int; defaults to height of parent container or 180, whichever is greater
    chartColorScale: chartColorScale, # name of scale defined in chart.colorbrewer, defaults to 'Set2'
    chartData: chartData # an object that can be mapped, returning `name` and `value` properties
})
*/

function Chart(options) {
    var chart = {};
    
    chart.init = function(options) {
        // establish our base vars
        chart.chartContainer = d3.select('#'+options.chartContainer);
        chart.parentHeight = chart.getParentHeight();
        chart.chartType = options.chartType;
        chart.chartStatType = options.chartStatType || 'number';
        chart.chartHeight = options.chartHeight || (chart.parentHeight < 180 ? 180 : chart.parentHeight);
        chart.chartColorScale = options.chartColorScale || 'Set2';
        chart.chartDataValues = d3.values(options.chartData).map(function(d) {
            return {
                name: d.name,
                value: +d.values.this
            }
        });
        
        // set height on container div for continuity
        chart.chartContainer.style("height", chart.chartHeight + "px");
        chart.settings = {
            width: parseInt(chart.chartContainer.style('width'), 10),
            height: chart.chartHeight
        }

        // time to make the chart
        chart.draw();
        return chart;
    };
    
    chart.draw = function() {
        // hand off based on desired type of chart
        if (chart.chartType == 'pie') {
            chart.makePieChart();
        } else if (chart.chartType == 'column' || chart.chartType == 'histogram') {
            chart.makeColumnChart();
        }
        return chart;
    }

    chart.makeColumnChart = function() {
        chart.chartContainer
            .classed("column-chart", true);
        
        // add basic settings specific to this chart type
        chart.updateSettings({
            margin: { top: 20, right: 0, bottom: 30, left: 30 },
            tickPadding: 5,
            outerColumnPadding: .25
        });
        chart.updateSettings({
            displayWidth: chart.settings.width - chart.settings.margin.left - chart.settings.margin.right,
            displayHeight: chart.settings.height - chart.settings.margin.top - chart.settings.margin.bottom
        });
        if (chart.chartType == 'histogram') {
            chart.updateSettings({
                columnPadding: .025
            });
        } else {
            chart.updateSettings({
                columnPadding: .2
            });
        }

        // primary svg container
        chart.base = chart.chartContainer.append("svg")
                .attr("class", "svg-chart")
                .attr("width", chart.settings.width)
                .attr("height", chart.settings.height)
            .append("g")
                .attr("transform", "translate(" + chart.settings.margin.left + "," + chart.settings.margin.top + ")");

        // x scale, axis and labels
        chart.x = d3.scale.ordinal()
            .rangeRoundBands([0, chart.settings.displayWidth], chart.settings.columnPadding, chart.settings.outerColumnPadding)
            .domain(chart.chartDataValues.map(function(d) { return d.name; }));

        chart.xAxisBase = chart.base.append("g")
            .attr("class", "x axis")
            .attr("transform", "translate(0," + (chart.settings.displayHeight + chart.settings.tickPadding) + ")");

        chart.xAxisLabels = chart.xAxisBase.selectAll("g")
                .data(chart.chartDataValues)
            .enter().append("g")
                    .classed("tick major", true)
                    .style("opacity", 1)
                    .attr("transform", function(d) {
                        return "translate(" + (chart.x(d.name) + (chart.x.rangeBand() / 2)) + ", 0)";
                    })
                .append("text")
                    .text(function(d) { return d.name; })
                    .attr("x", 0)
                    .attr("dy", ".71em")
                    .style("text-anchor", "middle");

        // y scale and axis, account for raw number vs. percentages
        if (chart.chartStatType == 'percentage') {
            var yDomain = [0, 100],
                yTickRange = d3.range(0, 101, 25);
        } else {
            var yValues = chart.chartDataValues.map(function(d) { return d.value; }),
                yDomain = [0, d3.max(yValues)],
                yTickRange = d3.range(0, (d3.max(yValues) + 1), (d3.max(yValues) / 4));
        }
        chart.y = d3.scale.linear()
            .range([chart.settings.displayHeight, 0])
            .domain(yDomain);
            
        chart.yAxis = d3.svg.axis()
            .scale(chart.y)
            .orient("left")
            .tickSize(-chart.settings.displayWidth)
            .tickPadding(chart.settings.tickPadding)
            .tickValues(yTickRange);

        chart.yAxisBase = chart.base.append("g")
            .attr("class", "y axis")
            .call(chart.yAxis);
            
        // add columns as <a> elements
        chart.columnGroup = chart.chartContainer.append("div")
            .attr("class", "column-group");

        chart.columns = chart.columnGroup.selectAll(".column")
                .data(chart.chartDataValues)
            .enter().append("a")
                .attr("class", "column")
                .style("background-color", chart.colorbrewer[chart.chartColorScale][0])
                .style("width", chart.x.rangeBand() + "px")
                .style("bottom", function(d) { return (chart.settings.margin.bottom + chart.settings.tickPadding - 1) + "px"; })
                .style("left", function(d) { return (chart.x(d.name) + chart.settings.margin.left) + "px"; })
                .style("height", function(d) { return (chart.settings.displayHeight - chart.y(d.value)) + "px"; });

        // label columns with values
        chart.labelGroup = chart.base.append("g")
            .attr("class", "column-group");

        chart.labels = chart.labelGroup.selectAll("text")
                .data(chart.chartDataValues)
            .enter().append("text")
                .text(function(d) {
                    return chart.pctFmt(d.value);
                })
                .attr("text-anchor", "middle")
                .attr("x", function(d) { return chart.x(d.name) + (chart.x.rangeBand() / 2); })
                .attr("y", function(d) { return chart.y(d.value) - 8; });

        return chart;
    }

    chart.makePieChart = function() {
        chart.chartContainer
            .classed("pie-chart", true);
            
        // make sure chart has enough room for full display
        var legendWidth = (chart.settings.width / 3)
        chart.updateSettings({
            legendWidth: legendWidth,
            radius: (Math.min((chart.settings.width - legendWidth), chart.settings.height) / 1.5)
        });

        // create array of categories specific to this chart
        chart.chartCategories = d3.values(chart.chartDataValues).map(function(d) {
            return d.name
        });
        
        // use ColorBrewer Set2 for pie charts
        chart.color = d3.scale.ordinal()
            .domain(chart.chartCategories)
            .range(chart.colorbrewer[chart.chartColorScale]);
        
        // adjust radii to set chart's size relative to container
        chart.arc = d3.svg.arc()
            .outerRadius(chart.settings.radius - 40)
            .innerRadius(chart.settings.radius / 2.5);

        // put this chart's data into D3 pie layout
        chart.pie = d3.layout.pie()
            .sort(null)
            .value(function(d) { return d.value; });
        chart.pieData = chart.pie(chart.chartDataValues);
        
        // get the max value for initial labeling
        chart.maxData = chart.pieData.slice(0).sort(chart.sortDataBy('-value'))[0];
        
        // primary svg container
        chart.chartContainer.style("height", chart.settings.height + "px");
        chart.base = chart.chartContainer.append("svg")
            .attr("class", "svg-chart")
            .attr("width", chart.settings.width)
            .attr("height", chart.settings.height);

        // group for arcs, to be added later
        chart.arcGroup = chart.base.append("g")
            .attr("class", "arc-group")
            .attr("transform", "translate(" + ((chart.settings.width / 2) - (chart.settings.legendWidth / 2)) + "," + chart.settings.height / 2 + ")");

        // center text group
        chart.centerGroup = chart.base.append("g")
            .attr("class", "center-group")
            .attr("transform", "translate(" + ((chart.settings.width / 2) - (chart.settings.legendWidth / 2)) + "," + chart.settings.height / 2 + ")");

        // center label
        chart.centerLabel = chart.centerGroup.append("text")
            .attr("class", "label-name")
            .attr("dy", -8)
            .attr("text-anchor", "middle");

        // center value
        chart.centerValue = chart.centerGroup.append("text")
            .attr("class", "label-value")
            .attr("dy", 14)
            .attr("text-anchor", "middle");

        // hover state highlights the arc and associated legend item,
        // and displays the data name and value in center of chart
        chart.arcHover = function(data) {
            chart.arcs
                .filter(function(d) {
                    return d == data;
                })
                .classed("hovered", true);
            chart.legendItems
                .filter(function(d) {
                    return d == data;
                })
                .classed("hovered", true);
            
            chart.centerLabel.text(data.data.name);
            chart.centerValue.text(function() {
                return chart.pctFmt(data.data.value);
            });
        }

        // return arc and associated legend item to normal styles
        chart.arcReset = function() {
            chart.arcs
                .classed("hovered", false);
            chart.legendItems
                .classed("hovered", false);

            chart.centerLabel.text(chart.maxData.data.name);
            chart.centerValue.text(chart.pctFmt(chart.maxData.data.value));
        }

        // add arc paths to arc group
        chart.arcs = chart.arcGroup.selectAll(".arc")
                .data(chart.pieData)
            .enter().append("path")
                .classed("arc", true)
                .attr("d", chart.arc)
                .style("fill", function(d) { return chart.color(d.data.name); });
                
        // listen for arc hovers
        chart.arcs.on("mouseover", chart.arcHover)
            .on("mouseout", chart.arcReset);
        
        // add legend, legend items
        chart.legend = chart.base.append("g")
                .attr("class", "legend")
                .attr("transform", "translate(" + ((chart.settings.width / 2) + (chart.settings.legendWidth / 2)) + ",30)");

        chart.legendItems = chart.legend.selectAll('g')
                .data(chart.pieData)
            .enter().append('g')
                .attr("class", "legend-item")
                .each(function(d, i) {
                    var g = d3.select(this);
                        g.append("rect")
                            .attr("y", i*18)
                            .attr("width", 10)
                            .attr("height", 10)
                            .style("fill", function(d) { return chart.color(d.data.name); });

                        g.append("text")
                            .attr("x", 15)
                            .attr("y", i*18 + 9)
                            .attr("height",30)
                            .text(d.data.name);
                });
                
        // add initial center label
        chart.arcReset();

        // listen for legend hovers
        chart.legendItems.on("mouseover", chart.arcHover)
            .on("mouseout", chart.arcReset);
        
        return chart;
    }
    
    // present percentages with % at the end
    chart.pctFmt = function(value) {
        if (chart.chartStatType == 'percentage' || chart.chartStatType == 'scaled-percentage') { value += '%' }
        return value;
    }
    
    chart.sortDataBy = function(field, sortFunc) {
        // allow reverse sorts, e.g. '-value'
        var sortOrder = (field[0] === "-") ? -1 : 1;
        if (sortOrder == -1) {
            field = field.substr(1);
        }
        
        // allow passing in a sort function
        var key = sortFunc ? function (x) { return sortFunc(x[field]); } : function (x) { return x[field]; };

        return function (a,b) {
            var A = key(a), B = key(b);
            return ((A < B) ? -1 : (A > B) ? +1 : 0) * sortOrder;
        }
    }
    
    chart.getParentHeight = function() {
        return parseInt(d3.select(chart.chartContainer.node().parentNode).style('height'), 10);
    }
    
    chart.updateSettings = function(newSettings) {
        for (var setting in newSettings) {
            chart.settings[setting] = newSettings[setting]
        }
    }
    
    // Colorbrewer color specifications and designs
    // by Cynthia Brewer (http://colorbrewer.org/)
    // https://github.com/mbostock/d3/tree/master/lib/colorbrewer
    chart.colorbrewer = {
        Greens: {
            2: ["#e5f5e0","#a1d99b"],
            3: ["#e5f5e0","#a1d99b","#31a354"],
            4: ["#edf8e9","#bae4b3","#74c476","#238b45"],
            5: ["#edf8e9","#bae4b3","#74c476","#31a354","#006d2c"],
            6: ["#edf8e9","#c7e9c0","#a1d99b","#74c476","#31a354","#006d2c"],
            7: ["#edf8e9","#c7e9c0","#a1d99b","#74c476","#41ab5d","#238b45","#005a32"],
            8: ["#f7fcf5","#e5f5e0","#c7e9c0","#a1d99b","#74c476","#41ab5d","#238b45","#005a32"],
            9: ["#f7fcf5","#e5f5e0","#c7e9c0","#a1d99b","#74c476","#41ab5d","#238b45","#006d2c","#00441b"]
        },
        RdBu: {
            2: ["#f7f7f7","#67a9cf"],
            3: ["#ef8a62","#f7f7f7","#67a9cf"],
            4: ["#ca0020","#f4a582","#92c5de","#0571b0"],
            5: ["#ca0020","#f4a582","#f7f7f7","#92c5de","#0571b0"],
            6: ["#b2182b","#ef8a62","#fddbc7","#d1e5f0","#67a9cf","#2166ac"],
            7: ["#b2182b","#ef8a62","#fddbc7","#f7f7f7","#d1e5f0","#67a9cf","#2166ac"],
            8: ["#b2182b","#d6604d","#f4a582","#fddbc7","#d1e5f0","#92c5de","#4393c3","#2166ac"],
            9: ["#b2182b","#d6604d","#f4a582","#fddbc7","#f7f7f7","#d1e5f0","#92c5de","#4393c3","#2166ac"],
            10: ["#67001f","#b2182b","#d6604d","#f4a582","#fddbc7","#d1e5f0","#92c5de","#4393c3","#2166ac","#053061"],
            11: ["#67001f","#b2182b","#d6604d","#f4a582","#fddbc7","#f7f7f7","#d1e5f0","#92c5de","#4393c3","#2166ac","#053061"]
        },
        Set1: ['#e41a1c', '#377eb8', '#4daf4a', '#984ea3', '#ff7f00', '#ffff33', '#a65628', '#f781bf', '#999999'],
        Set2: ['#66c2a5', '#fc8d62', '#8da0cb', '#e78ac3', '#a6d854', '#ffd92f', '#e5c494', '#b3b3b3'],
        Set3: ['#8dd3c7', '#ffffb3', '#bebada', '#fb8072', '#80b1d3', '#fdb462', '#b3de69', '#fccde5', '#d9d9d9', '#bc80bd', '#ccebc5', '#ffed6f'],
        Accent: ['#7fc97f', '#beaed4', '#fdc086', '#ffff99', '#386cb0', '#f0027f', '#bf5b17', '#666666']
    };

    // ready, set, go
    chart.init(options);
    return chart;
}