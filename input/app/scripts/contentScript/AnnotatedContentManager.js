const Events = require('../Events')
// PVSCL:IFCOND(NOT(Multivalued), LINE) // It is only used by SingleCode
const Config = require('../Config')
// PVSCL:ENDCOND
// PVSCL:IFCOND(NOT(Multivalued), LINE)
const Alerts = require('../utils/Alerts')
// PVSCL:ENDCOND
const LanguageUtils = require('../utils/LanguageUtils')
const Theme = require('../codebook/model/Theme')
// PVSCL:IFCOND(Hierarchy, LINE)
const Code = require('../codebook/model/Code')
// PVSCL:ENDCOND
const _ = require('lodash')
const Classifying = require('../annotationManagement/purposes/Classifying')
// PVSCL:IFCOND(Linking, LINE)
const Linking = require('../annotationManagement/purposes/Linking')
// PVSCL:ENDCOND
const Annotation = require('../annotationManagement/Annotation')

class AnnotatedTheme {
  constructor ({
    theme = null,
    annotations = []
    /* PVSCL:IFCOND(Hierarchy) */, annotatedCodes = []/* PVSCL:ENDCOND */
  }) {
    // code
    this.theme = theme
    // PVSCL:IFCOND(Hierarchy, LINE)
    this.annotatedCodes = annotatedCodes
    // PVSCL:ENDCOND
    this.annotations = annotations
  }

  hasAnnotations () {
    return !(this.annotations.length === 0)
  }
}
// PVSCL:IFCOND(Hierarchy, LINE)

class AnnotatedCode {
  constructor ({code = null, annotations = []}) {
    this.code = code
    this.annotations = annotations
  }

  hasAnnotations () {
    return !(this.annotations.length === 0)
  }
}
// PVSCL:ENDCOND

class AnnotatedContentManager {
  constructor () {
    this.annotatedThemes = {}
    this.events = {}
    // PVSCL:IFCOND(MoodleResource, LINE)
    this.cmid = window.abwa.codebookManager.codebookReader.codebook.cmid
    // PVSCL:ENDCOND
  }

  init (callback) {
    console.debug('Initializing AnnotatedContentManager')
    // Retrieve all the annotations for this assignment
    this.updateAnnotationForAssignment(() => {
      this.reloadTagsChosen()
      console.debug('Initialized AnnotatedContentManager')
      if (_.isFunction(callback)) {
        callback()
      }
    })
    // Init event handlers
    this.initEvents()
  }

  destroy () {
    // Remove event listeners
    let events = _.values(this.events)
    for (let i = 0; i < events.length; i++) {
      events[i].element.removeEventListener(events[i].event, events[i].handler)
    }
  }

  updateAnnotationForAssignment (callback) {
    // Retrieve all the annotations for this assignment
    this.retrieveAnnotationsForAssignment((err, assignmentAnnotations) => {
      if (err) {
        // TODO Unable to retrieve annotations for this assignment
      } else {
        // Retrieve current annotatedThemes
        this.addingCodingsFromAnnotations(assignmentAnnotations)
        console.debug('Updated annotations for assignment')
        // Callback
        if (_.isFunction(callback)) {
          callback()
        }
      }
    })
  }

  retrieveAnnotationsForAssignment (callback) {
    let promise
    // PVSCL:IFCOND(MoodleResource, LINE)
    promise = new Promise((resolve, reject) => {
      if (window.abwa.groupSelector.currentGroup.id) {
        let call = {}
        // Set the annotation group where annotations should be searched from
        call['group'] = window.abwa.groupSelector.currentGroup.id
        call['tags'] = 'cmid:' + this.cmid
        call['wildcard_uri'] = window.abwa.codebookManager.codebookReader.codebook.moodleEndpoint + '*'
        window.abwa.annotationServerManager.client.searchAnnotations(call, (err, annotations) => {
          if (err) {
            reject(err)
          } else {
            resolve(annotations.map(annotation => Annotation.deserialize(annotation)))
          }
        })
      } else {
        resolve([])
      }
    })
    // PVSCL:ELSECOND
    promise = new Promise((resolve, reject) => {
      let allAnnotations = window.abwa.annotationManagement.annotationReader.allAnnotations
      // PVSCL:IFCOND(Linking, LINE)
      let contentAnnotations = _.filter(allAnnotations, (annotation) => {
        if (annotation.body.length > 0) {
          return !LanguageUtils.isInstanceOf(annotation.body[0], Linking)
        }
      })
      resolve(contentAnnotations)
      // PVSCL:ELSECOND
      resolve(allAnnotations)
      // PVSCL:ENDCOND
    })
    // PVSCL:ENDCOND
    // Return retrieved annotations
    promise.catch((err) => {
      callback(err)
    }).then((annotations) => {
      callback(null, annotations)
    })
  }

  addingCodingsFromAnnotations (annotations) {
    let annotatedThemesWithoutAnnotations = this.defineStructure()
    for (let i = 0; i < annotations.length; i++) {
      let annotation = annotations[i]
      annotatedThemesWithoutAnnotations = this.addAnnotationToAnnotatedThemesOrCode(annotation, annotatedThemesWithoutAnnotations)
    }
    this.annotatedThemes = annotatedThemesWithoutAnnotations
  }

  defineStructure () {
    let annotatedThemesStructure
    // PVSCL:IFCOND(Hierarchy, LINE)
    annotatedThemesStructure = _.map(window.abwa.codebookManager.codebookReader.codebook.themes, (theme) => {
      let codes = _.map(theme.codes, (code) => {
        return new AnnotatedCode({code: code})
      })
      return new AnnotatedTheme({theme: theme, annotatedCodes: codes})
    })
    // PVSCL:ELSECOND
    annotatedThemesStructure = _.map(window.abwa.codebookManager.codebookReader.codebook.themes, (theme) => {
      return new AnnotatedTheme({theme: theme})
    })
    // PVSCL:ENDCOND
    return annotatedThemesStructure
  }
  // PVSCL:IFCOND(NOT(Multivalued), LINE)

  codeToAll (code, lastAnnotatedCode) {
    // Update annotatedThemes
    let annotatedTheme = this.getAnnotatedThemeOrCodeFromThemeOrCodeId(code.theme.id)
    let annotatedCode = this.getAnnotatedThemeOrCodeFromThemeOrCodeId(code.id)
    // 'exam:cmid:' + this.cmid
    let newTagList = [
      Config.namespace + ':' + Config.tags.grouped.relation + ':' + code.theme.name,
      Config.namespace + ':' + Config.tags.grouped.subgroup + ':' + code.name
    ]
    // PVSCL:IFCOND(MoodleResource, LINE)
    newTagList.push('cmid:' + this.cmid)
    // PVSCL:ENDCOND
    if (annotatedTheme.hasAnnotations()) {
      let themeAnnotations = annotatedTheme.annotations
      // Update all annotations with new tags
      _.forEach(themeAnnotations, (themeAnnotation) => {
        themeAnnotation.tags = newTagList
        let bodyClassifying = themeAnnotation.getBodyForPurpose(Classifying.purpose)
        bodyClassifying.value = code.toObject()
        annotatedCode.annotations.push(themeAnnotation)
      })
      this.updateAnnotationsInAnnotationServer(themeAnnotations, () => {
        annotatedTheme.annotations = []
        window.abwa.annotationManagement.annotationReader.updateAllAnnotations()
        this.reloadTagsChosen()
        // Dispatch updated content manager event
        LanguageUtils.dispatchCustomEvent(Events.annotatedContentManagerUpdated, {annotatedThemes: this.annotatedThemes})
        // Dispatch all coded event
        LanguageUtils.dispatchCustomEvent(Events.allCoded, {annotatedThemes: this.annotatedThemes})
      })
    }
    if (lastAnnotatedCode && (lastAnnotatedCode.code.id !== code.id)) {
      let lastAnnotatedCodeAnnotations = lastAnnotatedCode.annotations
      // Update all annotations with new tags
      _.forEach(lastAnnotatedCodeAnnotations, (lastAnnotatedCodeAnnotation) => {
        lastAnnotatedCodeAnnotation.tags = newTagList
        let bodyClassifying = lastAnnotatedCodeAnnotation.getBodyForPurpose(Classifying.purpose)
        bodyClassifying.value = code.toObject()
        annotatedCode.annotations.push(lastAnnotatedCodeAnnotation)
      })
      this.updateAnnotationsInAnnotationServer(lastAnnotatedCodeAnnotations, () => {
        lastAnnotatedCode.annotations = []
        window.abwa.annotationManagement.annotationReader.updateAllAnnotations()
        this.reloadTagsChosen()
        // Dispatch updated content manager event
        LanguageUtils.dispatchCustomEvent(Events.annotatedContentManagerUpdated, {annotatedThemes: this.annotatedThemes})
        // Dispatch all coded event
        LanguageUtils.dispatchCustomEvent(Events.allCoded, {annotatedThemes: this.annotatedThemes})
      })
    }
  }

  updateAnnotationsInAnnotationServer (annotations, callback) {
    let promises = []
    for (let i = 0; i < annotations.length; i++) {
      let annotation = annotations[i]
      promises.push(new Promise((resolve, reject) => {
        window.abwa.annotationServerManager.client.updateAnnotation(annotation.id, annotation.serialize(), (err, annotation) => {
          if (err) {
            reject(new Error('Unable to update annotation ' + annotation.id))
          } else {
            resolve(Annotation.deserialize(annotation))
          }
        })
      }))
    }
    let resultAnnotations = []
    Promise.all(promises).then((result) => {
      // All annotations updated
      resultAnnotations = result
    }).finally((result) => {
      if (_.isFunction(callback)) {
        callback(null, resultAnnotations)
      }
    })
  }

  searchAnnotatedCodeForGivenThemeId (themeId) {
    let annotatedTheme = this.getAnnotatedThemeOrCodeFromThemeOrCodeId(themeId)
    let annotatedCode = _.find(annotatedTheme.annotatedCodes, (annoCode) => {
      return annoCode.hasAnnotations()
    })
    return annotatedCode
  }
  // PVSCL:ENDCOND

  addAnnotationToAnnotatedThemesOrCode (annotation, annotatedThemesObject = this.annotatedThemes) {
    // Get classification code
    let classifyingBody = annotation.getBodyForPurpose(Classifying.purpose)
    if (classifyingBody) {
      let codeId = classifyingBody.value.code.id
      let annotatedThemeOrCode = this.getAnnotatedThemeOrCodeFromThemeOrCodeId(codeId, annotatedThemesObject)
      if (annotatedThemeOrCode) {
        annotatedThemeOrCode.annotations.push(annotation)
      }
      return annotatedThemesObject
    }
  }

  removeAnnotationToAnnotatedThemesOrCode (annotation) {
    // Get classification code
    let classifyingBody = annotation.getBodyForPurpose(Classifying.purpose)
    if (classifyingBody) {
      let codeId = classifyingBody.value.code.id
      let annotatedThemeOrCode = this.getAnnotatedThemeOrCodeFromThemeOrCodeId(codeId)
      _.remove(annotatedThemeOrCode.annotations, (anno) => {
        return anno.id === annotation.id
      })
    }
  }

  /**
   * This function returns the annotations done in current document for the given theme id or code id
   * @param themeOrCodeId
   * @returns array of annotations
   */
  getAnnotationsDoneWithThemeOrCodeId (themeOrCodeId) {
    // Get AnnotatedTheme or AnnotatedCode
    let themeOrCode = this.getAnnotatedThemeOrCodeFromThemeOrCodeId(themeOrCodeId)
    if (LanguageUtils.isInstanceOf(themeOrCode, AnnotatedTheme)) {
      // If it is the theme, we need to retrieve all the annotations with corresponding theme and annotations done with its children codes
      let annotations = _.filter(themeOrCode.annotations, (annotation) => {
        return _.intersection(window.abwa.targetManager.getDocumentLink(), _.values(annotation.target[0].source))
      })
      // PVSCL:IFCOND(Hierarchy, LINE)
      let childAnnotations = _.flatMap(themeOrCode.annotatedCodes.map(annotatedCode =>
        _.filter(annotatedCode.annotations, (annotation) => {
          return _.intersection(window.abwa.targetManager.getDocumentLink(), _.values(annotation.target[0].source))
        })))
      annotations = annotations.concat(childAnnotations)
      // PVSCL:ENDCOND
      return annotations
    } /* PVSCL:IFCOND(Hierarchy) */else if (LanguageUtils.isInstanceOf(themeOrCode, AnnotatedCode)) {
      return _.filter(themeOrCode.annotations, (annotation) => {
        return _.intersection(window.abwa.targetManager.getDocumentLink(), _.values(annotation.target[0].source))
      })
    }/* PVSCL:ENDCOND */ else {
      return []
    }
  }

  /**
   * This function returns the AnnotatedTheme or AnnotatedCode for the given theme id or code id
   * @param themeOrCodeId
   * @param annotatedThemesObject
   */
  getAnnotatedThemeOrCodeFromThemeOrCodeId (themeOrCodeId, annotatedThemesObject = this.annotatedThemes) {
    let themeOrCode = window.abwa.codebookManager.codebookReader.codebook.getCodeOrThemeFromId(themeOrCodeId)
    if (LanguageUtils.isInstanceOf(themeOrCode, Theme)) {
      // Return annotationTheme with the codeId we need
      return _.find(annotatedThemesObject, (annotatedTheme) => {
        return annotatedTheme.theme.id === themeOrCode.id
      })
    } /* PVSCL:IFCOND(Hierarchy) */else if (LanguageUtils.isInstanceOf(themeOrCode, Code)) {
      // Return annotationCode with the codeId we need
      let annotatedTheme = _.find(annotatedThemesObject, (annotatedTheme) => {
        return annotatedTheme.theme.id === themeOrCode.theme.id
      })
      return _.find(annotatedTheme.annotatedCodes, (annotatedCode) => {
        return annotatedCode.code.id === themeOrCode.id
      })
    }/* PVSCL:ENDCOND */
  }

  initEvents () {
    // Create event listener for updated all annotations
    this.events.annotationCreated = {element: document, event: Events.annotationCreated, handler: this.createAnnotationCreatedEventHandler()}
    this.events.annotationCreated.element.addEventListener(this.events.annotationCreated.event, this.events.annotationCreated.handler, false)
    // Create event listener for updated all annotations
    this.events.annotationDeleted = {element: document, event: Events.annotationDeleted, handler: this.createDeletedAnnotationEventHandler()}
    this.events.annotationDeleted.element.addEventListener(this.events.annotationDeleted.event, this.events.annotationDeleted.handler, false)
    // Create event listener for updated all annotations
    this.events.deletedAllAnnotations = {element: document, event: Events.deletedAllAnnotations, handler: this.createDeletedAllAnnotationsEventHandler()}
    this.events.deletedAllAnnotations.element.addEventListener(this.events.deletedAllAnnotations.event, this.events.deletedAllAnnotations.handler, false)
    // PVSCL:IFCOND(NOT(Multivalued), LINE)
    // Event for tag manager reloaded
    this.events.codeToAllEvent = {element: document, event: Events.codeToAll, handler: this.createCodeToAllEventHandler()}
    this.events.codeToAllEvent.element.addEventListener(this.events.codeToAllEvent.event, this.events.codeToAllEvent.handler, false)
    // PVSCL:ENDCOND
    // PVSCL:IFCOND(MoodleReport, LINE) // This one is only related to moodle as is the only feature that requires to take into account the annotated content manager when annotations are updated
    this.events.annotationUpdatedEvent = {element: document, event: Events.annotationUpdated, handler: this.createAnnotationUpdatedEventHandler()}
    this.events.annotationUpdatedEvent.element.addEventListener(this.events.annotationUpdatedEvent.event, this.events.annotationUpdatedEvent.handler, false)
    // PVSCL:ENDCOND
    // PVSCL:IFCOND(CodebookUpdate, LINE)
    this.events.codebookUpdatedEvent = {element: document, event: Events.codebookUpdated, handler: this.createCodebookUpdatedEventHandler()}
    this.events.codebookUpdatedEvent.element.addEventListener(this.events.codebookUpdatedEvent.event, this.events.codebookUpdatedEvent.handler, false)
    // PVSCL:ENDCOND
  }

  // PVSCL:IFCOND(CodebookUpdate, LINE)
  createCodebookUpdatedEventHandler () {
    return (event) => {
      this.updateAnnotationForAssignment(() => {
        this.reloadTagsChosen()
        console.debug('Annotated content manager updated')
        LanguageUtils.dispatchCustomEvent(Events.annotatedContentManagerUpdated, {annotatedThemes: this.annotatedThemes})
      })
    }
  }
  // PVSCL:ENDCOND

  // PVSCL:IFCOND(MoodleReport, LINE)
  createAnnotationUpdatedEventHandler () {
    return (event) => {
      // Retrieve annotation from event
      let annotation = event.detail.annotation
      // Get classification code
      let classifyingBody = annotation.getBodyForPurpose(Classifying.purpose)
      if (classifyingBody) {
        let codeId = classifyingBody.value.code.id
        let annotatedThemeOrCode = this.getAnnotatedThemeOrCodeFromThemeOrCodeId(codeId)
        // Retrieve criteria name for annotation
        if (annotatedThemeOrCode && annotatedThemeOrCode.annotations.length > 0) {
          let index = _.findIndex(annotatedThemeOrCode.annotations, (annotationMark) => annotationMark.id === annotation.id)
          if (index > -1) {
            annotatedThemeOrCode.annotations[index] = annotation
          }
          // Dispatch updated content manager event
          LanguageUtils.dispatchCustomEvent(Events.annotatedContentManagerUpdated, {annotatedThemes: this.annotatedThemes})
        }
      }
    }
  }
  // PVSCL:ENDCOND

  createCodeToAllEventHandler () {
    return (event) => {
      // Get level for this mark
      let code = window.abwa.codebookManager.codebookReader.codebook.getCodeOrThemeFromId(event.detail.codeId)
      if (code) {
        // Retrieve criteria from rubric
        this.codeToAll(code, event.detail.currentlyAnnotatedCode)
      } else {
        // Unable to retrieve criteria or level
        Alerts.errorAlert({
          title: 'Unable to code',
          text: 'There was an error in coding, please reload the page and try it again.' +
            chrome.i18n.getMessage('ErrorContactDeveloper', ['codeToAll', encodeURIComponent(new Error().stack)])})
      }
    }
  }

  createAnnotationCreatedEventHandler () {
    return (event) => {
      // Add event to the codings list
      if (event.detail.annotation) {
        let annotation = event.detail.annotation
        let classifyingBody = annotation.getBodyForPurpose(Classifying.purpose)
        if (classifyingBody) {
          this.annotatedThemes = this.addAnnotationToAnnotatedThemesOrCode(annotation)
          if (event.detail.codeToAll) {
            // Get classification code
            let codeId = classifyingBody.value.code.id
            LanguageUtils.dispatchCustomEvent(Events.codeToAll, {
              codeId: codeId,
              currentlyAnnotatedCode: event.detail.lastAnnotatedCode
            })
          } else {
            this.reloadTagsChosen()
          }
        }
      }
    }
  }

  createDeletedAnnotationEventHandler () {
    return (event) => {
      if (event.detail.annotation) {
        let annotation = event.detail.annotation
        this.removeAnnotationToAnnotatedThemesOrCode(annotation)
        // Dispatch updated content manager event
        LanguageUtils.dispatchCustomEvent(Events.annotatedContentManagerUpdated, {annotatedThemes: this.annotatedThemes})
      }
      this.reloadTagsChosen()
    }
  }

  createDeletedAllAnnotationsEventHandler () {
    return (event) => {
      if (event.detail.annotations) {
        let annotations = event.detail.annotations
        for (let i = 0; i < annotations.length; i++) {
          let annotation = annotations[i]
          this.removeAnnotationToAnnotatedThemesOrCode(annotation)
        }
      }
      this.reloadTagsChosen()
      // Dispatch updated content manager event
      LanguageUtils.dispatchCustomEvent(Events.annotatedContentManagerUpdated, {annotatedThemes: this.annotatedThemes})
    }
  }

  reloadTagsChosen () {
    // Retrieve annotated themes id
    for (let i = 0; i < this.annotatedThemes.length; i++) {
      // annotated
      let annotatedTheme = this.annotatedThemes[i]
      if (annotatedTheme.theme.codes && annotatedTheme.theme.codes.length > 0) {
        let annotatedGroupButton = document.querySelectorAll('.tagGroup[data-code-id="' + annotatedTheme.theme.id + '"]')
        let groupNameSpan = annotatedGroupButton[0].querySelector('.groupName')
        groupNameSpan.dataset.numberOfAnnotations = this.getAnnotationsDoneWithThemeOrCodeId(annotatedTheme.theme.id).length
        // PVSCL:IFCOND(Hierarchy, LINE)
        for (let j = 0; j < annotatedTheme.annotatedCodes.length; j++) {
          let annotatedCode = annotatedTheme.annotatedCodes[j]
          let annotatedCodeButton = document.querySelectorAll('.tagButton[data-code-id="' + annotatedCode.code.id + '"]')
          annotatedCodeButton[0].dataset.numberOfAnnotations = this.getAnnotationsDoneWithThemeOrCodeId(annotatedCode.code.id).length
        }
        // PVSCL:ENDCOND
      } else {
        let annotatedThemeButton = document.querySelectorAll('.tagButton[data-code-id="' + annotatedTheme.theme.id + '"]')
        annotatedThemeButton[0].dataset.numberOfAnnotations = this.getAnnotationsDoneWithThemeOrCodeId(annotatedTheme.theme.id).length
      }
    }
  }
}

module.exports = {
  AnnotatedContentManager,
  AnnotatedTheme/* PVSCL:IFCOND(Code) */,
  AnnotatedCode/* PVSCL:ENDCOND */}
