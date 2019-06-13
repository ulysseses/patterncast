// Configure the service.
function getToSService_() {
  const CLIENT_ID = 'ULUVARBYS@AMER.OAUTHAP';
  return OAuth2.createService('ToS')
    .setPropertyStore(PropertiesService.getUserProperties())
    .setAuthorizationBaseUrl('https://auth.tdameritrade.com/auth')
    .setParam('response_type', 'code')
    .setClientId(CLIENT_ID)
    .setClientSecret('NO_SECRET')
    .setCallbackFunction('authCallback')
    .setTokenUrl('https://api.tdameritrade.com/v1/oauth2/token');
}

// Handle the callback.
function authCallback(request) {
  var service = getToSService_();
  var payload = {
    code: request.parameter.code,
    client_id: service.clientId_,
    redirect_uri: service.getRedirectUri(),
    grant_type: 'authorization_code',
    access_type: 'offline'
  };
  var token = service.fetchToken_(payload);
  service.saveToken_(token);
  if (service.hasAccess()) {
    return HtmlService.createHtmlOutput('Success! You can close this tab.');
  } else {
    return HtmlService.createHtmlOutput('Denied. You can close this tab.');
  }
}
