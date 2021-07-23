import * as core from '@actions/core'
import * as github from '@actions/github'
import {removeIgnoreTaskListText, getTasks, createTaskListText} from './utils'
import {RestEndpointMethodTypes} from '@octokit/plugin-rest-endpoint-methods'
import {IssueCommentEvent} from '@octokit/webhooks-types'

async function run(): Promise<void> {
  try {
    const startTime = (new Date).toISOString();

    const token = core.getInput('repo-token', {required: true})
    const handleUncompletedTaskAsError = core.getBooleanInput('uncompleted-as-error')
    const scanComments = core.getBooleanInput('scan-comments')
    const githubApi = github.getOctokit(token)
    const appName = 'Task Completed Checker'

    let pr: any = github.context.payload.pull_request
    core.debug('Received payload: ' + JSON.stringify(github.context.payload))
    // check if this is an issue rather than pull event
    if (github.context.eventName == 'issue_comment' && ! pr) {
      const commentPayload = github.context.payload as IssueCommentEvent
      // if so we need to make sure this is for a PR only
      if (! commentPayload.issue.pull_request) {
        core.info('Triggered for issue rather than PR, exit...')
        return;
      }
      // & lookup the PR it's for to continue
      let response = await githubApi.rest.pulls.get({
        ...github.context.repo,
        pull_number: commentPayload.issue.number
      });
      pr = response.data;
    }

    const tasks = getTasks(pr.body)

    if (scanComments) {
      let comments: any = []
      // lookup comments on the PR
      const commentsResponse = await githubApi.rest.issues.listComments({
        ...github.context.repo,
        per_page: 100,
        issue_number: pr.number
      })
      if (commentsResponse.data.length) {
        comments = comments.concat(commentsResponse.data);
      }

      // as well as review comments
      const reviewCommentsResponse = await githubApi.rest.pulls.listReviews({
        ...github.context.repo,
        per_page: 100,
        pull_number: pr.number
      })
      if (reviewCommentsResponse.data.length) {
        comments = comments.concat(reviewCommentsResponse.data);
      }

      // and diff level comments on reviews
      const reviewDiffCommentsResponse = await githubApi.rest.pulls.listReviewComments({
        ...github.context.repo,
        per_page: 100,
        pull_number: pr.number
      })
      if (reviewDiffCommentsResponse.data.length) {
        comments = comments.concat(reviewDiffCommentsResponse.data);
      }

      // sort comments from oldest to newest
      comments.sort((a: any, b: any) => (a.created_at || a.submitted_at) > (b.created_at || b.submitted_at) ? 1 : -1)

      for (const comment of comments) {
        let commentTasks = getTasks(comment.body);
        tasks.completed = tasks.completed.concat(commentTasks.completed);
        tasks.uncompleted = tasks.uncompleted.concat(commentTasks.uncompleted);
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
      output = {
        title: appName,
        summary: 'Some tasks are uncompleted!',
        text
      }
    }
    const check: RestEndpointMethodTypes['checks']['create']['parameters'] = {
      name: appName,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
      head_sha: pr.head.sha,
      output,
      started_at: startTime,
      ...github.context.repo
    }
    if (isTaskCompleted) {
      check.status = 'completed'
      check.conclusion = 'success'
      check.completed_at = new Date().toISOString()
      core.debug('Task is completed: ' + JSON.stringify(check))
    } else if (handleUncompletedTaskAsError) {
      check.status = 'completed'
      check.conclusion = 'failure'
      check.completed_at = new Date().toISOString()
      core.debug('Uncompleted tasks - mark as error: ' + JSON.stringify(check))
    } else {
      check.status = 'in_progress'
      core.debug('Uncompleted tasks - mark as pending: ' + JSON.stringify(check))
    }
    await githubApi.rest.checks.create(check)
  } catch (error) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    core.setFailed(error.message)
  }
}

void run()
