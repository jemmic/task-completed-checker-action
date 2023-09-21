import * as core from '@actions/core'
import * as github from '@actions/github'
import {getTasks, createTaskListText} from './utils'
import {RestEndpointMethodTypes} from '@octokit/plugin-rest-endpoint-methods'
import {IssueCommentEvent} from '@octokit/webhooks-types'

interface simplePR {
  body?: string | null
  number: number
  head: {
    sha: string
  }
}

interface simpleComment {
  body?: string | undefined
  created_at?: string
  submitted_at?: string
}

async function run(): Promise<void> {
  try {
    const startTime = new Date().toISOString()

    const token = core.getInput('repo-token', {required: true})
    const handleUncompletedTaskAsError = core.getBooleanInput('uncompleted-as-error')
    const scanComments = core.getBooleanInput('scan-comments')
    const githubApi = github.getOctokit(token)
    const appName = 'Task Completed Checker'

    let pr: simplePR | undefined = github.context.payload.pull_request as simplePR | undefined
    core.debug(`Received payload: ${JSON.stringify(github.context.payload)}`)
    // check if this is an issue rather than pull event
    if (github.context.eventName === 'issue_comment' && !pr) {
      const commentPayload = github.context.payload as IssueCommentEvent
      // if so we need to make sure this is for a PR only
      if (!commentPayload.issue.pull_request) {
        core.info('Triggered for issue rather than PR, exit...')
        return
      }
      // & lookup the PR it's for to continue
      const response = await githubApi.rest.pulls.get({
        ...github.context.repo,
        pull_number: commentPayload.issue.number
      })
      pr = response.data
    }
    if (!pr) {
      core.warning('PR is unknown, exit...')
      return
    }

    const tasks = getTasks(pr.body)

    if (scanComments) {
      let comments: simpleComment[] = []
      // lookup comments on the PR
      const commentsResponse = await githubApi.rest.issues.listComments({
        ...github.context.repo,
        per_page: 100,
        issue_number: pr.number
      })
      if (commentsResponse.data.length) {
        comments = comments.concat(commentsResponse.data)
      }

      // as well as review comments
      const reviewCommentsResponse = await githubApi.rest.pulls.listReviews({
        ...github.context.repo,
        per_page: 100,
        pull_number: pr.number
      })
      if (reviewCommentsResponse.data.length) {
        comments = comments.concat(reviewCommentsResponse.data)
      }

      // and diff level comments on reviews
      const reviewDiffCommentsResponse = await githubApi.rest.pulls.listReviewComments({
        ...github.context.repo,
        per_page: 100,
        pull_number: pr.number
      })
      if (reviewDiffCommentsResponse.data.length) {
        comments = comments.concat(reviewDiffCommentsResponse.data)
      }

      // sort comments from oldest to newest
      comments.sort((a, b) =>
        (a.created_at || a.submitted_at || '') > (b.created_at || b.submitted_at || '') ? 1 : -1
      )

      for (const comment of comments) {
        const commentTasks = getTasks(comment.body)
        tasks.completed = tasks.completed.concat(commentTasks.completed)
        tasks.uncompleted = tasks.uncompleted.concat(commentTasks.uncompleted)
      }
    }

    const isTaskCompleted = tasks.uncompleted.length === 0
    const text = createTaskListText(tasks)

    core.debug('created a list of completed tasks and uncompleted tasks:')
    core.debug(text)

    let output
    if (isTaskCompleted && tasks.completed.length === 0) {
      output = {
        title: appName,
        summary: 'No task list',
        text: 'No task list'
      }
    } else if (isTaskCompleted) {
      output = {
        title: appName,
        summary: 'All tasks are completed!',
        text
      }
    } else {
      const uncompleted = tasks.uncompleted.length
      const total = tasks.completed.length + tasks.uncompleted.length
      output = {
        title: appName,
        summary: `${uncompleted}/${total} task${uncompleted > 1 ? 's' : ''} still to be completed!`,
        text
      }
    }
    const check: RestEndpointMethodTypes['checks']['create']['parameters'] = {
      name: appName,
      head_sha: pr.head.sha,
      output,
      started_at: startTime,
      ...github.context.repo
    }
    if (isTaskCompleted) {
      check.status = 'completed'
      check.conclusion = 'success'
      check.completed_at = new Date().toISOString()
      core.debug(`Task is completed: ${JSON.stringify(check)}`)
    } else if (handleUncompletedTaskAsError) {
      check.status = 'completed'
      check.conclusion = 'failure'
      check.completed_at = new Date().toISOString()
      core.debug(`Uncompleted tasks - mark as error: ${JSON.stringify(check)}`)
    } else {
      check.status = 'in_progress'
      core.debug(`Uncompleted tasks - mark as pending: ${JSON.stringify(check)}`)
    }
    await githubApi.rest.checks.create(check)
  } catch (err) {
    core.setFailed((err as Error).message)
  }
}

void run()
