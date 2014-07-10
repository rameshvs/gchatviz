$(window).load(function () {
///////////////////////
// Utility functions //
///////////////////////
function cumsum(arr, axis) {
    /**
     * Takes the cumulative sum along a particular axis.
     * Only works on 2D arrays.
     */
    var i, j, out;
    if (axis === 0) {
        out = d3.transpose(arr);
    } else {
        out = $.extend(true, [], arr);
    }
    for (i=0; i < out.length; i++) {
        var total = 0;
        for (j=0; j < out[i].length; j++) {
            total += out[i][j];
            out[i][j] = total;
        }
    }
    if (axis === 0) {
        out = d3.transpose(out);
    }
    return out;
}

function convolve1d(arr, filter) {
    /**
     * Convolves the 1D filter with every row of the 2D arr.
     * (to convolve along columns, transpose the array first)
     * Values at the left boundary are treated as 0.
     */
    var i, j, k;
    var out = $.extend(true, [], arr);
    for (i=0; i < out.length; i++) {
        for (j=0; j < out[i].length; j++) {
            val = 0;
            for (k=0; k < Math.min(filter.length, j+1); k++) {
                val += arr[i][j-k] * filter[k];
            }
            out[i][j] = val;
        }
    }
    return out;
}

function linspace(a, b, n) {
    /**
     * Returns an array of n evenly spaced points between a and b.
     */
    var stepsize = (b-a)/(n-1);
    var arr = [];
    arr.length = n;
    var value = a;
    for (i=0; i < n; i++) {
        arr[i] = value;
        value += stepsize;
    }
    return arr;
}

function blur(arr, sigma) {
    /**
     * Blurs each row of arr with a Gaussian kernel with the given signa.
     * Behavior at the right edge may be non-ideal due to clipping in conv1d.
     */
    if (sigma === undefined) {
        sigma = 1;
    }
    // first, construct gaussian kernel
    var kernel = [];
    var sum = 0;
    var i;
    kernel.length = Math.floor(sigma * 5);
    for (i=0; i<kernel.length; i++) {
        kernel[i] = Math.exp(-Math.pow(i-2, 2)/(2 * Math.pow(sigma, 2)));
        sum += kernel[i];
    }
    for (i=0; i<kernel.length; i++) {
        kernel[i] /= sum;
    }
    return arr;
}

function normalize(arr) {
    /**
     * Returns a copy of arr whose rows sum to 1.
     */
    var out = $.extend(true, [], arr);
    var i, j, sum;
    for (i=0; i<out.length; i++) {
        sum = 0;
        for (j=0; j<out[i].length; j++) {
            sum += out[i][j];
        }
        if (sum === 0) {
            continue;
        }
        for (j=0; j<out[i].length; j++) {
            out[i][j] /= sum;
        }
    }
    return out;
}


function argsort(arr) {
    /**
     * Returns indices of sorted elements in arr
     */
    var zipped, unzipped, j;
    var indices = [];
    for (j=0; j<arr.length; j++) {
        indices[j] = j;
    }
    zipped = d3.zip(arr, indices);
    zipped.sort(function(left, right) { return right[0] - left[0]; });
    unzipped = d3.transpose(zipped);
    return unzipped[1];
}
//////////////////////////
// Variable definitions //
//////////////////////////
var MAIN_WIDTH = 1260,
    MAIN_HEIGHT = 500;

var CONTROL_SIZE = 22;
var PANEL_WIDTH = 500,
    PANEL_HEIGHT = 500;

var original, dataList;
var xScale, yScale;
var colorScale = d3.scale.category20();
var stackArea = d3.svg.area();
var stack = d3.layout.stack()
        .values(function(d) { return d.stacked; });

var panelSVG = d3.select('#controlpanel').append('svg')
    .attr('width', PANEL_WIDTH)
    .attr('height', PANEL_HEIGHT);
var areaSVG = d3.select("#grapharea").append("svg")
    .attr("width", MAIN_WIDTH)
    .attr("height", MAIN_HEIGHT);
var tooltipDiv = d3.select("body").append("div")
    .attr("class", "tooltip")
    .style("opacity", 1e-6);
var reselectControl;
// TODO make these checkboxes or allow interactivity
// TODO make it renormalize once a checkbox is clicked
var doNormalization = true;

d3.json('chats.json', function(error, raw) {
    if (error) {
        return console.warn(error);
    }
    _original = raw;
    data = $.extend(true, {}, raw);
    data.counts = blur(data.counts); // TODO make this optional
    data.normCounts = d3.transpose(normalize(d3.transpose(data.counts)));
    dataList = [];
    var sortedUsers = argsort(data.counts.map(function(d) { return d3.sum(d); }));
    for (var idx=0; idx<data.counts.length; idx++) {
        i = sortedUsers[idx];
        var obj = {};
        for (var attr in data) {
            if (data.hasOwnProperty(attr) && (attr !== "dates")) {
                obj[attr] = data[attr][i];
            }
        }
        var stackData = doNormalization ? obj.normCounts : obj.counts;
        obj.stacked = stackData.map(function(d, j) { return {"x": j, "y": d}; });
        obj.hidden = false;
        obj.hiddenCount = 0;
        dataList.push(obj);
    }
    dataList = stack(dataList);
    var xScale = d3.scale.linear()
        .domain([0, raw.dates.length])
        .range([0, MAIN_WIDTH]);

    var ymax = d3.max(dataList, function(layer) { return d3.max(layer.stacked, function(d) { return d.y0 + d.y; }); });
    var yScale = d3.scale.linear()
        .domain([0, ymax])
        .range([MAIN_HEIGHT, 0]);

    stackArea
        .x(function(d) { return xScale(d.x); })
        .y0(function(d) { return yScale(d.y0); })
        .y1(function(d) { return yScale(d.y0 + d.y); });
    var paths = areaSVG.selectAll("path")
        .data(dataList)
        .enter().append("path")
        .attr("d", function(d, i) { return stackArea(d.stacked, i); })
        .style("fill", function(d, i) { return colorScale(i); })
        .on("mouseover", function() {
            d3.select(this).style("cursor", "pointer");
            tooltipDiv.transition()
                .duration(200)
                .style("opacity", 1);
        })
        .on("mousemove", function(d, i) {
            // TODO more efficient tooltip
            var xy = d3.mouse(areaSVG[0][0]);
            var xCoord = Math.floor(xScale.invert(xy[0]));
            var numInfo;
            if (doNormalization) {
                numInfo = (100 * d.stacked[xCoord].y).toFixed(1) + "%";
            } else {
                numInfo = d.stacked[xCoord].y + " words";
            }
            tooltipDiv
                .text(d.names + ", " + data.dates[xCoord] + ": " + numInfo)
                .style("left", (d3.event.pageX + 15) + "px")
                .style("top", (d3.event.pageY - 12) + "px");
        })
        .on("mouseout", function() {
            d3.select(this).style("cursor", "normal");
            tooltipDiv.transition()
                .duration(200)
                .style("opacity", 1e-6);
        })
        .on("click", function(d, i) {
            for (var j=0; j<d.stacked.length; j++) {
                d.stacked[j].y = 0;
            }
            d.hidden = true;
            redraw();
        });
    // TODO add a "total volume" plot right below the reference
    reselectControl = panelSVG.selectAll("g")
        .data(dataList)
        .enter().append("g")
        .attr("class", "reselect-control")
        .style("visibility", "hidden")
        .on("click", function(d, i) {
            var origValues = doNormalization ? d.normCounts : d.counts;
            for (var j=0; j<d.stacked.length; j++) {
                d.stacked[j].y = origValues[j];
            }
            d.hidden = false;
            redraw();
        });
    var reselectRect = reselectControl.append("rect")
        .attr("rx", "5px")
        .attr("ry", "5px")
        .attr("width", CONTROL_SIZE + "px")
        .attr("height", CONTROL_SIZE + "px")
        .style("fill", function(d, i) { return colorScale(i); });
    var reselectText = reselectControl.append("text")
        .text(function(d) { return d.names; })
        .attr("transform", "translate(" + (CONTROL_SIZE*1.2) + "," + (CONTROL_SIZE) + ")")
        .style("font", CONTROL_SIZE + "px sans-serif")
        .on("mouseover", function(d, i) {
            d3.select(this).style("cursor", "pointer");
        })
        .on("mouseout", function() {
            d3.select(this).style("cursor", "normal");
        });
});

function redraw() {
    dataList = stack(dataList);
    var j, idx = 0;
    for (j=0; j<dataList.length; j++) {
        dataList[j].hiddenCount = idx;
        idx += dataList[j].hidden;
    }
    areaSVG.selectAll("path")
        .transition()
        .duration(1200)
        .attr("d", function(d, i) { return stackArea(d.stacked, i); });
    reselectControl
        .attr("transform", function(d, i) { return "translate(0, " + (d.hiddenCount * CONTROL_SIZE * 1.25) + ")"; })
        .style("visibility", function(d, i) { return d.hidden ? "visible" : "hidden"; });
}
});

