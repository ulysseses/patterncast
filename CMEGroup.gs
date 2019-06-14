/* CMEGroup.gs */

/**
 * Creates a new CMEGroup sub-repository. This is used internally by SignalsRepository.
 * @constructor
 */
var CMEGroup = function() {
  this.loadMappings_();
  this.loadCMEGroupCodes_();
  this.loadFutureMargins_();
};

/**
 * Load PatternCast -> ToS symbols.
 */
CMEGroup.prototype.loadMappings_ = function() {
  this.symbolMapping_ = {};
  this.smallSymbolMapping_ = {};

  var pcCoverageList = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName('PC Coverage List')
    .getRange('A2:F')
    .getValues();

  for (var i = 0; i < pcCoverageList.length; i++) {
    if (pcCoverageList[i][0] === '') {
      break;
    }
    var productType = pcCoverageList[i][0];
    var symbol = pcCoverageList[i][1];
    var description = pcCoverageList[i][2];
    var tosSymbol = pcCoverageList[i][3];
    var smallSymbol = pcCoverageList[i][4];
    var onToS = pcCoverageList[i][5];

    if (tosSymbol && onToS) {
      this.symbolMapping_[symbol] = tosSymbol;
    }
    
    if (smallSymbol && onToS) {
      this.smallSymbolMapping_[symbol] = smallSymbol;
    }
  }
}

/**
 * Load CME Group codes.
 */
CMEGroup.prototype.loadCMEGroupCodes_ = function() {
  this.globexToClearingExchange_ = {};
  this.clearingExchangeToGlobex_ = {};

  var codes = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName('CMEGroup Codes')
    .getRange('A2:G')
    .getValues();

  for (var i = 0; i < codes.length; i++) {
    var clearing = codes[i][0];
    var globex = codes[i][1];
    var clearport = codes[i][2];
    var productName = codes[i][3];
    var productGroup = codes[i][4];
    var subGroup = codes[i][5];
    var exchange = codes[i][6];

    this.globexToClearingExchange_[globex] = [clearing, exchange];
    this.clearingExchangeToGlobex_[[clearing, exchange]] = globex;
  }
}

/**
 * Load CME future margins.
 */
CMEGroup.prototype.loadFutureMargins_ = function() {
  this.globexToMargin_ = {};

  var margins = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName('CMEGroup Margins')
    .getRange('A2:G')
    .getValues();

  for (var i = 0; i < margins.length; i++) {
    var exchange = margins[i][0];
    var assetClass = margins[i][1];
    var productName = margins[i][2];
    var productCode = margins[i][3];
    var startPeriod = margins[i][4];
    var endPeriod = margins[i][5];
    var maintenance = margins[i][6];

    var key = [productCode, exchange];
    var globex = this.clearingExchangeToGlobex_[key];
    if (globex === null) {
      continue;
    }
    
    if (globex in this.globexToMargin_ && this.globexToMargin_[globex] >= maintenance) {
      continue;
    }

    this.globexToMargin_[globex] = maintenance;
  }
}
