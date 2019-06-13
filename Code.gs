/* Code.gs */
/**
 * @file Code.gs defines onOpen, which adds menu items.
 */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('PatternCast')
    .addItem('Authorize ToS', 'requestAuthorization')
    .addItem('Process Signals', 'processSignals')
    .addToUi();
}
