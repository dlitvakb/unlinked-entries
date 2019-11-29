import React, { useEffect } from 'react'
import { css } from 'emotion'
import { render } from 'react-dom'
import PropTypes from 'prop-types'
import { init, locations } from 'contentful-ui-extensions-sdk'
import {
  Spinner, Heading, Paragraph, EntityList, EntityListItem, DropdownList, DropdownListItem, Button } from '@contentful/forma-36-react-components'
import '@contentful/forma-36-react-components/dist/styles.css'
import '@contentful/forma-36-fcss/dist/styles.css'
import './index.css'

const styles = {
  entry: css({
    figure: css({
      display: 'none'
    })
  })
}

export class UnlinkedEntries extends React.Component {
  constructor(props) {
    super(props)
    this.sdk = props.sdk

    this.state = {
      contentTypes: [],
      entries: [],
      loading: true,
      updating: false,
      defaultLocale: this.sdk.locales.default
    }

    this.onOpenEntry = this.onOpenEntry.bind(this)
    this.onRefetch = this.onRefetch.bind(this)
  }

  static propTypes = {
    sdk: PropTypes.object.isRequired
  }

  async componentDidMount() {
    const contentTypes = (await this.sdk.space.getContentTypes()).items
    const entries = await this.fetchUnlinkedEntries(contentTypes)
    this.setState({contentTypes, entries, loading: false})
  }

  contentTypeFor(entry) {
    return this.state.contentTypes.find((ct) => ct.sys.id === entry.sys.contentType.sys.id)
  }

  displayFieldFor(entry, contentType) {
    return (entry.fields[(contentType || this.contentTypeFor(entry)).displayField] || {})[this.state.defaultLocale]
  }

  async fetchUnlinkedEntries(contentTypes) {
    let unlinkedEntries = []
    const { defaultLocale } = this.state
    contentTypes = contentTypes || this.state.contentTypes
    for (let ctIndex = 0; ctIndex < contentTypes.length; ctIndex++) {
      const ct = contentTypes[ctIndex]
      let linkFields = ct.fields.filter(f => f.type === 'Link' && f.linkType === 'Entry')
      let linkArrayFields = ct.fields.filter(f => f.type === 'Array' && f.items.type === 'Link' && f.items.linkType === 'Entry')

      const totalEntries = (await this.sdk.space.getEntries({content_type: ct.sys.id, limit: 0})).total
      const perPage = 1000
      const totalPages = Math.floor(totalEntries / perPage)
      for (let page = 0; page <= totalPages; page++) {
        let entries = (await this.sdk.space.getEntries({content_type: ct.sys.id, limit: perPage, skip: page * perPage})).items
        for (let eIndex = 0; eIndex < entries.length; eIndex++) {
          const e = entries[eIndex]

          // if it has any children - it's not unlinked
          if (linkFields.some(f => {
            return e.fields[f.id] && e.fields[f.id][defaultLocale]
          })) {
           continue
          }
          if (linkArrayFields.some(f => {
            return e.fields[f.id] && e.fields[f.id][defaultLocale] && e.fields[f.id][defaultLocale].some(l => !!l.sys.id)
          })) {
            continue
          }

          // if it has any inbound links - it's not unlinked
          if ((await this.sdk.space.getEntries({links_to_entry: e.sys.id})).total > 0) {
            continue
          }

          unlinkedEntries.push(e)
        }
      }
    }

    return unlinkedEntries
  }

  async onOpenEntry(entry) {
window.open(`https://app.contentful.com/spaces/${entry.sys.space.sys.id}/environments/${this.props.sdk.ids.environment}/entries/${entry.sys.id}`, '_blank')
  }

  async onRefetch() {
    this.setState({updating: true})
    const entries = await this.fetchUnlinkedEntries(this.state.contentTypes)
    this.setState({entries, updating: false})
  }

  render() {
    const { loading, updating } = this.state


    return (
      <>
        <Heading>Unlinked Entries</Heading>

        { loading && (<small><Spinner /> Loading entries...</small>)}
        { updating && (<small><Spinner /> Updating entry list...</small>)}

        { !loading && (
          (this.state.entries || []).length > 0 ? (
            <EntityList>
            {this.state.entries.map((e, i) => {
              let contentType = this.contentTypeFor(e)
              return <EntityListItem
                className={styles.entry}
                key={`${i}-${e.sys.id}`}
                title={this.displayFieldFor(e, contentType)}
                status="published"
                contentType={contentType.name}
                description={`Entry ID: ${e.sys.id}`}
                dropdownListElements={(
                  <DropdownList>
                    <DropdownListItem onClick={async () => await this.onOpenEntry(e)}>Open in a new tab</DropdownListItem>
                  </DropdownList>
                )}
              />
            })}
            </EntityList>
          ) : (
            <Paragraph>No unlinked entries found</Paragraph>
          )
        )}
        { !(loading || updating) && (
          <div>
            <Button
              testId="refetch"
              onClick={this.onRefetch}>
              Refetch unlinked entries
            </Button>
          </div>
        )}
      </>
    )
  }
}

export function SidebarExtension(props) {
  useEffect(() => {
    return props.sdk.window.startAutoResizer()
  }, [props.sdk])

  return (
    <Button
      testId="open-page-extension"
      onClick={() => {
        props.sdk.navigator.openPageExtension({ path: '/' })
      }}>
      Open page extension
    </Button>
  )
}

SidebarExtension.propTypes = {
  sdk: PropTypes.object.isRequired
}

init(sdk => {
  if (sdk.location.is(locations.LOCATION_PAGE)) {
    render(<UnlinkedEntries sdk={sdk} />, document.getElementById('root'))
  } else if (sdk.location.is(locations.LOCATION_ENTRY_SIDEBAR)) {
    render(<SidebarExtension sdk={sdk} />, document.getElementById('root'))
  } else {
    return null
  }
})

/**
 * By default, iframe of the extension is fully reloaded on every save of a source file.
 * If you want to use HMR (hot module reload) instead of full reload, uncomment the following lines
 */
// if (module.hot) {
//   module.hot.accept()
// }
