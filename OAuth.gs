/* OAuth.gs */
/**
 * @file functions for OAuth 2.0 authentication/authorization with TD Ameritrade API
 */

/**
 * Gets the OAuth2 Service_ corresponding to the TD Ameritrade API.
 * @param {string} clientID The name of the service.
 * @return {Service_} The service object.
 */
function getTDService(clientID) {
  var p = PropertiesService.getUserProperties();
  // Get cached td_client_id, or prompt for one from the user
  if (clientID === null) {
    clientID = p.getProperty('td_client_id')
    if (clientID === null) {
      clientID = SpreadsheetApp.getUi().prompt('Enter your TD Ameritrade Client ID (without @AMER.OAUTHAP suffix):');
      clientID += '@AMER.OAUTHAP';
      p.setProperty('td_client_id', clientID)
    }
  }

  return OAuth2.createService('TD Ameritrade')
    .setPropertyStore(p)
    .setAuthorizationBaseUrl('https://auth.tdameritrade.com/auth')
    .setParam('response_type', 'code')
    .setClientId(clientID)
    .setClientSecret('NO_SECRET')
    .setCallbackFunction('authCallback_')
    .setTokenUrl('https://api.tdameritrade.com/v1/oauth2/token')
}

/**
 * Handles the OAuth 2.0 callback for TD Ameritrade
 * @param {Object} req The request data received from the callback function.
 * @return {HtmlOutput} HTML output shown after callback completes.
 */
function authCallback_(req) {
  var service = getTDService();
  var payload = {
    code: request.parameter.code,
    client_id: service.clientId_,
    redirect_url: service.getRedirectUri(),
    grant_type: 'authorization_code',
    access_type: 'offline'
  };
  var token = service.fetchToken_(payload);
  service.saveToken_(token);
  if (service.hasAccess()) {
    return HtmlService.createHtmlOutput('Success! You can close this tab.');
  } else {
    return HtmlService.createHtmlOutput('Denied. Please close this tab.');
  }
}

/**
 * Request authorization from user via sidebar
 */
function requestAuthorization() {
  var service = getTDService();
  var ui = SpreadsheetApp.getUi();
  if (service.hasAccess()) {
    service.refresh();
    ui.alert('Already authorized with TD Ameritrade.');
  } else {
    let template = HtmlService.createTemplate(
        '<a href="<?= authorizationUrl ?>" target="_blank" onclick="google.script.host.close()">Authorize</a>');
    template.authorizationUrl = service.getAuthorizationUrl();
    ui.showSidebar(template.evaluate());
  }
}
