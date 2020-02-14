const _ = require('lodash')

class AnnotationUtils {
  static getTagFromAnnotation (annotation, prefix) {
    return _.find(annotation.tags, (tag) => {
      return tag.startsWith(prefix)
    })
  }

  static getTagSubstringFromAnnotation (annotation, prefix) {
    let tag = AnnotationUtils.getTagFromAnnotation(annotation, prefix)
    if (tag) {
      return tag.replace(prefix, '')
    } else {
      return null
    }
  }

  static modifyTag (annotation, oldTag, newTag) {
    let index = _.findIndex(annotation.tags, (tag) => { return oldTag === tag })
    if (index > -1) {
      annotation.tags[index] = newTag
      return annotation
    } else {
      return null
    }
  }

  static isReplyOf (formerAnnotation, replyAnnotation) {
    if (_.has(replyAnnotation, 'references')) {
      return !!_.find(replyAnnotation.references, (ref) => { return ref === formerAnnotation.id })
    } else {
      return false
    }
  }

  static areFromSameDocument (a, b) {
    // Check by target.source
    if (_.has(a, 'target[0].source') && _.has(b, 'target[0].source')) {
      // If source is object (w3c standard)
      if (_.isObject(a.target[0].source) && _.isObject(b.target[0].source)) {
        if (_.intersection(_.values(a.target[0].source), _.values(b.target[0].source)).length > 0) {
          return true
        }
      } else if (_.isString(a.target[0].source) && _.isString(b.target[0].source)) { // If source is string (hypothes.is use case)
        if (a.target[0].source === b.target[0].source) {
          return true
        }
      }
    }
    // Check by uri
    return a.uri === b.uri
  }

  /**
   * Get from an annotation the most reliable URI to locate the annotated resource or target
   * @param annotation
   */
  static getReliableURItoLocateTarget (annotation) {
    if (_.has(annotation, 'target[0].source')) {
      let source = annotation.target[0].source
      // The most reliable source is DOI
      if (source.doi) {
        return source.doi
      }
      // The next more reliable URI is the URL, but only if it is not a local URL (protocol = file:) or is URN (protocol = urn:)
      if (source.url) {
        let protocol = new URL(source.url).protocol
        if (protocol !== 'file:' && protocol !== 'urn:') {
          return source.url
        }
      }
    }
    // For Hypothes.is it is not stored in source, is stored in documentMetadata
    if (_.has(annotation, 'documentMetadata')) {
      let documentMetadata = annotation.documentMetadata
      // The most reliable source is DOI
      if (_.has(documentMetadata, 'dc.identifier[0]')) {
        return documentMetadata.dc.identifier[0]
      }
      // The next more reliable URI is the URL, but only if it is not a local URL (protocol = file:)
      let reliableURL = annotation.documentMetadata.link.find(link => {
        let protocol = new URL(link.href).protocol
        return protocol !== 'urn:' && protocol !== 'file:'
      })
      if (reliableURL) {
        return reliableURL.href
      }
    }
    if (new URL(annotation.uri).protocol !== 'file:') {
      return annotation.uri
    }
    return null
  }
}

module.exports = AnnotationUtils
