/*

Online Python Tutor
Copyright (C) 2010 Philip J. Guo (philip@pgbovine.net)
https://github.com/pgbovine/OnlinePythonTutor/

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <http://www.gnu.org/licenses/>.

*/

// The Online Python Tutor front-end, which calls the cgi-bin/web_exec.py
// back-end with a string representing the user's script POST['user_script']
// and receives a complete execution trace, which it parses and displays to HTML.


var localTesting = false; // if this is true, mock-data.js had also better be included


/* colors - see edu-python.css */
var lightYellow = '#F5F798';
var lightLineColor = '#FFFFCC';
var errorColor = '#F87D76';
var visitedLineColor = '#3D58A2';

// ugh globals!
var curTrace = null;
var curInstr = 0;

// true iff trace ended prematurely since maximum instruction limit has
// been reached
var instrLimitReached = false;

function assert(cond) {
  if (!cond) {
    alert("Error: ASSERTION FAILED");
  }
}

// taken from http://www.toao.net/32-my-htmlspecialchars-function-for-javascript
function htmlspecialchars(str) {
  if (typeof(str) == "string") {
    str = str.replace(/&/g, "&amp;"); /* must do &amp; first */

    // ignore these for now ...
    //str = str.replace(/"/g, "&quot;");
    //str = str.replace(/'/g, "&#039;");

    str = str.replace(/</g, "&lt;");
    str = str.replace(/>/g, "&gt;");

    // replace spaces:
    str = str.replace(/ /g, "&nbsp;");
  }
  return str;
}

function processTrace(traceData) {
  curTrace = traceData;
  curInstr = 0;

  // delete all stale output
  $("#warningOutput").html('');
  $("#pyStdout").val('');

  if (curTrace.length > 0) {
    var lastEntry = curTrace[curTrace.length - 1];

    // GLOBAL!
    instrLimitReached = (lastEntry.event == 'instruction_limit_reached');

    // if there is some sort of error, then JUMP to it so that we can
    // immediately alert the user:
    // (cgi-bin/pg_logger.py ensures that if there is an uncaught
    //  exception, then that exception event will be the FINAL
    //  entry in curTrace.  a caught exception will appear somewhere in
    //  the MIDDLE of curTrace)
    //
    // on second thought, let's hold off on that for now

    /*
    if (lastEntry.event == 'exception' ||
        lastEntry.event == 'uncaught_exception') {
      // updateOutput should take care of the rest ...
      curInstr = curTrace.length - 1;
    }
    */
    if (instrLimitReached) {
      curTrace.pop() // kill last entry
      var warningMsg = lastEntry.exception_msg;
      $("#warningOutput").html(htmlspecialchars(warningMsg));
    }
    // as imran suggests, for a (non-error) one-liner, SNIP off the
    // first instruction so that we start after the FIRST instruction
    // has been executed ...
    else if (curTrace.length == 2) {
      curTrace.shift();
    }
  }

  updateOutput();
}

function highlightCodeLine(curLine, visitedLinesSet, hasError, isTerminated) {
  var tbl = $("table#pyCodeOutput");

  // reset then set:
  tbl.find('td.lineNo').css('color', '');
  tbl.find('td.lineNo').css('font-weight', '');

  $.each(visitedLinesSet, function(k, v) {
    tbl.find('td.lineNo:eq(' + (k - 1) + ')').css('color', visitedLineColor);
    tbl.find('td.lineNo:eq(' + (k - 1) + ')').css('font-weight', 'bold');
  });

  var lineBgCol = lightLineColor;
  if (hasError) {
    lineBgCol = errorColor;
  }

	// put a default white top border to keep space usage consistent
  tbl.find('td.cod').css('border-top', '1px solid #ffffff');

  if (!hasError && !isTerminated) {
    tbl.find('td.cod:eq(' + (curLine - 1) + ')').css('border-top', '1px solid #F87D76');
  }

  tbl.find('td.cod').css('background-color', '');
  if (!isTerminated || hasError) {
    tbl.find('td.cod:eq(' + (curLine - 1) + ')').css('background-color', lineBgCol);
  }
}

// relies on curTrace and curInstr globals
function updateOutput() {
  var curEntry = curTrace[curInstr];
  var hasError = false;

  // render VCR controls:
  var totalInstrs = curTrace.length;

  // to be user-friendly, if we're on the LAST instruction, print "Program has terminated"
  // and DON'T highlight any lines of code in the code display
  if (curInstr == (totalInstrs-1)) {
    if (instrLimitReached) {
      $("#vcrControls #curInstr").html("Instruction limit reached");
    }
    else {
      $("#vcrControls #curInstr").html("Program has terminated");
    }
  }
  else {
    $("#vcrControls #curInstr").html("About to do step " + (curInstr + 1) + " of " + (totalInstrs-1));
  }

  $("#vcrControls #jmpFirstInstr").attr("disabled", false);
  $("#vcrControls #jmpStepBack").attr("disabled", false);
  $("#vcrControls #jmpStepFwd").attr("disabled", false);
  $("#vcrControls #jmpLastInstr").attr("disabled", false);

  if (curInstr == 0) {
    $("#vcrControls #jmpFirstInstr").attr("disabled", true);
    $("#vcrControls #jmpStepBack").attr("disabled", true);
  }
  if (curInstr == (totalInstrs-1)) {
    $("#vcrControls #jmpLastInstr").attr("disabled", true);
    $("#vcrControls #jmpStepFwd").attr("disabled", true);
  }


  // render error (if applicable):
  if (curEntry.event == 'exception' ||
      curEntry.event == 'uncaught_exception') {
    assert(curEntry.exception_msg);

    if (curEntry.exception_msg == "Unknown error") {
      $("#errorOutput").html('Unknown error: <a id="editCodeLinkOnError" href="#">view code</a> and please<br/>email as a bug report to philip@pgbovine.net');
    }
    else {
      $("#errorOutput").html(htmlspecialchars(curEntry.exception_msg));
    }

    $("#editCodeLinkOnError").click(function() {
      $("#pyInputPane").show();
      $("#pyInputPane").css('border-bottom', '2px dashed #bbbbbb');
      return false; // to prevent page reload
    });

    $("#errorOutput").show();

    hasError = true;
  }
  else {
    $("#errorOutput").hide();
  }


  // render code output:
  if (curEntry.line) {
    // calculate all lines that have been 'visited' 
    // by execution up to (but NOT INCLUDING) curInstr:
    var visitedLinesSet = {}
    for (var i = 0; i < curInstr; i++) {
      if (curTrace[i].line) {
        visitedLinesSet[curTrace[i].line] = true;
      }
    }
    highlightCodeLine(curEntry.line, visitedLinesSet, hasError,
                      /* if instrLimitReached, then treat like a normal non-terminating line */
                      (!instrLimitReached && (curInstr == (totalInstrs-1))));
  }


  // render stdout:

  // keep original horizontal scroll level:
  var oldLeft = $("#pyStdout").scrollLeft();
  $("#pyStdout").val(curEntry.stdout);

  $("#pyStdout").scrollLeft(oldLeft);
  // scroll to bottom, tho:
  $("#pyStdout").scrollTop($("#pyStdout").attr('scrollHeight'));


  // render data structures:
  $("#dataViz").html(''); // CLEAR IT!


  // render locals on stack:
  if (curEntry.stack_locals != undefined) {
    $.each(curEntry.stack_locals, function (i, frame) {
      var funcName = htmlspecialchars(frame[0]); // might contain '<' or '>' for weird names like <genexpr>
      var localVars = frame[1];

      $("#dataViz").append('<div class="vizFrame">Local variables for <span style="font-family: Andale mono, monospace;">' + funcName + '</span>:</div>');

      // render locals in alphabetical order for tidiness:
      var orderedVarnames = [];

      // use plain ole' iteration rather than jQuery $.each() since
      // the latter breaks when a variable is named "length"
      for (varname in localVars) {
        orderedVarnames.push(varname);
      }
      orderedVarnames.sort();

      if (orderedVarnames.length > 0) {
        $("#dataViz .vizFrame:last").append('<br/><table class="frameDataViz"></table>');
        var tbl = $("#pyOutputPane table:last");
        $.each(orderedVarnames, function(i, varname) {
          var val = localVars[varname];
          tbl.append('<tr><td class="varname"></td><td class="val"></td></tr>');
          var curTr = tbl.find('tr:last');
          if (varname == '__return__') {
            curTr.find("td.varname").html('<span style="font-size: 10pt; font-style: italic;">return value</span>');
          }
          else {
            curTr.find("td.varname").html(varname);
          }
          renderData(val, curTr.find("td.val"));
        });

        tbl.find("tr:last").find("td.varname").css('border-bottom', '0px');
        tbl.find("tr:last").find("td.val").css('border-bottom', '0px');
      }
      else {
        $("#dataViz .vizFrame:last").append(' <i>none</i>');
      }
    });
  }


  // render globals LAST:

  $("#dataViz").append('<div class="vizFrame">Global variables:</div>');

  var nonEmptyGlobals = false;
  var curGlobalFields = {};
  if (curEntry.globals != undefined) {
    // use plain ole' iteration rather than jQuery $.each() since
    // the latter breaks when a variable is named "length"
    for (varname in curEntry.globals) {
      curGlobalFields[varname] = true;
      nonEmptyGlobals = true;
    }
  }

  if (nonEmptyGlobals) {
    $("#dataViz .vizFrame:last").append('<br/><table class="frameDataViz"></table>');

    // render all global variables IN THE ORDER they were created by the program,
    // in order to ensure continuity:
    var orderedGlobals = []

    // iterating over ALL instructions (could be SLOW if not for our optimization below)
    for (var i = 0; i <= curInstr; i++) {
      // some entries (like for exceptions) don't have GLOBALS
      if (curTrace[i].globals == undefined) continue;

      // use plain ole' iteration rather than jQuery $.each() since
      // the latter breaks when a variable is named "length"
      for (varname in curTrace[i].globals) {
        // eliminate duplicates (act as an ordered set)
        if ($.inArray(varname, orderedGlobals) == -1) {
          orderedGlobals.push(varname);
          curGlobalFields[varname] = undefined; // 'unset it'
        }
      }

      var earlyStop = true;
      // as an optimization, STOP as soon as you've found everything in curGlobalFields:
      for (o in curGlobalFields) {
        if (curGlobalFields[o] != undefined) {
          earlyStop = false;
          break;
        }
      }

      if (earlyStop) {
        break;
      }
    }

    var tbl = $("#pyOutputPane table:last");

    // iterate IN ORDER (it's possible that not all vars are in curEntry.globals)
    $.each(orderedGlobals, function(i, varname) {
      var val = curEntry.globals[varname];
      // (use '!==' to do an EXACT match against undefined)
      if (val !== undefined) { // might not be defined at this line, which is OKAY!
        tbl.append('<tr><td class="varname"></td><td class="val"></td></tr>');
        var curTr = tbl.find('tr:last');
        curTr.find("td.varname").html(varname);
        renderData(val, curTr.find("td.val"));
      }
    });

    tbl.find("tr:last").find("td.varname").css('border-bottom', '0px');
    tbl.find("tr:last").find("td.val").css('border-bottom', '0px');
  }
  else {
    $("#dataViz .vizFrame:last").append(' <i>none</i>');
  }

}

// render the JS data object obj inside of jDomElt,
// which is a jQuery wrapped DOM object
// (obj is in a format encoded by cgi-bin/pg_encoder.py)
function renderData(obj, jDomElt) {
  // dispatch on types:
  var typ = typeof obj;

  if (obj == null) {
    jDomElt.append('<span class="nullObj">None</span>');
  }
  else if (typ == "number") {
    jDomElt.append('<span class="numberObj">' + obj + '</span>');
  }
  else if (typ == "boolean") {
    if (obj) {
      jDomElt.append('<span class="boolObj">True</span>');
    }
    else {
      jDomElt.append('<span class="boolObj">False</span>');
    }
  }
  else if (typ == "string") {
    // escape using htmlspecialchars to prevent HTML/script injection
    // print as a JSON literal
    var literalStr = htmlspecialchars(obj);
    literalStr = literalStr.replace('\"', '\\"');
    literalStr = '"' + literalStr + '"';
    jDomElt.append('<span class="stringObj">' + literalStr + '</span>');
  }
  else if (typ == "object") {
    assert($.isArray(obj));

    if (obj[0] == 'LIST') {
      assert(obj.length >= 2);
      if (obj.length == 2) {
        jDomElt.append('<div class="typeLabel">empty list (id=' + obj[1] + ')</div>');
      }
      else {
        jDomElt.append('<div class="typeLabel">list (id=' + obj[1] + '):</div>');
        jDomElt.append('<table class="listTbl"><tr></tr><tr></tr></table>');
        var tbl = jDomElt.children('table');
        var headerTr = tbl.find('tr:first');
        var contentTr = tbl.find('tr:last');
        jQuery.each(obj, function(ind, val) {
          if (ind < 2) return; // skip 'LIST' tag and ID entry

          // add a new column and then pass in that newly-added column
          // as jDomElt to the recursive call to child:
          headerTr.append('<td class="listHeader"></td>');
          headerTr.find('td:last').append(ind - 2);

          contentTr.append('<td class="listElt"></td>');
          renderData(val, contentTr.find('td:last'));
        });
      }
    }
    else if (obj[0] == 'TUPLE') {
      assert(obj.length >= 2);
      if (obj.length == 2) {
        jDomElt.append('<div class="typeLabel">empty tuple (id=' + obj[1] + ')</div>');
      }
      else {
        jDomElt.append('<div class="typeLabel">tuple (id=' + obj[1] + '):</div>');
        jDomElt.append('<table class="tupleTbl"><tr></tr><tr></tr></table>');
        var tbl = jDomElt.children('table');
        var headerTr = tbl.find('tr:first');
        var contentTr = tbl.find('tr:last');
        jQuery.each(obj, function(ind, val) {
          if (ind < 2) return; // skip 'TUPLE' tag and ID entry

          // add a new column and then pass in that newly-added column
          // as jDomElt to the recursive call to child:
          headerTr.append('<td class="tupleHeader"></td>');
          headerTr.find('td:last').append(ind - 2);

          contentTr.append('<td class="tupleElt"></td>');
          renderData(val, contentTr.find('td:last'));
        });
      }
    }
    else if (obj[0] == 'SET') {
      assert(obj.length >= 2);
      if (obj.length == 2) {
        jDomElt.append('<div class="typeLabel">empty set (id=' + obj[1] + ')</div>');
      }
      else {
        jDomElt.append('<div class="typeLabel">set (id=' + obj[1] + '):</div>');
        jDomElt.append('<table class="setTbl"></table>');
        var tbl = jDomElt.children('table');
        // create an R x C matrix:
        var numElts = obj.length - 2;
        // gives roughly a 3x5 rectangular ratio, square is too, err,
        // 'square' and boring
        var numRows = Math.round(Math.sqrt(numElts));
        if (numRows > 3) {
          numRows -= 1;
        }

        var numCols = Math.round(numElts / numRows);
        // round up if not a perfect multiple:
        if (numElts % numRows) {
          numCols += 1;
        }

        jQuery.each(obj, function(ind, val) {
          if (ind < 2) return; // skip 'SET' tag and ID entry

          if (((ind - 2) % numCols) == 0) {
            tbl.append('<tr></tr>');
          }

          var curTr = tbl.find('tr:last');
          curTr.append('<td class="setElt"></td>');
          renderData(val, curTr.find('td:last'));
        });
      }
    }
    else if (obj[0] == 'DICT') {
      assert(obj.length >= 2);
      if (obj.length == 2) {
        jDomElt.append('<div class="typeLabel">empty dict (id=' + obj[1] + ')</div>');
      }
      else {
        jDomElt.append('<div class="typeLabel">dict (id=' + obj[1] + '):</div>');
        jDomElt.append('<table class="dictTbl"></table>');
        var tbl = jDomElt.children('table');
        $.each(obj, function(ind, kvPair) {
          if (ind < 2) return; // skip 'DICT' tag and ID entry

          tbl.append('<tr class="dictEntry"><td class="dictKey"></td><td class="dictVal"></td></tr>');
          var newRow = tbl.find('tr:last');
          var keyTd = newRow.find('td:first');
          var valTd = newRow.find('td:last');
          renderData(kvPair[0], keyTd);
          renderData(kvPair[1], valTd);
        });
      }
    }
    else if (obj[0] == 'INSTANCE') {
      assert(obj.length >= 3);
      jDomElt.append('<div class="typeLabel">' + obj[1] + ' instance (id=' + obj[2] + ')</div>');

      if (obj.length > 3) {
        jDomElt.append('<table class="instTbl"></table>');
        var tbl = jDomElt.children('table');
        $.each(obj, function(ind, kvPair) {
          if (ind < 3) return; // skip type tag, class name, and ID entry

          tbl.append('<tr class="instEntry"><td class="instKey"></td><td class="instVal"></td></tr>');
          var newRow = tbl.find('tr:last');
          var keyTd = newRow.find('td:first');
          var valTd = newRow.find('td:last');

          // the keys should always be strings, so render them directly (and without quotes):
          assert(typeof kvPair[0] == "string");
          var attrnameStr = htmlspecialchars(kvPair[0]);
          keyTd.append('<span class="stringObj">' + attrnameStr + '</span>');

          // values can be arbitrary objects, so recurse:
          renderData(kvPair[1], valTd);
        });
      }
    }
    else if (obj[0] == 'CLASS') {
      assert(obj.length >= 4);
      var superclassStr = '';
      if (obj[3].length > 0) {
        superclassStr += ('[extends ' + obj[3].join(',') + '] ');
      }

      jDomElt.append('<div class="typeLabel">' + obj[1] + ' class ' + superclassStr + '(id=' + obj[2] + ')</div>');

      if (obj.length > 4) {
        jDomElt.append('<table class="classTbl"></table>');
        var tbl = jDomElt.children('table');
        $.each(obj, function(ind, kvPair) {
          if (ind < 4) return; // skip type tag, class name, ID, and superclasses entries

          tbl.append('<tr class="classEntry"><td class="classKey"></td><td class="classVal"></td></tr>');
          var newRow = tbl.find('tr:last');
          var keyTd = newRow.find('td:first');
          var valTd = newRow.find('td:last');

          // the keys should always be strings, so render them directly (and without quotes):
          assert(typeof kvPair[0] == "string");
          var attrnameStr = htmlspecialchars(kvPair[0]);
          keyTd.append('<span class="stringObj">' + attrnameStr + '</span>');

          // values can be arbitrary objects, so recurse:
          renderData(kvPair[1], valTd);
        });
      }
    }

    else if (obj[0] == 'CIRCULAR_REF') {
      assert(obj.length == 2);
      jDomElt.append('<div class="circRefLabel">circular reference to id=' + obj[1] + '</div>');
    }
    else {
      // render custom data type
      assert(obj.length == 3);
      typeName = obj[0];
      id = obj[1];
      strRepr = obj[2];

      // if obj[2] is like '<generator object <genexpr> at 0x84760>',
      // then display an abbreviated version rather than the gory details
      noStrReprRE = /<.* at 0x.*>/;
      if (noStrReprRE.test(strRepr)) {
        jDomElt.append('<span class="customObj">' + typeName + ' (id=' + id + ')</span>');
      }
      else {
        strRepr = htmlspecialchars(strRepr); // escape strings!

        // warning: we're overloading tuple elts for custom data types
        jDomElt.append('<div class="typeLabel">' + typeName + ' (id=' + id + '):</div>');
        jDomElt.append('<table class="tupleTbl"><tr><td class="tupleElt">' + strRepr + '</td></tr></table>');
      }
    }
  }
  else {
    alert("Error: renderData FAIL!");
  }
}


String.prototype.rtrim = function() {
  return this.replace(/\s*$/g, "");
}

function renderPyCodeOutput(codeStr) {
  var tbl = $("#pyCodeOutput");
  tbl.html('');
  var lines = codeStr.rtrim().split('\n');

  $.each(lines, function(i, cod) {
    var lineNo = i + 1;
    var htmlCod = htmlspecialchars(cod);

    tbl.append('<tr><td class="lineNo"></td><td class="cod"></td></tr>');
    var curRow = tbl.find('tr:last');
    curRow.find('td.lineNo').html(lineNo);
    curRow.find('td.cod').html(htmlCod);
  });

}

$(document).ready(function() {

  $("#pyOutputPane").hide();

  $("#executeBtn").attr('disabled', false);

  $("#pyInput").tabby(); // recognize TAB and SHIFT-TAB

  // disable autogrow for simplicity
  //$("#pyInput").autogrow();

  $("#executeBtn").click(function() {
    if (localTesting) {
      renderPyCodeOutput($("#pyInput").val());

      processTrace(data_test_trace);

      $("#pyInputPane").hide();
      $("#pyOutputPane").show();
    }
    else {
      $('#executeBtn').html("Please wait ... processing your code");
      $('#executeBtn').attr('disabled', true);
      $("#pyOutputPane").hide();

      $.post("cgi-bin/web_exec.py",
             {user_script : $("#pyInput").val()},
             function(traceData) {
               renderPyCodeOutput($("#pyInput").val());
               processTrace(traceData);

              $("#pyInputPane").hide();
              $("#pyOutputPane").show();

              $('#executeBtn').html("Visualize execution");
              $('#executeBtn').attr('disabled', false);
             },
             "json");
    }
  });


  $("#editCodeLink").click(function() {
    $("#pyInputPane").show();
    $("#pyInputPane").css('border-bottom', '2px dashed #bbbbbb');
    return false; // to prevent page reload
  });


  $("#jmpFirstInstr").click(function() {
    curInstr = 0;
    updateOutput();
  });

  $("#jmpLastInstr").click(function() {
    curInstr = curTrace.length - 1;
    updateOutput();
  });

  $("#jmpStepBack").click(function() {
    if (curInstr > 0) {
      curInstr -= 1;
      updateOutput();
    }
  });

  $("#jmpStepFwd").click(function() {
    if (curInstr < curTrace.length - 1) {
      curInstr += 1;
      updateOutput();
    }
  });


  // canned examples

  $("#tutorialExampleLink").click(function() {
    $.get("example-code/py_tutorial.txt", function(dat) {$("#pyInput").val(dat);});
    return false;
  });

  $("#strtokExampleLink").click(function() {
    $.get("example-code/strtok.txt", function(dat) {$("#pyInput").val(dat);});
    return false;
  });

  $("#fibonacciExampleLink").click(function() {
    $.get("example-code/fib.txt", function(dat) {$("#pyInput").val(dat);});
    return false;
  });

  $("#memoFibExampleLink").click(function() {
    $.get("example-code/memo_fib.txt", function(dat) {$("#pyInput").val(dat);});
    return false;
  });

  $("#factExampleLink").click(function() {
    $.get("example-code/fact.txt", function(dat) {$("#pyInput").val(dat);});
    return false;
  });

  $("#filterExampleLink").click(function() {
    $.get("example-code/filter.txt", function(dat) {$("#pyInput").val(dat);});
    return false;
  });

  $("#insSortExampleLink").click(function() {
    $.get("example-code/ins_sort.txt", function(dat) {$("#pyInput").val(dat);});
    return false;
  });

  $("#aliasExampleLink").click(function() {
    $.get("example-code/aliasing.txt", function(dat) {$("#pyInput").val(dat);});
    return false;
  });

  $("#newtonExampleLink").click(function() {
    $.get("example-code/sqrt.txt", function(dat) {$("#pyInput").val(dat);});
    return false;
  });

  $("#oopSmallExampleLink").click(function() {
    $.get("example-code/oop_small.txt", function(dat) {$("#pyInput").val(dat);});
    return false;
  });

  $("#mapExampleLink").click(function() {
    $.get("example-code/map.txt", function(dat) {$("#pyInput").val(dat);});
    return false;
  });

  $("#oop1ExampleLink").click(function() {
    $.get("example-code/oop_1.txt", function(dat) {$("#pyInput").val(dat);});
    return false;
  });

  $("#oop2ExampleLink").click(function() {
    $.get("example-code/oop_2.txt", function(dat) {$("#pyInput").val(dat);});
    return false;
  });

  $("#inheritanceExampleLink").click(function() {
    $.get("example-code/oop_inherit.txt", function(dat) {$("#pyInput").val(dat);});
    return false;
  });

  $("#sumExampleLink").click(function() {
    $.get("example-code/sum.txt", function(dat) {$("#pyInput").val(dat);});
    return false;
  });

  $("#pwGcdLink").click(function() {
    $.get("example-code/wentworth_gcd.txt", function(dat) {$("#pyInput").val(dat);});
    return false;
  });

  $("#pwSumListLink").click(function() {
    $.get("example-code/wentworth_sumList.txt", function(dat) {$("#pyInput").val(dat);});
    return false;
  });

  $("#pwTryFinallyLink").click(function() {
    $.get("example-code/wentworth_try_finally.txt", function(dat) {$("#pyInput").val(dat);});
    return false;
  });


  // select an example on start-up:
  $("#tutorialExampleLink").trigger('click');
});

