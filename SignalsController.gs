/* SignalsController.gs */
/**
 * @file Signals Controller
 */

/**
 * Process the PatternCast emailed signals and show the processed results
 * on the Signals sheet.
 */
function processSignals() {
  var tdService = getTDService();
  if (!tdService.hasAccess()) {
    requestAuthorization();
    return;
  }
  tdService.refresh();

  var repo = new SignalsRepository(new TDClient(tdService), new CMEGroup());
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Signals');

  // Obtain quote information for emailed signal quotes
  repo.fetchQuotes(sheet.getRange('C2:C').getValues());

  // Set up headers of newly added columns
  sheet.getRange('H1:S1')
    .setFontColor('white')
    .setBackground('black')
    .setFontWeight('bold')
    .setValues([[
      'ToS',            // H1 0
      'Small',          // I1 1
      'ENTRY',          // J1 2
      'EXIT',           // K1 3
      'STOP',           // L1 4
      'Small STOP',     // M1 5
      'Profit*',        // N1 6
      'Small Profit**', // O1 7
      'Margin',         // P1 8
      'Small Margin',   // Q1 9
      'RoC',            // R1 10
      'Small RoC'       // S1 11
    ]]);
    sheet.getRange('V2')
      .setValue('* Assuming naked option for equity at >=35 days exp, or standard lot for forex (100,000)');
    sheet.getRange('V3')
      .setValue('** Assuming 1 share for equity, or mini lot for forex (10,000)');

    var addedColumns = [];
    var emailData = sheet.getRange('A2:G').getValues();
    for (var i = 0; i < emailData.length; i++) {
      if (emailData[i][0] === '') {
        break;
      }

      var sessionStart = emailData[i][0]; // A
      var type = emailData[i][1];         // B
      var symbol = emailData[i][2];       // C
      var description = emailData[i][3];  // D
      var signal = emailData[i][4];       // E
      var entry = emailData[i][5];        // F
      var exit = emailData[i][6];         // G

      // edge case
      if (symbol === 'JY') {
        entry /= 100;
        exit /= 100;
      }

      //         0   1   2   3   4   5   6   7   8   9   10  11
      //         H   I   J   K   L   M   N   O   P   Q   R   S
      var arr = ['', '', '', '', '', '', '', '', '', '', '', ''];
      
      // ToS            H 0
      var tosSymbol = repo.mapEmailToToSSymbol(symbol);
      if (tosSymbol != null) {
        arr[0] = tosSymbol;
      }

      // Small          I 1
      var smallToSSymbol = repo.mapEmailToToSSmallSymbol(symbol);
      if (smallToSSymbol != null) {
        arr[1] = repo.mapEmailToToSSmallSymbol(symbol);
      }
      switch(type) {
        case 'Equity':
          var [mark, delta] = repo.getOptions(arr[0], signal);
          // ENTRY          J 2
          arr[2] = parseFloat(entry).toFixed(2);
          // EXIT           K 3
          arr[3] = parseFloat(exit).toFixed(2);
          // STOP           L 4
          arr[4] = parseFloat((signal === 'SELL' ? 1 : -1) * (4.0 / Math.abs(delta)) + entry).toFixed(2);
          // Small STOP     M 5
          arr[5] = parseFloat((signal === 'SELL' ? 1 : -1) * 4.0 + entry).toFixed(2);
          // Profit*        N 6
          arr[6] = parseFloat(Math.abs(exit - entry) * 100 * delta).toFixed(2);
          // Small Profit** O 7
          arr[7] = parseFloat(Math.abs(exit - entry)).toFixed(2);
          // Margin         P 8
          arr[8] = mark * 100;
          // Small Margin   Q 9
          arr[9] = entry / 2;
          // RoC            R 10
          arr[10] = Number(arr[6]) / Number(arr[8]);
          // Small RoC      S 11
          arr[11] = Number(arr[7]) / Number(arr[9]);
          break;
        case 'Forex':
          var isMajor = (arr[0] == 'EUR/USD' ||
                         arr[0] == 'USD/JPY' ||
                         arr[0] == 'GBP/USD' ||
                         arr[0] == 'USD/CAD' ||
                         arr[0] == 'USD/CHF' ||
                         arr[0] == 'AUD/USD' ||
                         arr[0] == 'NZD/USD');
          var conversionRate = 1;
          if (symbol.substr(3) != 'USD') {
            var quote = repo.getQuote('USD/' + symbol.substr(3));
            conversionRate = quote.lastPriceInDouble;
          }
          // ENTRY          J 2
          arr[2] = entry;
          // EXIT           K 3
          arr[3] = exit;
          // STOP           L 4
          arr[4] = (signal === 'SELL' ? 1 : -1) / 10000.0 * 400 + entry;
          // Small STOP     M 5
          // Profit*        N 6
          arr[6] = parseFloat(Math.abs(exit - entry) * 10000.0 / conversionRate).toFixed(2);
          // Small Profit** O 7
          // Margin         P 8
          arr[8] = Math.min(
            isMajor ? 200 : 500,
            entry * 10000.0 / (isMajor ? 20 : 50) / conversionRate);
          // Small Margin   Q 9
          // RoC            R 10
          arr[10] = arr[6] / arr[8];
          // Small RoC      S 11
          break;
        case 'Futures':
          var quote = repo.getQuote(arr[0]);
          var tick = quote.tickAmount / quote.futureMultiplier;
          var contractSize = quote.futureMultiplier;
          // ENTRY          J 2
          arr[2] = optionallyTickify_(arr[0], truncateTick_(entry, tick));
          // EXIT           K 3
          arr[3] = optionallyTickify_(arr[0], truncateTick_(exit, tick));
          // STOP           L 4
          arr[4] = optionallyTickify_(
            arr[0],
            truncateTick_((signal === 'SELL' ? 1 : -1) / contractSize * 400 + entry, tick));
          // Profit*        N 6
          arr[6] = parseFloat(Math.abs(exit - entry) * contractSize).toFixed(2);
          // Margin         P 8
          arr[8] = repo.getMargin(arr[0]);
          // RoC            R 10
          arr[10] = Number(arr[6]) / Number(arr[8]);
          if (arr[1] != '') {
            var smallQuote = repo.getQuote(arr[1]);
            var smallTick = smallQuote.tickAmount / smallQuote.futureMultiplier;
            var smallContractSize = smallQuote.futureMultiplier;
            // Small STOP     M 5
            arr[5] = optionallyTickify_(
              arr[1],
              truncateTick_((signal === 'SELL' ? 1 : -1) / smallContractSize * 400 + entry, tick));
            // Small Profit** O 7
            arr[7] = parseFloat(Math.abs(exit - entry) * smallContractSize).toFixed(2);
            // Small Margin   Q 9
            arr[9] = repo.getMargin(arr[1]);
            // Small RoC      S 11
            arr[11] = Number(arr[7]) / Number(arr[9]);
          }
          break;
        default:
          break;
      }

      addedColumns.push(arr);
    }

    sheet.getRange('H2:S' + (2 + addedColumns.length - 1))
      .setValues(addedColumns);

  // Final touches
  sheet.setFrozenRows(1);
  sheet.setFrozenColumns(7);
  sheet.getRange('H2:I' + (2 + addedColumns.length - 1))
    .setFontFamily('Source Code Pro');
  sheet.getRange('N2:N').setNumberFormat('0.00');
  sheet.getRange('O2:O').setNumberFormat('0.00');
  sheet.getRange('P2:P').setNumberFormat('0.00');
  sheet.getRange('Q2:Q').setNumberFormat('0.00');
  sheet.getRange('R2:R').setNumberFormat('0.00%');
  sheet.getRange('S2:S').setNumberFormat('0.00%');
  sheet.getDataRange().setHorizontalAlignment('left');
  sheet.autoResizeColumns(1, 19);
  if (sheet.getRange('A:U').getFilter() != null) {
    sheet.getRange('A:U').getFilter().remove();
  }
  sheet.getRange('A:U').createFilter();
}

/**
 * Truncate the price to be whole number increments of tick.
 * @param {Number} price price.
 * @param {Number} tick tick amount.
 * @return {Number} Price truncated to be a whole number increment of tick.
 */
function truncateTick_(price, tick) {
  return Math.round(parseFloat(price) / tick) * tick;
}

/**
 * Convert XX.XXX to XX'XXX number format for certain symbols.
 * @param {string} tosSymbol ToS symbol.
 * @param {Number} price price.
 * @return {string} Price in XX'XXX format.
 */
function optionallyTickify_(tosSymbol, price) {
  if (tosSymbol === '/ZF' || tosSymbol === '/ZN') {
    return Math.trunc(price) + "'" + Math.trunc((price - Math.trunc(price)) * 320);
  }
  return price;
}
