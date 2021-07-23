import * as core from '@actions/core'
import * as github from '@actions/github'
import {removeIgnoreTaskListText, getTasks, createTaskListText} from './utils'
import {RestEndpointMethodTypes} from '@octokit/plugin-rest-endpoint-methods'

async function run(): Promise<void> {
  try {
    const body = github.context.payload.pull_request?.body

    const token = core.getInput('repo-token', {required: true})
    const handleUncompletedTaskAsError = core.getBooleanInput('uncompleted-as-error')
    const scanComments = core.getBooleanInput('scan-comments')
    const githubApi = github.getOctokit(token)
    const appName = 'Task Completed Checker'

    if (!body) {
      core.info('no task list and skip the process.')
      await githubApi.rest.checks.create({
        name: appName,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
        head_sha: github.context.payload.pull_request?.head.sha,
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
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
      head_sha: github.context.payload.pull_request?.head.sha,
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
    } else if (handleUncompletedTaskAsError) {
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
