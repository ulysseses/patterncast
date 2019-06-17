/**
 * @file Code.gs defines onOpen, which adds menu items.
 */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('PatternCast')
    .addItem('Authorize ToS', 'requestAuthorization')
    .addItem('Reset Client ID', 'resetClientID')
    .addItem('Process Signals', 'processSignals')
    .addToUi();
}
