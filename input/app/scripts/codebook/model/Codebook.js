import jsYaml from 'js-yaml'
import Theme from './Theme'
import Config from '../../Config'
import _ from 'lodash'
import LanguageUtils from '../../utils/LanguageUtils'
// PVSCL:IFCOND(Hierarchy,LINE)
import Code from './Code'
// PVSCL:ENDCOND
// PVSCL:IFCOND(Hypothesis, LINE)
import Hypothesis from '../../annotationServer/hypothesis/Hypothesis'
// PVSCL:ENDCOND
// PVSCL:IFCOND(BrowserStorage, LINE)
import BrowserStorage from '../../annotationServer/browserStorage/BrowserStorage'
// PVSCL:ENDCOND
// PVSCL:IFCOND(CodebookUpdate, LINE)
import ColorUtils from '../../utils/ColorUtils'
// PVSCL:ENDCOND

class Codebook {
  constructor ({
    id = null,
    name = '',
    annotationServer = null/* PVSCL:IFCOND(MoodleProvider or MoodleReport or MoodleResource) */,
    moodleEndpoint = null,
    assignmentName = null,
    assignmentId = null,
    courseId = null,
    cmid = null/* PVSCL:ENDCOND *//* PVSCL:IFCOND(GoogleSheetProvider) */,
    spreadsheetId = null,
    sheetId = null/* PVSCL:ENDCOND *//* PVSCL:IFCOND(Marking) */,
    grade = 0.0/* PVSCL:ENDCOND */
  }) {
    this.id = id
    this.name = name
    this.themes = []
    this.annotationServer = annotationServer
    // PVSCL:IFCOND(MoodleProvider,LINE)
    this.moodleEndpoint = moodleEndpoint
    this.assignmentName = assignmentName
    this.assignmentId = assignmentId
    this.courseId = courseId
    this.cmid = cmid
    // PVSCL:ENDCOND
    // PVSCL:IFCOND(GoogleSheetProvider,LINE)
    this.spreadsheetId = spreadsheetId
    this.sheetId = sheetId
    // PVSCL:ENDCOND
    // PVSCL:IFCOND(Marking,LINE)
    this.grade = grade
    // PVSCL:ENDCOND
  }

  toAnnotation () {
    const motivationTag = 'motivation:defining'
    const guideTag = Config.namespace + ':guide'
    const tags = [motivationTag, guideTag]
    // PVSCL:IFCOND(MoodleProvider or MoodleReport or MoodleResource,LINE)
    const cmidTag = 'cmid:' + this.cmid
    tags.push(cmidTag)
    // PVSCL:ENDCOND
    // Construct text attribute of the annotation
    let textObject
    // PVSCL:IFCOND(MoodleProvider or MoodleReport or MoodleResource,LINE)
    textObject = {
      moodleEndpoint: this.moodleEndpoint,
      assignmentId: this.assignmentId,
      assignmentName: this.assignmentName,
      courseId: this.courseId,
      cmid: this.cmid/* PVSCL:IFCOND(Marking) */,
      grade: this.grade/* PVSCL:ENDCOND */
    }
    // PVSCL:ENDCOND
    // PVSCL:IFCOND(GoogleSheetProvider,LINE)
    textObject = {
      spreadsheetId: this.spreadsheetId,
      sheetId: this.sheetId
    }
    // PVSCL:ENDCOND
    // Return the constructed annotation
    return {
      name: this.name,
      group: this.annotationServer.group.id,
      permissions: {
        read: ['group:' + this.annotationServer.group.id]
      },
      references: [],
      motivation: 'defining',
      tags: tags,
      target: [],
      text: jsYaml.dump(textObject),
      uri: this.annotationServer.group.links.html/* PVSCL:IFCOND(Marking) */,
      grade: this.grade/* PVSCL:ENDCOND */
    }
  }

  toAnnotations () {
    let annotations = []
    // Create annotation for current element
    annotations.push(this.toAnnotation())
    // Create annotations for all criterias
    for (let i = 0; i < this.themes.length; i++) {
      annotations = annotations.concat(this.themes[i].toAnnotations())
    }
    return annotations
  }

  static fromAnnotation (annotation, callback) {
    this.setAnnotationServer(null, (annotationServer) => {
      const annotationGuideOpts = { id: annotation.id, name: annotation.name, annotationServer: annotationServer /* PVSCL:IFCOND(Marking) */, grade: annotation.grade/* PVSCL:ENDCOND */ }
      // PVSCL:IFCOND(GoogleSheetProvider or MoodleProvider, LINE)
      // Configuration for gsheet provider or moodle provider is saved in text attribute
      // TODO Maybe this is not the best place to store this configuration, it wa done in this way to be visible in Hypothes.is client, but probably it should be defined in the body of the annotation
      const config = jsYaml.load(annotation.text)
      // PVSCL:ENDCOND
      // PVSCL:IFCOND(GoogleSheetProvider, LINE)
      annotationGuideOpts.spreadsheetId = config.spreadsheetId
      annotationGuideOpts.sheetId = config.sheetId
      // PVSCL:ENDCOND
      // PVSCL:IFCOND(MoodleProvider, LINE)
      annotationGuideOpts.moodleEndpoint = config.moodleEndpoint
      annotationGuideOpts.assignmentId = config.assignmentId
      annotationGuideOpts.assignmentName = config.assignmentName
      annotationGuideOpts.courseId = config.courseId
      const cmidTag = _.find(annotation.tags, (tag) => {
        return tag.includes('cmid:')
      })
      if (_.isString(cmidTag)) {
        annotationGuideOpts.cmid = cmidTag.replace('cmid:', '')
      }
      // PVSCL:ENDCOND
      let guide
      guide = new Codebook(annotationGuideOpts)
      if (_.isFunction(callback)) {
        callback(guide)
      }
    })
  }

  static fromAnnotations (annotations, callback) {
    // return Codebook
    const guideAnnotation = _.remove(annotations, (annotation) => {
      return _.some(annotation.tags, (tag) => { return tag === Config.namespace + ':guide' })
    })
    if (guideAnnotation.length > 0) {
      Codebook.fromAnnotation(guideAnnotation[0], (guide) => {
        // TODO Complete the guide from the annotations
        // For the rest of annotations, get themes and codes
        const themeAnnotations = _.remove(annotations, (annotation) => {
          return _.some(annotation.tags, (tag) => {
            return tag.includes(Config.namespace + ':' + Config.tags.grouped.group + ':')
          })
        })
        // PVSCL:IFCOND(Hierarchy,LINE)
        const codeAnnotations = _.remove(annotations, (annotation) => {
          return _.some(annotation.tags, (tag) => {
            return tag.includes(Config.namespace + ':' + Config.tags.grouped.subgroup + ':')
          })
        })
        // PVSCL:ENDCOND
        for (let i = 0; i < themeAnnotations.length; i++) {
          const theme = Theme.fromAnnotation(themeAnnotations[i], guide)
          if (LanguageUtils.isInstanceOf(theme, Theme)) {
            guide.themes.push(theme)
          }
        }
        // PVSCL:IFCOND(Hierarchy,LINE)
        for (let i = 0; i < codeAnnotations.length; i++) {
          const codeAnnotation = codeAnnotations[i]
          // Get theme corresponding to the level
          const themeTag = _.find(codeAnnotation.tags, (tag) => {
            return tag.includes(Config.namespace + ':' + Config.tags.grouped.relation + ':')
          })
          const themeName = themeTag.replace(Config.namespace + ':' + Config.tags.grouped.relation + ':', '')
          const theme = _.find(guide.themes, (theme) => {
            return theme.name === themeName
          })
          const code = Code.fromAnnotation(codeAnnotation, theme)
          if (LanguageUtils.isInstanceOf(theme, Theme)) {
            theme.codes.push(code)
          } else {
            console.debug('Code %s has no theme', code.name)
          }
        }
        // PVSCL:ENDCOND
        if (_.isFunction(callback)) {
          callback(null, guide)
        }
      })
    } else {
      callback(new Error('No annotations for codebook defined'))
    }
  }

  static setAnnotationServer (newGroup, callback) {
    let annotationAnnotationServer
    let group
    if (newGroup === null) {
      group = window.abwa.groupSelector.currentGroup
    } else {
      group = newGroup
    }
    // PVSCL:IFCOND(AnnotationServer->pv:SelectedChildren()->pv:Size()>1,LINE)
    chrome.runtime.sendMessage({ scope: 'annotationServer', cmd: 'getSelectedAnnotationServer' }, ({ annotationServer }) => {
      if (annotationServer === 'hypothesis') {
        // Hypothesis
        annotationAnnotationServer = new Hypothesis({ group: group })
      } else {
        // Browser storage
        annotationAnnotationServer = new BrowserStorage({ group: group })
      }
      if (_.isFunction(callback)) {
        callback(annotationAnnotationServer)
      }
    })
    // PVSCL:ELSECOND
    // PVSCL:IFCOND(Hypothesis,LINE)
    annotationAnnotationServer = new Hypothesis({ group: group })
    // PVSCL:ENDCOND
    // PVSCL:IFCOND(BrowserStorage,LINE)
    annotationAnnotationServer = new BrowserStorage({ group: group })
    // PVSCL:ENDCOND
    if (_.isFunction(callback)) {
      callback(annotationAnnotationServer)
    }
    // PVSCL:ENDCOND
  }
  // PVSCL:IFCOND(BuiltIn or ImportCodebook or NOT(Codebook) or ImportAnnotations, LINE)

  static fromObjects (userDefinedHighlighterDefinition) {
    const annotationGuide = new Codebook({ name: userDefinedHighlighterDefinition.name })
    for (let i = 0; i < userDefinedHighlighterDefinition.definition.length; i++) {
      const themeDefinition = userDefinedHighlighterDefinition.definition[i]
      // PVSCL:IFCOND(PublicPrivate,LINE)
      const publicPrivate = themeDefinition.publicPrivate ? themeDefinition.publicPrivate : false
      // PVSCL:ENDCOND
      const theme = new Theme({ name: themeDefinition.name, description: themeDefinition.description, annotationGuide/* PVSCL:IFCOND(PublicPrivate) */, publicPrivate: publicPrivate/* PVSCL:ENDCOND *//* PVSCL:IFCOND(Marking) */, grade: 0.0, weight: themeDefinition.weight/* PVSCL:ENDCOND */ })
      // PVSCL:IFCOND(Hierarchy,LINE)
      theme.codes = []
      if (_.isArray(themeDefinition.codes)) {
        for (let j = 0; j < themeDefinition.codes.length; j++) {
          const codeDefinition = themeDefinition.codes[j]
          const code = new Code({ name: codeDefinition.name, description: codeDefinition.description, theme: theme/* PVSCL:IFCOND(PublicPrivate) */, publicPrivate: publicPrivate/* PVSCL:ENDCOND */ })
          theme.codes.push(code)
        }
      }
      // PVSCL:ENDCOND
      annotationGuide.themes.push(theme)
    }
    return annotationGuide
  }
  // PVSCL:ENDCOND
  // PVSCL:IFCOND(GoogleSheetProvider,LINE)

  static fromGoogleSheet ({ spreadsheetId, sheetId, spreadsheet, sheetName }) {
    const codebook = new Codebook({ spreadsheetId, sheetId, name: sheetName })
    codebook.themes = Codebook.getThemesAndCodesGSheet(spreadsheet, codebook)
    return codebook
  }

  static getThemesAndCodesGSheet (spreadsheet, annotationGuide) {
    // Find current sheet
    const sheet = _.find(spreadsheet.sheets, (sheet) => { return sheet.properties.sheetId === annotationGuide.sheetId })
    // Check if exists object
    if (sheet && sheet.data && sheet.data[0] && sheet.data[0].rowData && sheet.data[0].rowData[0] && sheet.data[0].rowData[0].values) {
      // Retrieve index of "Author" column
      let lastIndex = _.findIndex(sheet.data[0].rowData[0].values, (cell) => {
        if (cell && cell.formattedValue) {
          return cell.formattedValue === ''
        } else {
          return false
        }
      })
      if (lastIndex === -1) {
        lastIndex = sheet.data[0].rowData[0].values.length
      }
      // If index of author exists
      if (lastIndex > 0) {
        // Retrieve themes. Retrieve elements between 2 column and author column, maps "formattedValue"
        const themesArray = _.map(_.slice(sheet.data[0].rowData[0].values, 1, lastIndex), 'formattedValue')
        const themes = _.map(_.countBy(themesArray), (numberOfColumns, name) => {
          const theme = new Theme({ name: name, annotationGuide })
          // PVSCL:IFCOND(Hierarchy,LINE)
          theme.multivalued = numberOfColumns > 1
          // PVSCL:ENDCOND
          return theme
        })
        // If facets are found, try to find codes for each
        if (themesArray.length > 0) {
        // PVSCL:IFCOND(Hierarchy,LINE)
          // Find codes
          if (sheet.data[0].rowData[1] && sheet.data[0].rowData[1].values) {
            // Get cells for codes
            const values = _.slice(sheet.data[0].rowData[1].values, 1, lastIndex)
            // For each cell
            for (let i = 0; i < themesArray.length; i++) {
              // Retrieve its facet
              const currentThemeName = themesArray[i]
              // If theme of current row is text and is a facet and is not already set the possible codes
              const currentTheme = _.find(themes, (facet) => { return facet.name === currentThemeName })
              if (_.isString(currentThemeName) && currentTheme && currentTheme.codes.length === 0) {
                // If cell has data validation "ONE_OF_LIST"
                if (_.isObject(values[i]) && _.isObject(values[i].dataValidation) && values[i].dataValidation.condition.type === 'ONE_OF_LIST') {
                  currentTheme.inductive = false
                  currentTheme.codes = _.map(values[i].dataValidation.condition.values, (value) => { return new Code({ name: value.userEnteredValue, theme: currentTheme }) })
                } else { // If cell has not data validation
                  currentTheme.inductive = true
                }
              }
            }
          }
          // PVSCL:ENDCOND
          return themes
        } else {
          return new Error('The spreadsheet hasn\'t the correct structure, you have not defined any facet.')
        }
      } else {
        return new Error('The spreadsheet\'s first row is empty.')
      }
    } else {
      return new Error('The spreadsheet hasn\'t the correct structure. The ROW #1 must contain the themes for your codebook.')
    }
  }
  // PVSCL:ENDCOND

  getCodeOrThemeFromId (id) {
    let themeOrCodeToReturn = null
    const theme = _.find(this.themes, (theme) => {
      return theme.id === id
    })
    if (LanguageUtils.isInstanceOf(theme, Theme)) {
      themeOrCodeToReturn = theme
    } /* PVSCL:IFCOND(Hierarchy) */ else {
      // Look for code inside themes
      for (let i = 0; i < this.themes.length; i++) {
        const theme = this.themes[i]
        const code = _.find(theme.codes, (code) => {
          return code.id === id
        })
        if (LanguageUtils.isInstanceOf(code, Code)) {
          themeOrCodeToReturn = code
        }
      }
    } /* PVSCL:ENDCOND */
    return themeOrCodeToReturn
  }
  // PVSCL:IFCOND(CodebookUpdate, LINE)

  addTheme (theme) {
    if (LanguageUtils.isInstanceOf(theme, Theme)) {
      this.themes.push(theme)
      // Get new color for the theme
      const colors = ColorUtils.getDifferentColors(this.themes.length)
      const lastColor = colors.pop()
      theme.color = ColorUtils.setAlphaToColor(lastColor, Config.colors.minAlpha)
    }
  }

  updateTheme (theme, previousId) {
    if (LanguageUtils.isInstanceOf(theme, Theme)) {
      // Find item index using _.findIndex
      const index = _.findIndex(this.themes, (it) => {
        return it.id === theme.id || it.id === previousId
      })
      const previousTheme = this.themes[index]
      // Replace item at index using native splice
      this.themes.splice(index, 1, theme)
      theme.color = previousTheme.color
      // PVSCL:IFCOND(Marking,LINE)
      // Update Codebook Final Grade
      this.grade = Number(theme.grade) * (Number(theme.weight) / 10)
      for (let i = 0; i < this.themes.length; i++) {
        if ((theme.name !== this.themes[i].name)) {
          this.grade = Number(this.grade) + (Number(this.themes[i].grade) * (Number(this.themes[i].weight) / 10))
          this.grade = this.grade.toFixed(2)
        }
      }
      if (Number(this.grade) > 10) {
        this.grade = 10
      }
      // PVSCL:ENDCOND
    }
  }

  removeTheme (theme) {
    _.remove(this.themes, theme)
  }
  // PVSCL:ENDCOND
  // PVSCL:IFCOND(MoodleProvider, LINE)

  static createCodebookFromObject (rubric) {
    // Instance rubric object
    const instancedCodebook = Object.assign(new Codebook(rubric))
    // Instance themes and codes
    for (let i = 0; i < rubric.themes.length; i++) {
      instancedCodebook.themes[i] = Theme.createThemeFromObject(rubric.themes[i], instancedCodebook)
    }
    return instancedCodebook
  }
  // PVSCL:ENDCOND
  // PVSCL:IFCOND(ExportCodebook or Export, LINE)

  toObjects (name) {
    const object = {
      name: name/* PVSCL:IFCOND(Marking) */,
      grade: this.grade/* PVSCL:ENDCOND */,
      definition: []
    }
    // For each criteria create the object
    for (let i = 0; i < this.themes.length; i++) {
      const theme = this.themes[i]
      if (LanguageUtils.isInstanceOf(theme, Theme)) {
        object.definition.push(theme.toObjects())
      }
    }
    return object
  }
  // PVSCL:ENDCOND
  // PVSCL:IFCOND(PreviousAssignments, LINE)

  getUrlToStudentAssignmentForTeacher (studentId) {
    if (studentId && this.moodleEndpoint && this.cmid) {
      return this.moodleEndpoint + 'mod/assign/view.php?id=' + this.cmid + '&rownum=0&action=grader&userid=' + studentId
    } else {
      return null
    }
  }

  getUrlToStudentAssignmentForStudent (studentId) {
    if (studentId && this.moodleEndpoint && this.cmid) {
      return this.moodleEndpoint + 'mod/assign/view.php?id=' + this.cmid
    } else {
      return null
    }
  }
  // PVSCL:ENDCOND

  getThemeByName (name) {
    if (_.isString(name)) {
      return this.themes.find(theme => theme.name === name)
    } else {
      return null
    }
  }
}

export default Codebook
