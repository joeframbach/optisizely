$(function () {
  var experiments = [];
  var variations = [];
  var totalArea;
  var optimizelyId = window.location.href.split('?')[1]
  if (!optimizelyId) {
    return;
  }

  $.getScript('https://cdn.optimizely.com/js/' + optimizelyId + '.js', function () {
    experiments = optimizely.allExperiments;
    variations = optimizely.allVariations;

    // Attach extra metadata onto optimizely.allVariations.
    // Calculate the approximate size of each variation.
    $.each(variations, function (variationId) {
      var variation = variations[variationId];
      variation.variationId = variationId;
      variation.size = JSON.stringify(variation.code||'').length;
    });

    // Attach extra metadata onto optimizely.allExperiments.
    // Link each experiment to its variations.
    // Calculate the total size of each experiment.
    $.each(experiments, function (experimentKey, experiment) {
      experiment.variations = experiment.variation_ids.map(function (variationId) {
        variations[variationId].experimentKey = experimentKey;
        variations[variationId].weight = (experiment.variation_weights||[])[variationId];
        return variations[variationId];
      });
      experiment.experimentKey = experimentKey;
      experiment.size = JSON.stringify(experiment).length;
    });

    totalArea = JSON.stringify(experiments).length;

    buildTree();
  });

  // Some templates for the block contents
  function bToKb (b) {
    return (b / 1024).toFixed(1) + 'KB';
  }
  function variationHtml (variation) {
    var notRunning = !variation.weight;
    var running100 = (variation.weight === 10000);
    var className = (notRunning || running100) ? 'warning' : '';
    return '<p class="' + className + '">' + 
             '<a data-variation-id="' + variation.variationId + '">' +
             bToKb(variation.size) +
             '</a> ' +
              'Variation ' + variation.variationId +
              (notRunning ? ' <strong>NOT RUNNING</strong>' : '') +
              (running100 ? ' <strong>100% WEIGHT</strong>' : '') +
           '</p>';
  }
  function experimentHtml (experiment) {
    return '<p>' +
            '<strong>' +
            '<a data-variation-id="' + experiment.variations[experiment.variations.length-1].variationId + '">' +
               (100*experiment.size/totalArea).toFixed(1) + '% ' +
               bToKb(experiment.size) +
             '</a> ' +
             experiment.name +
             ' (<a target="_blank" ' +
               'href="https://app.optimizely.com/projects/' + optimizelyId + '/experiments/' + experiment.experimentKey + '?search=' + experiment.experimentKey + '">' +
               experiment.experimentKey +
             '</a>)' +
            '</strong>' +
           '</p>' +
           experiment.variations.map(variationHtml).join('');
  }
  function experimentUrlHtml (experiment) {
    if (!experiment.urls) return '';
    return '<p><strong>Url targeting</strong></p>' +
      '<ul>' +
      experiment.urls.map(function (url) {
        return '<li>' + url.match + ': ' + url.value + '</li>'
      }).join('') +
      '</ul>';
  }

  // Build the treemap.
  // Each kTree node is an object containing {name, data, and children}.
  // Refer to the webtreemap documentation somewhere online.
  function buildTree () {
    var sortby = $('#sortby').val();
    var sortFn = {
      age: function (a, b) { return a.data.experiment.experimentKey - b.data.experiment.experimentKey; },
      size: function (a, b) { return b.data.experiment.size - a.data.experiment.size; },
    }[sortby];
    var kTree = {
      name: "<b>Optimizely experiments and variations " + bToKb(totalArea) + "</b>",
      data: { '$area': totalArea },
      children: $.map(experiments, function (experiment) {
        var warning = (experiment.variations||[]).some(function (variation) {
          return variation.weight === 10000;
        }) || (experiment.variations||[]).every(function (variation) {
          return !variation.weight;
        });
        var lightWarning = (experiment.variations||[]).some(function (variation) {
          return !variation.weight;
        });
        return {
          name: experimentHtml(experiment),
          data: {
            '$area': experiment.size,
            experiment: experiment,
            '$symbol': warning ? 'warning' : lightWarning ? 'light-warning' : ''
          }
        }
      }).sort(sortFn)
    }

    appendTreemap($('#map').empty().get(0), kTree);
    $('#list').html(kTree.children.map(function (experiment) {
      return '<li>'+experiment.name+'</li>';
    }).join(''));
  }

  function debounce (fn, time) {
    var timeout;
    return function() {
      clearTimeout(timeout);
      timeout = setTimeout(fn, time);
    }
  }
  $(window).on('resize', debounce(buildTree, 500));
  $('#sortby').on('change', buildTree);

  $('body').on('click', '[data-variation-id]', function () {
    var variation = variations[$(this).data('variation-id')];
    var experiment = experiments[variation.experimentKey];
    var source = variation.code || '';
    codemirror.setValue(source);
    $('.current-variation').html(
      experimentHtml(experiment) + '<hr>' +
      experimentUrlHtml(experiment) + '<hr>' +
      variationHtml(variation)
    );
    $('#list-pane').css('transform', 'translateX(-100%)');
    $('#map-pane').css('transform', 'translateX(-100%)');
    $('#code').css('transform', 'translateX(0)');
  });

  $('.back-to-map').on('click', function () {
    $('#list-pane').css('transform', 'translateX(-100%)');
    $('#map-pane').css('transform', 'translateX(0)');
    $('#code').css('transform', 'translateX(100%)');
  });

  $('.back-to-list').on('click', function () {
    $('#list-pane').css('transform', 'translateX(0)');
    $('#map-pane').css('transform', 'translateX(100%)');
    $('#code').css('transform', 'translateX(100%)');
  });

  var codemirror = CodeMirror.fromTextArea($('#source')[0], {
    theme: 'default',
    lineNumbers: true,
    lineWrapping: true
  });
});

// Needs to be global for codemirror ¯\_(ツ)_/¯
function beautify(source) {
  var output;
  var opts = {
    indent_size: 2,
    indent_char: ' ',
    max_preserve_newlines: 5,
    preserve_newlines: true,
    keep_array_indentation: false,
    break_chained_methods: false,
    indent_scripts: 'normal',
    brace_style: 'collapse',
    space_before_conditional: true,
    unescape_strings: false,
    jslint_happy: false,
    end_with_newline: false,
    wrap_line_length: '0',
    indent_inner_html: false,
    comma_first: false,
    e4x: false
  };

  return js_beautify(source, opts);
}
