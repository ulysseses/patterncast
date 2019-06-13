/* SignalsRepository.gs */
/**
 * @file Signals Repository
 */


var SignalsRepository = function(tdClient, cmeGroup) {
  this.tdClient_ = tdClient;
  this.cmeGroup_ = cmeGroup;
  this.options_ = {};
}

SignalsRepository.prototype.fetchQuotes = function(emailSymbols) {
  let symbolSet = {};
  let symbols = [];
  for (let i = 0; i < emailSymbols.length; i++) {
    let emailSymbol = emailSymbols[i];
    if (emailSymbol in this.cmeGroup_.symbolMapping_) {
      let symbol = this.cmeGroup_.symbolMapping_[emailSymbol];
      if (symbol in symbolSet) {
        continue;
      }
      symbolSet[symbol] = true;
      symbols.push(symbol);
    }

    if (emailSymbol in this.cmeGroup_.smallSymbolMapping_) {
      let symbol = this.cmeGroup_.smallSymbolMapping_[emailSymbol];
      if (symbol in symbolSet) {
        continue;
      }
      symbolSet[symbol] = true;
      symbols.push(symbol);
    }

    if (emailSymbol.length == 6 && emailSybmol.substr(3) != 'USD') {
      let symbol = 'USD/' + symbol.substr(3);
      symbols.push(symbol);
    }
  }

  this.quotes_ = this.tdClient_.getQuotes(symbols);
}

SignalsRepository.prototype.getQuote = function(symbol) {
  return this.quotes_[symbol];
}

SignalsRepository.prototype.getOptions = function(symbol, signal) {
  if (this.options_[symbol] === null) {
    let optionsData = this.tdClient_.getOptionChain({
      symbol: symbol,
      contractType: (signal === 'SELL' ? 'PUT' : 'CALL'),
      strikeCount: 1,
      range: 'ITM'
    });
    this.options_[symbol] = processOption_(optionsData);
  }
  return this.options_[symbol]
}

function processOption_(json) {
  let callExpDateMap = json.callExpDateMap;
  let keys = Object.keys(callExpDateMap);
  var chosenKey = null;
  for (let i in keys) {
    let key = keys[i];
    let daysTilExp = Number(key.split(':')[1]);
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
  
  let v = callExpDateMap[chosenKey][Object.keys(callExpDateMap[chosenKey])[0]][0];
  return [v.mark, v.delta]
}


SignalsRepository.prototype.mapEmailToToSSymbol = function(emailSymbol) {
  return this.cmeGroup_.symbolMapping_[emailSymbol];
}

SignalsRepository.prototype.mapEmailToToSSmallSymbol = function(emailSymbol) {
  return this.cmeGroup_.smallSymbolMapping_[emailSymbol];
}

SignalsRepository.prototype.getMargin = function(symbol) {
  return this.cmeGroup_.globexToMargin_[symbol.substr(1)];  // remove / prefix
}
