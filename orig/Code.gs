function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('ToS PC')
    .addItem('Authorize ToS', 'requestAuthorization')
    .addItem('Process Signals', 'processSignals')
    .addToUi();
}

function requestAuthorization() {
  var service = getToSService_();
  var ui = SpreadsheetApp.getUi();
  if (service.hasAccess()) {
    service.refresh();
    ui.alert('Already authorized with ToS.');
  } else {
    var authorizationUrl = service.getAuthorizationUrl();
    var template = HtmlService.createTemplate(
        '<a href="<?= authorizationUrl ?>" target="_blank" onclick="google.script.host.close()">Authorize</a>');
    template.authorizationUrl = authorizationUrl;
    var page = template.evaluate();
    ui.showSidebar(page);
  }
}

function processSignals() {
  if (!getToSService_().hasAccess()) {
    requestAuthorization();
    return;
  }
  getToSService_().refresh();
  
  var [symbolMapping, smallSymbolMapping] = loadMappings();
  var globexToClearingExchange = loadCMEGroupCodes();
  var clearingExchangeToMargin = loadCMEGroupMargins();
  
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var signalsSheet = spreadsheet.getSheetByName('Signals');
  var values = signalsSheet.getRange('A2:G').getValues();
  
  // obtain ToS quote information for emailed signal quotes
  var quotesSet = {};
  var quotes = [];
  for (var i = 0; i < values.length; i++) {
    var symbol = values[i][2];
    if (symbol in symbolMapping) {
      var quote = symbolMapping[symbol];
      if (quote in quotesSet) {
        continue;
      }
      if (quote[0] != '(') {
        quotesSet[quote] = true;
        quotes.push(quote);
      }
    }
    if (symbol in smallSymbolMapping) {
      var quote = smallSymbolMapping[symbol];
      if (quote in quotesSet) {
        continue;
      }
      if (quote[0] != '(') {
        quotesSet[quote] = true;
        quotes.push(quote);
      }
    }
    if (symbol.length == 6 && symbol.substr(3) != 'USD') {  // forex symbol
      var lookup = 'USD/' + symbol.substr(3);
      quotes.push(lookup);
    }
  }
  var json = callToS_('https://api.tdameritrade.com/v1/marketdata/quotes',
                      'symbol=' + encodeURIComponent(quotes.join(',')));
  
  // set up headers of newly added columns
  signalsSheet.getRange('H1:S1')
    .setFontColor('white')
    .setBackground('black')
    .setFontWeight('bold')
    .setValues([[
      'ToS',  // H1
      'Small',  // I1
      'ENTRY',  // J1
      'EXIT',  // K1
      'STOP',  // L1
      'Small STOP',  // M1
      'Profit*',  // N1
      'Small Profit**',  // O1
      'Margin',  // P1
      'Small Margin',  // Q1
      'RoC',  // R1
      'Small RoC'  // S1
    ]]);
  signalsSheet.getRange('U2')
    .setValue('* Assuming naked option for equity at >=35 days exp, or standard lot for forex (100,000)');
  signalsSheet.getRange('U3')
    .setValue('** Assuming 1 share for equity, or mini lot for forex (10,000)');
  
  var addedColumns = [];
  for (var i = 0; i < values.length; i++) {
    if (values[i][0] === '') {
      break;
    }
    
    var sessionStart = values[i][0];  // A 
    var type = values[i][1];  // B
    var symbol = values[i][2];  // C
    var description = values[i][3];  // D
    var signal = values[i][4];  // E
    var entry = values[i][5];  // F
    var exit = values[i][6];  // G
    
    //         0   1   2   3   4   5   6   7   8   9   10  11
    //         H   I   J   K   L   M   N   O   P   Q   R   S
    var arr = ['', '', '', '', '', '', '', '', '', '', '', ''];
    if (values[i][2] in symbolMapping) {
      arr[0] = symbolMapping[values[i][2]];
    }
    
    if (values[i][2] in smallSymbolMapping) {
      arr[1] = smallSymbolMapping[values[i][2]];
    }
    
    switch(type) {
      case 'Equity':
        var optionsData = callToS_('https://api.tdameritrade.com/v1/marketdata/chains',
          'symbol=' + arr[0] +
          '&contractType=' + (signal === 'SELL' ? 'PUT' : 'CALL') +
          '&strikeCount=1' +
          '&range=ITM');
        var [mark, delta] = processOption(optionsData);
        
        arr[2] = Number(parseFloat(entry).toFixed(2));
        arr[3] = Number(parseFloat(exit).toFixed(2));
        arr[4] = Number(parseFloat((signal === 'SELL' ? 1 : -1) * (4.0 / Math.abs(delta)) + arr[2]).toFixed(2));
        arr[5] = (signal === 'SELL' ? 1 : -1) * 4.0 + arr[2];
        arr[6] = Math.abs((arr[3] - arr[2]) * 100 * delta);
        arr[7] = Math.abs(arr[3] - arr[2]);
        
        // Approximate options buying power
        arr[8] = mark * 100;
        arr[9] = entry / 2;
        arr[10] = arr[6] / arr[8];
        arr[11] = arr[7] / arr[9];
        break;
      case 'Forex':
        // Forex can have arbitrary precision
        arr[2] = entry;
        arr[3] = exit;
        arr[4] = (signal === 'SELL' ? 1 : -1) / 100000.0 * 400 + arr[2];
        arr[5] = (signal === 'SELL' ? 1 : -1) / 10000.0 * 400 + arr[2];
        arr[6] = Math.abs(arr[3] - arr[2]) * 100000;  // standard lot
        arr[7] = Math.abs(arr[3] - arr[2]) * 10000;  // mini lot
        arr[8] = entry * 100000 / 20;
        arr[9] = entry * 10000 / 20;
        if (symbol.substr(3) != 'USD') {
          var lookup = 'USD/' + symbol.substr(3);
          arr[6] /= json[lookup].lastPriceInDouble;
          arr[7] /= json[lookup].lastPriceInDouble;
          arr[8] /= json[lookup].lastPriceInDouble;
          arr[9] /= json[lookup].lastPriceInDouble;
        }

        arr[10] = arr[6] / arr[8];
        arr[11] = arr[7] / arr[9];
        break;
      case 'Futures':
        // edge case
        if (symbol === 'JY') {
          entry /= 100;
          exit /= 100;
        }
        if (symbol in symbolMapping) {
          var tosSymbol = symbolMapping[symbol];
          if (tosSymbol[0] === '(') {
            break;
          }
          var tick = json[tosSymbol].tickAmount / json[tosSymbol].futureMultiplier;
          var contractSize = json[tosSymbol].futureMultiplier;
          arr[2] = truncateTick(entry, tick);
          arr[3] = truncateTick(exit, tick);
          arr[4] = truncateTick((signal === 'SELL' ? 1 : -1) / contractSize * 400 + arr[2], tick);
          arr[6] = Math.abs(arr[3] - arr[2]) * contractSize;
        }
        if (symbol in smallSymbolMapping) {
          var smallSymbol = smallSymbolMapping[symbol];
          if (smallSymbol[0] === '(') {
            break;
          }
          var smallContractSize = json[smallSymbol].futureMultiplier;
          arr[5] = truncateTick((signal === 'SELL' ? 1 : -1) / smallContractSize * 400 + arr[2], tick);
          arr[7] = Math.abs(arr[3] - arr[2]) * smallContractSize;
        }

        if (symbol in symbolMapping && symbolMapping[symbol][0] != '(') {
          var tosSymbol = symbolMapping[symbol];
          var clearingExchange = globexToClearingExchange[tosSymbol.substr(1)];
          var clearing = clearingExchange[0];
          if (clearing[0] === '0') {
            clearing = clearing.substr(1);
          }
          var margin = clearingExchangeToMargin[[clearing, clearingExchange[1]]];
          arr[8] = margin;
          arr[10] = arr[6] / arr[8];
        }

        if (symbol in smallSymbolMapping && smallSymbolMapping[symbol][0] != '(') {
          var smallSymbol = smallSymbolMapping[symbol];
          var clearingExchange = globexToClearingExchange[smallSymbol.substr(1)];
          var margin = clearingExchangeToMargin[clearingExchange];
          arr[9] = margin;
          arr[11] = arr[7] / arr[9];
        }
        break;
      default:
        break;
    }
    
    addedColumns.push(arr);
  }
  
  signalsSheet.getRange('H2:S' + (2 + addedColumns.length - 1))
    .setValues(addedColumns);
  
  // Final touches
  signalsSheet.setFrozenRows(1);
  signalsSheet.setFrozenColumns(7);
  signalsSheet.getRange('H2:I' + (2 + addedColumns.length - 1))
    .setFontFamily('Source Code Pro');
  signalsSheet.getRange('N2:N').setNumberFormat('0.00');
  signalsSheet.getRange('O2:O').setNumberFormat('0.00');
  signalsSheet.getRange('P2:P').setNumberFormat('0.00');
  signalsSheet.getRange('Q2:Q').setNumberFormat('0.00');
  signalsSheet.getRange('R2:R').setNumberFormat('0.00%');
  signalsSheet.getRange('S2:S').setNumberFormat('0.00%');
  signalsSheet.getDataRange().setHorizontalAlignment('left');
  signalsSheet.autoResizeColumns(1, 19);
  if (signalsSheet.getRange('A:T').getFilter() != null) {
    signalsSheet.getRange('A:T').getFilter().remove();
  }
  signalsSheet.getRange('A:T').createFilter();
}

function loadMappings() {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var symbolMapping = {};
  var smallSymbolMapping = {};
  var pcCoverageListSheet = spreadsheet.getSheetByName('PC Coverage List');
  var pcCoverageListData = pcCoverageListSheet.getRange('A2:F').getValues();
  for (var i = 0; i < pcCoverageListData.length; i++) {
    if (pcCoverageListData[i][0] === '') {
      break;
    }
    
    var productType = pcCoverageListData[i][0];
    var symbol = pcCoverageListData[i][1];
    var description = pcCoverageListData[i][2];
    var tosSymbol = pcCoverageListData[i][3];
    var smallSymbol = pcCoverageListData[i][4];
    var onToS = pcCoverageListData[i][5];
    
    if (tosSymbol) {
      symbolMapping[symbol] = tosSymbol;
    }
    
    if (smallSymbol) {
      smallSymbolMapping[symbol] = smallSymbol;
    }
  }
  
  return [symbolMapping, smallSymbolMapping];
}

function loadCMEGroupCodes() {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var cmeGroupCodesSheet = spreadsheet.getSheetByName('CMEGroup Codes');
  var values = cmeGroupCodesSheet.getRange('A2:G').getValues();
  var globexToClearingExchange = {};
  for (var i = 0; i < values.length; i++) {
    var clearing = values[i][0];
    var globex = values[i][1];
    var clearport = values[i][2];
    var productName = values[i][3];
    var productGroup = values[i][4];
    var subGroup = values[i][5];
    var exchange = values[i][6];
    
    globexToClearingExchange[globex] = [clearing, exchange];
  }
  return globexToClearingExchange
}

function loadCMEGroupMargins() {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var cmeGroupMarginsSheet = spreadsheet.getSheetByName('CMEGroup Margins');
  var values = cmeGroupMarginsSheet.getRange('A2:G').getValues();
  var clearingExchangeToMargin = {};
  for (var i = 0; i < values.length; i++) {
    var exchange = values[i][0];
    var assetClass = values[i][1];
    var productName = values[i][2];
    var productCode = values[i][3];
    var startPeriod = values[i][4];
    var endPeriod = values[i][5];
    var maintenance = values[i][6];
    
    var key = [productCode, exchange];
    if (key in clearingExchangeToMargin && clearingExchangeToMargin[key] >= maintenance) {
      continue;
    }
    clearingExchangeToMargin[key] = maintenance;
  }
  return clearingExchangeToMargin;
}

function processOption(json) {
  const callExpDateMap = json.callExpDateMap;
  const keys = Object.keys(callExpDateMap);
  var chosenKey = null;
  for (var i in keys) {
    var key = keys[i];
    var daysTilExp = Number(key.split(':')[1]);
    if (daysTilExp < 35) {
      continue;
    }
    if (chosenKey === null || daysTilExp < Number(chosenKey.split(':')[1])) {
      chosenKey = key;
    }
  }
  
  if (chosenKey === null) {
    throw('findOptionMidPrice error: ' + JSON.stringify(json));
  }
  
  const v = callExpDateMap[chosenKey][Object.keys(callExpDateMap[chosenKey])[0]][0];
  return [v.mark, v.delta]
}

function callToS_(url, paramStr) {
  const API_KEY = 'ULUVARBYS';
  url = url + '?apikey=' + API_KEY + '&' + paramStr;
  var headers = {
    'Authorization': 'Bearer ' + getToSService_().getAccessToken(),
    'Accept': 'application/json'
  };
  var options = {
    'headers': headers,
    'method': 'GET'
  };
  var response = UrlFetchApp.fetch(url, options);
  if (response.getResponseCode() != 200) {
    throw(response.getContentText());
  }
  var json = JSON.parse(response.getContentText());
  return json;
}

function truncateTick(price, tick) {
  return Math.round(parseFloat(price) / tick) * tick;
}



