import MoodleClientManager from '../../moodle/MoodleClientManager'
import MoodleUtils from '../../moodle/MoodleUtils'
import Alerts from '../../utils/Alerts'
import _ from 'lodash'
import Config from '../../Config'
import Events from '../../Events'
import Commenting from '../purposes/Commenting'
// const linkifyUrls = require('linkify-urls')

class MoodleReport {
  constructor () {
    this.moodleClientManager = null
    this.events = {}
  }

  init (callback) {
    console.debug('Initializing moodle report')
    this.moodleClientManager = new MoodleClientManager(window.abwa.codebookManager.codebookReader.codebook.moodleEndpoint)
    this.moodleClientManager.init(() => {
      if (_.isFunction(callback)) {
        console.debug('Initialized moodle report')
        callback()
      }
    })
    // TODO Listens when annotation is created, updated, deleted or codeToAll
    this.initEventListeners()
  }

  initEventListeners (callback) {
    this.events.annotatedContentManagerUpdatedEvent = { element: document, event: Events.annotatedContentManagerUpdated, handler: this.createUpdateMoodleFromMarksEventListener() }
    this.events.annotatedContentManagerUpdatedEvent.element.addEventListener(this.events.annotatedContentManagerUpdatedEvent.event, this.events.annotatedContentManagerUpdatedEvent.handler, false)
    if (_.isFunction(callback)) {
      callback()
    }
  }

  createUpdateMoodleFromMarksEventListener () {
    return () => {
      const annotatedThemes = window.abwa.annotatedContentManager.annotatedThemes
      window.abwa.moodleReport.updateMoodleFromMarks(annotatedThemes, (err) => {
        if (err) {
          Alerts.errorAlert({
            text: 'Unable to push marks to moodle, please make sure that you are logged in Moodle and try it again.' + chrome.i18n.getMessage('ContactAdministrator', [err.message, err.stack]),
            title: 'Unable to update marks in moodle'
          })
        } else {
          Alerts.temporalAlert({
            text: 'The mark is updated in moodle',
            title: 'Correctly marked',
            type: Alerts.alertType.success,
            toast: true
          })
        }
      })
    }
  }

  updateMoodleFromMarks (annotatedThemes, callback) {
    // Get all code annotations
    let annotations = []
    for (let i = 0; i < annotatedThemes.length; i++) {
      const themeId = annotatedThemes[i].theme.id
      const currentlyAnnotatedCode = window.abwa.annotatedContentManager.searchAnnotatedCodeForGivenThemeId(themeId)
      if (currentlyAnnotatedCode) {
        const codeAnnotaions = currentlyAnnotatedCode.annotations
        annotations.push(codeAnnotaions)
      }
    }
    annotations = _.flatten(annotations)
    // let annotations = _.flatten(_.map(annotatedThemes, annotatedTheme => annotatedTheme.annotations))
    // Get student id
    const studentId = window.abwa.targetManager.fileMetadata.studentId
    // Filter from search only the annotations which are used to classify and are from this cmid
    const cmid = window.abwa.codebookManager.codebookReader.codebook.cmid
    annotations = _.filter(annotations, (anno) => {
      return anno.uri !== window.abwa.groupSelector.currentGroup.links.html &&
        _.find(anno.tags, (tag) => {
          return tag === 'cmid:' + cmid
        })
    })
    const marks = _.map(annotations, (annotation) => {
      const criteriaName = _.find(annotation.tags, (tag) => {
        return tag.includes(Config.namespace + ':' + Config.tags.grouped.relation + ':')
      }).replace(Config.namespace + ':' + Config.tags.grouped.relation + ':', '')
      let levelName = _.find(annotation.tags, (tag) => {
        return tag.includes(Config.namespace + ':' + Config.tags.grouped.subgroup + ':')
      })
      if (levelName) {
        levelName = levelName.replace(Config.namespace + ':' + Config.tags.grouped.subgroup + ':', '')
      } else {
        levelName = null
      }
      const url = MoodleUtils.createURLForAnnotation({ annotation, studentId, courseId: window.abwa.codebookManager.codebookReader.codebook.courseId, cmid: cmid })
      // Construct feedback
      const comment = annotation.getBodyForPurpose(Commenting.purpose)
      const text = comment ? comment.value : ''
      let feedbackCommentElement = ''
      if (text) {
        /* let urlizedText = linkifyUrls(text, {
          attributes: {
            target: '_blank'
          }
        }) */
        const urlizedText = text
        const quoteSelector = _.find(annotation.target[0].selector, (selector) => { return selector.type === 'TextQuoteSelector' })
        if (quoteSelector) {
          feedbackCommentElement = '<b>' + urlizedText + '</b><br/><a href="' + url + '">See in context</a>'
        }
      } else {
        feedbackCommentElement = '<b>-</b><br/><a href="' + url + '">See in context</a>'
      }
      return { criteriaName, levelName, text, url, feedbackCommentElement }
    })
    console.log(marks)
    // Reorder criterias as same as are presented in rubric
    const sortingArr = _.map(window.abwa.codebookManager.codebookReader.codebook.themes, 'name')
    marks.slice().sort((a, b) => {
      return sortingArr.indexOf(a.criteriaName) - sortingArr.indexOf(b.criteriaName)
    })
    console.log(marks)
    // Get for each criteria name and mark its corresponding criterionId and level from window.abwa.rubric
    const criterionAndLevels = this.getCriterionAndLevel(marks)
    const feedbackComment = this.getFeedbackComment(marks)
    // Compose moodle data
    const moodleGradingData = this.composeMoodleGradingData({
      criterionAndLevels,
      userId: studentId,
      assignmentId: window.abwa.codebookManager.codebookReader.codebook.assignmentId,
      feedbackComment: feedbackComment
    })
    // Update student grading in moodle
    this.moodleClientManager.updateStudentGradeWithRubric(moodleGradingData, (err) => {
      if (err) {
        if (_.isFunction(callback)) {
          callback(err)
        }
      } else {
        if (_.isFunction(callback)) {
          callback(null)
        }
      }
    })
  }

  getCriterionAndLevel (marks) {
    const annotationGuide = window.abwa.codebookManager.codebookReader.codebook
    const criterionAndLevel = []
    for (let i = 0; i < marks.length; i++) {
      const mark = marks[i]
      const criteria = _.find(annotationGuide.themes, (theme) => {
        return theme.name === mark.criteriaName
      })
      let level = _.find(criteria.codes, (code) => {
        return code.name === mark.levelName
      })
      if (_.isUndefined(level)) {
        level = { levelId: -1 }
      }
      const remark = mark.text
      criterionAndLevel.push({ criterionId: criteria.moodleCriteriaId, levelid: level.moodleLevelId, remark })
    }
    console.log(criterionAndLevel)
    const resultingMarks = {}
    // TODO Append links if shared
    // Merge remarks with same criterionId and append remark
    _.forEach(criterionAndLevel, (crit) => {
      const remark = _.has(resultingMarks[crit.criterionId], 'remark') ? resultingMarks[crit.criterionId].remark + '\n\n' + crit.remark : crit.remark
      const levelid = crit.levelid
      resultingMarks[crit.criterionId] = { remark: remark, levelid: levelid }
    })
    // Convert merge object to an array
    return _.map(resultingMarks, (mark, key) => { return { criterionId: key, levelid: mark.levelid, remark: mark.remark } })
  }

  getFeedbackComment (marks) {
    let feedbackComment = '<h2>How to see feedback in your assignment?</h2><ul>' +
      '<li><a target="_blank" href="https://chrome.google.com/webstore/detail/markgo/kjedcndgienemldgjpjjnhjdhfoaocfa">Install Mark&Go</a></li>' +
      '<li><a target="_blank" href="' + window.abwa.groupSelector.currentGroup.links.html + '">Join feedback group</a></li>' +
      '</ul><hr/>' // TODO i18n
    const groupedMarksArray = _.values(_.groupBy(marks, 'criteriaName'))
    _.forEach(groupedMarksArray, (markGroup) => {
      // Criteria + level
      const criteria = markGroup[0].criteriaName
      const levelId = markGroup[0].levelName
      feedbackComment += '<h3>Criteria: ' + criteria + ' - Mark: ' + levelId + '</h3><br/>'
      // Comments
      _.forEach(markGroup, (mark) => {
        feedbackComment += mark.feedbackCommentElement + '<br/>'
      })
      // hr
      feedbackComment += '<hr/>'
    })
    return feedbackComment
  }

  composeMoodleGradingData ({ criterionAndLevels, userId, assignmentId, feedbackComment }) {
    const rubric = { criteria: [] }
    for (let i = 0; i < criterionAndLevels.length; i++) {
      const criterionAndLevel = criterionAndLevels[i]
      if (criterionAndLevel.levelid > -1) { // If it is -1, the student is not grade for this criteria
        rubric.criteria.push({
          criterionid: criterionAndLevel.criterionId,
          fillings: [
            {
              criterionid: '0',
              levelid: criterionAndLevel.levelid,
              remark: criterionAndLevel.remark,
              remarkformat: 1
            }
          ]
        })
      }
    }
    return {
      userid: userId + '',
      assignmentid: assignmentId,
      attemptnumber: '-1',
      addattempt: 1,
      workflowstate: '',
      applytoall: 1,
      grade: '0',
      advancedgradingdata: { rubric: rubric },
      plugindata: {
        assignfeedbackcomments_editor: {
          format: '1', // HTML
          text: feedbackComment
        }
      }
    }
  }

  destroy (callback) {
    // Remove the event listeners
    const events = _.values(this.events)
    for (let i = 0; i < events.length; i++) {
      events[i].element.removeEventListener(events[i].event, events[i].handler)
    }
    if (_.isFunction(callback)) {
      callback()
    }
  }
}

export default MoodleReport
