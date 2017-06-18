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

    self.opts.input.addEventListener('input', function (e) {
      self.processData.call(self, e.target.value);
    }, false);

    return self;
  },

  processData: function (data) {
    var self = this;

    if (data.length < 1) {
      self.opts.onChange(null, 0);
      return;
    }

    var columns = self.getNumberOfColumns(data);
    if (columns === null) {
      console.error('Unsupported data detected');
      return;
    }

    var values = self.extractNumbers(data);

    if (columns > 1) {
      values = self.to2DArray(values, columns);
    }

    // Calculate stats
    if (typeof self.opts.onChange === 'function') {
      self.opts.onChange(values, columns);
    }
  },

  extractNumbers: (function () {
    var numberPattern = /\-?\d+\.?\d*e\-?\+?\d+|\-?\d*\.?\d+/g;

    return function (data) {
      var numbers = data.match(numberPattern);
      return (numbers !== null) ? numbers.map(Number) : null;
    };
  })(),

  getNumberOfColumns: function (data) {
    var self = this;

    var firstLine = data.match(/.+[\n\r]|.+$/)[0];
    var numbers = self.extractNumbers(firstLine);
    return (numbers !== null) ? numbers.length : null;
  },

  to2DArray: function (values, columns) {
    var array2D = [];

    for (var i = 0; i < columns; i++) {
      array2D.push([]);
    }

    for (var j = 0; j < values.length; j++) {
      array2D[j % columns].push(values[j]);
    }

    return array2D;
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
    self.lastColumnsNumber = 0;
    self.lastData = null;

    self.rebuildColumnSelector(0);
    self.opts.columnSelector.addEventListener('change', self.onColumnChange.bind(self));

    return self;
  },

  calculate: function (data, columns) {
    var self = this;

    self.lastData = data;

    if (!data) {
      self.clear();
      return;
    }

    if (self.lastColumnsNumber !== columns) {
      self.lastColumnsNumber = columns;
      self.rebuildColumnSelector(columns);
    }

    var values = (columns > 1) ? data[self.selectedColumn] : data;

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
    self.selectedColumn = select.options[select.selectedIndex].value;

    self.calculate(self.lastData, self.lastColumnsNumber);
  },

  rebuildColumnSelector: function (columns) {
    var self = this;

    if (columns === 0) {
      self.opts.columnSelector.innerHTML = '<option>No columns detected</option>';
      return;
    }

    self.opts.columnSelector.innerHTML = '';
    var frag = document.createDocumentFragment();

    for (var i = 0; i < columns; i++) {
      var opt = document.createElement('option');
      opt.innerHTML = 'Column ' + i;
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

    self.rebuildColumnSelector(0);
    self.lastColumnsNumber = 0;
  }
};

var plotter = {
  init: function (opts) {
    var self = this;

    /*
     * opts = {
     *   wrapper: (DOM object)
     * }
     */

    self.chart = new Dygraph(
            opts.wrapper,
            [[0, 0], [1, 0]],
            {
              legend:'always',
              strokeWidth:1.5,
              labels:['X', 'Y'],
              showRangeSelector: true,
              rangeSelectorPlotFillColor: 'MediumSlateBlue',
              rangeSelectorPlotFillGradientColor: 'rgba(123, 104, 238, 0)',
              colorValue: 0.9,
              fillAlpha: 0.4
            }
    );
  },

  plot: function (data, columns) {
    var self = this;

    self.chart.updateOptions({
      labels: self.generateLabels(columns),
      file: self.reparseDataToSeries(data, columns)
    });
  },

  reparseDataToSeries: function (data, columns) {
    var series = [];

    if (columns < 2) {
      for (var i = 0; i < data.length; i++) {
        series.push([i, data[i]]);
      }
    } else {
      for (var k = 0; k < data[0].length; k++) {
        series.push([]);
        for (var j = 0; j < columns; j++) {
          series[k].push(data[j][k]);
        }
      }
    }

    return series;
  },

  generateLabels: function (columns) {
    if (columns < 2) {
      return ['X', 'Column 0'];
    } else {
      var labels = [];
      for (var i = 0; i < columns; i++) {
        labels.push('Column ' + i);
      }
      return labels;
    }
  }
};

var dictate = {
  init: function (opts) {
    var self = this;

    self.opts = {
      // toggler: (DOM object - checkbox),
      // input: (DOM object - text input or textarea),
      continous: true,
      lang: 'pl-PL'
    };

    tools.extend(self.opts, opts);

    var SpeechRecognition = SpeechRecognition || webkitSpeechRecognition;
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
  wrapper: document.getElementById('plotWrapper')
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
  input: statCalc.opts.input
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