/**
 * @file functions for easy access to TD Ameritrade API
 */


/**
 * Creates a new TD API client.
 * @param {Service_} tdService The TD Ameritrade service.
 * @constructor
 */
var TDClient = function(tdService) {
  validate_({
    'tdService': tdService
  });
  this.service_ = tdService;
  this.apiKey_ = tdService.clientId_.split('@')[0];
};


/**
 * Get quote for one or more symbols.
 * https://developer.tdameritrade.com/quotes/apis/get/marketdata/quotes
 * @param {Array.<string>} Array of symbols.
 * @return {object} Get Quotes response.
 */
TDClient.prototype.getQuotes = function(symbols) {
  var urlBase = 'https://api.tdameritrade.com/v1/marketdata/quotes';
  var params = {
    symbol: symbols.join(',')
  };
  return this.callAPI_(urlBase, params, 'GET');
}

/**
 * Get option chain for an optionable symbol.
 * https://developer.tdameritrade.com/option-chains/apis/get/marketdata/chains
 * @param {object} query
 * @return {object} Get Option Chain response.
 */
TDClient.prototype.getOptionChain = function(query) {
  var urlBase = 'https://api.tdameritrade.com/v1/marketdata/chains';
  return this.callAPI_(urlBase, query, 'GET');
}


/**
 * Make a request.
 * @param {string} urlBase URL base of API.
 * @param {Object.<string, string>} params The values to validate.
 * @param {string} method 'GET', 'POST', etc.
 * @return {object} JSON response.
 */
TDClient.prototype.callAPI_ = function(urlBase, params, method) {
  var options = {
    'headers': {
      'Authorization': 'Bearer ' + this.service_.getAccessToken(),
      'Accept': 'application/json'
    },
    'method': method
  };

  var queryString = Object.keys(params)
    .map(function(k) { return encodeURIComponent(k) + '=' + encodeURIComponent(params[k])})
    .join('&');
  var url = urlBase + '?' + this.apiKey_ + '&' + queryString;

  var response = UrlFetchApp.fetch(url, options);
  if (response.getResponseCode() != 200) {
    throw(response.getContentText());
  }
  return JSON.parse(response.getContentText());
}


/**
 * Validates that all of the values in the object are non-empty. If an empty
 * value is found, and error is thrown using the key as the name.
 * @param {Object.<string, string>} params The values to validate.
 * @private
 */
function validate_(params) {
  Object.keys(params).forEach(function(name) {
    var value = params[name];
    if (!value) {
      throw new Error(name + ' is required.');
    }
  });
}
