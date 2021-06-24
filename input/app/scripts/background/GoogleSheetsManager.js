import GoogleSheetClient from '../googleSheets/GoogleSheetClient'
import axios from 'axios'
// PVSCL:IFCOND(GoogleSheetConsumer,LINE)
import _ from 'lodash'
// PVSCL:ENDCOND

class GoogleSheetsManager {
  constructor () {
    this.googleSheetClient = null
  }

  init () {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.scope === 'googleSheets') {
        if (request.cmd === 'getToken') {
          chrome.identity.getAuthToken({ interactive: true }, function (token) {
            if (chrome.runtime.lastError) {
              sendResponse({ error: chrome.runtime.lastError })
            } else {
              GoogleSheetsManager.checkTokenIsStillActive(token, (err, result) => {
                if (err || !result) {
                  console.error('Unable to verify if token is active or is inactive, retrieving a new one')
                  GoogleSheetsManager.removeCachedToken(token, () => {
                    chrome.identity.getAuthToken({ interactive: true }, (token) => {
                      sendResponse({ token: token })
                    })
                  })
                } else {
                  sendResponse({ token: token })
                }
              })
            }
          })
        } else if (request.cmd === 'getTokenSilent') {
          chrome.identity.getAuthToken({ interactive: false }, function (token) {
            if (chrome.runtime.lastError) {
              sendResponse({ error: chrome.runtime.lastError })
            } else {
              sendResponse({ token: token })
            }
          })
          return true
        } else if (request.cmd === 'getSpreadsheet') {
          chrome.identity.getAuthToken({ interactive: true }, function (token) {
            if (chrome.runtime.lastError) {
              sendResponse({ error: chrome.runtime.lastError })
            } else {
              const data = JSON.parse(request.data)
              if (data.spreadsheetId) {
                // Create client
                let googleSheetClient = new GoogleSheetClient(token)
                googleSheetClient.getSpreadsheet(data.spreadsheetId, (err, spreadsheet) => {
                  if (err) {
                    sendResponse({ error: err })
                  } else {
                    sendResponse({ spreadsheet: JSON.stringify(spreadsheet) })
                  }
                })
              } else {
                sendResponse({ error: new Error('Spreadsheet id not found') })
              }
            }
          })
          return true
        } else if (request.cmd === 'batchUpdate') {
          chrome.identity.getAuthToken({ interactive: true }, (token) => {
            if (chrome.runtime.lastError) {
              sendResponse({ error: chrome.runtime.lastError })
            } else {
              const data = JSON.parse(request.data)
              if (data.data) {
                let googleSheetClient = new GoogleSheetClient(token)
                googleSheetClient.batchUpdate(data.data, (err) => {
                  if (err) {
                    sendResponse({ error: err })
                  } else {
                    sendResponse({ result: 'done' })
                  }
                })
              }
            }
          })
        } else if (request.cmd === 'createSpreadsheet') {
          chrome.identity.getAuthToken({ interactive: true }, function (token) {
            if (_.isUndefined(token)) {
              sendResponse({ error: new Error('Unable to retrieve token, please check if you have synced your browser and your google account. If the application did not ask you for login, please contact developer.') })
            } else {
              let googleSheetClient = new GoogleSheetClient(token)
              googleSheetClient.createSpreadsheet(request.data, (err, result) => {
                if (err) {
                  sendResponse({ error: err })
                } else {
                  sendResponse(result)
                }
              })
            }
          })
        } else if (request.cmd === 'updateSpreadsheet') {
          chrome.identity.getAuthToken({ interactive: true }, function (token) {
            let googleSheetClient = new GoogleSheetClient(token)
            googleSheetClient.updateSheetCells(request.data, (err, result) => {
              if (err) {
                sendResponse({ error: err })
              } else {
                sendResponse(result)
              }
            })
          })
        } else if (request.cmd === 'appendRowSpreadSheet') {
          chrome.identity.getAuthToken({ interactive: true }, function (token) {
            let googleSheetClient = new GoogleSheetClient(token)
            googleSheetClient.appendValuesSpreadSheet(request.data.spreadsheetId, request.data.range, request.data.data, (err, result) => {
              if (err) {
                sendResponse({ error: err })
              } else {
                sendResponse(result)
              }
            })
          })
        } else if (request.cmd === 'getSheetRowsRawData') {
          chrome.identity.getAuthToken({ interactive: true }, function (token) {
            let googleSheetClient = new GoogleSheetClient(token)
            googleSheetClient.getSheetRowsRawData(request.data.spreadsheetId, request.data.sheetName, (err, result) => {
              if (err) {
                sendResponse({ error: err })
              } else {
                sendResponse(result)
              }
            })
          })
        }
        return true
      }
    })
  }

  static checkTokenIsStillActive (token, callback) {
    axios.post('https://oauth2.googleapis.com/tokeninfo', {
      access_token: token
    }, {
      headers: { 'Content-Type': 'application/json; charset=utf-8' }
    }).catch(() => {
      callback(null, false)
    }).then(() => {
      callback(null, true)
    })
  }

  static removeCachedToken (token, callback) {
    chrome.identity.removeCachedAuthToken({ token: token }, callback)
  }
}

export default GoogleSheetsManager
