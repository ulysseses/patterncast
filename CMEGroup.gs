/* CMEGroup.gs */


var CMEGroup = function() {
  this.loadMappings_();
  this.loadCMEGroupCodes_();
  this.loadFutureMargins_();
}

/**
 * Load PatternCast -> ToS symbols.
 */
CMEGroup.prototype.loadMappings_ = function() {
  this.symbolMapping_ = {};
  this.smallSymbolMapping_ = {};

  let pcCoverageList = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName('PC Coverage List')
    .getRange('A2:F')
    .getValues();

  for (let i = 0; i < pcCoverageList.length; i++) {
    if (pcCoverageList[i][0] === '') {
      break;
    }
    let productType = pcCoverageList[i][0];
    let symbol = pcCoverageList[i][1];
    let description = pcCoverageList[i][2];
    let tosSymbol = pcCoverageList[i][3];
    let smallSymbol = pcCoverageList[i][4];
    let onToS = pcCoverageList[i][5];

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

  let codes = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName('CMEGroup Codes')
    .getRange('A2:G')
    .getValues();

  for (let i = 0; i < codes.length; i++) {
    let clearing = codes[i][0];
    let globex = codes[i][1];
    let clearport = codes[i][2];
    let productName = codes[i][3];
    let productGroup = codes[i][4];
    let subGroup = codes[i][5];
    let exchange = codes[i][6];

    this.globexToClearingExchange_[globex] = [clearing, exchange];
    this.clearingExchangeToGlobex_[[clearing, exchange]] = globex;
  }
}

/**
 * Load CME future margins.
 */
CMEGroup.prototype.loadFutureMargins_ = function() {
  this.globexToMargin_ = {};

  let margins = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName('CMEGroup Margins')
    .getRange('A2:G')
    .getValues();

  for (let i = 0; i < margins.length; i++) {
    let exchange = margins[i][0];
    let assetClass = margins[i][1];
    let productName = margins[i][2];
    let productCode = margins[i][3];
    let startPeriod = margins[i][4];
    let endPeriod = margins[i][5];
    let maintenance = margins[i][6];

    let key = [productCode, exchange];
    let globex = this.clearingExchangeToGlobex_[key];
    if (globex === null) {
      continue;
    }
    
    if (globex in this.globexToMargin_ && this.globexToMargin_[globex] >= maintenance) {
      continue;
    }

    this.globexToMargin_[globex] = maintenance;
  }
}
