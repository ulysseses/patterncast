/* SignalsRepository.gs */
/**
 * @file Signals Repository
 */


/**
 * Creates a new SignalsRepository. This combines the TD Client and CMEGroup sub-respository.
 * It is the only interface SignalsController will need to deal with for all data needs.
 * @constructor
 */
var SignalsRepository = function(tdClient, cmeGroup) {
  this.tdClient_ = tdClient;
  this.cmeGroup_ = cmeGroup;
  this.options_ = {};
}


/**
 * Fetch and store quotes for the symbols listed in the email.
 * @param {Array.<string>} emailSymbols Array of email symbols.
 */
SignalsRepository.prototype.fetchQuotes = function(emailSymbols) {
  var symbolSet = {};
  var symbols = [];
  for (var i = 0; i < emailSymbols.length; i++) {
    var emailSymbol = emailSymbols[i][0];
    if (emailSymbol === '') {
      break;
    }
    
    if (emailSymbol in this.cmeGroup_.symbolMapping_) {
      var symbol = this.cmeGroup_.symbolMapping_[emailSymbol];
      if (symbol in symbolSet) {
        continue;
      }
      symbolSet[symbol] = true;
      symbols.push(symbol);
    }

    if (emailSymbol in this.cmeGroup_.smallSymbolMapping_) {
      var symbol = this.cmeGroup_.smallSymbolMapping_[emailSymbol];
      if (symbol in symbolSet) {
        continue;
      }
      symbolSet[symbol] = true;
      symbols.push(symbol);
    }
    
    if (emailSymbol.length == 6 && emailSymbol.substr(3) != 'USD') {
      var symbol = 'USD/' + emailSymbol.substr(3);
      if (symbol in symbolSet) {
        continue;
      }
      symbolSet[symbol] = true;
      symbols.push(symbol);
    }
  }
  this.quotes_ = this.tdClient_.getQuotes(symbols);
}

/**
 * Retrieve the quote for the symbol. Must call fetchQuotes first.
 * @param {string} symbol Symbol to get quote for.
 * @return {object} Quote JSON associated to ToS symbol.
 */
SignalsRepository.prototype.getQuote = function(symbol) {
  return this.quotes_[symbol];
}

/**
 * Retrieve the options data for the symbol. This fetches and caches
 * the options data via TD Client if not cached already.
 * @param {string} symbol Symbol to get options data for.
 * @return {object} Options Data JSON associated to ToS symbol.
 */
SignalsRepository.prototype.getOptions = function(symbol, signal) {
  if (!(symbol in this.options_)) {
    var optionsData = this.tdClient_.getOptionChain({
      symbol: symbol,
      contractType: (signal === 'SELL' ? 'PUT' : 'CALL'),
      strikeCount: 1,
      range: 'ITM'
    });
    this.options_[symbol] = processOption_(optionsData);
  }
  return this.options_[symbol]
}

/**
 * Obtain just the mark and delta from the Options data JSON.
 * @param {object} json Options data JSON.
 * @return {Array.<Number, Number>} Mark and Delta.
 */
function processOption_(json) {
  var callExpDateMap = json.callExpDateMap;
  var keys = Object.keys(callExpDateMap);
  var chosenKey = null;
  for (var i = 0; i < keys.length; i++) {
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
  
  var v = callExpDateMap[chosenKey][Object.keys(callExpDateMap[chosenKey])[0]][0];
  return [v.mark, v.delta]
}

/**
 * Map email symbol to ToS symbol.
 * @param {string} emailSymbol email symbol.
 * @return {string} ToS symbol.
 */
SignalsRepository.prototype.mapEmailToToSSymbol = function(emailSymbol) {
  return this.cmeGroup_.symbolMapping_[emailSymbol];
}

/**
 * Map email symbol to small ToS symbol.
 * @param {string} emailSymbol email symbol.
 * @return {string} small ToS symbol.
 */
SignalsRepository.prototype.mapEmailToToSSmallSymbol = function(emailSymbol) {
  return this.cmeGroup_.smallSymbolMapping_[emailSymbol];
}

/**
 * Get the margin requirement for the corresponding ToS symbol.
 * @param {string} symbol ToS symbol.
 * @return {Number} Margin requirement for symbol.
 */
SignalsRepository.prototype.getMargin = function(symbol) {
  return this.cmeGroup_.globexToMargin_[symbol.substr(1)];  // remove / prefix
}
