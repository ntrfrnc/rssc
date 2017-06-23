// Register service worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js');
}

var tools = {
  extend: function (targetObj, sourceObj) {
    for (var key in sourceObj) {
      if (sourceObj.hasOwnProperty(key)) {
        targetObj[key] = sourceObj[key];
      }
    }
    return targetObj;
  }
};

var statLib = {
  min: function (values) {
    return values.reduce(function (prev, curr) {
      return (prev < curr ? prev : curr);
    });
  },

  max: function (values) {
    return values.reduce(function (prev, curr) {
      return (prev > curr ? prev : curr);
    });
  },

  sum: function (values) {
    return values.reduce(function (prev, curr) {
      return curr += prev;
    });
  },

  mean: function (values, sum) {
    var self = this;

    var n = values.length;
    sum = (sum === void(0)) ? self.sum(values) : sum;

    return sum / n;
  },

  median: function (values) {
    values = [].concat(values);
    values.sort(function (a, b) {
      return a - b;
    });

    var lowMiddle = Math.floor((values.length - 1) / 2);
    var highMiddle = Math.ceil((values.length - 1) / 2);
    return (values[lowMiddle] + values[highMiddle]) / 2;
  },

  variance: function (values, mean) {
    var self = this;

    mean = (mean === void(0)) ? self.mean(values) : mean;
    var n = values.length;

    var dev = 0;

    for (var i = n; i--; ) {
      dev += Math.pow(mean - values[i], 2);
    }

    return dev / n;
  },

  stdDeviation: function (values, variance) {
    var self = this;

    variance = (variance === void(0)) ? self.variance(values) : variance;

    return Math.sqrt(variance);
  },

  uncertainty: function (values, variance) {
    var self = this;

    variance = (variance === void(0)) ? self.variance(values) : variance;
    var n = values.length;

    return Math.sqrt((variance * n) / (n * (n - 1)));
  }
};

var dataHandler = {
  init: function (opts) {
    var self = this;
    /*
     * opts = {
     *   input: (DOM object - text input or textarea)
     *   onChange: function (values - 1D or 2D array, columns) {}
     * }
     */
    self.opts = opts;

    self.separator = null;
    self.separatorPattern = '[\\t, \\|;]';
    self.numberPattern = '\\-?\d+\\.?\\d*e\\-?\\+?\\d+|\\-?\\d*\\.?\\d+';
    self.numberCellPattern = self.numberPattern + '((' + self.separatorPattern + ')|$)';
    self.numberRegExp = new RegExp(self.numberPattern);
    self.numberCellRegExp = new RegExp(self.numberCellPattern);
    self.numericLineRegExp = new RegExp('^(' + self.numberCellPattern + ')+');

    self.opts.input.addEventListener('input', function (e) {
      self.processData.call(self, e.target.value);
    }, false);

    return self;
  },

  processData: function (data) {
    var self = this;

    if (data.length < 1) {
      self.opts.onChange(null, []);
      return;
    }

    var dataLines = data.split('\n');
    var valuesLineIndex = self.getFirstNumericDataLineIndex(dataLines);

    if (valuesLineIndex === -1) {
      self.opts.onChange(null, []);
      console.warn('Unsupported data detected');
      return;
    }

    self.separator = self.extractSeparator(dataLines[valuesLineIndex]);

    var columnsLabels;
    var values;

    if (self.separator === void(0)) { // one column data
      columnsLabels = self.getColumnLabel(dataLines, valuesLineIndex);
      values = self.get1DValues(dataLines, valuesLineIndex);
    } else { // multi-column data
      columnsLabels = self.getColumnsLabels(dataLines, valuesLineIndex);
      values = self.reparseValuesArray(self.get2DValues(dataLines, valuesLineIndex), columnsLabels.length);
    }

    // Invoke callback
    if (typeof self.opts.onChange === 'function') {
      self.opts.onChange(values, columnsLabels);
    }
  },

  extractCells: function (dataLine) {
    var self = this;

    return dataLine.split(self.separator);
  },

  extractSeparator: function (dataLine) {
    var self = this;

    return dataLine.match(self.numberCellRegExp)[2];
  },

  get1DValues: function (dataLines, startLine) {
    var valuesArray = [];

    for (var i = startLine; i < dataLines.length; i++) {
      if (dataLines[i] === '') {
        continue;
      }

      valuesArray.push(Number(dataLines[i]));
    }

    return valuesArray;
  },

  get2DValues: function (dataLines, startLine) {
    var self = this;

    var valuesArray = [];
    var lineValues;

    for (var i = startLine; i < dataLines.length; i++) {
      lineValues = self.extractCells(dataLines[i]);

      if (lineValues.length < 2 && lineValues[0] === '') {
        continue;
      }

      valuesArray.push(lineValues);
    }

    return valuesArray;
  },

  reparseValuesArray: function (values, columns) {
    var valArray = [];

    for (var i = 0; i < columns; i++) {
      valArray.push([]);
    }

    for (var j = 0; j < values.length; j++) {
      for (var k = 0; k < columns; k++) {
        valArray[k].push(Number(values[j][k]));
      }
    }

    return valArray;
  },

  getFirstNumericDataLineIndex: function (dataLines) {
    var self = this;

    var numericDataFound = false;

    for (var i = 0; i < dataLines.length; i++) {
      if (self.numericLineRegExp.test(dataLines[i])) {
        numericDataFound = true;
        break;
      }
    }

    return numericDataFound ? i : -1;
  },

  getColumnsLabels: function (dataLines, valuesLineIndex) {
    var self = this;

    var columns = self.extractCells(dataLines[valuesLineIndex]).length;

    if (valuesLineIndex > 0) {
      var columnLabels = self.extractCells(dataLines[valuesLineIndex - 1]);

      if (columnLabels.length === columns) {
        // there is at least one line of header and it contains columns labels
        return columnLabels;
      }
    }

    // If there is no column labels in header
    return self.generateColumnsLabels(columns);
  },

  getColumnLabel: function (dataLines, valuesLineIndex) {
    var self = this;

    if (valuesLineIndex > 0) {
      var label = dataLines[valuesLineIndex - 1];

      if (label !== '') {
        return [label];
      }
    }

    // If there is no column label in header
    return self.generateColumnsLabels(1);
  },

  generateColumnsLabels: function (columns) {
    var labels = [];

    for (var i = 0; i < columns; i++) {
      labels.push('Column ' + i);
    }

    return labels;
  }
};

var statCalc = {
  init: function (opts) {
    var self = this;
    /*
     * opts = {
     *   columnSelectorWrapper: (DOM object)
     *   out:{
     *     min: (DOM object - text input)
     *     max: (DOM object - text input)
     *     sum: (DOM object - text input)
     *     mean: (DOM object - text input)
     *     median: (DOM object - text input)
     *     variance: (DOM object - text input)
     *     stdDeviation: (DOM object - text input)
     *     uncertainty: (DOM object - text input)
     *   }
     * }
     */
    self.opts = opts;

    self.columnSelector = null;
    self.selectedColumn = 0;
    self.lastColumnsLabels = [];
    self.lastData = null;

    self.rebuildColumnSelector(0);
    self.opts.columnSelector.addEventListener('change', self.onColumnChange.bind(self));

    return self;
  },

  calculate: function (data, columnsLabels) {
    var self = this;

    self.lastData = data;

    if (!data) {
      self.clear();
      return;
    }

    self.lastColumnsLabels = columnsLabels;
    self.rebuildColumnSelector(columnsLabels);

    var values = (columnsLabels.length > 1) ? data[self.selectedColumn] : data;

    // Calculate stats
    self.opts.out.min.value = statLib.min(values);
    self.opts.out.max.value = statLib.max(values);
    self.opts.out.sum.value = statLib.sum(values);
    self.opts.out.mean.value = statLib.mean(values, self.opts.out.sum.value);
    self.opts.out.median.value = statLib.median(values);
    self.opts.out.variance.value = statLib.variance(values, self.opts.out.mean.value);
    self.opts.out.stdDeviation.value = statLib.stdDeviation(values, self.opts.out.variance.value);
    self.opts.out.uncertainty.value = statLib.uncertainty(values, self.opts.out.variance.value);
  },

  onColumnChange: function (e) {
    var self = this;

    var select = e.target;
    self.selectedColumn = Number(select.options[select.selectedIndex].value);

    self.calculate(self.lastData, self.lastColumnsLabels);
  },

  rebuildColumnSelector: function (columnsLabels) {
    var self = this;

    if (!columnsLabels || columnsLabels.length === 0) {
      self.opts.columnSelector.innerHTML = '<option>No columns detected</option>';
      return;
    }

    self.opts.columnSelector.innerHTML = '';
    var frag = document.createDocumentFragment();

    for (var i = 0; i < columnsLabels.length; i++) {
      var opt = document.createElement('option');
      opt.innerHTML = columnsLabels[i];
      opt.value = i;
      frag.appendChild(opt);
    }

    self.opts.columnSelector.appendChild(frag);

    if (self.selectedColumn + 1 > self.lastColumnsNumber) {
      self.selectedColumn = 0;
    }

    self.opts.columnSelector.selectedIndex = self.selectedColumn;
  },

  clear: function () {
    var self = this;

    Object.keys(self.opts.out).forEach(function (key) {
      self.opts.out[key].value = '';
    });

    self.rebuildColumnSelector();
    self.lastColumnsNumber = 0;
  }
};

var plotter = {
  init: function (opts) {
    var self = this;

    /*
     * opts = {
     *   wrapper: (DOM object)
     *   axisSelector:{
     *     x: (DOM object - select)
     *     y: (DOM object - select)
     *   }
     * }
     */

    self.opts = opts;

    self.chart = new Dygraph(
            opts.wrapper,
            [[0, 0], [1, 0]],
            {
              legend: 'always',
              strokeWidth: 1.5,
              labels: ['X', 'Y'],
              showRangeSelector: true,
              rangeSelectorPlotFillColor: '#fff',
              rangeSelectorPlotFillGradientColor: '#333',
              rangeSelectorPlotStrokeColor: '#eee',
              rangeSelectorForegroundStrokeColor: 'rgba(255,255,255,0.6)',
              rangeSelectorForegroundLineWidth: 0.5,
              colorValue: 0.9,
              fillAlpha: 0.4,
              colors: ['#aaee55', '#EF767A', '#23F0C7', '#6665DD', '#FFE366', '#1C5Dff', '#705246', '#F9DEC9']
            }
    );
    self.selectedAxis = {
      x: 0,
      y: [1]
    };
    self.lastColumnsLabels = [];
    self.lastData = null;

    self.opts.axisSelector.y.multiple = true;
    self.opts.axisSelector.y.size = 3;
    self.rebuildAxisSelector(0, 'x');
    self.rebuildAxisSelector(0, 'y');
    self.opts.axisSelector.x.addEventListener('change', self.onXAxisChange.bind(self));
    self.opts.axisSelector.y.addEventListener('change', self.onYAxisChange.bind(self));
  },

  plot: function (data, columnsLabels) {
    var self = this;

    self.lastData = data;
    self.lastColumnsLabels = columnsLabels;

    var labels;
    switch (columnsLabels.length) {
      case 0:
        labels = ['X', 'Y'];
        self.rebuildAxisSelector(0, 'x');
        self.rebuildAxisSelector(0, 'y');
        break;

      case 1:
        labels = ['X', columnsLabels[0]];
        self.rebuildAxisSelector(['Auto increment'], 'x');
        self.rebuildAxisSelector(columnsLabels, 'y');
        break;

      default:
        labels = [columnsLabels[self.selectedAxis.x]];
        labels = labels.concat(self.selectedAxis.y.map(function (i) {
          return columnsLabels[i];
        }));
        self.rebuildAxisSelector(columnsLabels, 'x');
        self.rebuildAxisSelector(columnsLabels, 'y');
    }

    self.chart.updateOptions({
      labels: labels,
      xlabel: labels[0],
      file: self.reparseDataToSeries(data, columnsLabels)
    });
  },

  reparseDataToSeries: function (data, columnsLabels) {
    var self = this;

    if (data === null) {
      return [[0, 0], [1, 0]];
    }

    var series = [];

    if (columnsLabels.length < 2) {
      for (var i = 0; i < data.length; i++) {
        series.push([i, data[i]]);
      }
    } else {
      for (var k = 0; k < data[0].length; k++) {
        series.push([data[self.selectedAxis.x][k]]);
        for (var j = 0; j < self.selectedAxis.y.length; j++) {
          series[k].push(data[self.selectedAxis.y[j]][k]);
        }
      }
    }

    return series;
  },

  onXAxisChange: function (e) {
    var self = this;

    var select = e.target;
    self.selectedAxis.x = Number(select.options[select.selectedIndex].value);

    self.plot(self.lastData, self.lastColumnsLabels);
  },

  onYAxisChange: function (e) {
    var self = this;

    var select = e.target;
    self.selectedAxis.y = [].filter.call(select.options, function (o) {
      return o.selected;
    }).map(function (o) {
      return Number(o.value);
    });

    self.plot(self.lastData, self.lastColumnsLabels);
  },

  rebuildAxisSelector: function (columnsLabels, axis) {
    var self = this;

    if (!columnsLabels || columnsLabels.length === 0) {
      self.opts.axisSelector[axis].innerHTML = '<option>No data available</option>';
      return;
    }

    self.opts.axisSelector[axis].innerHTML = '';
    var frag = document.createDocumentFragment();

    for (var i = 0; i < columnsLabels.length; i++) {
      var opt = document.createElement('option');
      opt.innerHTML = columnsLabels[i];
      opt.value = i;
      frag.appendChild(opt);
    }

    self.opts.axisSelector[axis].appendChild(frag);

    switch (axis) {
      case 'x':
        if (self.selectedAxis[axis] + 1 > self.lastColumnsLabels.length) {
          self.selectedAxis[axis] = 0;
        }
        self.opts.axisSelector[axis].selectedIndex = self.selectedAxis[axis];
        break;

      case 'y':
        if (self.selectedAxis[axis][self.selectedAxis[axis].length - 1] > self.lastColumnsLabels.length) {
          self.selectedAxis[axis] = [1];
        }
        for (var j = 0; j < self.selectedAxis[axis].length; j++) {
          self.opts.axisSelector[axis].options[self.selectedAxis[axis][j]].selected = true;
        }
        break;
    }

  }
};

var dictate = {
  init: function (opts) {
    var self = this;

    self.opts = {
      // toggler: (DOM object - checkbox),
      // input: (DOM object - text input or textarea),
      // onNoSupport: function(){},
      continous: true,
      lang: 'pl-PL'
    };

    tools.extend(self.opts, opts);

    try {
      var SpeechRecognition = SpeechRecognition || webkitSpeechRecognition;

      if (SpeechRecognition === void(0)) { // No speech recognition support
        if (typeof self.opts.onNoSupport === 'function') {
          self.opts.onNoSupport();
        }

        return;
      }
    } catch (err) {
      if (typeof self.opts.onNoSupport === 'function') {
        self.opts.onNoSupport();
      }

      return;
    }

    self.recognition = new SpeechRecognition();
    self.recognition.continuous = self.opts.continuous;
    self.recognition.lang = self.opts.lang;

    self.recognition.onresult = self.onResult.bind(self);
    self.recognition.onaudioend = function () {
      self.opts.toggler.checked = false;
    };

    self.opts.toggler.addEventListener('change', self.toggle.bind(self), false);

    return self;
  },

  toggle: function (e) {
    var self = this;

    if (e.target.checked) {
      self.start();
    } else {
      self.stop();
    }
  },

  start: function () {
    var self = this;

    self.recognition.start();
  },

  stop: function () {
    var self = this;

    self.recognition.stop();
  },

  onResult: function (e) {
    var self = this;

    var transcript = '';

    if (typeof (e.results) === 'undefined') {
      return;
    }

    for (var i = e.resultIndex; i < e.results.length; ++i) {
      if (e.results[i]) {
        transcript += e.results[i][0].transcript;
      }
    }

    self.opts.input.value += transcript + '\n';

    event = new Event('input');
    self.opts.input.dispatchEvent(event);
  }
};

var fileChooser = {
  init: function (opts) {
    var self = this;
    /*
     * opts = {
     *   fileInput: (DOM object - file input)
     *   dropBox: (DOM object)
     *   allowedFileMIMEsPattern: (RegExp) e.g. /text\/*/
    /*   onChoose: function (files) {}
     *   onError: function (errorMsg) {}
     * }
     */
    self.opts = opts;

    self.addEventListeners(self.opts.dropBox, 'drag dragstart dragend dragover dragenter dragleave drop', function (e) {
      e.preventDefault();
      e.stopPropagation();
    });
    self.addEventListeners(self.opts.dropBox, 'dragover dragenter', function (e) {
      self.opts.dropBox.classList.add('is-dragover');
    });
    self.addEventListeners(self.opts.dropBox, 'dragleave dragend drop', function (e) {
      self.opts.dropBox.classList.remove('is-dragover');
    });
    self.addEventListeners(self.opts.dropBox, 'drop', self.onDrop);
    self.addEventListeners(self.opts.fileInput, 'change', self.onInput);

    return self;
  },

  onDrop: function (e) {
    var self = this;
    var item = e.dataTransfer.items[0];

    if (item.kind === 'file' && self.opts.allowedFileMIMEsPattern.test(item.type)) {
      self.opts.onChoose(e.dataTransfer.files[0]);
    } else {
      if (typeof self.opts.onError === 'function') {
        self.opts.onError('Chosen file has unsupported format.');
      }
    }
  },

  onInput: function (e) {
    var self = this;

    if (e.target.files.length < 1) {
      return;
    }

    var file = e.target.files[0];

    if (self.opts.allowedFileMIMEsPattern.test(file.type)) {
      self.opts.onChoose(file);
    } else {
      if (typeof self.opts.onError === 'function') {
        self.opts.onError('Chosen file has unsupported format.');
      }
    }
  },

  addEventListeners: function (element, events, fn) {
    var self = this;

    events.split(' ').forEach(function (event) {
      element.addEventListener(event, fn.bind(self), false);
    });
  }
};

/**
 * Initializations ---------------------------------------------------------- >
 */

statCalc.init({
  columnSelector: document.getElementById('calcColumnSelector'),
  out: {
    min: document.getElementById('minValue'),
    max: document.getElementById('maxValue'),
    sum: document.getElementById('sumValue'),
    mean: document.getElementById('meanValue'),
    median: document.getElementById('medianValue'),
    variance: document.getElementById('varianceValue'),
    stdDeviation: document.getElementById('stdDeviationValue'),
    uncertainty: document.getElementById('uncertaintyValue')
  }
});

plotter.init({
  wrapper: document.getElementById('plotWrapper'),
  axisSelector: {
    x: document.getElementById('XAxisSelector'),
    y: document.getElementById('YAxisSelector')
  }
});

dataHandler.init({
  input: document.getElementById('inpuData'),
  onChange: function (data, columns) {
    statCalc.calculate(data, columns);
    plotter.plot(data, columns);
  }
});

dictate.init({
  toggler: document.getElementById('dictateToggler'),
  input: statCalc.opts.input,
  onNoSupport: function () {
    document.getElementById('dictateToggler').parentNode.style.display = 'none';
  }
});

fileChooser.init({
  fileInput: document.getElementById('fileInput'),
  dropBox: document.body,
  allowedFileMIMEsPattern: /text\/*|^$/,
  onChoose: function (file) {
    var reader = new FileReader();

    reader.onload = function (e) {
      dataHandler.opts.input.value = e.target.result;
      event = new Event('input');
      dataHandler.opts.input.dispatchEvent(event);
    };
    reader.onerror = function (e) {
      console.error(e);
    };

    reader.readAsText(file);
  },
  onError: function (errorMsg) {
    alert(errorMsg);
  }
});