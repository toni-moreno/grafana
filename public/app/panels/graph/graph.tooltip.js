define([
  'jquery',
  'app/core/utils/kbn',
],
function ($,kbn) {
  'use strict';

  function GraphTooltip(elem, dashboard, scope, getSeriesFn) {
    var self = this;

    var $tooltip = $('<div id="tooltip">');

    this.findHoverIndexFromDataPoints = function(posX, series, last) {
      var ps = series.datapoints.pointsize;
      var initial = last*ps;
      var len = series.datapoints.points.length;
      for (var j = initial; j < len; j += ps) {
        if (series.datapoints.points[j] > posX) {
          return Math.max(j - ps,  0)/ps;
        }
      }
      return j/ps - 1;
    };

    this.findHoverIndexFromData = function(posX, series) {
      var len = series.data.length;
      for (var j = 0; j < len; j++) {
        if (series.data[j][0] > posX) {
          return Math.max(j - 1,  0);
        }
      }
      return j - 1;
    };

    this.showTooltip = function(title, innerHtml, pos) {
      var body = '<div class="graph-tooltip small"><div class="graph-tooltip-time">'+ title + '</div> ' ;
      body += innerHtml + '</div>';
      $tooltip.html(body).place_tt(pos.pageX + 20, pos.pageY);
    };

    this.getMultiSeriesPlotHoverInfo = function(seriesList, pos) {
      var value, i, series, hoverIndex, original_value;
      var results = [];

      //now we know the current X (j) position for X and Y values
      var last_value = 0; //needed for stacked values
      var sum_value = 0; // needed to compute percent on stacked graphs

      for (i = 0; i < seriesList.length; i++) {
        series = seriesList[i];

        if (!series.data.length || (scope.panel.legend.hideEmpty && series.allIsNull)) {
          results.push({ hidden: true });
          continue;
        }

        hoverIndex = this.findHoverIndexFromData(pos.x, series);
        results.time = series.data[hoverIndex][0];

        if (series.stack) {
          if (scope.panel.tooltip.value_type === 'individual') {
            value = series.data[hoverIndex][1];
            original_value = value;
            sum_value+= original_value;
          } else {
            original_value = series.data[hoverIndex][1];
            last_value += original_value;
            value = last_value;
            sum_value+= original_value;
          }
        } else {
          value = series.data[hoverIndex][1];
        }

        // Highlighting multiple Points depending on the plot type
        if (series.lines.steps || series.stack) {
          // stacked and steppedLine plots can have series with different length.
          // Stacked series can increase its length on each new stacked serie if null points found,
          // to speed the index search we begin always on the last found hoverIndex.
          var newhoverIndex = this.findHoverIndexFromDataPoints(pos.x, series, hoverIndex);
          results.push({ original_value: original_value, value: value, hoverIndex: newhoverIndex , percent_val: 0});
        } else {
          results.push({ value: value, hoverIndex: hoverIndex});
        }
      }
      //compute percent for stacked series
      if(scope.panel.tooltip.percent_vals) {
        $.each(results,function (index,value) {
          if(value.percent_val === 0) {
            value.percent_val = value.original_value*100/sum_value;
          }
        });
      }
      return results;
    };

    elem.mouseleave(function () {
      if (scope.panel.tooltip.shared) {
        var plot = elem.data().plot;
        if (plot) {
          $tooltip.detach();
          plot.unhighlight();
        }
      }

      if (dashboard.sharedCrosshair) {
        scope.appEvent('clearCrosshair');
      }
    });

    elem.bind("plothover", function (event, pos, item) {
      var plot = elem.data().plot;
      var plotData = plot.getData();
      var seriesList = getSeriesFn();
      var group, value, timestamp, hoverInfo, i, series, seriesHtml;

      if(dashboard.sharedCrosshair){
        scope.appEvent('setCrosshair', { pos: pos, scope: scope });
      }

      if (seriesList.length === 0) {
        return;
      }

      if (scope.panel.tooltip.shared) {
        plot.unhighlight();

        var seriesHoverInfo = self.getMultiSeriesPlotHoverInfo(plotData, pos);

        seriesHtml = '';
        timestamp = dashboard.formatDate(seriesHoverInfo.time);

        for (i = 0; i < seriesHoverInfo.length; i++) {
          hoverInfo = seriesHoverInfo[i];

          if (hoverInfo.hidden) {
            continue;
          }

          series = seriesList[i];
          value = series.formatValue(hoverInfo.value);

          seriesHtml += '<div class="graph-tooltip-list-item"><div class="graph-tooltip-series-name">';
          seriesHtml += '<i class="fa fa-minus" style="color:' + series.color +';"></i> ' + series.label + ':</div>';
          seriesHtml += '<div class="graph-tooltip-value">' + value + '</div>';
          if(scope.panel.tooltip.percent_vals && hoverInfo.percent_val) {
            var value_percent = kbn.valueFormats.percent(hoverInfo.percent_val,1);
            seriesHtml += '<div class="graph-tooltip-value"> (' + value_percent + ')</div>';
          }
          seriesHtml += '</div>';
          plot.highlight(i, hoverInfo.hoverIndex);
        }

        self.showTooltip(timestamp, seriesHtml, pos);
      }
      // single series tooltip
      else if (item) {
        series = seriesList[item.seriesIndex];
        group = '<div class="graph-tooltip-list-item"><div class="graph-tooltip-series-name">';
        group += '<i class="fa fa-minus" style="color:' + item.series.color +';"></i> ' + series.label + ':</div>';

        if (scope.panel.stack && scope.panel.tooltip.value_type === 'individual') {
          value = item.datapoint[1] - item.datapoint[2];
        }
        else {
          value = item.datapoint[1];
        }

        value = series.formatValue(value);
        timestamp = dashboard.formatDate(item.datapoint[0]);
        group += '<div class="graph-tooltip-value">' + value + '</div>';

        self.showTooltip(timestamp, group, pos);
      }
      // no hit
      else {
        $tooltip.detach();
      }
    });
  }

  return GraphTooltip;
});
