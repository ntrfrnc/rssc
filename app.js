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
    values.sort(function(a, b){
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

var statCalc = {
  init: function (opts) {
    var self = this;
    /*
     * opts = {
     *   input: (DOM object)
     *   minOut: (DOM object)
     *   maxOut: (DOM object)
     *   sumOut: (DOM object)
     *   meanOut: (DOM object)
     *   medianOut: (DOM object)
     *   varianceOut: (DOM object)
     *   stdDeviationOut: (DOM object)
     *   uncertaintyOut: (DOM object)
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

    // Get array of values from string
    var values = data.trim().split(/[\s\n]+/);
    
    // Convert array of string to array of floats
    for (var i = 0; i < values.length; i++) {
      values[i] = parseFloat(values[i]);  
    }
    
    // Calculate stats
    self.opts.minOut.value = statLib.min(values);
    self.opts.maxOut.value = statLib.max(values);
    self.opts.sumOut.value = statLib.sum(values);
    self.opts.meanOut.value = statLib.mean(values, self.opts.sumOut.value);
    self.opts.medianOut.value = statLib.median(values);
    self.opts.varianceOut.value = statLib.variance(values, self.opts.meanOut.value);
    self.opts.stdDeviationOut.value = statLib.stdDeviation(values, self.opts.varianceOut.value);
    self.opts.uncertaintyOut.value = statLib.uncertainty(values, self.opts.varianceOut.value);
  }
};

var dictate = {
  init: function (opts) {
    var self = this;
    
    self.opts = {
      // toggler: (DOM object),
      // input: (DOM object),
      continous: true,
      lang: 'pl-PL'
    };
    
    tools.extend(self.opts, opts);

    var SpeechRecognition = SpeechRecognition || webkitSpeechRecognition;
    self.recognition = new SpeechRecognition();
    self.recognition.continuous = self.opts.continuous;
    self.recognition.lang = self.opts.lang;

    self.recognition.onresult = self.onResult.bind(self);
    self.recognition.onaudioend = function(){
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

    self.opts.input.value += transcript + ' ';
    
    event = new Event('input');
    self.opts.input.dispatchEvent(event);
  }
};

statCalc.init({
  input: document.getElementById('inpuData'),
  minOut: document.getElementById('minValue'),
  maxOut: document.getElementById('maxValue'),
  sumOut: document.getElementById('sumValue'),
  meanOut: document.getElementById('meanValue'),
  medianOut: document.getElementById('medianValue'),
  varianceOut: document.getElementById('varianceValue'),
  stdDeviationOut: document.getElementById('stdDeviationValue'),
  uncertaintyOut: document.getElementById('uncertaintyValue')
});

dictate.init({
  toggler: document.getElementById('dictateToggler'),
  input: statCalc.opts.input
});
