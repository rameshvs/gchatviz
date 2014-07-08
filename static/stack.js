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
    /** Returns an array of n evenly spaced points between a and b. */
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

normalize = function(arr) {
    /**
     * Returns a copy of arr whose rows are normalized (sum to 1).
     */
    // normalizes across rows
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
    // return {'names': obj.names, 'dates': obj.dates, 'counts': d3.transpose(out),
        // 'words': obj.words};
}

function stackprep(arr) {
    /** Prepares an array for use with d3's stacked layout */
    return arr.map(
            function(d, i) {
                return d.map(function(dat, j) { return {x: j, y: dat}; });
            });
}

var unstack = function(arr) {
    return arr.map(
            function(d, i) {
                return d.map(function(dat, j) { return dat.y; });
            });
}

// var sortSet = function(sort_by, arr, labels, n_to_keep) {
function argsort(arr) {
    // sortBy = original.counts.map(function(d) { return d3.sum(d.slice(120, d.length)); });

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
var n = 2, // number of layers
    m = 4, // number of samples per layer
    stack = d3.layout.stack();
var width = 1260,
    height = 500;

var svg = d3.select("#grapharea").append("svg")
    .attr("width", width)
    .attr("height", height);

var tooltipDiv = d3.select("body").append("div")
    .attr("class", "tooltip")
    .style("opacity", 1e-6);


// Hover line.
var hoverLineGroup = svg.append("g")
                    .attr("class", "hover-line");
var hoverLine = hoverLineGroup
    .append("line")
        .attr("x1", 10).attr("x2", 10)
        .attr("y1", 0).attr("y2", height)
        .style("opacity", 1e-6); // Hide hover line by default.

// objects w/"data" = raw counts, "names"+"dates" = axis labels
// var original;
var current;

var processedCounts;


// scales to map x and y into drawing area
var xScale, yScale;

// how to color the results
var colorScale = d3.scale.category20();
var stackArea = d3.svg.area();

// TODO make these checkboxes or allow interactivity
var doNormalization = true;
var doRenormalization = true; // should we renormalize after hiding people?
// not currently used: always sorts ascending (TODO implement)
// var sortType = 'ascending'; // 'none', 'ascending', or 'descending'
var processingFunctions = [blur]; // array of fns to call

var wasInitialized = false;
// topUsers include all users in "top". shownUsers excludes ones that
// the user clicked to hide
topUsers = []; // ordered array of users in top N (indices into 1:N)
var shownUsers = []; // array of booleans (logical index into 1:N)
var visibleNames = [];
var nUsersToShow;


//////////////////
// Drawing code //
//////////////////
d3.json('chats.json', function(error, raw) {
    if (error) {
        return console.warn(error);
    }
    _original = original = raw;
    current = $.extend(true, {}, original);
    current.counts = preprocessCounts(current.counts, processingFunctions);
    nUsersToShow = current.names.length;
    for (var i=0; i<current.names.length; i++) {
        topUsers[i] = i;
        shownUsers[i] = true;
    }
    topUsers = argsort(current.counts.map(function(d) { return d3.sum(d); }));
    draw(current, doNormalization);
});

function preprocessCounts(counts, processingFunctions) {
    var i;
    var result = counts;
    for (i=0; i < processingFunctions.length; i++) {
        result = processingFunctions[i](result);
    }
    return result;
}

var draw = function(data, doNormalization) {
    var i, userIdx;
    var zeros = [];
    var toDraw = [];
    for (i=0; i<data.counts[0].length; i++) {
        zeros[i] = 0;
    }
    if (doRenormalization) {
        for (i=0; i< current.names.length; i++) {
            if (!shownUsers[i]) {
                current.counts[i] = zeros;
            }
        }
    }
    // TODO smarter caching: not every call requires all this stuff
    if (doNormalization) {
        data.counts = d3.transpose(normalize(d3.transpose(data.counts)));
    }

    visibleNames = [];

    for (i=0; i<nUsersToShow; i++) {
        userIdx = topUsers[i];
        visibleNames.push(data.names[userIdx]);
        if (shownUsers[userIdx]) {
            console.log("showing " + userIdx);
            toDraw.push(data.counts[userIdx]);
        } else {
            console.log("hiding " + userIdx);
            toDraw.push(zeros);
        }
    }
    console.log(toDraw);
    toDraw = stack(stackprep(toDraw));
    setScales(toDraw);
    if (wasInitialized) {
        d3.selectAll("path")
            .data(toDraw)
            .transition()
            .duration(1300)
            .attr("d", stackArea);
    } else {
        svg.selectAll("path")
            .data(toDraw)
            .enter().append("path")
            .attr("d", stackArea)
            .on("mouseover", mouseover) // see below for callback defns
            .on("mousemove", mousemove)
            .on("click", mouseclick)
            .on("mouseout", mouseout)
            .style("fill", function(d, i) { return colorScale(i); });
        wasInitialized = true;
    }

}

// callbacks for mouse actions
var mouseover = function() {
  tooltipDiv.transition()
      .duration(200)
      .style("opacity", 1);
}

var mousemove = function(d, i) {
    var xy = d3.mouse(svg[0][0]);
    var xCoord = Math.floor(xScale.invert(xy[0]));
  tooltipDiv
      .text(visibleNames[i] + ", " + original.dates[xCoord] + ": " + (100 * d[xCoord].y).toFixed(1) + "%")
      .style("left", (d3.event.pageX + 15) + "px")
      .style("top", (d3.event.pageY - 12) + "px");
  hoverLine.attr("x1", xy[0])
      .attr("x2", xy[0])
      .attr("y1", yScale(d[xCoord].y0))
      .attr("y2", yScale(d[xCoord].y0 + d[xCoord].y))
      .style("opacity", 1);
}

var mouseout = function() {
  tooltipDiv.transition()
      .duration(200)
      .style("opacity", 1e-6);
    hoverLine.style("opacity", 1e-6);
}

var mouseclick = function(d, i) {
    var userIdx = topUsers[i];

    console.log(i);
    console.log(userIdx);
    shownUsers[userIdx] = false;
    console.log(shownUsers);
    draw(current, doNormalization);
}



var setScales = function(preprocessedInput) {
    xScale = d3.scale.linear()
        .domain([0, preprocessedInput[0].length])
        .range([0, width]);

    yScale = d3.scale.linear()
        .domain([0, d3.max(preprocessedInput, function(layer) { return d3.max(layer, function(d) { return d.y0 + d.y; }); })])
        .range([height, 0]);

    stackArea.x(function(d) { return xScale(d.x); })
             .y0(function(d) { return yScale(d.y0); })
             .y1(function(d) { return yScale(d.y0 + d.y); });

}
});
