const _ = require('lodash')
const GoogleSheetsClientManager = require('../../../../googleSheets/GoogleSheetsClientManager')
const GSheetParser = require('./GSheetParser')
const GroupInitializer = require('./GroupInitializer')
const Alerts = require('../../../../utils/Alerts')
const swal = require('sweetalert2')
// PVSCL:IFCOND(Hypothesis, LINE)
const HypothesisClientManager = require('../../../../annotationServer/hypothesis/HypothesisClientManager')
// PVSCL:ENDCOND
// PVSCL:IFCOND(BrowserStorage, LINE)
const BrowserStorageManager = require('../../../../annotationServer/browserStorage/BrowserStorageManager')
// PVSCL:ENDCOND

class GoogleSheetContentScriptManager {
  init (callback) {
    window.googleSheetProvider.googleSheetClientManager = new GoogleSheetsClientManager()
    this.loadAnnotationServer(() => {
      this.initLoginProcess((err, tokens) => {
        if (err) {
          swal('Oops!',
            'Unable to configure current spreadsheet. Failed login to services.', // TODO i18n
            'error') // Notify error to user
          if (_.isFunction(callback)) {
            callback()
          }
        } else {
          // Show tool is configuring prompt
          this.showToolIsConfiguring()
          // console.debug('Correctly logged in to hypothesis: %s', tokens.hypothesis)
          console.debug('Correctly logged in to gSheet: %s', tokens.gSheet)
          this.initGoogleSheetParsing(() => {
            // Execute callback without errors
            if (_.isFunction(callback)) {
              callback()
            }
          })
        }
      })
    })
  }

  showToolIsConfiguring () {
    swal({
      position: 'top-end',
      title: 'Configuring the tool, please be patient', // TODO i18n
      text: 'If the tool takes too much time, please reload the page and try again.',
      showConfirmButton: false,
      onOpen: () => {
        swal.showLoading()
      }
    })
  }

  initLoginProcess (callback) {
    window.googleSheetProvider.annotationServerManager.logIn((err) => {
      if (err) {
        callback(err)
      } else {
        window.googleSheetProvider.googleSheetClientManager.logInGoogleSheets((err, gSheetToken) => {
          if (err) {
            callback(err)
          } else {
            callback(null, {
              gSheet: gSheetToken
            })
          }
        })
      }
    })
  }

  loadAnnotationServer (callback) {
    // PVSCL:IFCOND(AnnotationServer->pv:SelectedChildren()->pv:Size()=1, LINE)
    // PVSCL:IFCOND(Hypothesis, LINE)
    window.googleSheetProvider.annotationServerManager = new HypothesisClientManager()
    // PVSCL:ENDCOND
    // PVSCL:IFCOND(BrowserStorage, LINE)
    window.googleSheetProvider.annotationServerManager = new BrowserStorageManager()
    // PVSCL:ENDCOND
    window.googleSheetProvider.annotationServerManager.init((err) => {
      if (_.isFunction(callback)) {
        if (err) {
          callback(err)
        } else {
          callback()
        }
      }
    })
    // PVSCL:ELSECOND
    chrome.runtime.sendMessage({scope: 'annotationServer', cmd: 'getSelectedAnnotationServer'}, ({annotationServer}) => {
      if (annotationServer === 'hypothesis') {
        // Hypothesis
        window.googleSheetProvider.annotationServerManager = new HypothesisClientManager()
      } else {
        // Browser storage
        window.googleSheetProvider.annotationServerManager = new BrowserStorageManager()
      }
      window.googleSheetProvider.annotationServerManager.init((err) => {
        if (_.isFunction(callback)) {
          if (err) {
            callback(err)
          } else {
            callback()
          }
        }
      })
    })
    // PVSCL:ENDCOND
  }

  initGoogleSheetParsing (callback) {
    window.googleSheetProvider.googleSheetParser = new GSheetParser()
    window.googleSheetProvider.googleSheetParser.parse((err, annotationGuide) => {
      if (err) {
        console.error(err)
        Alerts.errorAlert({text: err.message})
      } else {
        window.googleSheetProvider.GroupInitializer = new GroupInitializer()
        window.googleSheetProvider.GroupInitializer.init(annotationGuide, (err) => {
          if (err) {
            if (_.isFunction(callback)) {
              callback(err)
            }
          } else {
            if (_.isFunction(callback)) {
              callback()
            }
          }
        })
      }
    })
  }
}

module.exports = GoogleSheetContentScriptManager