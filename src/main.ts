import * as core from '@actions/core'
import * as github from '@actions/github'
import {removeIgnoreTaskListText, getTasks, createTaskListText} from './utils'
import {RestEndpointMethodTypes} from '@octokit/plugin-rest-endpoint-methods'
import {PullRequestEvent, PushEvent} from '@octokit/webhooks-types'

async function run(): Promise<void> {
  try {
    const body = github.context.payload.pull_request?.body

    const token = core.getInput('repo-token', {required: true})
    const handleMissingTaskAsError = core.getBooleanInput('missing-as-error')
    const githubApi = github.getOctokit(token)
    const appName = 'Task Completed Checker'

    let sha = ''
    if (github.context.eventName === 'push') {
      const pushPayload = github.context.payload as PushEvent
      if (!pushPayload.head_commit) {
        core.warning('Unknown commit, ignoring this push event')
        return
      }
      sha = pushPayload.head_commit.id
    }
    if (github.context.eventName === 'pull_request') {
      const prPayload = github.context.payload as PullRequestEvent
      sha = prPayload.pull_request?.head.sha
    }
    if (!sha) {
      core.warning('Unknown sha, ignoring this action')
      return
    }
    core.debug(`The head commit is: ${sha}`)

    if (!body) {
      core.info('no task list and skip the process.')
      await githubApi.rest.checks.create({
        name: appName,
        head_sha: sha,
        status: 'completed',
        conclusion: 'success',
        completed_at: new Date().toISOString(),
        output: {
          title: appName,
          summary: 'No task list',
          text: 'No task list'
        },
        owner: github.context.repo.owner,
        repo: github.context.repo.repo
      })
      return
    }

    const result = removeIgnoreTaskListText(body)

    core.debug('creates a list of tasks which removed ignored task: ')
    core.debug(result)

    const tasks = getTasks(result)

    const isTaskCompleted = tasks.uncompleted.length === 0

    const text = createTaskListText(tasks)

    core.debug('creates a list of completed tasks and uncompleted tasks: ')
    core.debug(text)

    const check: RestEndpointMethodTypes['checks']['create']['parameters'] = {
      name: appName,
      head_sha: sha,
      output: {
        title: appName,
        summary: isTaskCompleted
          ? 'All tasks are completed!'
          : 'Some tasks are uncompleted!',
        text
      },
      owner: github.context.repo.owner,
      repo: github.context.repo.repo
    }
    if (isTaskCompleted) {
      core.debug('Task is completed')
      check.status = 'completed'
      check.conclusion = 'success'
      check.completed_at = new Date().toISOString()
    } else if (handleMissingTaskAsError) {
      core.debug('Uncompleted tasks - mark as error')
      check.status = 'completed'
      check.conclusion = 'failure'
      check.completed_at = new Date().toISOString()
    } else {
      core.debug('Uncompleted tasks - mark as pending')
      check.status = 'in_progress'
    }
    await githubApi.rest.checks.create(check)
  } catch (error) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    core.setFailed(error.message)
  }
}

void run()
