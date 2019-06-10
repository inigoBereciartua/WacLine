const _ = require('lodash')
const ContentTypeManager = require('./ContentTypeManager')
const Sidebar = require('./Sidebar')
const MyTagManager = require('./MyTagManager')
// const RolesManager = require('./RolesManager')
const GroupSelector = require('../groupManipulation/GroupSelector')
const AnnotationBasedInitializer = require('./AnnotationBasedInitializer')
const HypothesisClientManager = require('../storage/hypothesis/HypothesisClientManager')
const Config = require('../Config')
const Toolset = require('./Toolset')
const TextAnnotator = require('./contentAnnotators/TextAnnotator')

class ContentScriptManager {
  constructor () {
    this.events = {}
    this.status = ContentScriptManager.status.notInitialized
  }

  init () {
    console.debug('Initializing content script manager')
    this.status = ContentScriptManager.status.initializing
    this.loadContentTypeManager(() => {
      window.abwa.hypothesisClientManager = new HypothesisClientManager()
      window.abwa.hypothesisClientManager.init(() => {
        window.abwa.sidebar = new Sidebar()
        window.abwa.sidebar.init(() => {
          window.abwa.annotationBasedInitializer = new AnnotationBasedInitializer()
          window.abwa.annotationBasedInitializer.init(() => {
            window.abwa.groupSelector = new GroupSelector()
            window.abwa.groupSelector.init(() => {
              // Reload for first time the content by group
              this.reloadContentByGroup()
              //PVSCL:IFCOND(Manual,LINE)
              // Initialize listener for group change to reload the content
              this.initListenerForGroupChange()
              //PVSCL:ENDCOND        
            })
          })
        })
      })
    })
  }
//PVSCL:IFCOND(Manual, LINE)

  initListenerForGroupChange () {
    this.events.groupChangedEvent = this.groupChangedEventHandlerCreator()
    document.addEventListener(GroupSelector.eventGroupChange, this.events.groupChangedEvent, false)
  }

  groupChangedEventHandlerCreator () {
    return (event) => {
      this.reloadContentByGroup()
    }
  }
//PVSCL:ENDCOND

  reloadContentByGroup (callback) {
    // TODO Use async await or promises
    this.reloadRolesManager((err) => {
      if (err) {
        // TODO Error
      } else {
        this.reloadTagsManager((err) => {
          if (err) {
            // TODO Error
          } else {
            this.reloadContentAnnotator((err) => {
              if (err) {
                // TODO Error
              } else {
                this.reloadToolset((err) => {
                  if (err) {
                    // TODO Error
                  } else {
                    this.status = ContentScriptManager.status.initialized
                    console.debug('Initialized content script manager')
                  }
                })
              }
            })
          }
        })
      }
    })
  }

  reloadContentAnnotator (callback) {
    // Destroy current content annotator
    this.destroyContentAnnotator()
    // Create a new content annotator for the current group
    window.abwa.contentAnnotator = new TextAnnotator(Config) // TODO Depending on the type of annotator
    window.abwa.contentAnnotator.init(callback)
  }

  reloadTagsManager (callback) {
    // Destroy current tag manager
    this.destroyTagsManager()
    // Create a new tag manager for the current group
    window.abwa.tagManager = new MyTagManager(Config.namespace, Config.tags) // TODO Depending on the type of annotator
    window.abwa.tagManager.init(callback)
  }

  destroyContentAnnotator () {
    // Destroy current content annotator
    if (!_.isEmpty(window.abwa.contentAnnotator)) {
      window.abwa.contentAnnotator.destroy()
    }
  }

  destroyTagsManager () {
    if (!_.isEmpty(window.abwa.tagManager)) {
      window.abwa.tagManager.destroy()
    }
  }

  destroy (callback) {
    console.debug('Destroying content script manager')
    this.destroyContentTypeManager(() => {
      this.destroyTagsManager()
      this.destroyContentAnnotator()
      // TODO Destroy groupSelector, roleManager,
      window.abwa.groupSelector.destroy(() => {
        window.abwa.sidebar.destroy(() => {
          window.abwa.hypothesisClientManager.destroy(() => {
            this.status = ContentScriptManager.status.notInitialized
            console.debug('Correctly destroyed content script manager')
            if (_.isFunction(callback)) {
              callback()
            }
          })
        })
      })
      document.removeEventListener(GroupSelector.eventGroupChange, this.events.groupChangedEvent)
    })
  }

  loadToolset () {
    window.abwa.toolset = new Toolset()
    window.abwa.toolset.init()
  }

  loadContentTypeManager (callback) {
    window.abwa.contentTypeManager = new ContentTypeManager()
    window.abwa.contentTypeManager.init(() => {
      if (_.isFunction(callback)) {
        callback()
      }
    })
  }

  destroyContentTypeManager (callback) {
    if (window.abwa.contentTypeManager) {
      window.abwa.contentTypeManager.destroy(() => {
        if (_.isFunction(callback)) {
          callback()
        }
      })
    }
  }

  reloadRolesManager (callback) {
    if (_.isFunction(callback)) {
      callback()
    }
  }

  reloadToolset (callback) {
    // Destroy toolset
    this.destroyToolset()
    // Create a new toolset
    this.loadToolset()
  }

  destroyToolset () {
    if (window.abwa.toolset) {
      window.abwa.toolset.destroy()
    }
  }
}

ContentScriptManager.status = {
  initializing: 'initializing',
  initialized: 'initialized',
  notInitialized: 'notInitialized'
}

module.exports = ContentScriptManager
